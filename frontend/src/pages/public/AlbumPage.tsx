import type { AlbumPhoto } from "@rollo/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Images, Sparkles, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState, LoadingBlock } from "@/components/admin/Feedback";
import { PhotoCard, PhotoGrid } from "@/components/common/PhotoCard";
import { PhotoLightbox, type LightboxPhoto } from "@/components/common/PhotoLightbox";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatDate, formatDateRange, formatNumber } from "@/utils/format";

function useNoindex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);
}

export function AlbumPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [day, setDay] = useState<string | undefined>(undefined);
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);

  useNoindex();

  const albumQuery = useQuery({
    queryKey: ["album", slug],
    queryFn: () => publicApi.album(slug),
    enabled: slug.length > 0,
    retry: false,
  });

  if (albumQuery.isPending) {
    return (
      <section className="container-editorial py-16">
        <LoadingBlock label="Abriendo el álbum…" />
      </section>
    );
  }

  if (albumQuery.isError || !albumQuery.data) {
    const missing = albumQuery.error instanceof ApiError && albumQuery.error.status === 404;

    return (
      <section className="container-editorial py-16">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-brown/30 bg-cream/50 text-brown">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-display-md font-semibold">
            {missing ? "Este álbum todavía no es público." : "No pudimos abrir el álbum."}
          </h1>
          <p className="text-body text-brown">
            {missing
              ? "Puede que el organizador aún no lo haya publicado o que el enlace no sea correcto."
              : "Revisa tu conexión e inténtalo de nuevo."}
          </p>
          <Link to="/" className={vintageButtonStyles({ variant: "ghost" })}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al inicio
          </Link>
        </div>
      </section>
    );
  }

  const data = albumQuery.data;
  const days = day ? data.days.filter((item) => item.eventDay === day) : data.days;

  return (
    <article className="pb-16">
      <header className="relative overflow-hidden border-b border-border bg-ink text-paper-raised">
        {data.album.coverUrl ? (
          <img
            src={data.album.coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-35"
          />
        ) : null}
        <div className="relative container-editorial py-14 sm:py-20">
          <p className="font-mono text-caption uppercase tracking-[0.18em] text-yellow">
            Álbum colectivo · {data.album.eventName}
          </p>
          <h1 className="mt-4 max-w-3xl text-display-lg font-semibold leading-[0.98]">
            {data.album.title}
          </h1>
          {data.album.subtitle ? (
            <p className="mt-4 max-w-2xl text-body-lg text-paper-raised/75">
              {data.album.subtitle}
            </p>
          ) : null}
          <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-caption uppercase tracking-[0.12em] text-paper-raised/60">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {formatDateRange(data.album.eventDates.start, data.album.eventDates.end)}
            </span>
            <span>Publicado el {formatDate(data.album.publishedAt.slice(0, 10))}</span>
          </p>
        </div>
      </header>

      <section className="container-editorial">
        <dl className="mt-8 grid grid-cols-3 divide-x divide-border border border-border bg-paper-raised">
          <div className="p-4 text-center sm:p-5">
            <dt className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
              Fotos
            </dt>
            <dd className="mt-1 font-display text-[1.8rem] font-semibold leading-none">
              {formatNumber(data.stats.totalPhotos)}
            </dd>
          </div>
          <div className="p-4 text-center sm:p-5">
            <dt className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
              Personas
            </dt>
            <dd className="mt-1 font-display text-[1.8rem] font-semibold leading-none">
              {formatNumber(data.stats.totalParticipants)}
            </dd>
          </div>
          <div className="p-4 text-center sm:p-5">
            <dt className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
              Días
            </dt>
            <dd className="mt-1 font-display text-[1.8rem] font-semibold leading-none">
              {formatNumber(data.stats.totalDays)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <VintageButton
              variant={day === undefined ? "primary" : "ghost"}
              onClick={() => setDay(undefined)}
            >
              <Images aria-hidden="true" className="size-4" />
              Todos los días
            </VintageButton>
            {data.days.map((item) => (
              <VintageButton
                key={item.eventDay}
                variant={day === item.eventDay ? "primary" : "ghost"}
                onClick={() => setDay(item.eventDay)}
              >
                Día {item.dayNumber}
              </VintageButton>
            ))}
          </div>
          <Link
            to={`/e/${data.album.eventSlug}/vote`}
            className={vintageButtonStyles({ variant: "ghost" })}
          >
            <Trophy aria-hidden="true" className="size-4" />
            Votar la mejor foto
          </Link>
        </div>

        {days.length === 0 ? (
          <EmptyState
            title="El álbum está vacío"
            description="Todavía no hay fotografías publicadas en este álbum."
          />
        ) : (
          <div className="mt-8 space-y-12">
            {days.map((item) => (
              <section key={item.eventDay} aria-labelledby={`album-day-${item.eventDay}`}>
                <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <p className="editorial-kicker">Día {item.dayNumber}</p>
                    <h2
                      id={`album-day-${item.eventDay}`}
                      className="mt-1 text-heading-md font-semibold"
                    >
                      {formatDate(item.eventDay)}
                    </h2>
                  </div>
                  <p className="flex items-center gap-1.5 font-mono text-caption uppercase tracking-[0.1em] text-muted">
                    <Users aria-hidden="true" className="size-3.5" />
                    {formatNumber(
                      new Set(
                        item.photos
                          .map((photo) => photo.author?.displayName)
                          .filter((value): value is string => Boolean(value)),
                      ).size,
                    )}
                  </p>
                </div>

                <PhotoGrid className="mt-4 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {item.photos.map((photo: AlbumPhoto) => (
                    <PhotoCard
                      key={photo.id}
                      src={photo.url}
                      alt={
                        photo.author?.displayName
                          ? `Foto de ${photo.author.displayName}`
                          : "Fotografía del álbum"
                      }
                      author={photo.author?.displayName}
                      caption={photo.caption}
                      aspect="landscape"
                      openLabel="Ampliar fotografía del álbum"
                      onOpen={() =>
                        setLightbox({
                          url: photo.url,
                          originalFilename: photo.author?.displayName
                            ? `Foto de ${photo.author.displayName}`
                            : "Fotografía del álbum",
                          caption: photo.caption ?? formatDate(item.eventDay),
                        })
                      }
                    />
                  ))}
                </PhotoGrid>
              </section>
            ))}
          </div>
        )}
      </section>

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </article>
  );
}
