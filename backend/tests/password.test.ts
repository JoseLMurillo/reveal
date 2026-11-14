import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isPasswordLengthValid,
  needsRehash,
  verifyPassword,
  verifyPasswordOrDummy,
} from "../src/utils/password.js";

describe("Argon2id", () => {
  it("hashea y verifica una contraseña", async () => {
    const hash = await hashPassword("una-contraseña-larga");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword(hash, "una-contraseña-larga")).resolves.toBe(true);
    await expect(verifyPassword(hash, "incorrecta")).resolves.toBe(false);
  });

  it("no falla con hashes corruptos", async () => {
    await expect(verifyPassword("no-es-un-hash", "x")).resolves.toBe(false);
  });

  it("consume tiempo y devuelve false cuando el admin no existe", async () => {
    await expect(verifyPasswordOrDummy(null, "cualquiera")).resolves.toBe(false);
  });

  it("detecta parámetros obsoletos", async () => {
    const hash = await hashPassword("otra-contraseña-larga");
    expect(needsRehash(hash)).toBe(false);
    expect(needsRehash("$argon2id$v=19$m=1024,t=1,p=1$c2FsdA$aGFzaA")).toBe(true);
  });

  it("valida longitudes de contraseña", () => {
    expect(isPasswordLengthValid("corta")).toBe(false);
    expect(isPasswordLengthValid("una-contraseña-valida")).toBe(true);
    expect(isPasswordLengthValid("x".repeat(129))).toBe(false);
  });
});
