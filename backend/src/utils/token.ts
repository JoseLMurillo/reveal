import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Genera un token opaco criptográficamente seguro en base64url.
 * Por defecto 32 bytes (256 bits). Los códigos de acceso usan 16 bytes (128 bits).
 */
export function generateOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 64) {
    throw new RangeError("El token debe tener entre 16 y 64 bytes.");
  }

  return randomBytes(byteLength).toString("base64url");
}

/**
 * El servidor nunca almacena el token en claro: guarda su SHA-256 hexadecimal.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX.test(value);
}

/**
 * Compara dos hashes hexadecimales en tiempo constante.
 */
export function safeEqualHex(left: string, right: string): boolean {
  if (!isSha256Hex(left) || !isSha256Hex(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/**
 * Compara dos tokens opacos en tiempo constante. La longitud forma parte de la
 * comparación: tokens de distinta longitud nunca son válidos.
 */
export function safeEqualToken(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function tokenPrefix(token: string, length = 8): string {
  const safeLength = Math.min(Math.max(length, 4), 12);
  return token.slice(0, safeLength);
}
