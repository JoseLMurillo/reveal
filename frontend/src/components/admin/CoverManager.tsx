import { ALLOWED_IMAGE_MIME_TYPES, type AdminEventDetail } from "@rollo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { InlineAlert } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";

const MAX_COVER_BYTES = 52_428_800;

export function CoverManager({ event }: { event: AdminEventDetail }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["admin", "event", event.id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  }

  async function handleFile(file: File): Promise<void> {
    setError(null);

    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("La portada debe ser una imagen JPEG, PNG o WebP.");
      return;
    }

    if (file.size > MAX_COVER_BYTES) {
      setError("La portada no puede superar los 50 MB.");
      return;
    }

    setUploading(true);

    try {
      const target = await adminApi.coverIntent(event.id, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const upload = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!upload.ok) {
        throw new Error("La subida directa a Storage falló.");
      }

      await adminApi.confirmCover(event.id, target.storagePath);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "No se pudo subir la portada.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove(): Promise<void> {
    setRemoving(true);
    setError(null);

    try {
      await adminApi.deleteCover(event.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No se pudo quitar la portada.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="paper-card p-5" aria-labelledby="event-cover">
      <h2 id="event-cover" className="text-heading-sm font-semibold">
        Portada
      </h2>
      <p className="mt-1 text-body-sm text-brown">
        Se sube directamente a Storage. La imagen no se recorta ni se modifica.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-sm border border-border bg-cream/40">
          {event.coverUrl ? (
            <img
              src={event.coverUrl}
              alt={`Portada de ${event.name}`}
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center text-brown">
              <ImagePlus aria-hidden="true" className="size-7" strokeWidth={1.4} />
            </span>
          )}
        </div>

        <div className="flex flex-col items-start justify-center gap-2">
          <input
            ref={inputRef}
            id="cover-file"
            type="file"
            accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
            className="sr-only"
            onChange={(changeEvent) => {
              const file = changeEvent.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <label
            htmlFor="cover-file"
            className="focus-film inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-brown/50 px-4 py-2 text-body-sm font-semibold hover:bg-cream/60 aria-disabled:pointer-events-none aria-disabled:opacity-45"
            aria-disabled={uploading || removing}
          >
            {uploading ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ImagePlus aria-hidden="true" className="size-4" />
            )}
            {uploading ? "Subiendo…" : event.coverUrl ? "Cambiar portada" : "Subir portada"}
          </label>

          {event.coverUrl ? (
            <VintageButton
              variant="ghost"
              onClick={() => void handleRemove()}
              disabled={uploading || removing}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {removing ? "Quitando…" : "Quitar portada"}
            </VintageButton>
          ) : null}

          <p className="text-caption text-muted">JPEG, PNG o WebP · máximo 50 MB.</p>
        </div>
      </div>

      {error ? (
        <InlineAlert tone="error" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}
    </section>
  );
}
