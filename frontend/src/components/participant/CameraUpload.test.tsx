import type { UploadIntentResult } from "@rollo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ParticipantProvider } from "@/context/ParticipantContext";
import { publicApi } from "@/services/public";
import { ACCESS_CODE, participantMeFixture, SESSION_TOKEN } from "@/test/fixtures";

import { CameraUpload } from "./CameraUpload";

vi.mock("@/services/public", () => ({
  publicApi: {
    me: vi.fn(),
    redeem: vi.fn(),
    uploadIntent: vi.fn(),
    confirmUpload: vi.fn(),
    releaseUpload: vi.fn(),
  },
}));

const SLUG = "cumple-ana";

class FakeXmlHttpRequest {
  public upload = {
    addEventListener: (
      type: string,
      listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void,
    ) => {
      if (type === "progress") {
        this.progressListener = listener;
      }
    },
  };

  public status = 200;

  private progressListener:
    ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null = null;
  private loadListener: (() => void) | null = null;

  public open(): void {
    return undefined;
  }

  public setRequestHeader(): void {
    return undefined;
  }

  public addEventListener(type: string, listener: () => void): void {
    if (type === "load") {
      this.loadListener = listener;
    }
  }

  public send(): void {
    this.progressListener?.({ lengthComputable: true, loaded: 5, total: 10 });
    queueMicrotask(() => this.loadListener?.());
  }
}

function seedSession() {
  window.localStorage.setItem(
    `rollo:participant:${SLUG}`,
    JSON.stringify({ sessionToken: SESSION_TOKEN, accessCode: ACCESS_CODE }),
  );
}

function renderUpload() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantProvider slug={SLUG}>
        <CameraUpload />
      </ParticipantProvider>
    </QueryClientProvider>,
  );
}

