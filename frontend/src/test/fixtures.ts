import type {
  AdminActivityEntry,
  AdminEventDetail,
  AdminEventPhotoStats,
  AdminParticipant,
  AdminParticipantCreateResult,
  AdminPhoto,
  AlbumDetail,
  ParticipantMe,
  Photo,
  PublicAlbum,
  PublicEvent,
  PublicGallery,
  VoteFeed,
} from "@rollo/shared";

export const EVENT_ID = "11111111-1111-4111-8111-111111111111";
export const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
export const SESSION_TOKEN = "a".repeat(64);
export const ACCESS_CODE = "b".repeat(32);

export const participantMeFixture: ParticipantMe = {
  participant: {
    id: PARTICIPANT_ID,
    displayName: "Ana",
    anonymous: false,
    registrationSource: "self",
    createdAt: "2026-11-12T15:00:00.000Z",
  },
  session: { expiresAt: "2026-11-20T15:00:00.000Z" },
  event: {
    id: EVENT_ID,
    slug: "cumple-ana",
    name: "Cumple de Ana",
    status: "active",
    effectiveStatus: "active",
    timezone: "America/Mexico_City",
    startDate: "2026-11-12",
    endDate: "2026-11-15",
    maxFileSizeBytes: 10_485_760,
  },
  quota: {
    eventDay: "2026-11-13",
    dayNumber: 2,
    dailyLimit: 3,
    totalLimit: 12,
    usedDay: 1,
    usedTotal: 1,
    reservedDay: 0,
    reservedTotal: 0,
    remainingDay: 2,
    remainingTotal: 11,
    resetsAt: "2026-11-14T06:00:00.000Z",
    eventStatus: "active",
  },
  permissions: {
    canUpload: true,
    canDeletePhotos: false,
    canViewGallery: true,
    canChangeName: true,
  },
};

export const publicEventFixture: PublicEvent = {
  slug: "cumple-ana",
  name: "Cumple de Ana",
  description: "Una tarde para revelar recuerdos juntos.",
  coverUrl: null,
  startDate: "2026-11-12",
  endDate: "2026-11-15",
  timezone: "America/Mexico_City",
  status: "active",
  effectiveStatus: "active",
  currentEventDay: "2026-11-13",
  dayNumber: 2,
  totalDays: 4,
  dailyPhotoLimit: 3,
  totalPhotoLimit: 12,
  requireName: false,
  showParticipantNames: true,
  maxFileSizeBytes: 10_485_760,
  galleryVisibility: "participants",
  allowPhotoDeletion: false,
  registration: {
    limit: 10,
    used: 2,
    remaining: 8,
    enabled: true,
    open: true,
    reason: null,
  },
  canRegister: true,
  quotaResetsAt: "2026-11-14T06:00:00.000Z",
  publicAlbumSlug: null,
};

export const adminEventDetailFixture: AdminEventDetail = {
  id: EVENT_ID,
  slug: "cumple-ana",
  name: "Cumple de Ana",
  description: null,
  coverUrl: null,
  startDate: "2026-11-12",
  endDate: "2026-11-15",
  timezone: "America/Mexico_City",
  dailyPhotoLimit: 3,
  totalPhotoLimit: 12,
  requireName: false,
  showParticipantNames: true,
  allowSelfRegistration: true,
  participantLimit: 10,
  maxFileSizeBytes: 10_485_760,
  galleryVisibility: "participants",
  allowPhotoDeletion: false,
  status: "active",
  createdAt: "2026-11-01T15:00:00.000Z",
  updatedAt: "2026-11-01T15:00:00.000Z",
  counts: {
    participants: 1,
    participantLimit: 10,
    remainingSlots: 9,
    photos: 1,
    photosToday: 1,
  },
  album: null,
};

export const adminParticipantFixture: AdminParticipant = {
  id: PARTICIPANT_ID,
  displayName: "Ana",
  anonymous: false,
  note: "Mesa 4",
  registrationSource: "admin",
  accessCodePrefix: "abc123",
  accessCodeStatus: "active",
  isActive: true,
  createdAt: "2026-11-12T15:00:00.000Z",
  lastSeenAt: "2026-11-13T15:00:00.000Z",
  photosTotal: 1,
  photosToday: 1,
  remainingToday: 2,
};

export const adminCreateResultFixture: AdminParticipantCreateResult = {
  participant: {
    id: PARTICIPANT_ID,
    displayName: "Ana",
    anonymous: false,
    registrationSource: "admin",
    note: "Mesa 4",
    accessCodePrefix: "abc123",
    isActive: true,
    createdAt: "2026-11-12T15:00:00.000Z",
    lastSeenAt: "2026-11-12T15:00:00.000Z",
  },
  access: {
    code: ACCESS_CODE,
    url: `https://rollo.test/e/cumple-ana/a/${ACCESS_CODE}`,
    createdAt: "2026-11-12T15:00:00.000Z",
  },
  registration: {
    limit: 10,
    used: 1,
    remaining: 9,
  },
};

