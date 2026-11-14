import type { SupabaseClient } from "@supabase/supabase-js";

export type CleanupClaim = {
  id: number;
  bucket: string;
  objectPath: string;
  attempts: number;
};

export type StorageCleanupRepository = {
  claim(limit: number): Promise<CleanupClaim[]>;
  finish(id: number, success: boolean, error: string | null): Promise<void>;
  expireUploadSessions(limit: number): Promise<number>;
};

type ClaimRow = {
  id: number;
  bucket: string;
  object_path: string;
  attempts: number;
};

export function createSupabaseStorageCleanupRepository(
  supabase: SupabaseClient,
): StorageCleanupRepository {
  return {
    async claim(limit) {
      const { data, error } = await supabase
        .rpc("claim_storage_cleanup", { p_limit: limit })
        .returns<ClaimRow[]>();

      if (error) {
        throw new Error(`No se pudo reclamar la cola de limpieza: ${error.message}`);
      }

      return ((data ?? []) as ClaimRow[]).map((row) => ({
        id: Number(row.id),
        bucket: row.bucket,
        objectPath: row.object_path,
        attempts: Number(row.attempts),
      }));
    },

    async finish(id, success, error) {
      const { error: rpcError } = await supabase.rpc("finish_storage_cleanup", {
        p_id: id,
        p_success: success,
        p_error: error,
      });

      if (rpcError) {
        throw new Error(`No se pudo cerrar la limpieza: ${rpcError.message}`);
      }
    },

    async expireUploadSessions(limit) {
      const { data, error } = await supabase
        .rpc("expire_upload_sessions", { p_limit: limit })
        .returns<Array<{ session_id: string; expired_items: number }>>();

      if (error) {
        throw new Error(`No se pudieron expirar las reservas: ${error.message}`);
      }

      return ((data ?? []) as Array<{ session_id: string; expired_items: number }>).length;
    },
  };
}
