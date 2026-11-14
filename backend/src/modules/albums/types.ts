import type { AlbumStatus, AlbumVisibility, PhotoVoteValue } from "@rollo/shared";

import type { PhotoRecord } from "../photos/types.js";

export type AlbumRecord = {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverPhotoId: string | null;
  status: AlbumStatus;
  visibility: AlbumVisibility;
  generatedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlbumPhotoRecord = PhotoRecord & {
  albumPhotoId: string;
  albumEventDay: string;
  position: number;
  caption: string | null;
  participantDisplayName: string | null;
};

export type GalleryPhotoRecord = PhotoRecord & {
  participantDisplayName: string | null;
};

export type VoteRecord = {
  photoId: string;
  participantId: string;
  eventId: string;
  value: PhotoVoteValue;
  eventDay: string;
};

export type VoteCounts = {
  likes: number;
  dislikes: number;
};

export type EventPhotoDayStat = {
  eventDay: string;
  totalPhotos: number;
  votedPhotos: number;
};

export type VoteFeedPhotoRecord = GalleryPhotoRecord & VoteCounts;
