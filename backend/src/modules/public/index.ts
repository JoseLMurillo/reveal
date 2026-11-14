import type { SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";
import {
  createSupabaseAuditRepository,
  type AuditRepository,
} from "../admin/shared/audit.repository.js";
import {
  createSupabaseStorageService,
  type StorageService,
} from "../admin/shared/storage.service.js";
import { createSupabasePublicRepository, type PublicRepository } from "./public.repository.js";
import { createPublicService, type PublicService } from "./public.service.js";

export type PublicServiceOverrides = {
  repository?: PublicRepository;
  storage?: StorageService;
  audit?: AuditRepository;
  now?: () => Date;
};

function requireClient(supabase: SupabaseClient | null): SupabaseClient {
  if (!supabase) {
    throw new Error("Se requiere el cliente de Supabase para el módulo público.");
  }

  return supabase;
}

export function createPublicModule(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: PublicServiceOverrides = {},
): PublicService {
  return createPublicService({
    env,
    repository: overrides.repository ?? createSupabasePublicRepository(requireClient(supabase)),
    storage: overrides.storage ?? createSupabaseStorageService(env, requireClient(supabase)),
    audit: overrides.audit ?? createSupabaseAuditRepository(requireClient(supabase)),
    now: overrides.now,
  });
}

export { createPublicRouter } from "./public.routes.js";
export type { PublicService } from "./public.service.js";
