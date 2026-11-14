import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export const fieldInputClass =
  "focus-film min-h-11 w-full rounded-sm border border-border bg-paper-raised px-3 py-2.5 text-body-sm text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-cream/40";

export const fieldLabelClass =
  "mb-1.5 block font-mono text-caption uppercase tracking-[0.12em] text-brown";

export const fieldHintClass = "mt-1.5 text-caption text-muted";

export const fieldErrorClass = "mt-1.5 text-caption font-medium text-red";

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className={fieldErrorClass} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
