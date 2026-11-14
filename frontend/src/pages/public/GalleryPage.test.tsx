import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { publicGalleryFixture } from "@/test/fixtures";

import { GalleryPage } from "./GalleryPage";

vi.mock("@/services/public", () => ({
  publicApi: {
    gallery: vi.fn(),
    me: vi.fn(),
    redeem: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug="cumple-ana">
        <MemoryRouter initialEntries={["/e/cumple-ana/gallery"]}>
          <Routes>
            <Route path="/e/:slug/gallery" element={<GalleryPage />} />
          </Routes>
        </MemoryRouter>
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

describe("GalleryPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(publicApi.gallery).mockResolvedValue(publicGalleryFixture);
  });

  it("muestra la galería agrupada por días y autores", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /las fotos del evento/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 fotografías de 1 personas/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /13 nov 2026/i })).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /votar la mejor foto/i })).toHaveAttribute(
      "href",
      "/e/cumple-ana/vote",
    );
    expect(screen.getByRole("link", { name: /álbum/i })).toHaveAttribute(
      "href",
      "/album/album-cumple-ana",
    );
  });

  it("filtra por día y vuelve a todos los días", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /las fotos del evento/i });
    fireEvent.click(screen.getByRole("button", { name: /día 2/i }));

    await waitFor(() => {
      expect(publicApi.gallery).toHaveBeenLastCalledWith("cumple-ana", {
        token: null,
        day: "2026-11-13",
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: /todos los días/i }));
    await waitFor(() => {
      expect(publicApi.gallery).toHaveBeenLastCalledWith("cumple-ana", {
        token: null,
        day: undefined,
      });
    });
  });

  it("explica cuando la galería es privada", async () => {
    vi.mocked(publicApi.gallery).mockRejectedValue(
      new ApiError("Galería privada.", { status: 403, code: "FORBIDDEN" }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /esta galería es privada/i }),
    ).toBeInTheDocument();
  });

  it("abre el visor de una fotografía", async () => {
    renderPage();

    await screen.findByAltText("Foto de Ana");
    fireEvent.click(screen.getAllByRole("button", { name: /ampliar fotografía/i })[0]!);

    expect(
      await screen.findByRole("button", { name: /cerrar vista de la fotografía/i }),
    ).toBeInTheDocument();
  });
});
