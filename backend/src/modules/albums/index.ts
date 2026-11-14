import type { SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";
import {
  createSupabasePhotoStorageService,
  type PhotoStorageService,
} from "../photos/photos.storage.js";
import { createSupabaseAlbumRepository, type AlbumRepository } from "./albums.repository.js";
import { createAlbumsPublicService, type AlbumsPublicService } from "./albums.service.js";

export type AlbumsPublicOverrides = {
  repository?: AlbumRepository;
  storage?: PhotoStorageService;
  now?: () => Date;
};

function requireClient(supabase: SupabaseClient | null): SupabaseClient {
  if (!supabase) {
    throw new Error("Se requiere el cliente de Supabase para el módulo de álbumes.");
  }

  return supabase;
}

export function createAlbumsPublicModule(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: AlbumsPublicOverrides = {},
): AlbumsPublicService {
  return createAlbumsPublicService({
    repository: overrides.repository ?? createSupabaseAlbumRepository(requireClient(supabase)),
    storage: overrides.storage ?? createSupabasePhotoStorageService(env, requireClient(supabase)),
    now: overrides.now,
  });
}

export { createAlbumsPublicRouter, createPhotoVotesRouter } from "./albums.routes.js";
export type { AlbumsPublicService } from "./albums.service.js";
export type { AlbumRepository } from "./albums.repository.js";
