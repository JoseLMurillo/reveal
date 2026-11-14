import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventStats } from "./types.js";

export type StatsRepository = {
  getEventStats(eventIds: string[] | null): Promise<Map<string, EventStats>>;
};

type StatsRow = {
  event_id: string;
  participants: number;
  photos: number;
  photos_today: number;
  quota_consumed_today: number;
};

export function createSupabaseStatsRepository(supabase: SupabaseClient): StatsRepository {
  return {
    async getEventStats(eventIds) {
      if (eventIds !== null && eventIds.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .rpc("admin_event_stats", { p_event_ids: eventIds })
        .returns<StatsRow[]>();

      if (error) {
        throw new Error(`No se pudieron leer las estadísticas: ${error.message}`);
      }

      const rows = (data ?? []) as StatsRow[];

      return new Map(
        rows.map((row) => [
          row.event_id,
          {
            participants: row.participants,
            photos: row.photos,
            photosToday: row.photos_today,
            quotaConsumedToday: row.quota_consumed_today,
          },
        ]),
      );
    },
  };
}
