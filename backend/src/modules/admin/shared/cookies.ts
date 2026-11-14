import type { CookieOptions, Response } from "express";

import type { Env } from "../../../config/env.js";

export const ADMIN_SESSION_COOKIE = "rollo_admin_session";
export const ADMIN_CSRF_COOKIE = "rollo_csrf";

function baseOptions(env: Env): CookieOptions {
  return {
    path: "/",
    secure: env.isProduction,
    sameSite: "lax",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAdminCookies(
  res: Response,
  env: Env,
  sessionToken: string,
  csrfToken: string,
  maxAgeSeconds: number,
): void {
  const options = baseOptions(env);

  res.cookie(ADMIN_SESSION_COOKIE, sessionToken, {
    ...options,
    httpOnly: true,
    maxAge: maxAgeSeconds * 1000,
  });

  res.cookie(ADMIN_CSRF_COOKIE, csrfToken, {
    ...options,
    httpOnly: false,
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearAdminCookies(res: Response, env: Env): void {
  const options = baseOptions(env);

  res.clearCookie(ADMIN_SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(ADMIN_CSRF_COOKIE, { ...options, httpOnly: false });
}
