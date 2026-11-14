import type {
  ConfirmUploadInput,
  ConfirmUploadResult,
  DeletePhotoResult,
  Photo,
  PhotoListQuery,
  ReleaseUploadInput,
  ReleaseUploadResult,
  UploadIntentInput,
  UploadIntentResult,
  UploadItemResult,
  UploadSessionSummary,
} from "@rollo/shared";
import { MAX_UPLOAD_ITEMS } from "@rollo/shared";

import type { Env } from "../../config/env.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { eventDayInTimezone, isWithinEventDates } from "../../utils/event-time.js";
import { randomUUID } from "node:crypto";
import type { AuthenticatedParticipant } from "../participants/participants.service.js";
import type { PhotoStorageService } from "./photos.storage.js";
import type {
  ConfirmItemEntry,
  ConfirmRpcItemResult,
  PhotoRecord,
  QuotaRecord,
  UploadItemRecord,
  UploadSessionRecord,
} from "./types.js";
import type { PhotosRepository } from "./photos.repository.js";

export type PhotosService = {
  uploadIntent(
    auth: AuthenticatedParticipant,
    input: UploadIntentInput,
  ): Promise<UploadIntentResult>;
  confirm(auth: AuthenticatedParticipant, input: ConfirmUploadInput): Promise<ConfirmUploadResult>;
  release(auth: AuthenticatedParticipant, input: ReleaseUploadInput): Promise<ReleaseUploadResult>;
  listMine(
    auth: AuthenticatedParticipant,
    query: PhotoListQuery,
  ): Promise<{ rows: Photo[]; total: number }>;
  deleteMine(auth: AuthenticatedParticipant, photoId: string): Promise<DeletePhotoResult>;
};

function quotaSummary(quota: QuotaRecord): {
  eventDay: string;
  remainingDay: number;
  remainingTotal: number | null;
} {
  return {
    eventDay: quota.eventDay,
    remainingDay: quota.remainingDay,
    remainingTotal: quota.remainingTotal,
  };
}

function summaryOf(session: UploadSessionRecord): UploadSessionSummary {
  return {
    id: session.id,
    status: session.status,
    uploadedCount: session.uploadedCount,
    releasedCount: session.releasedCount,
    eventDay: session.eventDay,
  };
}

function pendingErrorMessage(error: unknown): string {
  return error instanceof AppError ? error.message : "El archivo no se pudo validar.";
}

function pendingErrorCode(error: unknown): string {
  return error instanceof AppError ? error.code : ERROR_CODES.INVALID_FILE_TYPE;
}

