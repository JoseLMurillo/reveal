import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { participantMeFixture, ACCESS_CODE, SESSION_TOKEN } from "@/test/fixtures";

import { ParticipantProvider, participantStorageKey, useParticipant } from "./ParticipantContext";

vi.mock("@/services/public", () => ({
  publicApi: {
    me: vi.fn(),
    redeem: vi.fn(),
    updateMe: vi.fn(),
    quota: vi.fn(),
  },
}));

const SLUG = "cumple-ana";

function Probe() {
  const { me, sessionToken, slug, isLoading, accessCode, clearSession } = useParticipant();

  return (
    <div>
      <span data-testid="slug">{slug}</span>
      <span data-testid="token">{sessionToken ?? "sin-sesion"}</span>
      <span data-testid="access-code">{accessCode ?? "sin-codigo"}</span>
      <span data-testid="name">{me?.participant.displayName ?? "sin-nombre"}</span>
      <span data-testid="loading">{isLoading ? "cargando" : "lista"}</span>
      <button type="button" onClick={clearSession}>
        Salir
      </button>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <Probe />
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

function storedValue(): { sessionToken: string; accessCode: string | null } | null {
  const raw = window.localStorage.getItem(participantStorageKey(SLUG));
  return raw ? (JSON.parse(raw) as { sessionToken: string; accessCode: string | null }) : null;
}

describe("ParticipantContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("usa la clave de almacenamiento por evento", () => {
    expect(participantStorageKey("cumple-ana")).toBe("rollo:participant:cumple-ana");
  });

  it("recupera la sesión guardada y carga el participante", async () => {
    window.localStorage.setItem(
      participantStorageKey(SLUG),
      JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
    );
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);

    renderProvider();

    expect(screen.getByTestId("loading")).toHaveTextContent("cargando");
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByTestId("token")).toHaveTextContent(SESSION_TOKEN);
    expect(screen.getByTestId("access-code")).toHaveTextContent(ACCESS_CODE);
    expect(screen.getByTestId("loading")).toHaveTextContent("lista");
    expect(publicApi.me).toHaveBeenCalledWith(SESSION_TOKEN);
  });

  it("ignora datos guardados corruptos", async () => {
    window.localStorage.setItem(participantStorageKey(SLUG), "{no-es-json");

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("lista");
    });
    expect(screen.getByTestId("token")).toHaveTextContent("sin-sesion");
    expect(publicApi.me).not.toHaveBeenCalled();
  });

  it("renueva la sesión expirada con el código de acceso guardado", async () => {
    window.localStorage.setItem(
      participantStorageKey(SLUG),
      JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
    );

    const nextToken = "c".repeat(64);
    vi.mocked(publicApi.me)
      .mockRejectedValueOnce(
        new ApiError("La sesión expiró.", {
          status: 401,
          code: "PARTICIPANT_SESSION_EXPIRED",
        }),
      )
      .mockResolvedValue(participantMeFixture);
    vi.mocked(publicApi.redeem).mockResolvedValue({
      participant: participantMeFixture.participant,
      session: { token: nextToken, expiresAt: "2026-11-20T15:00:00.000Z" },
      event: participantMeFixture.event,
      quota: participantMeFixture.quota,
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent(nextToken);
    });
    expect(publicApi.redeem).toHaveBeenCalledWith(SLUG, { accessCode: ACCESS_CODE });
    expect(storedValue()).toEqual({ sessionToken: nextToken, accessCode: ACCESS_CODE });
    expect(await screen.findByText("Ana")).toBeInTheDocument();
  });

  it("cierra la sesión si expiró y no hay código para renovarla", async () => {
    window.localStorage.setItem(
      participantStorageKey(SLUG),
      JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: null }),
    );
    vi.mocked(publicApi.me).mockRejectedValue(
      new ApiError("La sesión expiró.", {
        status: 401,
        code: "PARTICIPANT_SESSION_EXPIRED",
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent("sin-sesion");
    });
    expect(storedValue()).toBeNull();
    expect(publicApi.redeem).not.toHaveBeenCalled();
  });

  it("permite cerrar la sesión desde el contexto", async () => {
    window.localStorage.setItem(
      participantStorageKey(SLUG),
      JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
    );
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);

    renderProvider();

    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /salir/i }));

    expect(screen.getByTestId("token")).toHaveTextContent("sin-sesion");
    expect(storedValue()).toBeNull();
  });
});
