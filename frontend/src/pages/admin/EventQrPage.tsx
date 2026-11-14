import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorBlock, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { adminApi } from "@/services/admin";
import { formatDateRange } from "@/utils/format";

type QrFormat = "png" | "svg";

export function EventQrPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [format, setFormat] = useState<QrFormat>("png");
  const [size, setSize] = useState(1024);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => adminApi.detail(id),
    enabled: id.length > 0,
  });

  const qr = useQuery({
    queryKey: ["admin", "event", id, "qr", format, size],
    queryFn: () => adminApi.qrBlob(id, format, size),
    enabled: id.length > 0 && detail.isSuccess,
  });

  useEffect(() => {
    if (!qr.data) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(qr.data);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [qr.data]);

  if (detail.isPending) {
    return <LoadingBlock label="Cargando el evento…" />;
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-4">
        <PageHeader kicker="QR" title="Evento no disponible" />
        <ErrorBlock message="El evento no existe o no tienes acceso." />
        <Link to="/admin/events" className={vintageButtonStyles({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a eventos
        </Link>
      </div>
    );
  }

  const event = detail.data;
  const filename = `qr-${event.slug}.${format}`;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="QR del evento"
        title={event.name}
        description="Un QR genérico para compartir el evento. El enlace se genera con el dominio público configurado."
        actions={
          <Link
            to={`/admin/events/${event.id}`}
            className={vintageButtonStyles({ variant: "ghost" })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al evento
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="paper-card h-fit p-5 print:hidden" aria-labelledby="qr-options">
          <h2 id="qr-options" className="text-heading-sm font-semibold">
            Opciones
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="qr-format" className={fieldLabelClass}>
                Formato
              </label>
              <select
                id="qr-format"
                value={format}
                onChange={(changeEvent) => setFormat(changeEvent.target.value as QrFormat)}
                className={fieldInputClass}
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            <div>
              <label htmlFor="qr-size" className={fieldLabelClass}>
                Tamaño
              </label>
              <select
                id="qr-size"
                value={size}
                onChange={(changeEvent) => setSize(Number(changeEvent.target.value))}
                className={fieldInputClass}
              >
                <option value={512}>512 px</option>
                <option value={1024}>1024 px</option>
                <option value={2048}>2048 px</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={objectUrl ?? undefined}
                download={filename}
                aria-disabled={!objectUrl}
                className={vintageButtonStyles({
                  variant: "primary",
                  className: !objectUrl ? "pointer-events-none opacity-45" : undefined,
                })}
              >
                <Download aria-hidden="true" className="size-4" />
                Descargar {format.toUpperCase()}
              </a>
              <VintageButton variant="ghost" onClick={() => window.print()} disabled={!objectUrl}>
                <Printer aria-hidden="true" className="size-4" />
                Imprimir hoja
              </VintageButton>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-caption text-muted">
            El QR apunta a <span className="font-mono">/e/{event.slug}</span>. La descarga usa el
            mismo archivo que ves en la vista previa.
          </p>
        </section>

        <section aria-labelledby="qr-preview">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 id="qr-preview" className="text-heading-sm font-semibold">
              Vista previa
            </h2>
            <span className="font-mono text-caption uppercase tracking-[0.12em] text-muted">
              A5 · listo para imprimir
            </span>
          </div>

          {qr.isPending ? (
            <LoadingBlock label="Generando el QR…" />
          ) : qr.isError ? (
            <ErrorBlock message="No se pudo generar el QR." onRetry={() => void qr.refetch()} />
          ) : objectUrl ? (
            <div className="qr-print-sheet mx-auto w-full max-w-[32rem] rounded-md border border-border bg-paper-raised p-8 shadow-card">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-brown">
                  Rollo · álbum colectivo
                </p>
                <QrCode aria-hidden="true" className="size-4 text-brown" strokeWidth={1.75} />
              </div>

              <div className="mt-6 text-center">
                <h3 className="break-words font-display text-[clamp(1.5rem,4vw,2.25rem)] font-semibold leading-tight">
                  {event.name}
                </h3>
                <p className="mt-2 text-body-sm text-brown">
                  {formatDateRange(event.startDate, event.endDate)}
                </p>
              </div>

              <img
                src={objectUrl}
                alt={`Código QR para el evento ${event.name}`}
                className="mx-auto mt-6 w-full max-w-[18rem]"
              />

              <div className="mt-6 border-t border-border pt-4 text-center">
                <p className="text-heading-sm font-semibold">Escanea para compartir tus fotos</p>
                <p className="mt-1 text-body-sm text-brown">
                  Abre la cámara y apunta al código. No necesitas instalar nada.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