export function createPhotosService(deps: {
  env: Env;
  repository: PhotosRepository;
  storage: PhotoStorageService;
  now?: () => Date;
}): PhotosService {
  const now = deps.now ?? (() => new Date());

  function assertUploadAllowed(auth: AuthenticatedParticipant): string {
    if (auth.event.status !== "active") {
      throw conflict(ERROR_CODES.EVENT_NOT_ACTIVE, "El evento no está activo en este momento.");
    }

    const current = now();
    const day = eventDayInTimezone(auth.event.timezone, current);

    if (!isWithinEventDates(auth.event, day)) {
      throw conflict(ERROR_CODES.EVENT_OUT_OF_DATES, "Hoy está fuera de las fechas del evento.");
    }

    return day;
  }

  async function loadSession(
    auth: AuthenticatedParticipant,
    sessionId: string,
  ): Promise<UploadSessionRecord> {
    const session = await deps.repository.findSession(sessionId);

    if (!session || session.participantId !== auth.participant.id) {
      throw notFound("La sesión de carga no existe o ya no está disponible.");
    }

    return session;
  }

  function photoOf(auth: AuthenticatedParticipant, photo: PhotoRecord, url: string): Photo {
    const day = eventDayInTimezone(auth.event.timezone, now());
    const canDelete =
      auth.event.allowPhotoDeletion &&
      auth.event.status === "active" &&
      isWithinEventDates(auth.event, day);

    return {
      id: photo.id,
      url,
      width: photo.width,
      height: photo.height,
      eventDay: photo.eventDay,
      uploadedAt: photo.uploadedAt,
      originalFilename: photo.originalFilename,
      mimeType: photo.mimeType,
      fileSize: photo.fileSize,
      canDelete,
    };
  }

  return {
    async uploadIntent(auth, input) {
      const eventDay = assertUploadAllowed(auth);

      if (input.files.length > deps.env.MAX_FILES_PER_UPLOAD) {
        throw badRequest(
          `Puedes subir como máximo ${deps.env.MAX_FILES_PER_UPLOAD} fotos a la vez.`,
        );
      }

      for (const file of input.files) {
        if (file.sizeBytes > auth.event.maxFileSizeBytes) {
          throw new AppError(
            413,
            ERROR_CODES.FILE_TOO_LARGE,
            `«${file.filename}» supera el límite de ${Math.round(
              auth.event.maxFileSizeBytes / 1_048_576,
            )} MB.`,
          );
        }
      }

      const items = input.files.map((file) => {
        const itemId = randomUUID();

        return {
          itemId,
          clientFileId: file.clientFileId,
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          storagePath: deps.storage.pathFor(
            {
              eventId: auth.event.id,
              eventDay,
              participantId: auth.participant.id,
              itemId,
            },
            file.mimeType,
          ),
        };
      });

      const reserved = await deps.repository.reserve(
        auth.participant.id,
        items,
        deps.env.UPLOAD_SESSION_TTL_SECONDS,
      );

      try {
        const uploads = await Promise.all(
          items.map(async (item) => {
            const target = await deps.storage.createUploadTarget(item.storagePath);

            return {
              itemId: item.itemId,
              clientFileId: item.clientFileId,
              storagePath: item.storagePath,
              signedUrl: target.signedUrl,
              token: target.token,
              expiresAt: target.expiresAt,
            };
          }),
        );

        return {
          sessionId: reserved.sessionId,
          eventDay: reserved.eventDay,
          expiresAt: reserved.expiresAt,
          quota: {
            remainingDay: reserved.remainingDay,
            remainingTotal: reserved.remainingTotal,
          },
          uploads,
        };
      } catch (error) {
        await deps.repository
          .release(reserved.sessionId, auth.participant.id, null, "upload_target_failed")
          .catch(() => undefined);
        throw internalError(error);
      }
    },

    async confirm(auth, input) {
      const session = await loadSession(auth, input.sessionId);
      const quota = await deps.repository.getQuota(auth.participant.id);

      if (session.status !== "reserved") {
        return { session: summaryOf(session), results: [], quota: quotaSummary(quota) };
      }

      if (new Date(session.expiresAt).getTime() <= now().getTime()) {
        await deps.repository.confirm(session.id, auth.participant.id, []);
        throw conflict(
          ERROR_CODES.SESSION_EXPIRED,
          "La sesión de carga expiró. Vuelve a intentarlo.",
        );
      }

      const requestedIds =
        input.items && input.items.length > 0
          ? [...new Set(input.items.map((item) => item.itemId))].slice(0, MAX_UPLOAD_ITEMS)
          : null;

      const pending = await deps.repository.listPendingItems(session.id, requestedIds ?? undefined);
      const pendingById = new Map(pending.map((item) => [item.id, item]));

      const entries: ConfirmItemEntry[] = [];
      const invalid: Array<{ item: UploadItemRecord; error: unknown }> = [];
      const results: UploadItemResult[] = [];

      if (requestedIds) {
        for (const itemId of requestedIds) {
          if (!pendingById.has(itemId)) {
            results.push({
              itemId,
              clientFileId: itemId,
              status: "failed",
              error: {
                code: "UPLOAD_ITEM_NOT_FOUND",
                message: "El archivo no pertenece a esta sesión de carga.",
              },
            });
          }
        }
      }

      for (const item of pending) {
        try {
          const validated = await deps.storage.validateOriginal(
            {
              eventId: session.eventId,
              eventDay: session.eventDay,
              participantId: session.participantId,
              itemId: item.id,
            },
            item.storagePath,
            item.declaredMimeType,
            auth.event.maxFileSizeBytes,
          );

          entries.push({
            itemId: item.id,
            mimeType: validated.mimeType,
            fileSize: validated.fileSize,
            width: validated.width,
            height: validated.height,
            contentHash: validated.contentHash,
          });
        } catch (error) {
          invalid.push({ item, error });
        }
      }

      let rpcResults: ConfirmRpcItemResult[] = [];

      if (entries.length > 0) {
        const confirmed = await deps.repository.confirm(session.id, auth.participant.id, entries);
        rpcResults = confirmed.results;
      }

      if (invalid.length > 0) {
        await deps.repository.release(
          session.id,
          auth.participant.id,
          invalid.map((entry) => entry.item.id),
          "invalid_file",
        );
      }

      for (const entry of invalid) {
        results.push({
          itemId: entry.item.id,
          clientFileId: entry.item.clientFileId,
          status: "failed",
          error: {
            code: pendingErrorCode(entry.error),
            message: pendingErrorMessage(entry.error),
          },
        });
      }

      for (const result of rpcResults) {
        results.push({
          itemId: result.itemId,
          clientFileId: result.clientFileId ?? result.itemId,
          status: result.status,
          ...(result.photoId ? { photoId: result.photoId } : {}),
          ...(result.error ? { error: result.error } : {}),
        });
      }

      const updated = (await deps.repository.findSession(session.id)) ?? session;
      const refreshedQuota = await deps.repository.getQuota(auth.participant.id);

      return {
        session: summaryOf(updated),
        results,
        quota: quotaSummary(refreshedQuota),
      };
    },

    async release(auth, input) {
      const session = await loadSession(auth, input.sessionId);

      if (session.status !== "reserved") {
        const quota = await deps.repository.getQuota(auth.participant.id);
        return { session: summaryOf(session), releasedNow: 0, quota: quotaSummary(quota) };
      }

      const released = await deps.repository.release(
        session.id,
        auth.participant.id,
        null,
        "client_released",
      );
      const updated = (await deps.repository.findSession(session.id)) ?? session;
      const quota = await deps.repository.getQuota(auth.participant.id);

      return {
        session: {
          ...summaryOf(updated),
          status: released.status,
          uploadedCount: released.uploadedCount,
          releasedCount: released.releasedCount,
        },
        releasedNow: released.releasedNow,
        quota: quotaSummary(quota),
      };
    },

    async listMine(auth, query) {
      const result = await deps.repository.listPhotos(auth.participant.id, {
        page: query.page,
        limit: query.limit,
        day: query.day,
      });

      const urls = await Promise.all(
        result.rows.map((photo) => deps.storage.createSignedUrl(photo.storagePath)),
      );

      return {
        rows: result.rows.map((photo, index) => photoOf(auth, photo, urls[index] ?? "")),
        total: result.total,
      };
    },

    async deleteMine(auth, photoId) {
      const photo = await deps.repository.findPhoto(photoId);

      if (!photo || photo.participantId !== auth.participant.id || photo.status !== "active") {
        throw notFound("La fotografía no existe o ya fue eliminada.");
      }

      if (!auth.event.allowPhotoDeletion) {
        throw forbidden("Este evento no permite borrar fotografías.");
      }

      assertUploadAllowed(auth);
      await deps.repository.softDeletePhoto(photo.id, null);
      const quota = await deps.repository.getQuota(auth.participant.id);

      return {
        deleted: true,
        quota: {
          eventDay: quota.eventDay,
          remainingDay: quota.remainingDay,
          remainingTotal: quota.remainingTotal,
        },
      };
    },
  };
}
