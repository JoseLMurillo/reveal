import type {
  AccessCodeActionInput,
  AdminAccessCodeRevokeResult,
  AdminAccessCodeRotateResult,
  AdminActivityEntry,
  AdminBulkCreateParticipantsInput,
  AdminCreateParticipantInput,
  AdminDashboard,
  AdminEventActivityQuery,
  AdminEventCreateResult,
  AdminEventDetail,
  AdminEventListQuery,
  AdminEventPhotoStats,
  AdminEventSummary,
  AdminLoginResponse,
  AdminMeResponse,
  AdminParticipant,
  AdminParticipantBulkResult,
  AdminParticipantCreateResult,
  AdminParticipantListQuery,
  AdminPhoto,
  AdminPhotoListQuery,
  AdminUpdateParticipantInput,
  AlbumDetail,
  CancelEventInput,
  GenerateAlbumInput,
  UpdateAlbumInput,
  ChangePasswordInput,
  CreateEventInput,
  LoginInput,
  PaginationMeta,
  UpdateEventInput,
} from "@rollo/shared";

import { env } from "@/config/env";

import { apiBlob, apiRequest, apiRequestEnvelope } from "./api";

export type AdminEventPage = {
  data: AdminEventSummary[];
  meta: PaginationMeta;
};

export type AdminParticipantPage = {
  data: AdminParticipant[];
  meta: PaginationMeta;
};

export type AdminPhotoPage = {
  data: AdminPhoto[];
  meta: PaginationMeta;
};

export type AdminActivityPage = {
  data: AdminActivityEntry[];
  meta: PaginationMeta;
};

