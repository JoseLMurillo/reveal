import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageOff, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InlineAlert } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { PhotoLightbox, type LightboxPhoto } from "@/components/common/PhotoLightbox";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/utils/format";

const PAGE_SIZE = 24;

export function MyPhotos() {
  const { sessionToken, me, slug, refetch } = useParticipant();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);

  const photos = useQuery({
    queryKey: ["participant-photos", slug, sessionToken, page],
    queryFn: () => publicApi.photos(sessionToken ?? "", { page, limit: PAGE_SIZE }),
    enabled: Boolean(sessionToken),
    staleTime: 20_000,
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => publicApi.deletePhoto(sessionToken ?? "", photoId),
    async onSuccess() {
      setPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey: ["participant-photos", slug, sessionToken],
      });
      refetch();
    },
  });

  if (!me || !sessionToken) {
    return null;
  }

  const data = photos.data;
  const totalPages = data?.meta.totalPages ?? 0;

  return (
    <section className="paper-card p-6" aria-labelledby="my-photos-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="editorial-kicker">Tu rollo</p>
          <h2 id="my-photos-title" className="mt-2 text-heading-md font-semibold">
            Mis fotos
          </h2>
          <p className="mt-1 text-body-sm text-brown">
            {formatNumber(data?.meta.total ?? 0)} fotografía
            {(data?.meta.total ?? 0) === 1 ? "" : "s"} confirmada
            {(data?.meta.total ?? 0) === 1 ? "" : "s"} en este evento.
          </p>
        </div>
        {photos.isFetching ? (
          <span className="flex items-center gap-2 font-mono text-caption uppercase tracking-[0.1em] text-muted">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Actualizando
          </span>
        ) : null}
      </div>

      {photos.isPending ? (
        <p className="flex items-center gap-2 py-8 text-body-sm text-brown" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Cargando tus fotos…
        </p>
      ) : photos.isError ? (
        <InlineAlert className="mt-4" tone="error">
          No se pudieron cargar tus fotos. Vuelve a intentarlo.
        </InlineAlert>
      ) : (data?.data.length ?? 0) === 0 ? (
        <div className="mt-6 rounded-sm border border-dashed border-brown/30 bg-cream/20 px-4 py-10 text-center">
          <ImageOff aria-hidden="true" className="mx-auto size-6 text-brown" />
          <p className="mt-2 text-body-sm text-brown">
            Tu rollo está vacío. Las fotos confirmadas aparecerán aquí.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data?.data.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-sm border border-border bg-paper"
              >
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      url: photo.url,
                      originalFilename: photo.originalFilename,
                      caption: `${formatDate(photo.eventDay)} · ${formatDateTime(photo.uploadedAt)}`,
                    })
                  }
                  className="focus-film block w-full"
                  aria-label={`Ampliar ${photo.originalFilename}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.originalFilename}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </button>
                <div className="space-y-1 p-2">
                  <p className="truncate text-caption text-brown" title={photo.originalFilename}>
                    {photo.originalFilename}
                  </p>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                    {formatBytes(photo.fileSize)} · {formatDateTime(photo.uploadedAt)}
                  </p>
                  {photo.canDelete ? (
                    <VintageButton
                      variant="ghost"
                      className="mt-1 w-full justify-center !px-2 !py-1 text-[0.68rem]"
                      onClick={() => setPendingDelete(photo.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      Borrar
                    </VintageButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <VintageButton
                variant="ghost"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={page <= 1 || photos.isFetching}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Anterior
              </VintageButton>
              <p className="font-mono text-caption uppercase tracking-[0.1em] text-muted">
                Página {page} de {totalPages}
              </p>
              <VintageButton
                variant="ghost"
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                disabled={page >= totalPages || photos.isFetching}
              >
                Siguiente
                <ChevronRight aria-hidden="true" className="size-4" />
              </VintageButton>
            </div>
          ) : null}
        </>
      )}

      {remove.isError ? (
        <InlineAlert className="mt-4" tone="error">
          {remove.error instanceof ApiError
            ? remove.error.message
            : "No se pudo borrar la fotografía."}
        </InlineAlert>
      ) : null}

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Borrar esta fotografía"
        description="Se ocultará de tu rollo y el original se encolará para limpieza. La cuota se libera en cuanto se borra."
        confirmLabel="Borrar foto"
        pending={remove.isPending}
        onClose={() => {
          if (!remove.isPending) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) {
            remove.mutate(pendingDelete);
          }
        }}
      />
    </section>
  );
}
