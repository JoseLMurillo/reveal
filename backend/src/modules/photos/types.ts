import type {
  AllowedImageMimeType,
  PhotoStatus,
  Quota,
  UploadItemStatus,
  UploadSessionStatus,
} from "@rollo/shared";

export type PhotoRecord = {
  id: string;
  eventId: string;
  participantId: string;
  uploadItemId: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: AllowedImageMimeType;
  fileSize: number;
  width: number | null;
  height: number | null;
  contentHash: string;
  eventDay: string;
  uploadedAt: string;
  status: PhotoStatus;
  deletedAt: string | null;
  deletedByAdminId: string | null;
};

export type UploadSessionRecord = {
  id: string;
  eventId: string;
  participantId: string;
  eventDay: string;
  reservedCount: number;
  uploadedCount: number;
  releasedCount: number;
  status: UploadSessionStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type UploadItemRecord = {
  id: string;
  uploadSessionId: string;
  clientFileId: string;
  storagePath: string;
  declaredFilename: string;
  declaredMimeType: AllowedImageMimeType;
  declaredSizeBytes: number;
  status: UploadItemStatus;
  failureCode: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type QuotaRecord = Quota;

export type ReserveItemInput = {
  itemId: string;
  clientFileId: string;
  storagePath: string;
  filename: string;
  mimeType: AllowedImageMimeType;
  sizeBytes: number;
};

export type ReserveRpcResult = {
  sessionId: string;
  eventDay: string;
  expiresAt: string;
  remainingDay: number;
  remainingTotal: number | null;
};

export type ConfirmItemEntry = {
  itemId: string;
  mimeType: AllowedImageMimeType;
  fileSize: number;
  width: number;
  height: number;
  contentHash: string;
};

export type ConfirmRpcItemResult = {
  itemId: string;
  clientFileId: string | null;
  status: UploadItemStatus;
  photoId?: string;
  error?: { code: string; message: string };
};

export type ConfirmRpcResult = {
  sessionId: string;
  status: UploadSessionStatus;
  expired: boolean;
  uploadedCount: number;
  releasedCount: number;
  eventDay: string;
  results: ConfirmRpcItemResult[];
};

export type ReleaseRpcResult = {
  sessionId: string;
  status: UploadSessionStatus;
  releasedNow: number;
  uploadedCount: number;
  releasedCount: number;
};

export type PhotoPage = {
  rows: PhotoRecord[];
  total: number;
};

export type PhotoWithParticipant = PhotoRecord & {
  participantDisplayName: string | null;
};

export type AdminPhotoPage = {
  rows: PhotoWithParticipant[];
  total: number;
};

export type PhotoListFilters = {
  page: number;
  limit: number;
  day?: string;
};

export type AdminPhotoListFilters = PhotoListFilters & {
  participantId?: string;
  search?: string;
  includeDeleted?: boolean;
};
