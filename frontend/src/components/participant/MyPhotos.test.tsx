import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { publicApi } from "@/services/public";
import { ACCESS_CODE, participantMeFixture, photoFixture, SESSION_TOKEN } from "@/test/fixtures";

import { MyPhotos } from "./MyPhotos";

vi.mock("@/services/public", () => ({
  publicApi: {
    me: vi.fn(),
    redeem: vi.fn(),
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

function renderPhotos() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <MyPhotos />
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

describe("MyPhotos", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
    vi.mocked(publicApi.photos).mockResolvedValue({
      data: [photoFixture],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });
  });

  it("muestra el rollo personal con metadatos", async () => {
    seedSession();
    renderPhotos();

    expect(await screen.findByRole("heading", { name: /mis fotos/i })).toBeInTheDocument();
    expect(screen.getByAltText(photoFixture.originalFilename)).toBeInTheDocument();
    expect(screen.getByText(/2.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/1 fotografía confirmada/i)).toBeInTheDocument();
    expect(publicApi.photos).toHaveBeenCalledWith(SESSION_TOKEN, { page: 1, limit: 24 });
  });

  it("amplía una foto en el visor", async () => {
    seedSession();
    renderPhotos();

    await screen.findByAltText(photoFixture.originalFilename);
    fireEvent.click(
      screen.getByRole("button", { name: `Ampliar ${photoFixture.originalFilename}` }),
    );

    expect(
      await screen.findByRole("button", { name: /cerrar vista de la fotografía/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByAltText(photoFixture.originalFilename).length).toBeGreaterThanOrEqual(2);
  });

  it("explica cuando el rollo está vacío", async () => {
    seedSession();
    vi.mocked(publicApi.photos).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
    });

    renderPhotos();

    expect(await screen.findByText(/tu rollo está vacío/i)).toBeInTheDocument();
  });

  it("borra una foto tras confirmar", async () => {
    seedSession();
    vi.mocked(publicApi.deletePhoto).mockResolvedValue({
      deleted: true,
      quota: { eventDay: "2026-11-13", remainingDay: 2, remainingTotal: 11 },
    });

    renderPhotos();

    await screen.findByAltText(photoFixture.originalFilename);
    fireEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(
      await screen.findByRole("heading", { name: /borrar esta fotografía/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /borrar foto/i }));

    await waitFor(() => {
      expect(publicApi.deletePhoto).toHaveBeenCalledWith(SESSION_TOKEN, photoFixture.id);
    });
  });

  it("oculta el botón de borrar cuando el evento no lo permite", async () => {
    seedSession();
    vi.mocked(publicApi.photos).mockResolvedValue({
      data: [{ ...photoFixture, canDelete: false }],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });

    renderPhotos();

    await screen.findByAltText(photoFixture.originalFilename);
    expect(screen.queryByRole("button", { name: /^borrar$/i })).not.toBeInTheDocument();
  });

  it("pagina cuando hay más de una página", async () => {
    seedSession();
    const secondPage = {
      ...photoFixture,
      id: "99999999-9999-4999-8999-999999999999",
      originalFilename: "IMG_0002.jpg",
    };
    vi.mocked(publicApi.photos).mockImplementation(async (_token, query) =>
      query.page === 2
        ? {
            data: [secondPage],
            meta: { page: 2, limit: 24, total: 25, totalPages: 2 },
          }
        : {
            data: [photoFixture],
            meta: { page: 1, limit: 24, total: 25, totalPages: 2 },
          },
    );

    renderPhotos();

    await screen.findByText(/página 1 de 2/i);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(await screen.findByAltText("IMG_0002.jpg")).toBeInTheDocument();
    expect(publicApi.photos).toHaveBeenLastCalledWith(SESSION_TOKEN, { page: 2, limit: 24 });
  });

  it("muestra un aviso cuando la lista falla", async () => {
    seedSession();
    vi.mocked(publicApi.photos).mockRejectedValue(new Error("sin red"));

    renderPhotos();

    expect(await screen.findByText(/no se pudieron cargar tus fotos/i)).toBeInTheDocument();
  });
});
