import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";

import type { Env } from "../../config/env.js";
import { createAuthAdmin } from "../../middlewares/auth-admin.js";
import { csrfProtect } from "../../middlewares/csrf.js";
import { createOriginGuard } from "../../middlewares/origin.js";
import {
  createSupabaseAdminRepository,
  createSupabaseAdminSessionRepository,
  type AdminRepository,
  type AdminSessionRepository,
} from "./auth/auth.repository.js";
import { createAuthRouter } from "./auth/auth.routes.js";
import { createAuthService, type AuthService } from "./auth/auth.service.js";
import { createDashboardRouter } from "./dashboard/dashboard.routes.js";
import { createDashboardService, type DashboardService } from "./dashboard/dashboard.service.js";
import { createEventsRouter } from "./events/events.routes.js";
import { createSupabaseEventRepository, type EventRepository } from "./events/events.repository.js";
import { createEventsService, type EventsService } from "./events/events.service.js";
import {
  createAdminParticipantsService,
  type AdminParticipantsService,
} from "./participants/participants.service.js";
import { createAdminParticipantsRouter } from "./participants/participants.routes.js";
import {
  createSupabaseAdminParticipantsRepository,
  type AdminParticipantsRepository,
} from "./participants/participants.repository.js";
import { createSupabaseAuditRepository, type AuditRepository } from "./shared/audit.repository.js";
import { createSupabaseStatsRepository, type StatsRepository } from "./shared/stats.repository.js";
import { createSupabaseStorageService, type StorageService } from "./shared/storage.service.js";
import {
  createSupabasePhotoStorageService,
  type PhotoStorageService,
} from "../photos/photos.storage.js";
import {
  createSupabaseAdminPhotosRepository,
  type AdminPhotosRepository,
} from "./photos/photos.repository.js";
import { createAdminPhotosService, type AdminPhotosService } from "./photos/photos.service.js";
import { createAdminPhotosRouter } from "./photos/photos.routes.js";
import {
  createSupabaseAlbumRepository,
  type AlbumRepository,
} from "../albums/albums.repository.js";
import { createAdminAlbumsService, type AdminAlbumsService } from "./albums/albums.service.js";
import { createAdminAlbumsRouter } from "./albums/albums.routes.js";

export type AdminServices = {
  auth: AuthService;
  events: EventsService;
  dashboard: DashboardService;
  participants: AdminParticipantsService;
  photos: AdminPhotosService;
  albums: AdminAlbumsService;
};

export type AdminServiceOverrides = {
  adminRepository?: AdminRepository;
  sessionRepository?: AdminSessionRepository;
  eventRepository?: EventRepository;
  participantRepository?: AdminParticipantsRepository;
  photoRepository?: AdminPhotosRepository;
  albumRepository?: AlbumRepository;
  statsRepository?: StatsRepository;
  auditRepository?: AuditRepository;
  storageService?: StorageService;
  photoStorageService?: PhotoStorageService;
  now?: () => Date;
};

function requireClient(supabase: SupabaseClient | null): SupabaseClient {
  if (!supabase) {
    throw new Error("Se requiere el cliente de Supabase para la administración.");
  }

  return supabase;
}

export function createAdminServices(
  env: Env,
  supabase: SupabaseClient | null,
  overrides: AdminServiceOverrides = {},
): AdminServices {
  const getRepository = <T>(override: T | undefined, build: (client: SupabaseClient) => T): T =>
    override ?? build(requireClient(supabase));

  const adminRepository = getRepository(overrides.adminRepository, createSupabaseAdminRepository);
  const sessionRepository = getRepository(
    overrides.sessionRepository,
    createSupabaseAdminSessionRepository,
  );
  const auditRepository = getRepository(overrides.auditRepository, createSupabaseAuditRepository);
  const statsRepository = getRepository(overrides.statsRepository, createSupabaseStatsRepository);
  const storageService = getRepository(overrides.storageService, (client) =>
    createSupabaseStorageService(env, client),
  );
  const photoStorageService = getRepository(overrides.photoStorageService, (client) =>
    createSupabasePhotoStorageService(env, client),
  );
  const photoRepository = getRepository(
    overrides.photoRepository,
    createSupabaseAdminPhotosRepository,
  );
  const albumRepository = getRepository(overrides.albumRepository, createSupabaseAlbumRepository);
  const eventRepository = getRepository(overrides.eventRepository, (client) =>
    createSupabaseEventRepository(client, env.SUPABASE_STORAGE_BUCKET),
  );
  const participantRepository = getRepository(
    overrides.participantRepository,
    createSupabaseAdminParticipantsRepository,
  );

  const auth = createAuthService({
    env,
    admins: adminRepository,
    sessions: sessionRepository,
    audit: auditRepository,
    now: overrides.now,
  });

  const events = createEventsService({
    env,
    events: eventRepository,
    stats: statsRepository,
    audit: auditRepository,
    storage: storageService,
    now: overrides.now,
  });

  const dashboard = createDashboardService({
    events: eventRepository,
    stats: statsRepository,
    audit: auditRepository,
    storage: storageService,
  });

  const participants = createAdminParticipantsService({
    env,
    events: eventRepository,
    participants: participantRepository,
    audit: auditRepository,
    now: overrides.now,
  });

  const photos = createAdminPhotosService({
    events: eventRepository,
    photos: photoRepository,
    storage: photoStorageService,
    audit: auditRepository,
    now: overrides.now,
  });

  const albums = createAdminAlbumsService({
    repository: albumRepository,
    storage: photoStorageService,
    audit: auditRepository,
    now: overrides.now,
  });

  return { auth, events, dashboard, participants, photos, albums };
}

export function createAdminRouter(env: Env, services: AdminServices): Router {
  const router = Router();
  const originGuard = createOriginGuard(env);
  const authAdmin = createAuthAdmin(services.auth);

  router.use(originGuard);
  router.use("/auth", createAuthRouter(env, services.auth));

  router.use(authAdmin, csrfProtect);
  router.use("/dashboard", createDashboardRouter(services.dashboard));
  router.use("/events", createEventsRouter(services.events));
  router.use("/", createAdminPhotosRouter(services.photos));
  router.use("/", createAdminAlbumsRouter(services.albums));
  router.use("/", createAdminParticipantsRouter(env, services.participants));

  return router;
}
