import type { VoteFeed, VotePhoto } from "@rollo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, HeartOff, LoaderCircle, Sparkles, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatDate, formatNumber } from "@/utils/format";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function Ranking({ photos }: { photos: VotePhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="mt-3 text-body-sm text-brown">
        Todavía no hay votos suficientes para armar el ranking de este día.
      </p>
    );
  }

  return (
    <ol className="mt-4 space-y-3">
      {photos.map((photo, index) => (
        <li key={photo.id} className="flex items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-brown/30 font-mono text-caption">
            {index + 1}
          </span>
          <img
            src={photo.url}
            alt={
              photo.author?.displayName
                ? `Miniatura de ${photo.author.displayName}`
                : "Miniatura votada"
            }
            className="size-12 rounded-sm border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm">
              {photo.author?.displayName ?? "Invitado anónimo"}
            </p>
            <p className="font-mono text-caption text-muted">
              {formatNumber(photo.likes)} me gusta · {formatNumber(photo.dislikes)} no me gusta
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function VotingPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { sessionToken } = useParticipant();
  const queryClient = useQueryClient();
  const [day, setDay] = useState<string | undefined>(undefined);

  const feed = useQuery({
    queryKey: ["vote-feed", slug, day ?? "auto"],
    queryFn: () => publicApi.voteFeed(slug, sessionToken ?? "", { day }),
    enabled: Boolean(sessionToken),
    retry: false,
  });

  const vote = useMutation({
    mutationFn: (input: { photoId: string; value: "like" | "dislike" }) =>
      publicApi.vote(sessionToken ?? "", input.photoId, { value: input.value }),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["vote-feed", slug] });
    },
  });

  if (!sessionToken) {
    return <Navigate to={`/e/${slug}`} replace />;
  }

  if (feed.isPending) {
    return (
      <section className="container-editorial py-16">
        <LoadingBlock label="Preparando la votación…" />
      </section>
    );
  }

  if (feed.isError || !feed.data) {
    return (
      <section className="container-editorial py-16">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-display-md font-semibold">No pudimos abrir la votación.</h1>
          <p className="text-body text-brown">
            {messageOf(feed.error, "Revisa tu conexión e inténtalo de nuevo.")}
          </p>
          <ErrorBlock message="La votación necesita una sesión de participante válida." />
        </div>
      </section>
    );
  }

  const data: VoteFeed = feed.data;
  const current = data.photos[0];
  const totalPhotos = data.days.reduce((sum, item) => sum + item.totalPhotos, 0);
  const votedPhotos = data.days.reduce((sum, item) => sum + item.votedPhotos, 0);

  function cast(value: "like" | "dislike"): void {
    if (!current || vote.isPending) {
      return;
    }

    vote.mutate({ photoId: current.id, value });
  }

  return (
    <section className="container-editorial py-10 sm:py-14">
      <div className="border-b border-border pb-6">
        <p className="editorial-kicker flex items-center gap-2">
          <Trophy aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Votación anónima · {data.event.name}
        </p>
        <h1 className="mt-2 text-display-md font-semibold">La mejor foto del día</h1>
        <p className="mt-2 max-w-2xl text-body-sm text-brown">
          Desliza a la derecha si te gusta y a la izquierda si no. Tu voto es anónimo: nadie ve
          quién votó qué. Solo se muestran los totales del día.
        </p>
        <p className="mt-3 font-mono text-caption uppercase tracking-[0.1em] text-muted">
          {formatNumber(votedPhotos)} de {formatNumber(totalPhotos)} fotos votadas
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {data.days.map((item) => (
          <VintageButton
            key={item.eventDay}
            variant={data.selectedDay === item.eventDay ? "primary" : "ghost"}
            onClick={() => setDay(item.eventDay)}
            disabled={vote.isPending}
          >
            Día {item.dayNumber} · {formatDate(item.eventDay)}
          </VintageButton>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section aria-labelledby="voting-card-title">
          <h2 id="voting-card-title" className="sr-only">
            Fotografía para votar
          </h2>

          {current ? (
            <>
              <div className="relative mx-auto max-w-md">
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(_event, info) => {
                    if (Math.abs(info.offset.x) < 80 || vote.isPending) {
                      return;
                    }

                    cast(info.offset.x > 0 ? "like" : "dislike");
                  }}
                  className="overflow-hidden rounded-md border border-border bg-paper-raised shadow-card"
                >
                  <img
                    src={current.url}
                    alt={
                      current.author?.displayName
                        ? `Foto de ${current.author.displayName}`
                        : "Fotografía del evento"
                    }
                    draggable={false}
                    className="aspect-[3/4] w-full select-none object-cover"
                  />
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="truncate text-body-sm text-brown">
                      {current.author?.displayName ?? "Invitado anónimo"}
                    </p>
                    <p className="font-mono text-caption text-muted">
                      {formatNumber(data.photos.length)} pendientes
                    </p>
                  </div>
                </motion.div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <VintageButton
                  variant="ghost"
                  onClick={() => cast("dislike")}
                  disabled={vote.isPending}
                  aria-label="No me gusta"
                  className="min-w-36"
                >
                  <HeartOff aria-hidden="true" className="size-4" />
                  No me gusta
                </VintageButton>
                <VintageButton
                  onClick={() => cast("like")}
                  disabled={vote.isPending}
                  aria-label="Me gusta"
                  className="min-w-36"
                >
                  <Heart aria-hidden="true" className="size-4" />
                  Me gusta
                </VintageButton>
              </div>

              {vote.isPending ? (
                <p className="mt-3 flex items-center justify-center gap-2 text-caption text-muted">
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  Registrando tu voto anónimo…
                </p>
              ) : null}

              {vote.isError ? (
                <InlineAlert className="mt-3" tone="error">
                  {messageOf(vote.error, "No se pudo registrar tu voto. Inténtalo de nuevo.")}
                </InlineAlert>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Ya votaste todas las fotos de este día"
              description="Puedes cambiar de día para seguir votando o revisar el ranking de abajo."
            />
          )}
        </section>

        <aside className="space-y-5">
          <section className="paper-card p-5" aria-labelledby="voting-results">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-brown" />
              <h2 id="voting-results" className="text-heading-sm font-semibold">
                Mejor foto del día
              </h2>
            </div>
            <p className="mt-1 text-caption text-muted">
              Ranking por me gusta, calculado con votos anónimos.
            </p>
            <Ranking photos={data.results} />
          </section>

          <section className="rounded-sm border border-brown/25 bg-cream/35 p-4 text-caption text-brown">
            <p>
              No puedes votar por tus propias fotos. Cada participante cuenta una vez por foto y los
              administradores nunca ven la identidad de quien vota.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
