import argon2 from "argon2";

/**
 * Parámetros OWASP para Argon2id: 19 MiB, 2 iteraciones, 1 hilo.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

let dummyHashPromise: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash("rollo-dummy-password-for-timing", ARGON2_OPTIONS);
  return dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Verifica una contraseña aunque el administrador no exista. El coste de la
 * verificación ficticia evita distinguir emails registrados por tiempo de respuesta.
 */
export async function verifyPasswordOrDummy(
  hash: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!hash) {
    try {
      await argon2.verify(await getDummyHash(), password);
    } catch {
      // La verificación ficticia solo consume tiempo; el resultado es siempre falso.
    }
    return false;
  }

  return verifyPassword(hash, password);
}

export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}

export function isPasswordLengthValid(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