function selectFile(name = "foto.jpg", type = "image/jpeg") {
  const input = screen.getByLabelText(/seleccionar fotografías/i);
  const file = new File(["contenido"], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

function intentFor(input: {
  files: Array<{ clientFileId: string; filename: string; mimeType: string; sizeBytes: number }>;
}): UploadIntentResult {
  return {
    sessionId: "55555555-5555-4555-8555-555555555555",
    eventDay: "2026-11-13",
    expiresAt: "2026-11-13T18:15:00.000Z",
    quota: { remainingDay: 1, remainingTotal: 10 },
    uploads: input.files.map((file) => ({
      itemId: crypto.randomUUID(),
      clientFileId: file.clientFileId,
      storagePath: `events/test/originals/${file.clientFileId}.jpg`,
      signedUrl: `https://upload.test/${file.clientFileId}`,
      token: "signed-token",
      expiresAt: "2026-11-13T18:15:00.000Z",
    })),
  };
}

describe("CameraUpload", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    window.URL.createObjectURL = vi.fn(() => "blob:preview");
    window.URL.revokeObjectURL = vi.fn();
    vi.mocked(publicApi.me).mockResolvedValue(participantMeFixture);
    vi.mocked(publicApi.releaseUpload).mockResolvedValue({
      session: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "cancelled",
        uploadedCount: 0,
        releasedCount: 1,
        eventDay: "2026-11-13",
      },
      releasedNow: 1,
      quota: { eventDay: "2026-11-13", remainingDay: 2, remainingTotal: 11 },
    });
  });

  it("rechaza archivos que no son imágenes admitidas", async () => {
    seedSession();
    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    selectFile("notas.txt", "text/plain");

    expect(await screen.findByText(/no es JPEG, PNG ni WebP/i)).toBeInTheDocument();
    expect(publicApi.uploadIntent).not.toHaveBeenCalled();
  });

  it("rechaza archivos que superan el límite del evento", async () => {
    seedSession();
    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    const file = selectFile();
    Object.defineProperty(file, "size", { value: 10_485_761 });

    fireEvent.change(screen.getByLabelText(/seleccionar fotografías/i), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/supera el límite de 10.0 MB/i)).toBeInTheDocument();
    expect(publicApi.uploadIntent).not.toHaveBeenCalled();
  });

  it("acepta archivos arrastrados al área de carga", async () => {
    seedSession();
    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    const dropzone = screen.getByLabelText(/seleccionar fotografías/i).closest(".paper-card");

    if (!dropzone) {
      throw new Error("No se encontró el área de carga");
    }

    const file = new File(["contenido"], "arrastrada.jpg", { type: "image/jpeg" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByText("arrastrada.jpg")).toBeInTheDocument();
  });

  it("sube, confirma y muestra el resultado real", async () => {
    seedSession();
    let intent: UploadIntentResult | null = null;
    vi.mocked(publicApi.uploadIntent).mockImplementation(async (_token, input) => {
      intent = intentFor(input);
      return intent;
    });
    vi.mocked(publicApi.confirmUpload).mockImplementation(async () => ({
      session: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "completed",
        uploadedCount: 1,
        releasedCount: 0,
        eventDay: "2026-11-13",
      },
      results: [
        {
          itemId: intent?.uploads[0]?.itemId ?? "66666666-6666-4666-8666-666666666666",
          clientFileId: intent?.uploads[0]?.clientFileId ?? "77777777-7777-4777-8777-777777777777",
          status: "confirmed",
          photoId: "88888888-8888-4888-8888-888888888888",
        },
      ],
      quota: { eventDay: "2026-11-13", remainingDay: 1, remainingTotal: 10 },
    }));

    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    selectFile();

    fireEvent.click(screen.getByRole("button", { name: /revelar 1/i }));

    expect(await screen.findByText("Confirmada")).toBeInTheDocument();
    expect(publicApi.uploadIntent).toHaveBeenCalledWith(
      SESSION_TOKEN,
      expect.objectContaining({
        files: [
          expect.objectContaining({
            filename: "foto.jpg",
            mimeType: "image/jpeg",
          }),
        ],
      }),
    );
    expect(publicApi.confirmUpload).toHaveBeenCalledWith(
      SESSION_TOKEN,
      expect.objectContaining({
        sessionId: "55555555-5555-4555-8555-555555555555",
      }),
    );
  });

  it("marca el archivo como fallido y permite reintentarlo", async () => {
    seedSession();
    let intent: UploadIntentResult | null = null;
    vi.mocked(publicApi.uploadIntent).mockImplementation(async (_token, input) => {
      intent = intentFor(input);
      return intent;
    });
    vi.mocked(publicApi.confirmUpload).mockImplementation(async () => ({
      session: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "partially_completed",
        uploadedCount: 0,
        releasedCount: 1,
        eventDay: "2026-11-13",
      },
      results: [
        {
          itemId: intent?.uploads[0]?.itemId ?? "66666666-6666-4666-8666-666666666666",
          clientFileId: intent?.uploads[0]?.clientFileId ?? "77777777-7777-4777-8777-777777777777",
          status: "failed",
          error: {
            code: "INVALID_FILE_TYPE",
            message: "El contenido no es una imagen válida.",
          },
        },
      ],
      quota: { eventDay: "2026-11-13", remainingDay: 2, remainingTotal: 11 },
    }));

    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    selectFile();

    fireEvent.click(screen.getByRole("button", { name: /revelar 1/i }));

    expect(await screen.findByText(/el contenido no es una imagen válida/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar foto.jpg/i })).toBeInTheDocument();
  });

  it("avisa cuando no quedan disparos disponibles", async () => {
    seedSession();
    vi.mocked(publicApi.me).mockResolvedValue({
      ...participantMeFixture,
      quota: { ...participantMeFixture.quota, remainingDay: 0 },
      permissions: { ...participantMeFixture.permissions, canUpload: false },
    });

    renderUpload();

    await screen.findByText(/ya usaste todos los disparos disponibles hoy/i);
    expect(screen.getByRole("button", { name: /elegir fotos/i })).toBeDisabled();
  });

  it("cancela la reserva si la confirmación falla por red", async () => {
    seedSession();
    vi.mocked(publicApi.uploadIntent).mockImplementation(async (_token, input) => intentFor(input));
    vi.mocked(publicApi.confirmUpload).mockRejectedValue(new Error("sin red"));

    renderUpload();

    await screen.findByRole("heading", { name: /revela tus fotos de hoy/i });
    selectFile();

    fireEvent.click(screen.getByRole("button", { name: /revelar 1/i }));

    await waitFor(() => {
      expect(publicApi.releaseUpload).toHaveBeenCalledWith(SESSION_TOKEN, {
        sessionId: "55555555-5555-4555-8555-555555555555",
      });
    });
  });
});
