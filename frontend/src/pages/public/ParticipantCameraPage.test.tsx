import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { publicApi } from "@/services/public";
import { ACCESS_CODE, participantMeFixture, SESSION_TOKEN } from "@/test/fixtures";

import { ParticipantCameraPage } from "./ParticipantCameraPage";

vi.mock("@/services/public", () => ({
  publicApi: {
    event: vi.fn(),
    status: vi.fn(),
    redeem: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    updateMe: vi.fn(),
    quota: vi.fn(),
    uploadIntent: vi.fn(),
    confirmUpload: vi.fn(),
    releaseUpload: vi.fn(),
    photos: vi.fn(),
    deletePhoto: vi.fn(),
  },
}));

const SLUG = "cumple-ana";

function seedSession() {
  window.localStorage.setItem(
    `rollo:participant:${SLUG}`,
    JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <MemoryRouter initialEntries={[`/e/${SLUG}/camera`]}>
          <Routes>
            <Route path="/e/:slug" element={<p>Página del evento</p>} />
            <Route path="/e/:slug/camera" element={<ParticipantCameraPage />} />
          </Routes>
        </MemoryRouter>
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

describe("ParticipantCameraPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(publicApi.photos).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
    });
  });

  it("muestra la cuota real, la cámara y el rollo personal", async () => {
    seedSession();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Ana" })).toBeInTheDocument();
    expect(screen.getByText(/disponibles hoy/i)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /1 de 3 disparos usados/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /revela tus fotos de hoy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /elegir fotos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /mis fotos/i })).toBeInTheDocument();
    expect(screen.getByText(/America\/Mexico_City/)).toBeInTheDocument();
  });

  it("permite cambiar el nombre mientras el evento está activo", async () => {
    seedSession();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
    vi.mocked(publicApi.updateMe).mockResolvedValue({
      ...participantMeFixture,
      participant: { ...participantMeFixture.participant, displayName: "Ana María" },
    });

    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ana" });
    fireEvent.click(screen.getByRole("button", { name: /cambiar nombre/i }));

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
      target: { value: "  Ana María  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(publicApi.updateMe).toHaveBeenCalledWith(SESSION_TOKEN, {
        displayName: "Ana María",
      });
    });
  });

  it("explica cuando la cámara está cerrada por el estado del evento", async () => {
    seedSession();
    vi.mocked(publicApi.me).mockResolvedValue({
      ...participantMeFixture,
      event: {
        ...participantMeFixture.event,
        status: "finished",
        effectiveStatus: "finished",
      },
      permissions: { ...participantMeFixture.permissions, canUpload: false },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /el evento ya terminó/i }),
    ).toBeInTheDocument();
  });

  it("avisa cuando la persona participa de forma anónima", async () => {
    seedSession();
    vi.mocked(publicApi.me).mockResolvedValue({
      ...participantMeFixture,
      participant: {
        ...participantMeFixture.participant,
        displayName: null,
        anonymous: true,
      },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /invitado anónimo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/participando de forma anónima/i)).toBeInTheDocument();
  });
});
