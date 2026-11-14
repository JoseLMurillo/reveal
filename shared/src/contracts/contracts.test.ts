import { describe, expect, it } from "vitest";

import {
  adminActivityEntrySchema,
  adminEventActivityQuerySchema,
  adminEventPhotoStatsSchema,
  adminPhotoListQuerySchema,
  albumExportQuerySchema,
  albumPhotoSchema,
  generateAlbumSchema,
  publicGallerySchema,
  updateAlbumSchema,
  voteInputSchema,
  confirmUploadSchema,
  createEventSchema,
  isValidTimezone,
  loginSchema,
  photoIdParamSchema,
  photoListQuerySchema,
  registerParticipantSchema,
  updateParticipantSchema,
  uploadIntentSchema,
  uuidSchema,
} from "../index.js";

describe("timezone", () => {
  it("acepta zonas IANA válidas", () => {
    expect(isValidTimezone("America/Mexico_City")).toBe(true);
    expect(isValidTimezone("Europe/Madrid")).toBe(true);
    expect(isValidTimezone("Asia/Kathmandu")).toBe(true);
  });

  it("rechaza zonas inventadas", () => {
    expect(isValidTimezone("Marte/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("createEventSchema", () => {
  const validEvent = {
    name: "Cumpleaños de Ana",
    startDate: "2026-11-14",
    endDate: "2026-11-17",
    timezone: "America/Mexico_City",
    dailyPhotoLimit: 10,
    totalPhotoLimit: 30,
    requireName: true,
    showParticipantNames: false,
    allowSelfRegistration: true,
    participantLimit: 50,
    maxFileSizeBytes: 10_485_760,
    galleryVisibility: "participants",
    allowPhotoDeletion: false,
  };

  it("acepta un evento válido", () => {
    expect(createEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rechaza fechas invertidas", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      endDate: "2026-11-13",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza auto-registro sin cupo", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      participantLimit: null,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza tamaños de archivo fuera de rango", () => {
    expect(createEventSchema.safeParse({ ...validEvent, maxFileSizeBytes: 100 }).success).toBe(
      false,
    );
    expect(
      createEventSchema.safeParse({ ...validEvent, maxFileSizeBytes: 60 * 1024 * 1024 }).success,
    ).toBe(false);
  });
});

describe("auth", () => {
  it("normaliza el email y exige contraseña", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Example.com ", password: "secreto" });
    expect(parsed.email).toBe("admin@example.com");
    expect(loginSchema.safeParse({ email: "no-es-email", password: "x" }).success).toBe(false);
  });
});

describe("participantes", () => {
  it("recorta el nombre y rechaza controles", () => {
    expect(updateParticipantSchema.parse({ displayName: "  Ana  " }).displayName).toBe("Ana");
    expect(updateParticipantSchema.safeParse({ displayName: "Ana\u0000" }).success).toBe(false);
  });

  it("permite registro anónimo", () => {
    expect(registerParticipantSchema.safeParse({}).success).toBe(true);
  });
});

describe("uploadIntentSchema", () => {
  const file = {
    clientFileId: "8f14e45f-ea0a-4c1b-9f7e-2f5d3b1a9c00",
    filename: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
  };

  it("acepta un archivo válido", () => {
    expect(uploadIntentSchema.safeParse({ files: [file] }).success).toBe(true);
  });

  it("rechaza SVG y tamaños negativos", () => {
    expect(
      uploadIntentSchema.safeParse({ files: [{ ...file, mimeType: "image/svg+xml" }] }).success,
    ).toBe(false);
    expect(uploadIntentSchema.safeParse({ files: [{ ...file, sizeBytes: -1 }] }).success).toBe(
      false,
    );
  });

  it("rechaza clientFileId duplicados", () => {
    expect(uploadIntentSchema.safeParse({ files: [file, file] }).success).toBe(false);
  });

  it("valida el formato UUID", () => {
    expect(uuidSchema.safeParse("no-uuid").success).toBe(false);
  });
});

describe("contratos de fotografías", () => {
  it("aplica el límite de página por defecto y rechaza límites excesivos", () => {
    const parsed = photoListQuerySchema.parse({ page: "2" });
    expect(parsed).toEqual({ page: 2, limit: 24 });
    expect(photoListQuerySchema.safeParse({ page: 1, limit: 61 }).success).toBe(false);
    expect(photoListQuerySchema.safeParse({ page: 1, limit: 60, day: "2026-11-13" }).success).toBe(
      true,
    );
  });

  it("exige un UUID válido para el identificador de foto", () => {
    expect(photoIdParamSchema.safeParse({ id: "no-uuid" }).success).toBe(false);
    expect(
      photoIdParamSchema.safeParse({ id: "33333333-3333-4333-8333-333333333333" }).success,
    ).toBe(true);
  });

  it("permite confirmar sin ítems y limita el lote", () => {
    expect(
      confirmUploadSchema.safeParse({ sessionId: "55555555-5555-4555-8555-555555555555" }).success,
    ).toBe(true);
    expect(
      confirmUploadSchema.safeParse({
        sessionId: "55555555-5555-4555-8555-555555555555",
        items: Array.from({ length: 51 }, () => ({
          itemId: uuidSchema.parse(crypto.randomUUID()),
        })),
      }).success,
    ).toBe(false);
  });
});

describe("contratos administrativos de fotografías", () => {
  it("convierte includeDeleted y aplica los valores por defecto", () => {
    const parsed = adminPhotoListQuerySchema.parse({
      page: "1",
      includeDeleted: "true",
      search: "  Ana  ",
    });

    expect(parsed).toMatchObject({
      page: 1,
      limit: 24,
      includeDeleted: true,
      search: "Ana",
    });
    expect(adminPhotoListQuerySchema.parse({ includeDeleted: "false" }).includeDeleted).toBe(false);
  });

  it("valida las estadísticas de fotos y la actividad", () => {
    expect(
      adminEventPhotoStatsSchema.safeParse({
        event: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Cumple de Ana",
          status: "active",
        },
        totals: {
          participants: 10,
          anonymousParticipants: 2,
          photos: 80,
          photosToday: 20,
          storageBytes: 1024,
          deletedPhotos: 1,
        },
        byDay: [
          {
            eventDay: "2026-11-13",
            dayNumber: 1,
            photos: 20,
            participants: 5,
          },
        ],
        topParticipants: [
          {
            participantId: "22222222-2222-4222-8222-222222222222",
            displayName: null,
            photos: 12,
          },
        ],
      }).success,
    ).toBe(true);

    expect(adminEventActivityQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(adminEventActivityQuerySchema.safeParse({ limit: 101 }).success).toBe(false);

    expect(
      adminActivityEntrySchema.safeParse({
        id: 1,
        action: "photo.deleted",
        entityType: "photo",
        entityId: null,
        metadata: { eventDay: "2026-11-13" },
        createdAt: "2026-11-13T18:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});

describe("álbumes y votación", () => {
  it("valida la generación y actualización del álbum", () => {
    expect(generateAlbumSchema.safeParse({}).success).toBe(true);
    expect(
      generateAlbumSchema.safeParse({
        title: "Los mejores momentos",
        visibility: "public",
      }).success,
    ).toBe(true);
    expect(generateAlbumSchema.safeParse({ title: "", visibility: "public" }).success).toBe(false);
    expect(updateAlbumSchema.safeParse({ status: "published" }).success).toBe(true);
    expect(updateAlbumSchema.safeParse({ status: "public" }).success).toBe(false);
    expect(albumExportQuerySchema.parse({ day: "2026-11-13" })).toEqual({
      day: "2026-11-13",
    });
  });

  it("exige una fotografía de álbum con autor o anónima", () => {
    const photo = {
      id: "33333333-3333-4333-8333-333333333333",
      url: "https://storage.test/foto.jpg",
      width: 1600,
      height: 1200,
      author: null,
      caption: null,
    };

    expect(albumPhotoSchema.safeParse(photo).success).toBe(true);
    expect(albumPhotoSchema.safeParse({ ...photo, author: { displayName: "Ana" } }).success).toBe(
      true,
    );
  });

  it("acepta me gusta y no me gusta, pero no otros valores", () => {
    expect(voteInputSchema.safeParse({ value: "like" }).success).toBe(true);
    expect(voteInputSchema.safeParse({ value: "dislike" }).success).toBe(true);
    expect(voteInputSchema.safeParse({ value: "love" }).success).toBe(false);
  });

  it("valida la forma de la galería pública", () => {
    expect(
      publicGallerySchema.safeParse({
        event: {
          slug: "cumple-ana",
          name: "Cumple de Ana",
          showParticipantNames: true,
          galleryVisibility: "participants",
          publicAlbumSlug: null,
        },
        days: [
          {
            eventDay: "2026-11-13",
            dayNumber: 1,
            photos: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                url: "https://storage.test/foto.jpg",
                width: 1600,
                height: 1200,
                author: null,
                caption: null,
                uploadedAt: "2026-11-13T18:00:00.000Z",
              },
            ],
          },
        ],
        stats: { totalPhotos: 1, totalParticipants: 1, totalDays: 1 },
      }).success,
    ).toBe(true);
  });
});