export const photoFixture: Photo = {
  id: "33333333-3333-4333-8333-333333333333",
  url: "https://storage.test/events/cumple/originals/2026-11-13/foto.jpg",
  width: 1600,
  height: 1200,
  eventDay: "2026-11-13",
  uploadedAt: "2026-11-13T18:00:00.000Z",
  originalFilename: "IMG_0001.jpg",
  mimeType: "image/jpeg",
  fileSize: 2_048_000,
  canDelete: true,
};

export const adminPhotoFixture: AdminPhoto = {
  id: photoFixture.id,
  url: photoFixture.url,
  width: photoFixture.width,
  height: photoFixture.height,
  eventDay: photoFixture.eventDay,
  uploadedAt: photoFixture.uploadedAt,
  originalFilename: photoFixture.originalFilename,
  mimeType: photoFixture.mimeType,
  fileSize: photoFixture.fileSize,
  status: "active",
  deletedAt: null,
  participant: {
    id: PARTICIPANT_ID,
    displayName: "Ana",
    anonymous: false,
  },
};

export const adminPhotoStatsFixture: AdminEventPhotoStats = {
  event: {
    id: EVENT_ID,
    name: "Cumple de Ana",
    status: "active",
  },
  totals: {
    participants: 12,
    anonymousParticipants: 2,
    photos: 184,
    photosToday: 24,
    storageBytes: 356_515_840,
    deletedPhotos: 3,
  },
  byDay: [
    {
      eventDay: "2026-11-12",
      dayNumber: 1,
      photos: 80,
      participants: 9,
    },
    {
      eventDay: "2026-11-13",
      dayNumber: 2,
      photos: 24,
      participants: 5,
    },
  ],
  topParticipants: [
    { participantId: PARTICIPANT_ID, displayName: "Ana", photos: 32 },
    { participantId: "44444444-4444-4444-8444-444444444444", displayName: null, photos: 12 },
  ],
};

export const adminActivityFixture: AdminActivityEntry = {
  id: 99,
  action: "photo.deleted",
  entityType: "photo",
  entityId: photoFixture.id,
  metadata: { eventDay: "2026-11-13" },
  createdAt: "2026-11-13T19:00:00.000Z",
};

export const publicGalleryFixture: PublicGallery = {
  event: {
    slug: "cumple-ana",
    name: "Cumple de Ana",
    showParticipantNames: true,
    galleryVisibility: "participants",
    publicAlbumSlug: "album-cumple-ana",
  },
  days: [
    {
      eventDay: "2026-11-13",
      dayNumber: 2,
      photos: [
        {
          id: photoFixture.id,
          url: photoFixture.url,
          width: 1600,
          height: 1200,
          author: { displayName: "Ana" },
          caption: null,
          uploadedAt: photoFixture.uploadedAt,
        },
      ],
    },
  ],
  stats: { totalPhotos: 1, totalParticipants: 1, totalDays: 1 },
};

export const publicAlbumFixture: PublicAlbum = {
  album: {
    slug: "album-cumple-ana",
    eventSlug: "cumple-ana",
    title: "Los mejores momentos",
    subtitle: "Una tarde para revelar recuerdos.",
    eventName: "Cumple de Ana",
    eventDates: { start: "2026-11-12", end: "2026-11-15" },
    coverUrl: photoFixture.url,
    publishedAt: "2026-11-16T12:00:00.000Z",
  },
  days: [
    {
      eventDay: "2026-11-13",
      dayNumber: 2,
      photos: [
        {
          id: photoFixture.id,
          url: photoFixture.url,
          width: 1600,
          height: 1200,
          author: { displayName: "Ana" },
          caption: null,
        },
      ],
    },
  ],
  stats: { totalPhotos: 1, totalParticipants: 1, totalDays: 1 },
};

export const albumDetailFixture: AlbumDetail = {
  album: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventId: EVENT_ID,
    slug: "album-cumple-ana",
    title: "Los mejores momentos",
    subtitle: "Una tarde para revelar recuerdos.",
    coverPhotoId: photoFixture.id,
    coverUrl: photoFixture.url,
    status: "draft",
    visibility: "public",
    publishedAt: null,
    createdAt: "2026-11-16T12:00:00.000Z",
    updatedAt: "2026-11-16T12:00:00.000Z",
  },
  days: publicAlbumFixture.days,
  stats: publicAlbumFixture.stats,
};

export const voteFeedFixture: VoteFeed = {
  event: { slug: "cumple-ana", name: "Cumple de Ana", timezone: "America/Mexico_City" },
  selectedDay: "2026-11-13",
  days: [
    {
      eventDay: "2026-11-13",
      dayNumber: 2,
      totalPhotos: 2,
      votedPhotos: 0,
    },
  ],
  photos: [
    {
      id: photoFixture.id,
      url: photoFixture.url,
      width: 1600,
      height: 1200,
      author: { displayName: "Beto" },
      caption: null,
      uploadedAt: photoFixture.uploadedAt,
      likes: 2,
      dislikes: 0,
    },
  ],
  results: [
    {
      id: photoFixture.id,
      url: photoFixture.url,
      width: 1600,
      height: 1200,
      author: { displayName: "Beto" },
      caption: null,
      uploadedAt: photoFixture.uploadedAt,
      likes: 2,
      dislikes: 0,
    },
  ],
  counts: { liked: 0, disliked: 0, remaining: 1 },
};
