import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { ReadinessCheckResult } from "../src/services/health.service.js";
import { testEnv } from "./fixtures.js";

const logger = pino({ level: "silent" });

function buildApp(result: ReadinessCheckResult = { database: "ok", storage: "ok" }) {
  return createApp({
    env: testEnv,
    logger,
    checkReadiness: async () => result,
  });
}

describe("GET /health", () => {
  it("responde con el estado del proceso y un request id", async () => {
    const response = await request(buildApp()).get("/health").expect(200);

    expect(response.body).toMatchObject({ data: { status: "ok" } });
    expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("conserva un request id válido enviado por el cliente", async () => {
    const response = await request(buildApp())
      .get("/health")
      .set("X-Request-Id", "client-request-1234")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("client-request-1234");
  });

  it("reemplaza un request id inválido", async () => {
    const response = await request(buildApp())
      .get("/health")
      .set("X-Request-Id", "mal id")
      .expect(200);

    expect(response.headers["x-request-id"]).not.toBe("mal id");
  });
});

describe("GET /health/ready", () => {
  it("responde ready cuando las dependencias están bien", async () => {
    const response = await request(buildApp()).get("/health/ready").expect(200);

    expect(response.body).toEqual({
      status: "ready",
      checks: { database: "ok", storage: "ok" },
    });
  });

  it("responde 503 sin revelar detalles internos", async () => {
    const response = await request(
      buildApp({
        database: "error",
        storage: "ok",
        errors: { database: "connection refused secret-host" },
      }),
    )
      .get("/health/ready")
      .expect(503);

    expect(response.body).toEqual({
      status: "unavailable",
      checks: { database: "error", storage: "ok" },
    });
    expect(JSON.stringify(response.body)).not.toContain("secret-host");
  });
});

describe("manejo de rutas y errores", () => {
  it("devuelve un sobre de error consistente en 404", async () => {
    const response = await request(buildApp()).get("/no-existe").expect(404);

    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      requestId: response.headers["x-request-id"],
    });
  });

  it("rechaza JSON inválido con 400", async () => {
    const response = await request(buildApp())
      .post("/no-existe")
      .set("Content-Type", "application/json")
      .send('{"roto":')
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
