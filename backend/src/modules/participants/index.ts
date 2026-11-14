import type { SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";
import {
  createSupabaseParticipantRepository,
  type ParticipantRepository,
} from "./participants.repository.js";
import { createParticipantService, type ParticipantService } from "./participants.service.js";

export type ParticipantServiceOverrides = {
  repository?: ParticipantRepository;
  now?: () => Date;
};

function requireClient(supabase: SupabaseClient | null): SupabaseClient {
  if (!supabase) {
    throw new Error("Se requiere el cliente de Supabase para el módulo de participantes.");
  }

  return supabase;
}

export function createParticipantModule(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: ParticipantServiceOverrides = {},
): ParticipantService {
  return createParticipantService({
    env,
    repository:
      overrides.repository ?? createSupabaseParticipantRepository(requireClient(supabase)),
    now: overrides.now,
  });
}

export { createParticipantRouter } from "./participants.routes.js";
export type { ParticipantService } from "./participants.service.js";
