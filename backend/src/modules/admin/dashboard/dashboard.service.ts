import type { AdminDashboard } from "@rollo/shared";

import type { AuditRepository } from "../shared/audit.repository.js";
import { canAccessEvent } from "../shared/access.js";
import type { StatsRepository } from "../shared/stats.repository.js";
import type { StorageService } from "../shared/storage.service.js";
import type { EventRepository } from "../events/events.repository.js";
import type { AdminRecord, EventRecord, EventStats, AuditEntry } from "../shared/types.js";

export type DashboardService = {
  get(admin: AdminRecord): Promise<AdminDashboard>;
};

const EMPTY_STATS: EventStats = {
  participants: 0,
  photos: 0,
  photosToday: 0,
  quotaConsumedToday: 0,
};

const STATUS_ORDER: Record<EventRecord["status"], number> = {
  active: 0,
  scheduled: 1,
  draft: 2,
  finished: 3,
  cancelled: 4,
};

export function createDashboardService(deps: {
  events: EventRepository;
  stats: StatsRepository;
  audit: AuditRepository;
  storage: StorageService;
  activityLimit?: number;
  eventLimit?: number;
}): DashboardService {
  const activityLimit = deps.activityLimit ?? 8;
  const eventLimit = deps.eventLimit ?? 8;

  return {
    async get(admin) {
      const allEvents = await deps.events.listAll(admin);
      const ids = allEvents.map((event) => event.id);
      const stats = await deps.stats.getEventStats(ids);

      const statsOf = (event: EventRecord): EventStats => stats.get(event.id) ?? EMPTY_STATS;

      const totals = allEvents.reduce(
        (accumulator, event) => {
          const value = statsOf(event);
          return {
            events: accumulator.events + 1,
            activeEvents: accumulator.activeEvents + (event.status === "active" ? 1 : 0),
            participants: accumulator.participants + value.participants,
            photos: accumulator.photos + value.photos,
            photosToday: accumulator.photosToday + value.photosToday,
          };
        },
        { events: 0, activeEvents: 0, participants: 0, photos: 0, photosToday: 0 },
      );

      const ordered = [...allEvents].sort((left, right) => {
        const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
        return byStatus !== 0 ? byStatus : right.startDate.localeCompare(left.startDate);
      });

      const highlighted = ordered.slice(0, eventLimit);

      const summaries = await Promise.all(
        highlighted.map(async (event) => {
          const value = statsOf(event);
          return {
            id: event.id,
            slug: event.slug,
            name: event.name,
            description: event.description,
            coverUrl: event.coverImagePath
              ? await deps.storage.createSignedUrl(event.coverImagePath)
              : null,
            startDate: event.startDate,
            endDate: event.endDate,
            timezone: event.timezone,
            status: event.status,
            dailyPhotoLimit: event.dailyPhotoLimit,
            totalPhotoLimit: event.totalPhotoLimit,
            galleryVisibility: event.galleryVisibility,
            participants: value.participants,
            photos: value.photos,
            photosToday: value.photosToday,
            quotaConsumedToday: value.quotaConsumedToday,
            remainingSlots:
              event.participantLimit === null
                ? null
                : Math.max(0, event.participantLimit - value.participants),
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
          };
        }),
      );

      const accessibleIds = allEvents
        .filter((event) => canAccessEvent(admin, event))
        .map((event) => event.id);
      const activity: AuditEntry[] = await deps.audit.listRecent(
        admin.role === "owner" ? null : accessibleIds,
        activityLimit,
      );

      return {
        totals,
        events: summaries,
        recentActivity: activity.map((entry) => ({
          id: entry.id,
          action: entry.action,
          eventId: entry.eventId,
          eventName: entry.eventName,
          createdAt: entry.createdAt,
        })),
      };
    },
  };
}
