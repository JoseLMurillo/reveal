import type { AccessCodeStatus, ParticipantSource } from "@rollo/shared";
import type { Quota } from "@rollo/shared";

export type ParticipantRecord = {
  id: string;
  eventId: string;
  displayName: string | null;
  note: string | null;
  registrationSource: ParticipantSource;
  accessCodeHash: string;
  accessCodePrefix: string;
  accessCodeCreatedAt: string;
  accessCodeRevokedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type ParticipantSessionRecord = {
  id: string;
  participantId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export type QuotaRecord = Quota;

export type ParticipantPhotoStats = {
  photosTotal: number;
  photosToday: number;
  reservedToday: number;
};

export type ParticipantListFilters = {
  page: number;
  limit: number;
  search?: string;
  anonymous?: boolean;
  isActive?: boolean;
  source?: ParticipantSource;
};

export type ParticipantListResult = {
  rows: ParticipantRecord[];
  total: number;
};

export type RedeemRpcResult = {
  participantId: string;
  displayName: string | null;
  eventId: string;
  eventDay: string;
  eventStatus: string;
  sessionExpiresAt: string;
};

export type RegisterRpcResult = {
  participantId: string;
  displayName: string | null;
  eventId: string;
  eventDay: string;
  createdAt: string;
  sessionExpiresAt: string;
  remainingSlots: number | null;
};

export type CreatedParticipantRow = {
  id: string;
  eventId: string;
  displayName: string | null;
  note: string | null;
  registrationSource: ParticipantSource;
  accessCodePrefix: string;
  accessCodeCreatedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type CreateParticipantsResult = {
  participants: CreatedParticipantRow[];
  remainingSlots: number | null;
};

export type AdminParticipantRow = ParticipantRecord & ParticipantPhotoStats;

export function accessCodeStatusOf(participant: ParticipantRecord): AccessCodeStatus {
  if (participant.accessCodeRevokedAt !== null) {
    return "revoked";
  }

  if (!participant.accessCodeHash) {
    return "none";
  }

  return "active";
}
