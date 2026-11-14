import { describe, expect, it } from "vitest";

import {
  generateOpaqueToken,
  hashToken,
  isSha256Hex,
  safeEqualHex,
  tokenPrefix,
} from "../src/utils/token.js";

describe("tokens opacos", () => {
  it("genera tokens base64url de la longitud esperada", () => {
    const token = generateOpaqueToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(42);
  });

  it("genera valores distintos", () => {
    const values = new Set(Array.from({ length: 50 }, () => generateOpaqueToken(16)));
    expect(values.size).toBe(50);
  });

  it("hashea con SHA-256 hexadecimal", () => {
    const hash = hashToken("un-token");
    expect(isSha256Hex(hash)).toBe(true);
    expect(hash).toHaveLength(64);
    expect(hashToken("un-token")).toBe(hash);
    expect(hashToken("otro-token")).not.toBe(hash);
  });

  it("rechaza longitudes inválidas", () => {
    expect(() => generateOpaqueToken(8)).toThrow(RangeError);
    expect(() => generateOpaqueToken(128)).toThrow(RangeError);
  });

  it("compara hashes en tiempo constante y rechaza formatos inválidos", () => {
    const left = hashToken("a");
    expect(safeEqualHex(left, left)).toBe(true);
    expect(safeEqualHex(left, hashToken("b"))).toBe(false);
    expect(safeEqualHex(left, "no-hex")).toBe(false);
  });

  it("extrae un prefijo seguro", () => {
    expect(tokenPrefix("abcdefghijkl", 8)).toBe("abcdefgh");
    expect(tokenPrefix("abc", 8)).toBe("abc");
  });
});
