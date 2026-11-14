import type { AdminRole, EventStatus, GalleryVisibility } from "@rollo/shared";

export type AdminRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string;
  createdAt: string;
};

export type AdminSessionRecord = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export type AuthenticatedAdmin = {
  admin: AdminRecord;
  sessionId: string;
  expiresAt: string;
  idleExpiresAt: string;
};

export type EventRecord = {
  id: string;
  adminId: string;
  slug: string;
  name: string;
  description: string | null;
  coverImagePath: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  dailyPhotoLimit: number;
  totalPhotoLimit: number | null;
  requireName: boolean;
  showParticipantNames: boolean;
  allowSelfRegistration: boolean;
  participantLimit: number | null;
  maxFileSizeBytes: number;
  galleryVisibility: GalleryVisibility;
  allowPhotoDeletion: boolean;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};

export type EventStats = {
  participants: number;
  photos: number;
  photosToday: number;
  quotaConsumedToday: number;
};

export type AlbumSummary = {
  id: string;
  slug: string;
  status: "draft" | "published";
  visibility: "private" | "public";
};

export type AuditEntry = {
  id: number;
  action: string;
  eventId: string | null;
  eventName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditInput = {
  adminId: string | null;
  eventId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
};

export type EventListFilters = {
  page: number;
  limit: number;
  status?: EventStatus;
  search?: string;
  from?: string;
  to?: string;
};

export type EventListResult = {
  rows: EventRecord[];
  total: number;
};

export type EventCreateValues = {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  timezone: string;
  dailyPhotoLimit: number;
  totalPhotoLimit?: number | null;
  requireName: boolean;
  showParticipantNames: boolean;
  allowSelfRegistration: boolean;
  participantLimit?: number | null;
  maxFileSizeBytes: number;
  galleryVisibility: GalleryVisibility;
  allowPhotoDeletion: boolean;
};

export type EventUpdateValues = Partial<EventCreateValues>;
