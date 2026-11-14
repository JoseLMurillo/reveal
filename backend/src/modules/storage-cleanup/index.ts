import type { SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";
import {
  createSupabaseStorageCleanupRepository,
  type StorageCleanupRepository,
} from "./cleanup.repository.js";
import { createStorageCleanupService, type StorageCleanupService } from "./cleanup.service.js";

export type StorageCleanupModuleOverrides = {
  repository?: StorageCleanupRepository;
};

export function createStorageCleanupModule(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: StorageCleanupModuleOverrides = {},
): StorageCleanupService {
  if (!supabase && !overrides.repository) {
    throw new Error("Se requiere el cliente de Supabase para la limpieza de Storage.");
  }

  const client = supabase as SupabaseClient;

  return createStorageCleanupService({
    repository: overrides.repository ?? createSupabaseStorageCleanupRepository(client),
    async removeObject(bucket, path) {
      const { error } = await client.storage.from(bucket).remove([path]);

      if (error) {
        throw new Error(`No se pudo eliminar ${path}: ${error.message}`);
      }
    },
  });
}

export { createCleanupWorker } from "./cleanup.worker.js";
export type { CleanupWorker, CleanupWorkerLogger } from "./cleanup.worker.js";
export type { StorageCleanupService } from "./cleanup.service.js";
export type { StorageCleanupRepository } from "./cleanup.repository.js";
