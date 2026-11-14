import type {
  AlbumDay,
  AlbumPhoto,
  AlbumStats,
  GalleryDay,
  GalleryPhoto,
  PublicAlbum,
  PublicGallery,
  VoteFeed,
  VoteInput,
  VotePhoto,
  VoteResult,
} from "@rollo/shared";

import { forbidden, notFound } from "../../errors/app-error.js";
import { dayNumberFor, eventDayInTimezone, isWithinEventDates } from "../../utils/event-time.js";
import type { EventRecord } from "../admin/shared/types.js";
import type { AuthenticatedParticipant } from "../participants/participants.service.js";
import type { PhotoStorageService } from "../photos/photos.storage.js";
import type { AlbumRepository } from "./albums.repository.js";
import type {
  AlbumPhotoRecord,
  AlbumRecord,
  GalleryPhotoRecord,
  VoteCounts,
  VoteRecord,
} from "./types.js";

export type AlbumsPublicService = {
  gallery(
    slug: string,
    day: string | undefined,
    auth: AuthenticatedParticipant | null,
  ): Promise<PublicGallery>;
  album(slug: string): Promise<PublicAlbum>;
  voteFeed(
    slug: string,
    day: string | undefined,
    auth: AuthenticatedParticipant,
  ): Promise<VoteFeed>;
  vote(photoId: string, input: VoteInput, auth: AuthenticatedParticipant): Promise<VoteResult>;
};

function notPublished(): ReturnType<typeof notFound> {
  return notFound("El evento no existe.");
}

function authorOf(event: EventRecord, displayName: string | null): { displayName: string } | null {
  if (!event.showParticipantNames || displayName === null) {
    return null;
  }

  return { displayName };
}

function statsOf(photos: Array<{ participantId: string }>, dayCount: number): AlbumStats {
  return {
    totalPhotos: photos.length,
    totalParticipants: new Set(photos.map((photo) => photo.participantId)).size,
    totalDays: dayCount,
  };
}

function countsFromVotes(votes: VoteRecord[]): Map<string, VoteCounts> {
  const counts = new Map<string, VoteCounts>();

  for (const vote of votes) {
    const current = counts.get(vote.photoId) ?? { likes: 0, dislikes: 0 };

    if (vote.value === "like") {
      current.likes += 1;
    } else {
      current.dislikes += 1;
    }

    counts.set(vote.photoId, current);
  }

  return counts;
}

function emptyCounts(): VoteCounts {
  return { likes: 0, dislikes: 0 };
}

