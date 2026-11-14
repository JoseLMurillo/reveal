import type { Env } from "../src/config/env.js";

export const testEnv: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  FRONTEND_URL: "http://localhost:5173",
  TRUST_PROXY: "1",
  LOG_LEVEL: "silent",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-not-real-000000",
  SUPABASE_ANON_KEY: "test-anon-key-not-real-000000",
  SUPABASE_STORAGE_BUCKET: "rollo-originals",
  ADMIN_SESSION_TTL_SECONDS: 43_200,
  ADMIN_SESSION_IDLE_SECONDS: 3_600,
  COOKIE_DOMAIN: undefined,
  PARTICIPANT_SESSION_TTL_SECONDS: 2_592_000,
  UPLOAD_SESSION_TTL_SECONDS: 900,
  MAX_FILES_PER_UPLOAD: 10,
  SIGNED_URL_TTL_SECONDS: 3_600,
  CLEANUP_INTERVAL_SECONDS: 300,
  isProduction: false,
  isDevelopment: false,
  isTest: true,
};

export const envSource = {
  NODE_ENV: "test",
  PORT: "4000",
  FRONTEND_URL: "http://localhost:5173",
  TRUST_PROXY: "1",
  LOG_LEVEL: "silent",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-not-real-000000",
  SUPABASE_ANON_KEY: "test-anon-key-not-real-000000",
  SUPABASE_STORAGE_BUCKET: "rollo-originals",
};
