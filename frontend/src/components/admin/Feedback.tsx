import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function LoadingBlock({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-body-sm text-brown" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-md border border-red/30 bg-red/5 p-4 text-body-sm text-ink sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <span className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red" />
        {message}
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="focus-film rounded-sm border border-red/40 px-3 py-1.5 font-mono text-caption uppercase tracking-[0.1em] text-red hover:bg-red/10"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-red/30 bg-red/5 text-red",
    success: "border-success/30 bg-success/5 text-success",
    info: "border-border bg-cream/40 text-brown",
  } as const;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-sm border px-3 py-2.5 text-body-sm", styles[tone], className)}
    >
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="paper-card flex flex-col items-start gap-3 p-6">
      <span className="grid size-10 place-items-center rounded-sm border border-brown/30 bg-cream/50 text-brown">
        <Inbox aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-heading-sm font-semibold">{title}</h2>
        <p className="mt-1 max-w-lg text-body-sm text-brown">{description}</p>
      </div>
      {action}
    </div>
  );
}
