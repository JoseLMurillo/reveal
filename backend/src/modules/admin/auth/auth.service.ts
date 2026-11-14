import type { ChangePasswordInput, LoginInput } from "@rollo/shared";

import { AppError, badRequest, unauthorized } from "../../../errors/app-error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import type { Env } from "../../../config/env.js";
import { generateOpaqueToken, hashToken } from "../../../utils/token.js";
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "../../../utils/password.js";
import type { AuditRepository } from "../shared/audit.repository.js";
import type { AdminRecord, AuthenticatedAdmin } from "../shared/types.js";
import type { AdminRepository, AdminSessionRepository } from "./auth.repository.js";

export type LoginContext = {
  ipHash: string | null;
  userAgent: string | null;
};

export type LoginResult = {
  admin: AdminRecord;
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
  idleExpiresAt: string;
};

export type AuthService = {
  login(input: LoginInput, context: LoginContext): Promise<LoginResult>;
  authenticate(sessionToken: string): Promise<AuthenticatedAdmin>;
  logout(auth: AuthenticatedAdmin, context: LoginContext): Promise<void>;
  changePassword(
    auth: AuthenticatedAdmin,
    input: ChangePasswordInput,
    context: LoginContext,
  ): Promise<void>;
};

function toIso(date: Date): string {
  return date.toISOString();
}

function minIso(left: string, right: string): string {
  return left < right ? left : right;
}

function invalidCredentials(): AppError {
  return new AppError(
    401,
    ERROR_CODES.INVALID_CREDENTIALS,
    "El correo o la contraseña no son correctos.",
  );
}

export function createAuthService(deps: {
  env: Env;
  admins: AdminRepository;
  sessions: AdminSessionRepository;
  audit: AuditRepository;
  now?: () => Date;
}): AuthService {
  const now = deps.now ?? (() => new Date());
  const ttlSeconds = deps.env.ADMIN_SESSION_TTL_SECONDS;
  const idleSeconds = deps.env.ADMIN_SESSION_IDLE_SECONDS;

  return {
    async login(input, context) {
      const admin = await deps.admins.findByEmail(input.email);

      if (!admin) {
        await verifyPasswordOrDummy(null, input.password);
        throw invalidCredentials();
      }

      const passwordValid = await verifyPasswordOrDummy(admin.passwordHash, input.password);

      if (!passwordValid || !admin.isActive) {
        throw invalidCredentials();
      }

      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
      const idleExpiresAt = new Date(createdAt.getTime() + idleSeconds * 1000);
      const sessionToken = generateOpaqueToken(32);
      const csrfToken = generateOpaqueToken(32);

      const session = await deps.sessions.create({
        adminUserId: admin.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: toIso(expiresAt),
        ipHash: context.ipHash,
        userAgent: context.userAgent,
      });

      await deps.admins.touchLastLogin(admin.id);

      await deps.audit.record({
        adminId: admin.id,
        action: "admin.login",
        entityType: "admin_user",
        entityId: admin.id,
        ipHash: context.ipHash,
      });

      return {
        admin,
        sessionId: session.id,
        sessionToken,
        csrfToken,
        expiresAt: toIso(expiresAt),
        idleExpiresAt: minIso(toIso(idleExpiresAt), toIso(expiresAt)),
      };
    },

    async authenticate(sessionToken) {
      if (!sessionToken) {
        throw unauthorized();
      }

      const session = await deps.sessions.findByTokenHash(hashToken(sessionToken));

      if (!session || session.revokedAt !== null) {
        throw unauthorized();
      }

      const current = now();
      const expiresAt = new Date(session.expiresAt);
      const lastUsedAt = new Date(session.lastUsedAt);

      if (current >= expiresAt) {
        throw unauthorized("La sesión expiró. Vuelve a iniciar sesión.");
      }

      const idleDeadline = new Date(lastUsedAt.getTime() + idleSeconds * 1000);

      if (current >= idleDeadline) {
        await deps.sessions.revoke(session.id);
        throw unauthorized("La sesión expiró por inactividad. Vuelve a iniciar sesión.");
      }

      const admin = await deps.admins.findById(session.adminUserId);

      if (!admin) {
        await deps.sessions.revoke(session.id);
        throw unauthorized();
      }

      if (!admin.isActive) {
        await deps.sessions.revoke(session.id);
        throw new AppError(
          403,
          ERROR_CODES.ADMIN_DISABLED,
          "La cuenta de administrador está deshabilitada.",
        );
      }

      const renewedIdle = new Date(current.getTime() + idleSeconds * 1000);
      const idleExpiresAt = minIso(toIso(renewedIdle), session.expiresAt);

      await deps.sessions.touch(session.id, toIso(current));

      return {
        admin,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        idleExpiresAt,
      };
    },

    async logout(auth, context) {
      await deps.sessions.revoke(auth.sessionId);
      await deps.audit.record({
        adminId: auth.admin.id,
        action: "admin.logout",
        entityType: "admin_session",
        entityId: auth.sessionId,
        ipHash: context.ipHash,
      });
    },

    async changePassword(auth, input, context) {
      const valid = await verifyPassword(auth.admin.passwordHash, input.currentPassword);

      if (!valid) {
        throw badRequest("La contraseña actual no es correcta.", {
          field: "currentPassword",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await deps.admins.updatePassword(auth.admin.id, passwordHash);
      await deps.sessions.revokeAllForAdmin(auth.admin.id);
      await deps.audit.record({
        adminId: auth.admin.id,
        action: "admin.password_changed",
        entityType: "admin_user",
        entityId: auth.admin.id,
        ipHash: context.ipHash,
      });
    },
  };
}
