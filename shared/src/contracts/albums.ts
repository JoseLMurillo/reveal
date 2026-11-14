import { z } from "zod";

import {
  ALBUM_STATUSES,
  ALBUM_VISIBILITIES,
  GALLERY_VISIBILITIES,
  PHOTO_VOTE_VALUES,
} from "../enums/index.js";
import { isoDateSchema, isoDateTimeSchema, slugSchema, uuidSchema } from "./common.js";

export const generateAlbumSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  visibility: z.enum(ALBUM_VISIBILITIES).optional(),
  coverPhotoId: uuidSchema.optional(),
});

export type GenerateAlbumInput = z.infer<typeof generateAlbumSchema>;

export const updateAlbumSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  visibility: z.enum(ALBUM_VISIBILITIES).optional(),
  coverPhotoId: uuidSchema.optional(),
  status: z.enum(ALBUM_STATUSES).optional(),
});

export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;

export const albumPhotoSchema = z.object({
  id: uuidSchema,
  url: z.string().url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  author: z.object({ displayName: z.string() }).nullable(),
  caption: z.string().nullable(),
});

export type AlbumPhoto = z.infer<typeof albumPhotoSchema>;

export const albumDaySchema = z.object({
  eventDay: isoDateSchema,
  dayNumber: z.number().int().positive(),
  photos: z.array(albumPhotoSchema),
});

export type AlbumDay = z.infer<typeof albumDaySchema>;

export const albumStatsSchema = z.object({
  totalPhotos: z.number().int().nonnegative(),
  totalParticipants: z.number().int().nonnegative(),
  totalDays: z.number().int().nonnegative(),
});

export type AlbumStats = z.infer<typeof albumStatsSchema>;

export const publicAlbumSchema = z.object({
  album: z.object({
    slug: slugSchema,
    eventSlug: slugSchema,
    title: z.string(),
    subtitle: z.string().nullable(),
    eventName: z.string(),
    eventDates: z.object({ start: isoDateSchema, end: isoDateSchema }),
    coverUrl: z.string().url().nullable(),
    publishedAt: isoDateTimeSchema,
  }),
  days: z.array(albumDaySchema),
  stats: albumStatsSchema,
});

export type PublicAlbum = z.infer<typeof publicAlbumSchema>;

export const galleryPhotoSchema = albumPhotoSchema.extend({
  uploadedAt: isoDateTimeSchema,
});

export type GalleryPhoto = z.infer<typeof galleryPhotoSchema>;

export const galleryDaySchema = z.object({
  eventDay: isoDateSchema,
  dayNumber: z.number().int().positive(),
  photos: z.array(galleryPhotoSchema),
});

export type GalleryDay = z.infer<typeof galleryDaySchema>;

export const publicGallerySchema = z.object({
  event: z.object({
    slug: slugSchema,
    name: z.string(),
    showParticipantNames: z.boolean(),
    galleryVisibility: z.enum(GALLERY_VISIBILITIES),
    publicAlbumSlug: slugSchema.nullable(),
  }),
  days: z.array(galleryDaySchema),
  stats: albumStatsSchema,
});

export type PublicGallery = z.infer<typeof publicGallerySchema>;

export const albumDetailSchema = z.object({
  album: z.object({
    id: uuidSchema,
    eventId: uuidSchema,
    slug: slugSchema,
    title: z.string(),
    subtitle: z.string().nullable(),
    coverPhotoId: uuidSchema.nullable(),
    coverUrl: z.string().url().nullable(),
    status: z.enum(ALBUM_STATUSES),
    visibility: z.enum(ALBUM_VISIBILITIES),
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
  days: z.array(albumDaySchema),
  stats: albumStatsSchema,
});

export type AlbumDetail = z.infer<typeof albumDetailSchema>;

export const albumExportQuerySchema = z.object({
  day: isoDateSchema.optional(),
});

export type AlbumExportQuery = z.infer<typeof albumExportQuerySchema>;

export const voteDaySchema = z.object({
  eventDay: isoDateSchema,
  dayNumber: z.number().int().positive(),
  totalPhotos: z.number().int().nonnegative(),
  votedPhotos: z.number().int().nonnegative(),
});

export type VoteDay = z.infer<typeof voteDaySchema>;

export const votePhotoSchema = galleryPhotoSchema.extend({
  likes: z.number().int().nonnegative(),
  dislikes: z.number().int().nonnegative(),
});

export type VotePhoto = z.infer<typeof votePhotoSchema>;

export const voteFeedSchema = z.object({
  event: z.object({
    slug: slugSchema,
    name: z.string(),
    timezone: z.string(),
  }),
  selectedDay: isoDateSchema,
  days: z.array(voteDaySchema),
  photos: z.array(votePhotoSchema),
  results: z.array(votePhotoSchema),
  counts: z.object({
    liked: z.number().int().nonnegative(),
    disliked: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  }),
});

export type VoteFeed = z.infer<typeof voteFeedSchema>;

export const voteInputSchema = z.object({
  value: z.enum(PHOTO_VOTE_VALUES),
});

export type VoteInput = z.infer<typeof voteInputSchema>;

export const voteResultSchema = z.object({
  photoId: uuidSchema,
  value: z.enum(PHOTO_VOTE_VALUES),
  likes: z.number().int().nonnegative(),
  dislikes: z.number().int().nonnegative(),
});

export type VoteResult = z.infer<typeof voteResultSchema>;
