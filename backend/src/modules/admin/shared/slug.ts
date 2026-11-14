import { randomBytes } from "node:crypto";

const MAX_SLUG_LENGTH = 80;
const BASE_SLUG_LENGTH = 60;

/**
 * Convierte un nombre libre en un slug estable. Los acentos se descomponen y
 * se eliminan, de modo que "Cumpleaños de Ana" sea "cumpleanos-de-ana".
 */
export function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BASE_SLUG_LENGTH)
    .replace(/-+$/g, "");

  if (normalized.length >= 3) {
    return normalized;
  }

  return "evento";
}

function randomSuffix(): string {
  return randomBytes(3).toString("hex").slice(0, 5);
}

/**
 * Genera un slug único consultando la base de datos. El sufijo aleatorio se
 * añade solo cuando el slug base ya existe, tal como promete la API.
 */
export async function generateUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);

  if (!(await exists(base))) {
    return base;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomSuffix();
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffix.length - 1)}-${suffix}`;

    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  return `${base.slice(0, MAX_SLUG_LENGTH - 14)}-${randomSuffix()}${randomSuffix()}`;
}
