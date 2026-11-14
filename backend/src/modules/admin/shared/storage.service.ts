import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp, { type Metadata } from "sharp";

import type { Env } from "../../../config/env.js";
import { AppError } from "../../../errors/app-error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";

const COVER_MAX_BYTES = 52_428_800;

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type CoverUploadTarget = {
  storagePath: string;
  signedUrl: string;
  token: string;
  expiresAt: string;
};

export type StorageService = {
  createSignedUrl(path: string): Promise<string | null>;
  createCoverUploadTarget(
    eventId: string,
    mimeType: keyof typeof EXTENSION_BY_MIME,
  ): Promise<CoverUploadTarget>;
  validateCoverObject(eventId: string, storagePath: string): Promise<void>;
  removeObject(path: string): Promise<void>;
};

export function isCoverPathForEvent(eventId: string, storagePath: string): boolean {
  const pattern = new RegExp(
    `^events/${eventId}/cover/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp)$`,
  );
  return pattern.test(storagePath);
}

export function createSupabaseStorageService(env: Env, supabase: SupabaseClient): StorageService {
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  return {
    async createSignedUrl(path) {
      if (!path) {
        return null;
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, env.SIGNED_URL_TTL_SECONDS);

      if (error || !data) {
        throw new Error(`No se pudo firmar la URL: ${error?.message ?? "sin datos"}`);
      }

      return data.signedUrl;
    },

    async createCoverUploadTarget(eventId, mimeType) {
      const extension = EXTENSION_BY_MIME[mimeType];
      const storagePath = `events/${eventId}/cover/${randomUUID()}.${extension}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        throw new Error(`No se pudo preparar la subida: ${error?.message ?? "sin datos"}`);
      }

      return {
        storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        expiresAt: new Date(Date.now() + env.SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      };
    },

    async validateCoverObject(eventId, storagePath) {
      if (!isCoverPathForEvent(eventId, storagePath)) {
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          "La ruta de la portada no pertenece a este evento.",
        );
      }

      const extension = storagePath.split(".").pop() ?? "";
      const expectedMime = MIME_BY_EXTENSION[extension as keyof typeof MIME_BY_EXTENSION];

      const { data, error } = await supabase.storage.from(bucket).download(storagePath);

      if (error || !data) {
        throw new AppError(
          422,
          ERROR_CODES.INVALID_FILE_TYPE,
          "La imagen no se ha subido o no se puede leer.",
        );
      }

      if (data.size <= 0 || data.size > COVER_MAX_BYTES) {
        await this.removeObject(storagePath);
        throw new AppError(
          422,
          ERROR_CODES.FILE_TOO_LARGE,
          "La portada supera el tamaño permitido o está vacía.",
        );
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      let metadata: Metadata;
      try {
        metadata = await sharp(buffer, { failOn: "error" }).metadata();
      } catch {
        await this.removeObject(storagePath);
        throw new AppError(
          422,
          ERROR_CODES.INVALID_FILE_TYPE,
          "El archivo no es una imagen válida.",
        );
      }

      const format = metadata.format;
      const actualMime =
        format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : undefined;

      const effectiveMime = actualMime ?? (format === "webp" ? "image/webp" : undefined);

      if (!effectiveMime || effectiveMime !== expectedMime || !metadata.width || !metadata.height) {
        await this.removeObject(storagePath);
        throw new AppError(
          422,
          ERROR_CODES.INVALID_FILE_TYPE,
          "La portada debe ser una imagen JPEG, PNG o WebP válida.",
        );
      }
    },

    async removeObject(path) {
      const { error } = await supabase.storage.from(bucket).remove([path]);

      if (error) {
        throw new Error(`No se pudo eliminar el objeto: ${error.message}`);
      }
    },
  };
}
