import type {
  ConfirmUploadInput,
  ConfirmUploadResult,
  DeletePhotoResult,
  PaginationMeta,
  ParticipantMe,
  Photo,
  PhotoListQuery,
  PublicAlbum,
  PublicEvent,
  PublicEventStatus,
  PublicGallery,
  VoteFeed,
  VoteInput,
  VoteResult,
  Quota,
  RedeemAccessCodeInput,
  RedeemAccessResponse,
  RegisterParticipantInput,
  RegisterParticipantResponse,
  ReleaseUploadInput,
  ReleaseUploadResult,
  UpdateParticipantInput,
  UploadIntentInput,
  UploadIntentResult,
} from "@rollo/shared";

import { apiRequest, apiRequestEnvelope } from "./api";

export type PhotoPage = {
  data: Photo[];
  meta: PaginationMeta;
};

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

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

export const publicApi = {
  event(slug: string): Promise<PublicEvent> {
    return apiRequest<PublicEvent>(`/public/events/${encodeURIComponent(slug)}`);
  },

  status(slug: string): Promise<PublicEventStatus> {
    return apiRequest<PublicEventStatus>(`/public/events/${encodeURIComponent(slug)}/status`);
  },

  redeem(slug: string, input: RedeemAccessCodeInput): Promise<RedeemAccessResponse> {
    return apiRequest<RedeemAccessResponse>(
      `/public/events/${encodeURIComponent(slug)}/access/redeem`,
      { method: "POST", body: input },
    );
  },

  register(slug: string, input: RegisterParticipantInput): Promise<RegisterParticipantResponse> {
    return apiRequest<RegisterParticipantResponse>(
      `/public/events/${encodeURIComponent(slug)}/register`,
      { method: "POST", body: input },
    );
  },

  me(token: string): Promise<ParticipantMe> {
    return apiRequest<ParticipantMe>("/participants/me", { headers: bearer(token) });
  },

  updateMe(token: string, input: UpdateParticipantInput): Promise<ParticipantMe> {
    return apiRequest<ParticipantMe>("/participants/me", {
      method: "PATCH",
      headers: bearer(token),
      body: input,
    });
  },

  quota(token: string): Promise<Quota> {
    return apiRequest<Quota>("/participants/me/quota", { headers: bearer(token) });
  },

  uploadIntent(token: string, input: UploadIntentInput): Promise<UploadIntentResult> {
    return apiRequest<UploadIntentResult>("/photos/upload-intent", {
      method: "POST",
      headers: bearer(token),
      body: input,
    });
  },

  confirmUpload(token: string, input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
    return apiRequest<ConfirmUploadResult>("/photos/confirm", {
      method: "POST",
      headers: bearer(token),
      body: input,
    });
  },

  releaseUpload(token: string, input: ReleaseUploadInput): Promise<ReleaseUploadResult> {
    return apiRequest<ReleaseUploadResult>("/photos/release", {
      method: "POST",
      headers: bearer(token),
      body: input,
    });
  },

  async photos(token: string, query: PhotoListQuery): Promise<PhotoPage> {
    const envelope = await apiRequestEnvelope<Photo[]>(
      `/photos/mine${queryString({
        page: query.page,
        limit: query.limit,
        day: query.day,
      })}`,
      { headers: bearer(token) },
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

  deletePhoto(token: string, photoId: string): Promise<DeletePhotoResult> {
    return apiRequest<DeletePhotoResult>(`/photos/${photoId}`, {
      method: "DELETE",
      headers: bearer(token),
    });
  },

  gallery(slug: string, options: { token?: string | null; day?: string }): Promise<PublicGallery> {
    return apiRequest<PublicGallery>(
      `/public/events/${encodeURIComponent(slug)}/gallery${queryString({ day: options.day })}`,
      options.token ? { headers: bearer(options.token) } : {},
    );
  },

  album(slug: string): Promise<PublicAlbum> {
    return apiRequest<PublicAlbum>(`/public/albums/${encodeURIComponent(slug)}`);
  },

  voteFeed(slug: string, token: string, options: { day?: string } = {}): Promise<VoteFeed> {
    return apiRequest<VoteFeed>(
      `/public/events/${encodeURIComponent(slug)}/vote${queryString({ day: options.day })}`,
      { headers: bearer(token) },
    );
  },

  vote(token: string, photoId: string, input: VoteInput): Promise<VoteResult> {
    return apiRequest<VoteResult>(`/photos/${photoId}/vote`, {
      method: "POST",
      headers: bearer(token),
      body: input,
    });
  },
};
