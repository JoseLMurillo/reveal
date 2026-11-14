import { describe, expect, it } from "vitest";

import { EnvValidationError, loadEnv, parseTrustProxy } from "../src/config/env.js";
import { envSource } from "./fixtures.js";

describe("loadEnv", () => {
  it("carga y normaliza variables válidas", () => {
    const env = loadEnv({ ...envSource, FRONTEND_URL: "http://localhost:5173/" });

    expect(env.FRONTEND_URL).toBe("http://localhost:5173");
    expect(env.isTest).toBe(true);
    expect(env.ADMIN_SESSION_TTL_SECONDS).toBe(43_200);
  });

  it("rechaza una configuración incompleta", () => {
    expect(() => loadEnv({ NODE_ENV: "test" })).toThrow(EnvValidationError);
  });

  it("rechaza valores fuera de rango", () => {
    expect(() => loadEnv({ ...envSource, UPLOAD_SESSION_TTL_SECONDS: "5" })).toThrow(
      EnvValidationError,
    );
  });

  it("usa la secret key de SUPABASE_ANON_KEY si falta la service_role", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _removed, ...withoutServiceRole } = envSource;
    const env = loadEnv({
      ...withoutServiceRole,
      SUPABASE_ANON_KEY: "sb_secret_test_key_not_real_000000",
    });

    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("sb_secret_test_key_not_real_000000");
  });

  it("rechaza una configuración sin ninguna clave de servidor", () => {
    const source = { ...envSource, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_ANON_KEY: "" };
    expect(() => loadEnv(source)).toThrow(EnvValidationError);
  });

  it("normaliza COOKIE_DOMAIN vacío a undefined", () => {
    const env = loadEnv({ ...envSource, COOKIE_DOMAIN: "" });
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });
});

describe("parseTrustProxy", () => {
  it.each([
    ["1", 1],
    ["true", true],
    ["false", false],
    ["", false],
    ["loopback", "loopback"],
  ])("interpreta %s", (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });
});
