import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { publicAlbumFixture } from "@/test/fixtures";

import { AlbumPage } from "./AlbumPage";

vi.mock("@/services/public", () => ({
  publicApi: {
    album: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/album/album-cumple-ana"]}>
        <Routes>
          <Route path="/album/:slug" element={<AlbumPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AlbumPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicApi.album).mockResolvedValue(publicAlbumFixture);
    document.head.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
  });

  it("presenta el álbum editorial con estadísticas y autores", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Los mejores momentos" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/una tarde para revelar recuerdos/i)).toBeInTheDocument();
    expect(screen.getByText(/12 nov 2026 — 15 nov 2026/i)).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /votar la mejor foto/i })).toHaveAttribute(
      "href",
      "/e/cumple-ana/vote",
    );
  });

  it("marca la página como noindex", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Los mejores momentos" });
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, nofollow",
    );
  });

  it("explica cuando el álbum no está publicado", async () => {
    vi.mocked(publicApi.album).mockRejectedValue(
      new ApiError("No encontrado.", { status: 404, code: "NOT_FOUND" }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /todavía no es público/i }),
    ).toBeInTheDocument();
  });
});
