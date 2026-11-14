import type { GalleryPhoto } from "@rollo/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Images, LoaderCircle, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/admin/Feedback";
import { PhotoCard, PhotoGrid } from "@/components/common/PhotoCard";
import { PhotoLightbox, type LightboxPhoto } from "@/components/common/PhotoLightbox";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatDate, formatNumber } from "@/utils/format";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function GalleryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { sessionToken } = useParticipant();
  const [day, setDay] = useState<string | undefined>(undefined);
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);

  const gallery = useQuery({
    queryKey: ["gallery", slug, day ?? "all", sessionToken ?? "anonymous"],
    queryFn: () => publicApi.gallery(slug, { token: sessionToken, day }),
    enabled: slug.length > 0,
    retry: false,
  });

  if (gallery.isPending) {
    return (
      <section className="container-editorial py-16">
        <LoadingBlock label="Abriendo la galería…" />
      </section>
    );
  }

  if (gallery.isError || !gallery.data) {
    const forbidden = gallery.error instanceof ApiError && gallery.error.status === 403;

    return (
      <section className="container-editorial py-16">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-brown/30 bg-cream/50 text-brown">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-display-md font-semibold">
            {forbidden ? "Esta galería es privada." : "No pudimos abrir la galería."}
          </h1>
          <p className="text-body text-brown">
            {forbidden
              ? "Necesitas entrar con tu enlace de participante para ver las fotos del evento."
              : messageOf(gallery.error, "Revisa tu conexión e inténtalo de nuevo.")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={`/e/${slug}`} className={vintageButtonStyles()}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Volver al evento
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const data = gallery.data;
  const days = data.days;
  const selectedDay = day ? days.find((item) => item.eventDay === day) : undefined;
  const visibleDays = selectedDay ? [selectedDay] : days;

  return (
    <section className="container-editorial py-10 sm:py-14">
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="editorial-kicker flex items-center gap-2">
            <Images aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Galería colectiva · {data.event.name}
          </p>
          <h1 className="mt-2 text-display-md font-semibold">Las fotos del evento</h1>
          <p className="mt-2 text-body-sm text-brown">
            {formatNumber(data.stats.totalPhotos)} fotografías de{" "}
            {formatNumber(data.stats.totalParticipants)} personas en{" "}
            {formatNumber(data.stats.totalDays)} días.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/e/${slug}`} className={vintageButtonStyles({ variant: "ghost" })}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Evento
          </Link>
          <Link to={`/e/${slug}/vote`} className={vintageButtonStyles()}>
            <Trophy aria-hidden="true" className="size-4" />
            Votar la mejor foto
          </Link>
          {data.event.publicAlbumSlug ? (
            <Link
              to={`/album/${data.event.publicAlbumSlug}`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Álbum
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <VintageButton
          variant={day === undefined ? "primary" : "ghost"}
          onClick={() => setDay(undefined)}
        >
          Todos los días
        </VintageButton>
        {days.map((item) => (
          <VintageButton
            key={item.eventDay}
            variant={day === item.eventDay ? "primary" : "ghost"}
            onClick={() => setDay(item.eventDay)}
          >
            Día {item.dayNumber} · {formatDate(item.eventDay)}
          </VintageButton>
        ))}
      </div>

      {visibleDays.length === 0 ? (
        <EmptyState
          title="Todavía no hay fotos"
          description="Cuando los invitados confirmen sus primeras fotografías aparecerán aquí."
        />
      ) : (
        <div className="mt-8 space-y-10">
          {visibleDays.map((item) => (
            <section key={item.eventDay} aria-labelledby={`gallery-day-${item.eventDay}`}>
              <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="editorial-kicker">Día {item.dayNumber}</p>
                  <h2
                    id={`gallery-day-${item.eventDay}`}
                    className="mt-1 text-heading-md font-semibold"
                  >
                    {formatDate(item.eventDay)}
                  </h2>
                </div>
                <p className="font-mono text-caption uppercase tracking-[0.1em] text-muted">
                  {formatNumber(item.photos.length)} fotos
                </p>
              </div>

              <PhotoGrid className="mt-4">
                {item.photos.map((photo: GalleryPhoto) => (
                  <PhotoCard
                    key={photo.id}
                    src={photo.url}
                    alt={`Foto de ${photo.author?.displayName ?? "invitado anónimo"}`}
                    author={photo.author?.displayName ?? "Invitado anónimo"}
                    onOpen={() =>
                      setLightbox({
                        url: photo.url,
                        originalFilename: `Foto de ${photo.author?.displayName ?? "invitado anónimo"}`,
                        caption: `${formatDate(item.eventDay)} · ${formatNumber(
                          data.stats.totalPhotos,
                        )} fotos en el evento`,
                      })
                    }
                  />
                ))}
              </PhotoGrid>
            </section>
          ))}
        </div>
      )}

      {gallery.isFetching ? (
        <p className="mt-4 flex items-center gap-2 text-caption text-muted" role="status">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          Actualizando
        </p>
      ) : null}

      {gallery.isError ? (
        <div className="mt-4">
          <ErrorBlock message="No se pudo actualizar la galería." />
        </div>
      ) : null}

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
