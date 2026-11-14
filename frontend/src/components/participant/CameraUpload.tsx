import type { AllowedImageMimeType } from "@rollo/shared";
import { MAX_FILES_PER_UPLOAD } from "@rollo/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InlineAlert } from "@/components/admin/Feedback";
import { VintageButton } from "@/components/common/VintageButton";
import { useParticipant } from "@/context/ParticipantContext";
import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";
import { formatBytes } from "@/utils/format";

const ALLOWED_TYPES: AllowedImageMimeType[] = ["image/jpeg", "image/png", "image/webp"];

type JobStatus = "queued" | "uploading" | "confirming" | "done" | "failed";

type UploadJob = {
  id: string;
  file: File;
  previewUrl: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  photoId: string | null;
};

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error && error.message.length > 0
      ? error.message
      : fallback;
}

function isAllowedMime(value: string): value is AllowedImageMimeType {
  return (ALLOWED_TYPES as string[]).includes(value);
}

function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Storage rechazó el archivo. Vuelve a intentarlo."));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("No se pudo conectar con Storage. Revisa tu conexión."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("La carga se canceló."));
    });

    xhr.send(body);
  });
}

export function CameraUpload({ onUploaded }: { onUploaded?: () => void }) {
  const { sessionToken, me, refetch } = useParticipant();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef<UploadJob[]>([]);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  jobsRef.current = jobs;

  useEffect(() => {
    return () => {
      for (const job of jobsRef.current) {
        URL.revokeObjectURL(job.previewUrl);
      }
    };
  }, []);

  if (!me || !sessionToken) {
    return null;
  }

  const maxFileSizeBytes = me.event.maxFileSizeBytes;
  const eventSlug = me.event.slug;
  const remainingSlots = Math.min(me.quota.remainingDay, MAX_FILES_PER_UPLOAD);
  const queued = jobs.filter((job) => job.status === "queued" || job.status === "failed");
  const done = jobs.filter((job) => job.status === "done");
  const failed = jobs.filter((job) => job.status === "failed");

  function updateJob(id: string, patch: Partial<UploadJob>): void {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function addFiles(fileList: FileList | null): void {
    if (!fileList) {
      return;
    }

    const next: UploadJob[] = [];
    const issues: string[] = [];
    const used = jobs.filter(
      (job) => job.status === "queued" || job.status === "uploading" || job.status === "confirming",
    ).length;
    const available = Math.max(remainingSlots - used, 0);

    for (const file of Array.from(fileList)) {
      if (next.length >= available) {
        issues.push(
          `Solo puedes añadir ${remainingSlots} foto${remainingSlots === 1 ? "" : "s"} en esta carga.`,
        );
        break;
      }

      if (!isAllowedMime(file.type)) {
        issues.push(`«${file.name}» no es JPEG, PNG ni WebP.`);
        continue;
      }

      if (file.size <= 0) {
        issues.push(`«${file.name}» está vacío.`);
        continue;
      }

      if (file.size > maxFileSizeBytes) {
        issues.push(`«${file.name}» supera el límite de ${formatBytes(maxFileSizeBytes)}.`);
        continue;
      }

      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
        error: null,
        photoId: null,
      });
    }

    setProblems(issues);
    setJobs((current) => [...current, ...next]);
  }

  function removeJob(id: string): void {
    setJobs((current) => {
      const job = current.find((item) => item.id === id);

      if (job) {
        URL.revokeObjectURL(job.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  function retry(job: UploadJob): void {
    updateJob(job.id, { status: "queued", progress: 0, error: null });
  }

  async function startUpload(): Promise<void> {
    if (busy || !sessionToken) {
      return;
    }

    const pending = jobs.filter((job) => job.status === "queued" || job.status === "failed");

    if (pending.length === 0) {
      return;
    }

    setBusy(true);
    setProblems([]);
    setJobs((current) =>
      current.map((job) =>
        pending.some((item) => item.id === job.id)
          ? { ...job, status: "uploading", progress: 0, error: null }
          : job,
      ),
    );

    let sessionId: string | null = null;

    try {
      const intent = await publicApi.uploadIntent(sessionToken, {
        files: pending.map((job) => ({
          clientFileId: job.id,
          filename: job.file.name,
          mimeType: job.file.type as AllowedImageMimeType,
          sizeBytes: job.file.size,
        })),
      });

      sessionId = intent.sessionId;
      const targets = new Map(intent.uploads.map((upload) => [upload.clientFileId, upload]));

      await Promise.all(
        pending.map(async (job) => {
          const target = targets.get(job.id);

          if (!target) {
            updateJob(job.id, {
              status: "failed",
              error: "El servidor no preparó una URL para este archivo.",
            });
            return;
          }

          try {
            await uploadWithProgress(target.signedUrl, job.file, (percent) => {
              updateJob(job.id, { progress: percent });
            });
            updateJob(job.id, { status: "confirming", progress: 100 });
          } catch (error) {
            updateJob(job.id, {
              status: "failed",
              error: messageOf(error, "No se pudo subir el archivo."),
            });
          }
        }),
      );

      try {
        const result = await publicApi.confirmUpload(sessionToken, {
          sessionId,
          items: intent.uploads.map((upload) => ({ itemId: upload.itemId })),
        });

        const byItem = new Map(result.results.map((item) => [item.itemId, item]));

        setJobs((current) =>
          current.map((job) => {
            const target = targets.get(job.id);
            const item = target ? byItem.get(target.itemId) : undefined;

            if (!target || !item) {
              return job.status === "uploading" || job.status === "confirming"
                ? {
                    ...job,
                    status: "failed",
                    error: "El servidor no devolvió el resultado de este archivo.",
                  }
                : job;
            }

            if (item.status === "confirmed") {
              return {
                ...job,
                status: "done",
                progress: 100,
                error: null,
                photoId: item.photoId ?? null,
              };
            }

            return {
              ...job,
              status: "failed",
              error: item.error?.message ?? "El archivo no se pudo validar.",
            };
          }),
        );

        await queryClient.invalidateQueries({ queryKey: ["participant", eventSlug] });
        await queryClient.invalidateQueries({ queryKey: ["participant-photos", eventSlug] });
        refetch();
        onUploaded?.();
      } catch (error) {
        await publicApi.releaseUpload(sessionToken, { sessionId }).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      const message = messageOf(error, "No se pudieron subir las fotografías.");

      setJobs((current) =>
        current.map((job) =>
          job.status === "uploading" || job.status === "confirming"
            ? { ...job, status: "failed", error: message }
            : job,
        ),
      );

      if (sessionId) {
        await publicApi.releaseUpload(sessionToken, { sessionId }).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`paper-card p-6 transition-colors ${dragging ? "border-ink bg-cream/40" : ""}`}
      aria-labelledby="camera-upload-title"
      onDragOver={(event) => {
        if (busy) {
          return;
        }

        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);

        if (!busy) {
          addFiles(event.dataTransfer.files);
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="editorial-kicker flex items-center gap-2">
            <Camera aria-hidden="true" className="size-3.5" />
            Tu cámara
          </p>
          <h2 id="camera-upload-title" className="mt-2 text-heading-md font-semibold">
            Revela tus fotos de hoy
          </h2>
          <p className="mt-2 max-w-prose text-body-sm text-brown">
            Las fotos se suben directamente a Storage. El original nunca se modifica. Te quedan{" "}
            {me.quota.remainingDay} disparos hoy
            {me.quota.remainingTotal === null ? "" : ` y ${me.quota.remainingTotal} en total`}.
          </p>
        </div>
        <span className="rounded-full border border-brown/30 bg-cream/45 px-3 py-1 font-mono text-caption uppercase tracking-[0.1em] text-brown">
          Máx. {formatBytes(me.event.maxFileSizeBytes)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          className="sr-only"
          aria-label="Seleccionar fotografías"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <VintageButton
          variant="ghost"
          onClick={() => inputRef.current?.click()}
          disabled={busy || remainingSlots <= 0}
        >
          <ImagePlus aria-hidden="true" className="size-4" />
          Elegir fotos
        </VintageButton>
        <VintageButton onClick={() => void startUpload()} disabled={busy || queued.length === 0}>
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="size-4" />
          )}
          {busy ? "Revelando…" : `Revelar ${queued.length || ""}`.trim()}
        </VintageButton>
        {done.length > 0 ? (
          <VintageButton
            variant="ghost"
            onClick={() => {
              setJobs((current) => {
                for (const job of current) {
                  if (job.status === "done") {
                    URL.revokeObjectURL(job.previewUrl);
                  }
                }

                return current.filter((job) => job.status !== "done");
              });
            }}
          >
            <Check aria-hidden="true" className="size-4" />
            Limpiar completadas
          </VintageButton>
        ) : null}
      </div>

      {remainingSlots <= 0 ? (
        <InlineAlert className="mt-4" tone="error">
          Ya usaste todos los disparos disponibles hoy. La cuota se renueva en la zona horaria del
          evento.
        </InlineAlert>
      ) : null}

      {problems.length > 0 ? (
        <div className="mt-4 space-y-1 rounded-sm border border-warning/30 bg-warning/5 px-4 py-3 text-caption text-warning">
          {problems.map((problem) => (
            <p key={problem} className="flex items-start gap-2">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {problem}
            </p>
          ))}
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="group relative overflow-hidden rounded-sm border border-border bg-paper"
            >
              <img
                src={job.previewUrl}
                alt={`Vista previa de ${job.file.name}`}
                className="aspect-square w-full object-cover"
              />
              <div className="space-y-1 p-2">
                <p className="truncate text-caption text-brown" title={job.file.name}>
                  {job.file.name}
                </p>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                  {formatBytes(job.file.size)}
                </p>
                {job.status === "uploading" || job.status === "confirming" ? (
                  <div>
                    <div
                      className="h-1 overflow-hidden rounded-full bg-cream"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={job.progress}
                      aria-label={`Subiendo ${job.file.name}`}
                    >
                      <div
                        className="h-full bg-ink transition-[width] duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[0.62rem] text-muted">
                      {job.status === "confirming" ? "Validando…" : `${job.progress}%`}
                    </p>
                  </div>
                ) : null}
                {job.status === "done" ? (
                  <p className="flex items-center gap-1 text-[0.68rem] font-semibold text-success">
                    <Check aria-hidden="true" className="size-3" />
                    Confirmada
                  </p>
                ) : null}
                {job.status === "failed" ? (
                  <p className="text-[0.68rem] text-warning">{job.error}</p>
                ) : null}
              </div>

              <div className="absolute right-1.5 top-1.5 flex gap-1">
                {job.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => retry(job)}
                    disabled={busy}
                    aria-label={`Reintentar ${job.file.name}`}
                    className="grid size-8 place-items-center rounded-full bg-paper-raised/95 text-ink shadow-sm"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                ) : null}
                {job.status === "queued" || job.status === "failed" || job.status === "done" ? (
                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    disabled={busy}
                    aria-label={`Quitar ${job.file.name}`}
                    className="grid size-8 place-items-center rounded-full bg-paper-raised/95 text-ink shadow-sm"
                  >
                    {job.status === "done" ? (
                      <X className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-sm border border-dashed border-brown/30 bg-cream/20 px-4 py-8 text-center">
          <ImagePlus aria-hidden="true" className="mx-auto size-6 text-brown" />
          <p className="mt-2 text-body-sm text-brown">
            Arrastra tus fotos aquí o elige hasta {remainingSlots} foto
            {remainingSlots === 1 ? "" : "s"} para empezar.
          </p>
          <p className="mt-1 text-caption text-muted">
            JPEG, PNG o WebP. No se aceptan archivos que no sean imágenes reales.
          </p>
        </div>
      )}

      {failed.length > 0 && !busy ? (
        <p className="mt-3 text-caption text-warning">
          {failed.length} archivo{failed.length === 1 ? "" : "s"} no se pudo confirmar. La reserva
          se liberó automáticamente.
        </p>
      ) : null}
    </div>
  );
}
