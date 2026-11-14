import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { publicApi } from "@/services/public";
import {
  ACCESS_CODE,
  participantMeFixture,
  photoFixture,
  SESSION_TOKEN,
  voteFeedFixture,
} from "@/test/fixtures";

import { VotingPage } from "./VotingPage";

vi.mock("@/services/public", () => ({
  publicApi: {
    me: vi.fn(),
    redeem: vi.fn(),
    voteFeed: vi.fn(),
    vote: vi.fn(),
  },
}));

function seedSession() {
  window.localStorage.setItem(
    "rollo:participant:cumple-ana",
    JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug="cumple-ana">
        <MemoryRouter initialEntries={["/e/cumple-ana/vote"]}>
          <Routes>
            <Route path="/e/:slug" element={<p>Página del evento</p>} />
            <Route path="/e/:slug/vote" element={<VotingPage />} />
          </Routes>
        </MemoryRouter>
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

describe("VotingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
    vi.mocked(publicApi.voteFeed).mockResolvedValue(voteFeedFixture);
    vi.mocked(publicApi.vote).mockResolvedValue({
      photoId: photoFixture.id,
      value: "like",
      likes: 3,
      dislikes: 0,
    });
  });

  it("muestra la tarjeta, los botones y el ranking", async () => {
    seedSession();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /la mejor foto del día/i }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Beto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^me gusta$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^no me gusta$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mejor foto del día" })).toBeInTheDocument();
    expect(screen.getByText(/2 me gusta/i)).toBeInTheDocument();
    expect(publicApi.voteFeed).toHaveBeenCalledWith("cumple-ana", SESSION_TOKEN, {
      day: undefined,
    });
  });

  it("registra un me gusta anónimo", async () => {
    seedSession();
    renderPage();

    await screen.findByAltText("Foto de Beto");
    fireEvent.click(screen.getByRole("button", { name: /^me gusta$/i }));

    await waitFor(() => {
      expect(publicApi.vote).toHaveBeenCalledWith(SESSION_TOKEN, photoFixture.id, {
        value: "like",
      });
    });
    await waitFor(() => {
      expect(publicApi.voteFeed).toHaveBeenCalledTimes(2);
    });
  });

  it("registra un no me gusta", async () => {
    seedSession();
    renderPage();

    await screen.findByAltText("Foto de Beto");
    fireEvent.click(screen.getByRole("button", { name: /no me gusta/i }));

    await waitFor(() => {
      expect(publicApi.vote).toHaveBeenCalledWith(SESSION_TOKEN, photoFixture.id, {
        value: "dislike",
      });
    });
  });

  it("cambia de día y consulta el feed correspondiente", async () => {
    seedSession();
    renderPage();

    await screen.findByAltText("Foto de Beto");
    fireEvent.click(screen.getByRole("button", { name: /día 2 ·/i }));

    await waitFor(() => {
      expect(publicApi.voteFeed).toHaveBeenLastCalledWith("cumple-ana", SESSION_TOKEN, {
        day: "2026-11-13",
      });
    });
  });

  it("pide entrar al evento si no hay sesión", async () => {
    renderPage();

    expect(await screen.findByText(/página del evento/i)).toBeInTheDocument();
  });
});
