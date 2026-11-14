import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import sharp, { type Metadata } from "sharp";

import type { AllowedImageMimeType } from "@rollo/shared";

import type { Env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

export const ABSOLUTE_MAX_BYTES = 52_428_800;

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const MIME_BY_FORMAT = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type OriginalUploadTarget = {
  signedUrl: string;
  token: string;
  expiresAt: string;
};

export type ValidatedOriginal = {
  mimeType: AllowedImageMimeType;
  fileSize: number;
  width: number;
  height: number;
  contentHash: string;
};

export type OriginalLocation = {
  eventId: string;
  eventDay: string;
  participantId: string;
  itemId: string;
};

export type PhotoStorageService = {
  pathFor(location: OriginalLocation, mimeType: AllowedImageMimeType): string;
  createUploadTarget(path: string): Promise<OriginalUploadTarget>;
  validateOriginal(
    location: OriginalLocation,
    storagePath: string,
    declaredMimeType: AllowedImageMimeType,
    maxBytes: number,
  ): Promise<ValidatedOriginal>;
  createSignedUrl(storagePath: string, downloadFilename?: string): Promise<string>;
  downloadOriginal(storagePath: string): Promise<Buffer>;
  removeObject(storagePath: string): Promise<void>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function invalidFile(message: string): AppError {
  return new AppError(422, ERROR_CODES.INVALID_FILE_TYPE, message);
}

export function originalPathFor(
  location: OriginalLocation,
  mimeType: AllowedImageMimeType,
): string {
  const extension = EXTENSION_BY_MIME[mimeType];
  return `events/${location.eventId}/originals/${location.eventDay}/${location.participantId}/${location.itemId}.${extension}`;
}

export function isOriginalPathFor(location: OriginalLocation, storagePath: string): boolean {
  const pattern = new RegExp(
    `^events/${escapeRegExp(location.eventId)}/originals/${escapeRegExp(location.eventDay)}/${escapeRegExp(location.participantId)}/${escapeRegExp(location.itemId)}\\.(jpg|png|webp)$`,
  );
  return pattern.test(storagePath);
}

export function createSupabasePhotoStorageService(
  env: Env,
  supabase: SupabaseClient,
): PhotoStorageService {
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  return {
    pathFor: originalPathFor,

    async createUploadTarget(path) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

      if (error || !data) {
        throw new Error(`No se pudo preparar la subida: ${error?.message ?? "sin datos"}`);
      }

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        expiresAt: new Date(Date.now() + env.SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      };
    },

    async validateOriginal(location, storagePath, declaredMimeType, maxBytes) {
      if (!isOriginalPathFor(location, storagePath)) {
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          "La ruta del archivo no pertenece a esta carga.",
        );
      }

      const { data, error } = await supabase.storage.from(bucket).download(storagePath);

      if (error || !data) {
        throw invalidFile("El archivo no se ha subido o no se puede leer.");
      }

      if (data.size <= 0) {
        await this.removeObject(storagePath);
        throw invalidFile("El archivo está vacío.");
      }

      if (data.size > ABSOLUTE_MAX_BYTES || data.size > maxBytes) {
        await this.removeObject(storagePath);
        throw new AppError(
          413,
          ERROR_CODES.FILE_TOO_LARGE,
          "El archivo supera el tamaño máximo permitido.",
        );
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const detected = await fileTypeFromBuffer(buffer);
      const allowedMimes: readonly string[] = Object.values(MIME_BY_FORMAT);
      const detectedMime =
        detected && allowedMimes.includes(detected.mime)
          ? (detected.mime as AllowedImageMimeType)
          : null;

      if (detectedMime === null) {
        await this.removeObject(storagePath);
        throw invalidFile("El archivo no es una imagen JPEG, PNG o WebP válida.");
      }

      if (detectedMime !== declaredMimeType) {
        await this.removeObject(storagePath);
        throw invalidFile("El contenido del archivo no coincide con el tipo declarado.");
      }

      let metadata: Metadata;

      try {
        metadata = await sharp(buffer, { failOn: "error" }).metadata();
      } catch {
        await this.removeObject(storagePath);
        throw invalidFile("El archivo no es una imagen válida.");
      }

      const formatMime = metadata.format
        ? MIME_BY_FORMAT[metadata.format as keyof typeof MIME_BY_FORMAT]
        : undefined;

      if (formatMime !== detectedMime || !metadata.width || !metadata.height) {
        await this.removeObject(storagePath);
        throw invalidFile("La imagen está dañada o no se puede decodificar.");
      }

      if (metadata.width * metadata.height > 100_000_000) {
        await this.removeObject(storagePath);
        throw invalidFile("La imagen tiene una resolución demasiado alta.");
      }

      return {
        mimeType: detectedMime,
        fileSize: data.size,
        width: metadata.width,
        height: metadata.height,
        contentHash: createHash("sha256").update(buffer).digest("hex"),
      };
    },

    async createSignedUrl(storagePath, downloadFilename) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(
          storagePath,
          env.SIGNED_URL_TTL_SECONDS,
          downloadFilename ? { download: downloadFilename } : undefined,
        );

      if (error || !data) {
        throw new Error(`No se pudo firmar la URL: ${error?.message ?? "sin datos"}`);
      }

      return data.signedUrl;
    },

    async downloadOriginal(storagePath) {
      const { data, error } = await supabase.storage.from(bucket).download(storagePath);

      if (error || !data) {
        throw new Error(`No se pudo descargar ${storagePath}: ${error?.message ?? "sin datos"}`);
      }

      return Buffer.from(await data.arrayBuffer());
    },

    async removeObject(storagePath) {
      const { error } = await supabase.storage.from(bucket).remove([storagePath]);

      if (error) {
        throw new Error(`No se pudo eliminar el objeto: ${error.message}`);
      }
    },
  };
}
