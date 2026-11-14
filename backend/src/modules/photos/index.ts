import type { SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";
import { createSupabasePhotoStorageService, type PhotoStorageService } from "./photos.storage.js";
import { createSupabasePhotosRepository, type PhotosRepository } from "./photos.repository.js";
import { createPhotosService, type PhotosService } from "./photos.service.js";

export type PhotosModuleOverrides = {
  repository?: PhotosRepository;
  storage?: PhotoStorageService;
  now?: () => Date;
};

export function createPhotosModule(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: PhotosModuleOverrides = {},
): PhotosService {
  if (!supabase && (!overrides.repository || !overrides.storage)) {
    throw new Error("Se requiere el cliente de Supabase para el módulo de fotografías.");
  }

  const client = supabase as SupabaseClient;

  return createPhotosService({
    env,
    repository: overrides.repository ?? createSupabasePhotosRepository(client),
    storage: overrides.storage ?? createSupabasePhotoStorageService(env, client),
    now: overrides.now,
  });
}

export { createPhotosRouter } from "./photos.routes.js";
export type { PhotoStorageService } from "./photos.storage.js";
export type { PhotosRepository } from "./photos.repository.js";
export type { PhotosService } from "./photos.service.js";
