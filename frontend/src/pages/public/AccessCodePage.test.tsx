import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { ACCESS_CODE, participantMeFixture, SESSION_TOKEN } from "@/test/fixtures";

import { AccessCodePage } from "./AccessCodePage";

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

function renderPage(code = ACCESS_CODE) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <MemoryRouter initialEntries={[`/e/${SLUG}/a/${code}`]}>
          <Routes>
            <Route path="/e/:slug/a/:code" element={<AccessCodePage />} />
            <Route path="/e/:slug" element={<p>Página del evento</p>} />
            <Route path="/e/:slug/camera" element={<p>Pantalla de cámara</p>} />
          </Routes>
        </MemoryRouter>
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

function redeemResponse() {
  return {
    participant: participantMeFixture.participant,
    session: { token: SESSION_TOKEN, expiresAt: "2026-11-20T15:00:00.000Z" },
    event: participantMeFixture.event,
    quota: participantMeFixture.quota,
  };
}

describe("AccessCodePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
  });

  it("canjea el enlace, guarda la sesión y limpia el código de la URL", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    vi.mocked(publicApi.redeem).mockResolvedValue(redeemResponse());

    renderPage();

    expect(await screen.findByText("Pantalla de cámara")).toBeInTheDocument();
    expect(publicApi.redeem).toHaveBeenCalledWith(SLUG, { accessCode: ACCESS_CODE });
    expect(replaceState).toHaveBeenCalledWith(null, "", `/e/${SLUG}`);

    const stored = window.localStorage.getItem(`rollo:participant:${SLUG}`);
    expect(JSON.parse(stored ?? "{}")).toMatchObject({
      sessionToken: SESSION_TOKEN,
      accessCode: ACCESS_CODE,
    });
  });

  it("pide el nombre cuando el código lo exige", async () => {
    vi.mocked(publicApi.redeem)
      .mockRejectedValueOnce(
        new ApiError("Escribe tu nombre.", { status: 400, code: "NAME_REQUIRED" }),
      )
      .mockResolvedValueOnce(redeemResponse());

    renderPage();

    expect(await screen.findByRole("heading", { name: /dinos tu nombre/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
      target: { value: "Luis" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar al evento/i }));

    expect(await screen.findByText("Pantalla de cámara")).toBeInTheDocument();
    expect(publicApi.redeem).toHaveBeenLastCalledWith(SLUG, {
      accessCode: ACCESS_CODE,
      displayName: "Luis",
    });
  });

  it("rechaza un código con formato inválido sin llamar a la API", async () => {
    renderPage("corto");

    expect(
      await screen.findByRole("heading", { name: /este enlace ya no es válido/i }),
    ).toBeInTheDocument();
    expect(publicApi.redeem).not.toHaveBeenCalled();
  });

  it("muestra el estado inválido cuando el servidor rechaza el código", async () => {
    vi.mocked(publicApi.redeem).mockRejectedValue(
      new ApiError("El enlace no es válido.", {
        status: 404,
        code: "ACCESS_CODE_INVALID",
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /este enlace ya no es válido/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /ir a la página del evento/i })).toHaveAttribute(
      "href",
      `/e/${SLUG}`,
    );
  });
});
