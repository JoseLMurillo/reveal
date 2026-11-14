import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import {
  ACCESS_CODE,
  participantMeFixture,
  publicEventFixture,
  SESSION_TOKEN,
} from "@/test/fixtures";

import { EventWelcomePage } from "./EventWelcomePage";

vi.mock("@/services/public", () => ({
  publicApi: {
    event: vi.fn(),
    status: vi.fn(),
    redeem: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    updateMe: vi.fn(),
    quota: vi.fn(),
  },
}));

const SLUG = "cumple-ana";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <MemoryRouter initialEntries={[`/e/${SLUG}`]}>
          <Routes>
            <Route path="/e/:slug" element={<EventWelcomePage />} />
            <Route path="/e/:slug/camera" element={<p>Pantalla de cámara</p>} />
          </Routes>
        </MemoryRouter>
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

describe("EventWelcomePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
  });

  it("muestra la información del evento y registra a un invitado", async () => {
    vi.mocked(publicApi.event).mockResolvedValue(publicEventFixture);
    vi.mocked(publicApi.register).mockResolvedValue({
      participant: participantMeFixture.participant,
      access: {
        code: ACCESS_CODE,
        url: `https://rollo.test/e/${SLUG}/a/${ACCESS_CODE}`,
        createdAt: "2026-11-13T15:00:00.000Z",
      },
      session: { token: SESSION_TOKEN, expiresAt: "2026-11-20T15:00:00.000Z" },
      registration: { limit: 10, used: 3, remaining: 7 },
      event: participantMeFixture.event,
      quota: participantMeFixture.quota,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /cumple de ana/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/quedan 8 de 10 lugares/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar al evento/i }));

    expect(await screen.findByText("Pantalla de cámara")).toBeInTheDocument();
    expect(publicApi.register).toHaveBeenCalledWith(SLUG, { displayName: "Marta" });

    const stored = window.localStorage.getItem(`rollo:participant:${SLUG}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({
      sessionToken: SESSION_TOKEN,
      accessCode: ACCESS_CODE,
    });
  });

  it("explica cuando el enlace público no existe", async () => {
    vi.mocked(publicApi.event).mockRejectedValue(
      new ApiError("Evento no encontrado.", { status: 404, code: "EVENT_NOT_FOUND" }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /este enlace no está disponible/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/aún no se haya publicado/i)).toBeInTheDocument();
  });

  it("no ofrece auto-registro si el evento es solo por invitación", async () => {
    vi.mocked(publicApi.event).mockResolvedValue({
      ...publicEventFixture,
      canRegister: false,
      registration: {
        limit: null,
        used: 0,
        remaining: null,
        enabled: false,
        open: false,
        reason: "disabled",
      },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /no acepta auto-registro/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrar al evento/i })).not.toBeInTheDocument();
  });

  it("exige el nombre cuando el organizador lo pidió", async () => {
    vi.mocked(publicApi.event).mockResolvedValue({
      ...publicEventFixture,
      requireName: true,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: /cómo te llamas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /entrar al evento/i }));

    await waitFor(() => {
      expect(screen.getByText(/el nombre no puede estar vacío/i)).toBeInTheDocument();
    });
    expect(publicApi.register).not.toHaveBeenCalled();
  });
});
