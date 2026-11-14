export const EVENT_STATUSES = ["draft", "scheduled", "active", "finished", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_EFFECTIVE_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "out_of_dates",
  "finished",
  "cancelled",
] as const;
export type EventEffectiveStatus = (typeof EVENT_EFFECTIVE_STATUSES)[number];

export const GALLERY_VISIBILITIES = ["private", "participants", "public"] as const;
export type GalleryVisibility = (typeof GALLERY_VISIBILITIES)[number];

export const ALBUM_VISIBILITIES = ["private", "public"] as const;
export type AlbumVisibility = (typeof ALBUM_VISIBILITIES)[number];

export const ALBUM_STATUSES = ["draft", "published"] as const;
export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

export const PHOTO_STATUSES = ["active", "deleted"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

export const UPLOAD_SESSION_STATUSES = [
  "reserved",
  "completed",
  "partially_completed",
  "expired",
  "cancelled",
] as const;
export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export const UPLOAD_ITEM_STATUSES = [
  "reserved",
  "uploaded",
  "confirmed",
  "failed",
  "expired",
  "cancelled",
] as const;
export type UploadItemStatus = (typeof UPLOAD_ITEM_STATUSES)[number];

export const ADMIN_ROLES = ["owner", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PARTICIPANT_SOURCES = ["admin", "self"] as const;
export type ParticipantSource = (typeof PARTICIPANT_SOURCES)[number];

export const CLEANUP_STATUSES = ["pending", "processing", "done", "failed"] as const;
export type CleanupStatus = (typeof CLEANUP_STATUSES)[number];

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const PHOTO_VOTE_VALUES = ["like", "dislike"] as const;
export type PhotoVoteValue = (typeof PHOTO_VOTE_VALUES)[number];

export const REGISTRATION_REASONS = [
  "event_not_active",
  "event_out_of_dates",
  "limit_reached",
  "disabled",
] as const;
export type RegistrationReason = (typeof REGISTRATION_REASONS)[number];
