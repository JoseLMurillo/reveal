import type { ApiErrorBody, ApiSuccess } from "@rollo/shared";

import { env } from "@/config/env";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requestId?: string;

  public constructor(
    message: string,
    options: { status: number; code: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

function isApiErrorBody(payload: unknown): payload is ApiErrorBody {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return false;
  }

  const error = (payload as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  );
}

function isApiSuccess<T>(payload: unknown): payload is ApiSuccess<T> {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const payload = await apiRequestEnvelope<T>(path, options);
  return payload.data;
}

export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

async function execute(path: string, options: ApiRequestOptions): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = readCookie("rollo_csrf");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const url = `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    return await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
      body:
        hasBody && options.body !== undefined
          ? options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body)
          : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("No se pudo conectar con el servidor. Revisa tu conexión.", {
      status: 0,
      code: "NETWORK_ERROR",
    });
  }
}

async function throwForResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const requestId = response.headers.get("x-request-id") ?? undefined;
  const text = await response.text();
  let payload: unknown;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = undefined;
    }
  }

  if (isApiErrorBody(payload)) {
    throw new ApiError(payload.error.message, {
      status: response.status,
      code: payload.error.code,
      details: payload.error.details,
      requestId: payload.error.requestId ?? requestId,
    });
  }

  throw new ApiError("El servidor no pudo completar la solicitud.", {
    status: response.status,
    code: response.status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR",
    requestId,
  });
}

export async function apiRequestEnvelope<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const response = await execute(path, options);

  await throwForResponse(response);

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const text = await response.text();
  let payload: unknown;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = undefined;
    }
  }

  if (payload === undefined) {
    return { data: undefined as T };
  }

  if (isApiSuccess<T>(payload)) {
    return {
      data: payload.data,
      meta: payload.meta,
    };
  }

  return { data: payload as T };
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await execute(path, {});
  await throwForResponse(response);
  return response.blob();
}
