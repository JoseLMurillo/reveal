import type { AlbumPhoto } from "@rollo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Images,
  LoaderCircle,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { PhotoLightbox, type LightboxPhoto } from "@/components/common/PhotoLightbox";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { adminApi } from "@/services/admin";
import { ApiError } from "@/services/api";
import { formatDate, formatNumber } from "@/utils/format";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function AdminAlbumPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const formLoaded = useRef(false);

  const albumQuery = useQuery({
    queryKey: ["admin", "event", id, "album"],
    queryFn: () => adminApi.album(id),
    enabled: id.length > 0,
    retry: false,
  });

  const album = albumQuery.data;
  const isMissing = albumQuery.error instanceof ApiError && albumQuery.error.status === 404;

  useEffect(() => {
    if (!album || formLoaded.current) {
      return;
    }

    formLoaded.current = true;
    setTitle(album.album.title);
    setSubtitle(album.album.subtitle ?? "");
    setVisibility(album.album.visibility);
  }, [album]);

  const generate = useMutation({
    mutationFn: () =>
      adminApi.generateAlbum(id, {
        ...(title.trim().length > 0 ? { title: title.trim() } : {}),
        ...(subtitle.trim().length > 0 ? { subtitle: subtitle.trim() } : {}),
        visibility,
      }),
    async onSuccess(result) {
      queryClient.setQueryData(["admin", "event", id, "album"], result);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "event", id],
        exact: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
  });

  const update = useMutation({
    mutationFn: (input: {
      status?: "draft" | "published";
      title?: string;
      subtitle?: string;
      visibility?: "private" | "public";
    }) => adminApi.updateAlbum(id, input),
    async onSuccess(result) {
      queryClient.setQueryData(["admin", "event", id, "album"], result);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "event", id],
        exact: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
  });

  async function copyLink(slug: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/album/${slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (albumQuery.isPending) {
    return <LoadingBlock label="Cargando el álbum…" />;
  }

  if (albumQuery.isError && !isMissing) {
    return (
      <div className="space-y-4">
        <PageHeader kicker="Álbum" title="No se pudo cargar el álbum" />
        <ErrorBlock
          message={messageOf(albumQuery.error, "Revisa tu conexión e inténtalo de nuevo.")}
        />
        <Link to={`/admin/events/${id}`} className={vintageButtonStyles({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al evento
        </Link>
      </div>
    );
  }

  const pending = generate.isPending || update.isPending;
  const formTitle = album ? null : "Generar el álbum";
  const activePhotoCount = album ? album.days.reduce((sum, day) => sum + day.photos.length, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Álbum editorial"
        title={album?.album.title ?? "Preparar el álbum"}
        description="El álbum es una instantánea de las fotos activas. Regenerarlo conserva el slug y actualiza el contenido."
        actions={
          <>
            <Link to={`/admin/events/${id}`} className={vintageButtonStyles({ variant: "ghost" })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Evento
            </Link>
            <Link
              to={`/admin/events/${id}/photos`}
              className={vintageButtonStyles({ variant: "ghost" })}
            >
              <Images aria-hidden="true" className="size-4" />
              Fotos
            </Link>
          </>
        }
      />

      {generate.isError ? (
        <InlineAlert tone="error">
          {messageOf(generate.error, "No se pudo generar el álbum.")}
        </InlineAlert>
      ) : null}
      {update.isError ? (
        <InlineAlert tone="error">
          {messageOf(update.error, "No se pudo actualizar el álbum.")}
        </InlineAlert>
      ) : null}

      <section className="paper-card p-5" aria-labelledby="album-form-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="editorial-kicker">{album ? "Metadatos" : "Primer paso"}</p>
            <h2 id="album-form-title" className="mt-1 text-heading-md font-semibold">
              {formTitle}
            </h2>
            <p className="mt-1 text-body-sm text-brown">
              {album
                ? "Cambiar el título no cambia el slug ya compartido."
                : "Se crearán los días y las fotos activas del evento en este momento."}
            </p>
          </div>
          {album ? (
            <span className="rounded-full border border-brown/30 bg-cream/55 px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-brown">
              {album.album.status === "published" ? "Publicado" : "Borrador"}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="album-title" className={fieldLabelClass}>
              Título
            </label>
            <input
              id="album-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={album?.album.title ?? "El nombre del evento"}
              maxLength={160}
              className={fieldInputClass}
            />
          </div>
          <div>
            <label htmlFor="album-subtitle" className={fieldLabelClass}>
              Subtítulo
            </label>
            <input
              id="album-subtitle"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder={album?.album.subtitle ?? "Una frase para el álbum"}
              maxLength={240}
              className={fieldInputClass}
            />
          </div>
          <div>
            <label htmlFor="album-visibility" className={fieldLabelClass}>
              Visibilidad
            </label>
            <select
              id="album-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "private" | "public")}
              className={fieldInputClass}
            >
              <option value="private">Privado</option>
              <option value="public">Público</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <VintageButton
              onClick={() => generate.mutate()}
              disabled={pending || (album !== undefined && activePhotoCount === 0)}
            >
              {generate.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-4" />
              )}
              {album ? "Regenerar álbum" : "Generar álbum"}
            </VintageButton>
          </div>
        </div>

        {!album ? (
          <p className="mt-3 text-caption text-muted">
            El evento necesita al menos una foto activa. Puedes generarlo ahora como borrador y
            publicarlo después de revisarlo.
          </p>
        ) : null}
      </section>

      {album ? (
        <>
          <section className="paper-card p-5" aria-labelledby="album-status-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="album-status-title" className="text-heading-md font-semibold">
                  Publicación
                </h2>
                <p className="mt-1 text-body-sm text-brown">
                  {album.album.status === "published"
                    ? "El álbum es visible en su enlace si la visibilidad es pública."
                    : "El álbum es un borrador privado para revisión."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <VintageButton variant="ghost" onClick={() => void copyLink(album.album.slug)}>
                  <Copy aria-hidden="true" className="size-4" />
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </VintageButton>
                <a
                  href={`/album/${album.album.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={vintageButtonStyles({ variant: "ghost" })}
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Ver álbum
                </a>
                {album.album.status === "published" ? (
                  <VintageButton
                    variant="ghost"
                    onClick={() => update.mutate({ status: "draft" })}
                    disabled={pending}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Despublicar
                  </VintageButton>
                ) : (
                  <VintageButton
                    onClick={() => update.mutate({ status: "published" })}
                    disabled={pending || activePhotoCount === 0}
                  >
                    <Send aria-hidden="true" className="size-4" />
                    Publicar
                  </VintageButton>
                )}
                <VintageButton
                  variant="ghost"
                  onClick={() => update.mutate({ visibility })}
                  disabled={pending || visibility === album.album.visibility}
                >
                  Guardar visibilidad
                </VintageButton>
                <a
                  href={adminApi.albumZipUrl(id)}
                  className={vintageButtonStyles({ variant: "ghost" })}
                >
                  <Download aria-hidden="true" className="size-4" />
                  Descargar ZIP
                </a>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
              <div className="px-3 text-center">
                <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                  Fotos
                </dt>
                <dd className="mt-1 font-display text-[1.6rem] font-semibold leading-none">
                  {formatNumber(album.stats.totalPhotos)}
                </dd>
              </div>
              <div className="px-3 text-center">
                <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                  Personas
                </dt>
                <dd className="mt-1 font-display text-[1.6rem] font-semibold leading-none">
                  {formatNumber(album.stats.totalParticipants)}
                </dd>
              </div>
              <div className="px-3 text-center">
                <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">
                  Días
                </dt>
                <dd className="mt-1 font-display text-[1.6rem] font-semibold leading-none">
                  {formatNumber(album.stats.totalDays)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="paper-card p-5" aria-labelledby="album-preview-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="editorial-kicker">Vista previa</p>
                <h2 id="album-preview-title" className="mt-1 text-heading-md font-semibold">
                  Días del álbum
                </h2>
              </div>
              <p className="flex items-center gap-1.5 font-mono text-caption uppercase tracking-[0.1em] text-muted">
                <Users aria-hidden="true" className="size-3.5" />
                {formatNumber(album.stats.totalParticipants)} autores
              </p>
            </div>

            {album.days.length === 0 ? (
              <EmptyState
                title="El álbum no tiene fotos activas"
                description="Regenera el álbum después de que los participantes confirmen fotos."
              />
            ) : (
              <div className="mt-5 space-y-8">
                {album.days.map((day) => (
                  <div key={day.eventDay}>
                    <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
                      <div>
                        <p className="editorial-kicker">Día {day.dayNumber}</p>
                        <h3 className="mt-1 text-heading-sm font-semibold">
                          {formatDate(day.eventDay)}
                        </h3>
                      </div>
                      <p className="font-mono text-caption uppercase tracking-[0.1em] text-muted">
                        {formatNumber(day.photos.length)} fotos
                      </p>
                    </div>
                    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {day.photos.map((photo: AlbumPhoto) => (
                        <li
                          key={photo.id}
                          className="overflow-hidden rounded-sm border border-border bg-paper"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setLightbox({
                                url: photo.url,
                                originalFilename: photo.author?.displayName
                                  ? `Foto de ${photo.author.displayName}`
                                  : "Fotografía del álbum",
                                caption: formatDate(day.eventDay),
                              })
                            }
                            className="focus-film block w-full"
                            aria-label="Ampliar fotografía del álbum"
                          >
                            <img
                              src={photo.url}
                              alt={
                                photo.author?.displayName
                                  ? `Foto de ${photo.author.displayName}`
                                  : "Fotografía del álbum"
                              }
                              loading="lazy"
                              className="aspect-square w-full object-cover"
                            />
                          </button>
                          <p className="truncate px-2 py-1.5 text-caption text-brown">
                            {photo.author?.displayName ?? "Invitado anónimo"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
