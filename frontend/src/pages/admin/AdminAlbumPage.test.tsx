import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { adminApi } from "@/services/admin";
import { ApiError } from "@/services/api";
import { adminPhotoFixture, albumDetailFixture, EVENT_ID } from "@/test/fixtures";

import { AdminAlbumPage } from "./AdminAlbumPage";

vi.mock("@/services/admin", () => ({
  adminApi: {
    album: vi.fn(),
    generateAlbum: vi.fn(),
    updateAlbum: vi.fn(),
    albumZipUrl: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/events/${EVENT_ID}/album`]}>
        <Routes>
          <Route path="/admin/events/:id/album" element={<AdminAlbumPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminAlbumPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.albumZipUrl).mockReturnValue(
      `https://api.test/admin/events/${EVENT_ID}/export/zip`,
    );
  });

  it("permite generar el primer álbum", async () => {
    vi.mocked(adminApi.album).mockRejectedValue(
      new ApiError("Sin álbum.", { status: 404, code: "NOT_FOUND" }),
    );
    vi.mocked(adminApi.generateAlbum).mockResolvedValue(albumDetailFixture);

    renderPage();

    expect(await screen.findByRole("heading", { name: /preparar el álbum/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^título$/i), {
      target: { value: "Los mejores momentos" },
    });
    fireEvent.change(screen.getByLabelText(/subtítulo/i), {
      target: { value: "Una tarde para recordar." },
    });
    fireEvent.change(screen.getByLabelText(/visibilidad/i), {
      target: { value: "public" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generar álbum/i }));

    await waitFor(() => {
      expect(adminApi.generateAlbum).toHaveBeenCalledWith(EVENT_ID, {
        title: "Los mejores momentos",
        subtitle: "Una tarde para recordar.",
        visibility: "public",
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Los mejores momentos" }),
    ).toBeInTheDocument();
  });

  it("muestra la vista previa y publica el álbum", async () => {
    vi.mocked(adminApi.album).mockResolvedValue(albumDetailFixture);
    vi.mocked(adminApi.updateAlbum).mockResolvedValue({
      ...albumDetailFixture,
      album: {
        ...albumDetailFixture.album,
        status: "published",
        publishedAt: "2026-11-16T13:00:00.000Z",
      },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Los mejores momentos" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /descargar zip/i })).toHaveAttribute(
      "href",
      `https://api.test/admin/events/${EVENT_ID}/export/zip`,
    );

    fireEvent.click(screen.getByRole("button", { name: /^publicar$/i }));

    await waitFor(() => {
      expect(adminApi.updateAlbum).toHaveBeenCalledWith(EVENT_ID, { status: "published" });
    });
    expect((await screen.findAllByText("Publicado")).length).toBeGreaterThan(0);
  });

  it("despublica y guarda la visibilidad", async () => {
    vi.mocked(adminApi.album).mockResolvedValue({
      ...albumDetailFixture,
      album: {
        ...albumDetailFixture.album,
        status: "published",
        publishedAt: "2026-11-16T13:00:00.000Z",
      },
    });
    vi.mocked(adminApi.updateAlbum).mockResolvedValue(albumDetailFixture);

    renderPage();

    await screen.findByRole("heading", { name: "Los mejores momentos" });
    fireEvent.click(screen.getByRole("button", { name: /despublicar/i }));

    await waitFor(() => {
      expect(adminApi.updateAlbum).toHaveBeenCalledWith(EVENT_ID, { status: "draft" });
    });

    fireEvent.change(screen.getByLabelText(/visibilidad/i), {
      target: { value: "private" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar visibilidad/i }));

    await waitFor(() => {
      expect(adminApi.updateAlbum).toHaveBeenCalledWith(EVENT_ID, { visibility: "private" });
    });
  });

  it("muestra la portada y los autores de la vista previa", async () => {
    vi.mocked(adminApi.album).mockResolvedValue(albumDetailFixture);

    renderPage();

    await screen.findByRole("heading", { name: "Los mejores momentos" });
    expect(screen.queryByText(adminPhotoFixture.originalFilename)).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
  });
});