export type CoverUploadTarget = {
  storagePath: string;
  signedUrl: string;
  token: string;
  expiresAt: string;
};

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export const adminApi = {
  login(input: LoginInput): Promise<AdminLoginResponse> {
    return apiRequest<AdminLoginResponse>("/admin/auth/login", {
      method: "POST",
      body: input,
    });
  },

  logout(): Promise<void> {
    return apiRequest<void>("/admin/auth/logout", { method: "POST" });
  },

  me(): Promise<AdminMeResponse> {
    return apiRequest<AdminMeResponse>("/admin/auth/me");
  },

  changePassword(input: ChangePasswordInput): Promise<void> {
    return apiRequest<void>("/admin/auth/password", {
      method: "POST",
      body: input,
    });
  },

  dashboard(): Promise<AdminDashboard> {
    return apiRequest<AdminDashboard>("/admin/dashboard");
  },

  async listEvents(query: AdminEventListQuery): Promise<AdminEventPage> {
    const envelope = await apiRequestEnvelope<AdminEventSummary[]>(
      `/admin/events${queryString({
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        from: query.from,
        to: query.to,
      })}`,
    );

    const meta = envelope.meta ?? {};

    return {
      data: envelope.data,
      meta: {
        page: Number(meta.page ?? query.page),
        limit: Number(meta.limit ?? query.limit),
        total: Number(meta.total ?? envelope.data.length),
        totalPages: Number(meta.totalPages ?? 1),
      },
    };
  },

  detail(id: string): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}`);
  },

  create(input: CreateEventInput): Promise<AdminEventCreateResult> {
    return apiRequest<AdminEventCreateResult>("/admin/events", {
      method: "POST",
      body: input,
    });
  },

  update(id: string, input: UpdateEventInput): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}`, {
      method: "PATCH",
      body: input,
    });
  },

  schedule(id: string): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}/schedule`, { method: "POST" });
  },

  activate(id: string): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}/activate`, { method: "POST" });
  },

  finish(id: string): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}/finish`, { method: "POST" });
  },

  cancel(id: string, input: CancelEventInput): Promise<AdminEventDetail> {
    return apiRequest<AdminEventDetail>(`/admin/events/${id}/cancel`, {
      method: "POST",
      body: input,
    });
  },

  duplicate(id: string): Promise<AdminEventCreateResult> {
    return apiRequest<AdminEventCreateResult>(`/admin/events/${id}/duplicate`, {
      method: "POST",
    });
  },

  remove(id: string, confirmName: string): Promise<{ cleanupQueued: boolean }> {
    return apiRequest<{ cleanupQueued: boolean }>(`/admin/events/${id}`, {
      method: "DELETE",
      body: { confirmName },
    });
  },

  coverIntent(
    id: string,
    input: { filename: string; mimeType: string; sizeBytes: number },
  ): Promise<CoverUploadTarget> {
    return apiRequest<CoverUploadTarget>(`/admin/events/${id}/cover/upload-intent`, {
      method: "POST",
      body: input,
    });
  },

  confirmCover(
    id: string,
    storagePath: string,
  ): Promise<{ coverUrl: string | null; coverImagePath: string }> {
    return apiRequest<{ coverUrl: string | null; coverImagePath: string }>(
      `/admin/events/${id}/cover/confirm`,
      { method: "POST", body: { storagePath } },
    );
  },

  deleteCover(id: string): Promise<void> {
    return apiRequest<void>(`/admin/events/${id}/cover`, { method: "DELETE" });
  },

  qrBlob(id: string, format: "png" | "svg", size: number): Promise<Blob> {
    return apiBlob(`/admin/events/${id}/qr?format=${format}&size=${size}`);
  },

  async listParticipants(
    eventId: string,
    query: AdminParticipantListQuery,
  ): Promise<AdminParticipantPage> {
    const envelope = await apiRequestEnvelope<AdminParticipant[]>(
      `/admin/events/${eventId}/participants${queryString({
        page: query.page,
        limit: query.limit,
        search: query.search,
        anonymous: query.anonymous === undefined ? undefined : String(query.anonymous),
        isActive: query.isActive === undefined ? undefined : String(query.isActive),
        source: query.source,
      })}`,
    );

    const meta = envelope.meta ?? {};

    return {
      data: envelope.data,
      meta: {
        page: Number(meta.page ?? query.page),
        limit: Number(meta.limit ?? query.limit),
        total: Number(meta.total ?? envelope.data.length),
        totalPages: Number(meta.totalPages ?? 1),
      },
    };
  },

  createParticipant(
    eventId: string,
    input: AdminCreateParticipantInput,
  ): Promise<AdminParticipantCreateResult> {
    return apiRequest<AdminParticipantCreateResult>(`/admin/events/${eventId}/participants`, {
      method: "POST",
      body: input,
    });
  },

  bulkCreateParticipants(
    eventId: string,
    input: AdminBulkCreateParticipantsInput,
  ): Promise<AdminParticipantBulkResult> {
    return apiRequest<AdminParticipantBulkResult>(`/admin/events/${eventId}/participants/bulk`, {
      method: "POST",
      body: input,
    });
  },

  updateParticipant(
    participantId: string,
    input: AdminUpdateParticipantInput,
  ): Promise<AdminParticipant> {
    return apiRequest<AdminParticipant>(`/admin/participants/${participantId}`, {
      method: "PATCH",
      body: input,
    });
  },

  regenerateAccessCode(
    participantId: string,
    input: AccessCodeActionInput,
  ): Promise<AdminAccessCodeRotateResult> {
    return apiRequest<AdminAccessCodeRotateResult>(
      `/admin/participants/${participantId}/access-code/regenerate`,
      { method: "POST", body: input },
    );
  },

  revokeAccessCode(
    participantId: string,
    input: AccessCodeActionInput,
  ): Promise<AdminAccessCodeRevokeResult> {
    return apiRequest<AdminAccessCodeRevokeResult>(
      `/admin/participants/${participantId}/access-code/revoke`,
      { method: "POST", body: input },
    );
  },

  async listPhotos(eventId: string, query: AdminPhotoListQuery): Promise<AdminPhotoPage> {
    const envelope = await apiRequestEnvelope<AdminPhoto[]>(
      `/admin/events/${eventId}/photos${queryString({
        page: query.page,
        limit: query.limit,
        day: query.day,
        participantId: query.participantId,
        search: query.search,
        includeDeleted:
          query.includeDeleted === undefined ? undefined : String(query.includeDeleted),
      })}`,
    );

    const meta = envelope.meta ?? {};

    return {
      data: envelope.data,
      meta: {
        page: Number(meta.page ?? query.page),
        limit: Number(meta.limit ?? query.limit),
        total: Number(meta.total ?? envelope.data.length),
        totalPages: Number(meta.totalPages ?? 1),
      },
    };
  },

  deletePhoto(photoId: string): Promise<{ deleted: true }> {
    return apiRequest<{ deleted: true }>(`/admin/photos/${photoId}`, { method: "DELETE" });
  },

  downloadPhotoUrl(eventId: string, photoId: string): string {
    return `${env.apiUrl}/admin/events/${eventId}/photos/${photoId}/download`;
  },

  photoStats(eventId: string): Promise<AdminEventPhotoStats> {
    return apiRequest<AdminEventPhotoStats>(`/admin/events/${eventId}/statistics`);
  },

  album(eventId: string): Promise<AlbumDetail> {
    return apiRequest<AlbumDetail>(`/admin/events/${eventId}/album`);
  },

  generateAlbum(eventId: string, input: GenerateAlbumInput): Promise<AlbumDetail> {
    return apiRequest<AlbumDetail>(`/admin/events/${eventId}/album`, {
      method: "POST",
      body: input,
    });
  },

  updateAlbum(eventId: string, input: UpdateAlbumInput): Promise<AlbumDetail> {
    return apiRequest<AlbumDetail>(`/admin/events/${eventId}/album`, {
      method: "PATCH",
      body: input,
    });
  },

  albumZipUrl(eventId: string, day?: string): string {
    const query = day ? `?day=${encodeURIComponent(day)}` : "";
    return `${env.apiUrl}/admin/events/${eventId}/export/zip${query}`;
  },

  async activity(eventId: string, query: AdminEventActivityQuery): Promise<AdminActivityPage> {
    const envelope = await apiRequestEnvelope<AdminActivityEntry[]>(
      `/admin/events/${eventId}/activity${queryString({
        page: query.page,
        limit: query.limit,
      })}`,
    );

    const meta = envelope.meta ?? {};

    return {
      data: envelope.data,
      meta: {
        page: Number(meta.page ?? query.page),
        limit: Number(meta.limit ?? query.limit),
        total: Number(meta.total ?? envelope.data.length),
        totalPages: Number(meta.totalPages ?? 1),
      },
    };
  },
};
