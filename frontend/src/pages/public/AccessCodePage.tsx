import { zodResolver } from "@hookform/resolvers/zod";
import { displayNameSchema } from "@rollo/shared";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, KeyRound, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { InlineAlert } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";

const nameSchema = z.object({ displayName: displayNameSchema });
type NameValues = z.infer<typeof nameSchema>;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function AccessCodePage() {
  const { slug = "", code = "" } = useParams<{ slug: string; code: string }>();
  const navigate = useNavigate();
  const { saveSession } = useParticipant();
  const started = useRef(false);
  const [needsName, setNeedsName] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);

  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: "" },
  });

  const redeem = useMutation({
    mutationFn: (displayName?: string) =>
      publicApi.redeem(slug, {
        accessCode: code,
        ...(displayName ? { displayName } : {}),
      }),
    onSuccess(result) {
      saveSession(result.session.token, code);
      // El código no debe quedar en el historial ni en la barra de direcciones.
      window.history.replaceState(null, "", `/e/${slug}`);
      navigate(`/e/${slug}/camera`, { replace: true });
    },
    onError(error) {
      if (error instanceof ApiError && error.code === "NAME_REQUIRED") {
        setNeedsName(true);
        return;
      }

      if (error instanceof ApiError && error.code === "ACCESS_CODE_INVALID") {
        setInvalidCode(true);
      }
    },
  });

  const mutate = redeem.mutate;

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    if (code.trim().length < 16) {
      setInvalidCode(true);
      return;
    }

    mutate(undefined);
  }, [code, mutate]);

  if (invalidCode) {
    return (
      <section className="container-editorial flex min-h-[60dvh] items-center py-16">
        <div className="max-w-xl">
          <p className="editorial-kicker flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4" />
            Enlace personal
          </p>
          <h1 className="mt-4 text-display-md font-semibold">Este enlace ya no es válido.</h1>
          <p className="mt-4 text-body text-brown">
            Puede haber sido revocado, regenerado por el organizador o pertenecer a otro evento.
            Pide un enlace nuevo o entra desde el código QR del evento.
          </p>
          <Link
            to={`/e/${slug}`}
            className="focus-film mt-7 inline-flex items-center gap-2 rounded-sm text-body-sm underline underline-offset-4"
          >
            Ir a la página del evento
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>
    );
  }

  if (needsName) {
    return (
      <section className="container-editorial flex min-h-[60dvh] items-center py-16">
        <form
          className="paper-card w-full max-w-lg p-6"
          onSubmit={form.handleSubmit((values) => redeem.mutate(values.displayName))}
          noValidate
        >
          <p className="editorial-kicker flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4" />
            Enlace personal
          </p>
          <h1 className="mt-3 text-heading-lg font-semibold">Antes de entrar, dinos tu nombre.</h1>
          <p className="mt-2 text-body-sm text-brown">
            El organizador pidió un nombre para este evento. Lo usaremos para ordenar tus fotos en
            el álbum.
          </p>

          <label
            htmlFor="redeem-name"
            className="mt-5 block font-mono text-caption uppercase tracking-[0.12em] text-brown"
          >
            Tu nombre
          </label>
          <input
            id="redeem-name"
            autoComplete="name"
            maxLength={60}
            className="mt-1.5 min-h-11 w-full rounded-sm border border-border bg-paper px-3 py-2 text-body-sm"
            aria-invalid={form.formState.errors.displayName ? "true" : "false"}
            {...form.register("displayName")}
          />
          {form.formState.errors.displayName ? (
            <p className="mt-1.5 text-caption text-red" role="alert">
              {form.formState.errors.displayName.message}
            </p>
          ) : null}

          {redeem.isError ? (
            <InlineAlert className="mt-4">
              {messageOf(redeem.error, "No se pudo canjear el enlace.")}
            </InlineAlert>
          ) : null}

          <VintageButton type="submit" className="mt-5 w-full" disabled={redeem.isPending}>
            {redeem.isPending ? "Entrando…" : "Entrar al evento"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </VintageButton>
        </form>
      </section>
    );
  }

  return (
    <section className="container-editorial flex min-h-[60dvh] items-center py-16">
      <div className="max-w-xl">
        <p className="editorial-kicker flex items-center gap-2">
          <ScanLine aria-hidden="true" className="size-4" />
          Enlace personal
        </p>
        <h1 className="mt-4 text-display-md font-semibold">Abriendo tu cámara…</h1>
        <p className="mt-4 text-body text-brown">
          Estamos comprobando tu enlace y preparando tu sesión. Esto toma un segundo.
        </p>

        {redeem.isError && !needsName ? (
          <>
            <InlineAlert className="mt-6">
              {messageOf(redeem.error, "No se pudo canjear el enlace.")}
            </InlineAlert>
            <Link
              to={`/e/${slug}`}
              className="focus-film mt-5 inline-flex items-center gap-2 rounded-sm text-body-sm underline underline-offset-4"
            >
              Volver al evento
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </>
        ) : (
          <div className="mt-8 flex items-center gap-3 font-mono text-caption uppercase tracking-[0.12em] text-muted">
            <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-brown" />
            Canjeando el código
          </div>
        )}
      </div>
    </section>
  );
}