export function createAlbumsPublicService(deps: {
  repository: AlbumRepository;
  storage: PhotoStorageService;
  now?: () => Date;
}): AlbumsPublicService {
  const now = deps.now ?? (() => new Date());

  async function loadVisibleEvent(slug: string): Promise<EventRecord> {
    const event = await deps.repository.findEventBySlug(slug);

    if (!event || event.status === "draft" || event.status === "cancelled") {
      throw notPublished();
    }

    return event;
  }

  async function galleryPhotoOf(
    event: EventRecord,
    photo: GalleryPhotoRecord,
  ): Promise<GalleryPhoto> {
    return {
      id: photo.id,
      url: await deps.storage.createSignedUrl(photo.storagePath),
      width: photo.width,
      height: photo.height,
      author: authorOf(event, photo.participantDisplayName),
      caption: null,
      uploadedAt: photo.uploadedAt,
    };
  }

  async function albumPhotoOf(event: EventRecord, photo: AlbumPhotoRecord): Promise<AlbumPhoto> {
    return {
      id: photo.id,
      url: await deps.storage.createSignedUrl(photo.storagePath),
      width: photo.width,
      height: photo.height,
      author: authorOf(event, photo.participantDisplayName),
      caption: photo.caption,
    };
  }

  async function albumDetailOf(event: EventRecord, album: AlbumRecord): Promise<PublicAlbum> {
    const records = (await deps.repository.listAlbumPhotos(album.id)).filter(
      (photo) => photo.status === "active",
    );
    const days: AlbumDay[] = [];
    const grouped = new Map<string, AlbumPhotoRecord[]>();

    for (const photo of records) {
      const list = grouped.get(photo.albumEventDay) ?? [];
      list.push(photo);
      grouped.set(photo.albumEventDay, list);
    }

    for (const [eventDay, photos] of [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      days.push({
        eventDay,
        dayNumber: dayNumberFor(event.startDate, eventDay),
        photos: await Promise.all(photos.map((photo) => albumPhotoOf(event, photo))),
      });
    }

    const coverRecord = records.find((photo) => photo.id === album.coverPhotoId) ?? records[0];
    const coverUrl = coverRecord
      ? await deps.storage.createSignedUrl(coverRecord.storagePath)
      : null;
    const stats = statsOf(records, days.length);

    return {
      album: {
        slug: album.slug,
        eventSlug: event.slug,
        title: album.title,
        subtitle: album.subtitle,
        eventName: event.name,
        eventDates: { start: event.startDate, end: event.endDate },
        coverUrl,
        publishedAt: album.publishedAt ?? album.createdAt,
      },
      days,
      stats,
    };
  }

  async function votePhotoOf(
    event: EventRecord,
    photo: GalleryPhotoRecord,
    counts: VoteCounts,
  ): Promise<VotePhoto> {
    return {
      ...(await galleryPhotoOf(event, photo)),
      likes: counts.likes,
      dislikes: counts.dislikes,
    };
  }

  function assertParticipantEvent(auth: AuthenticatedParticipant, event: EventRecord): void {
    if (auth.event.id !== event.id) {
      throw forbidden("Este evento pertenece a otro enlace de participante.");
    }
  }

  return {
    async gallery(slug, day, auth) {
      const event = await loadVisibleEvent(slug);

      if (event.galleryVisibility === "private") {
        throw forbidden("La galería de este evento es privada.");
      }

      if (event.galleryVisibility === "participants") {
        if (!auth) {
          throw forbidden("Necesitas una sesión de participante para ver esta galería.");
        }

        assertParticipantEvent(auth, event);
      }

      const photos = await deps.repository.listEventPhotos(event.id, day);
      const grouped = new Map<string, GalleryPhotoRecord[]>();

      for (const photo of photos) {
        const list = grouped.get(photo.eventDay) ?? [];
        list.push(photo);
        grouped.set(photo.eventDay, list);
      }

      const days: GalleryDay[] = [];

      for (const [eventDay, records] of [...grouped.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        days.push({
          eventDay,
          dayNumber: dayNumberFor(event.startDate, eventDay),
          photos: await Promise.all(records.map((photo) => galleryPhotoOf(event, photo))),
        });
      }

      const album = await deps.repository.findAlbumByEvent(event.id);
      const publicAlbumSlug =
        album && album.status === "published" && album.visibility === "public" ? album.slug : null;

      return {
        event: {
          slug: event.slug,
          name: event.name,
          showParticipantNames: event.showParticipantNames,
          galleryVisibility: event.galleryVisibility,
          publicAlbumSlug,
        },
        days,
        stats: statsOf(photos, days.length),
      };
    },

    async album(slug) {
      const album = await deps.repository.findAlbumBySlug(slug);

      if (!album) {
        throw notFound("El álbum no existe o no está publicado.");
      }

      const event = await deps.repository.findEventById(album.eventId);

      if (!event || event.status === "draft" || event.status === "cancelled") {
        throw notFound("El álbum no existe o no está publicado.");
      }

      return albumDetailOf(event, album);
    },

    async voteFeed(slug, day, auth) {
      const event = await loadVisibleEvent(slug);
      assertParticipantEvent(auth, event);

      const allPhotos = (await deps.repository.listEventPhotos(event.id)).filter(
        (photo) => photo.participantId !== auth.participant.id,
      );
      const votes = await deps.repository.listVotesForParticipant(auth.participant.id, event.id);
      const votedIds = new Set(votes.map((vote) => vote.photoId));
      const votesByDay = new Map<string, VoteRecord[]>();

      for (const vote of votes) {
        const list = votesByDay.get(vote.eventDay) ?? [];
        list.push(vote);
        votesByDay.set(vote.eventDay, list);
      }

      const days = [...new Set(allPhotos.map((photo) => photo.eventDay))].sort().map((eventDay) => {
        const dayPhotos = allPhotos.filter((photo) => photo.eventDay === eventDay);
        const dayVotes = votesByDay.get(eventDay) ?? [];

        return {
          eventDay,
          dayNumber: dayNumberFor(event.startDate, eventDay),
          totalPhotos: dayPhotos.length,
          votedPhotos: dayVotes.length,
        };
      });

      const current = eventDayInTimezone(event.timezone, now());
      const fallbackDay =
        days.find((item) => item.eventDay === current)?.eventDay ??
        days.at(-1)?.eventDay ??
        (isWithinEventDates(event, current) ? current : event.endDate);
      const selectedDay = day ?? fallbackDay;

      const dayVotes = await deps.repository.listVotesForDay(event.id, selectedDay);
      const counts = countsFromVotes(dayVotes);
      const feedRecords = allPhotos.filter(
        (photo) => photo.eventDay === selectedDay && !votedIds.has(photo.id),
      );
      const feed = await Promise.all(
        feedRecords.map((photo) =>
          votePhotoOf(event, photo, counts.get(photo.id) ?? emptyCounts()),
        ),
      );

      const rankedRecords = allPhotos
        .filter((photo) => photo.eventDay === selectedDay)
        .sort((left, right) => {
          const leftCounts = counts.get(left.id) ?? emptyCounts();
          const rightCounts = counts.get(right.id) ?? emptyCounts();

          if (rightCounts.likes !== leftCounts.likes) {
            return rightCounts.likes - leftCounts.likes;
          }

          if (leftCounts.dislikes !== rightCounts.dislikes) {
            return leftCounts.dislikes - rightCounts.dislikes;
          }

          return left.uploadedAt.localeCompare(right.uploadedAt);
        })
        .filter((photo) => (counts.get(photo.id)?.likes ?? 0) > 0)
        .slice(0, 5);

      const results = await Promise.all(
        rankedRecords.map((photo) =>
          votePhotoOf(event, photo, counts.get(photo.id) ?? emptyCounts()),
        ),
      );
      const dayVotesForMe = votesByDay.get(selectedDay) ?? [];

      return {
        event: { slug: event.slug, name: event.name, timezone: event.timezone },
        selectedDay,
        days,
        photos: feed,
        results,
        counts: {
          liked: dayVotesForMe.filter((vote) => vote.value === "like").length,
          disliked: dayVotesForMe.filter((vote) => vote.value === "dislike").length,
          remaining: feedRecords.length,
        },
      };
    },

    async vote(photoId, input, auth) {
      const photo = await deps.repository.findEventPhoto(auth.event.id, photoId);

      if (!photo || photo.status !== "active") {
        throw notFound("La fotografía no existe o ya no está disponible.");
      }

      if (photo.participantId === auth.participant.id) {
        throw forbidden("No puedes votar por tu propia fotografía.");
      }

      await deps.repository.upsertVote({
        eventId: photo.eventId,
        eventDay: photo.eventDay,
        photoId: photo.id,
        participantId: auth.participant.id,
        value: input.value,
      });
      const counts = await deps.repository.countVotes(photo.id);

      return {
        photoId: photo.id,
        value: input.value,
        likes: counts.likes,
        dislikes: counts.dislikes,
      };
    },
  };
}
