import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { adminApi } from "@/services/admin";
import { ApiError } from "@/services/api";
import {
  adminActivityFixture,
  adminPhotoFixture,
  adminPhotoStatsFixture,
  EVENT_ID,
} from "@/test/fixtures";

import { EventPhotosPage } from "./EventPhotosPage";

vi.mock("@/services/admin", () => ({
  adminApi: {
    listPhotos: vi.fn(),
    deletePhoto: vi.fn(),
    downloadPhotoUrl: vi.fn(),
    photoStats: vi.fn(),
    activity: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/events/${EVENT_ID}/photos`]}>
        <Routes>
          <Route path="/admin/events/:id/photos" element={<EventPhotosPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockPage() {
  vi.mocked(adminApi.photoStats).mockResolvedValue(adminPhotoStatsFixture);
  vi.mocked(adminApi.listPhotos).mockResolvedValue({
    data: [adminPhotoFixture],
    meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
  });
  vi.mocked(adminApi.activity).mockResolvedValue({
    data: [adminActivityFixture],
    meta: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
  vi.mocked(adminApi.downloadPhotoUrl).mockReturnValue(
    "https://api.test/admin/events/event/photos/photo/download",
  );
}

describe("EventPhotosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage();
  });

  it("muestra estadísticas, fotos, días y actividad", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Cumple de Ana" })).toBeInTheDocument();
    expect(screen.getByText("184")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText(/340.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(adminPhotoFixture.originalFilename)).toBeInTheDocument();
    expect(screen.getByText(/^ana$/i)).toBeInTheDocument();
    expect(screen.getByText("photo.deleted")).toBeInTheDocument();
    expect(screen.getByText(/^día 1 ·/i)).toBeInTheDocument();
    expect(adminApi.listPhotos).toHaveBeenCalledWith(EVENT_ID, {
      page: 1,
      limit: 24,
      day: undefined,
      search: undefined,
      includeDeleted: false,
    });
  });

  it("filtra por participante, día y borradas", async () => {
    renderPage();

    await screen.findByText(adminPhotoFixture.originalFilename);

    fireEvent.change(screen.getByLabelText(/participante/i), {
      target: { value: "ana" },
    });

    await waitFor(() => {
      expect(adminApi.listPhotos).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({ page: 1, search: "ana" }),
      );
    });

    fireEvent.change(screen.getByLabelText(/^día$/i), {
      target: { value: "2026-11-13" },
    });

    await waitFor(() => {
      expect(adminApi.listPhotos).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({ day: "2026-11-13" }),
      );
    });

    fireEvent.click(screen.getByLabelText(/incluir borradas/i));

    await waitFor(() => {
      expect(adminApi.listPhotos).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({ includeDeleted: true }),
      );
    });
  });

  it("borra una foto tras confirmar y refresca los datos", async () => {
    vi.mocked(adminApi.deletePhoto).mockResolvedValue({ deleted: true });

    renderPage();

    await screen.findByText(adminPhotoFixture.originalFilename);
    fireEvent.click(
      screen.getByRole("button", { name: `Borrar ${adminPhotoFixture.originalFilename}` }),
    );

    expect(
      await screen.findByRole("heading", { name: /borrar la fotografía/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /borrar foto/i }));

    await waitFor(() => {
      expect(adminApi.deletePhoto).toHaveBeenCalledWith(adminPhotoFixture.id);
    });
    await waitFor(() => {
      expect(vi.mocked(adminApi.photoStats).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("muestra un enlace de descarga para fotos activas", async () => {
    renderPage();

    await screen.findByText(adminPhotoFixture.originalFilename);
    const link = screen.getByRole("link", {
      name: `Descargar ${adminPhotoFixture.originalFilename}`,
    });

    expect(link).toHaveAttribute(
      "href",
      "https://api.test/admin/events/event/photos/photo/download",
    );
    expect(adminApi.downloadPhotoUrl).toHaveBeenCalledWith(EVENT_ID, adminPhotoFixture.id);
  });

  it("abre la vista individual de una foto", async () => {
    renderPage();

    await screen.findByText(adminPhotoFixture.originalFilename);
    fireEvent.click(
      screen.getByRole("button", { name: `Ampliar ${adminPhotoFixture.originalFilename}` }),
    );

    expect(
      await screen.findByRole("button", { name: /cerrar vista de la fotografía/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ana ·/i)).toBeInTheDocument();
  });

  it("explica cuando el evento no está disponible", async () => {
    vi.mocked(adminApi.photoStats).mockRejectedValue(
      new ApiError("Sin acceso.", { status: 403, code: "FORBIDDEN" }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /evento no disponible/i }),
    ).toBeInTheDocument();
  });

  it("muestra un aviso cuando la lista de fotos falla", async () => {
    vi.mocked(adminApi.listPhotos).mockRejectedValue(new Error("sin red"));

    renderPage();

    expect(await screen.findByText(/no se pudieron cargar las fotografías/i)).toBeInTheDocument();
  });
});
