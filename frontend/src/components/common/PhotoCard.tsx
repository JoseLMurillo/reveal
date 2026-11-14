import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function PhotoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {children}
    </ul>
  );
}

export function PhotoCard({
  src,
  alt,
  author,
  caption,
  onOpen,
  openLabel = "Ampliar fotografía",
  aspect = "square",
}: {
  src: string;
  alt: string;
  author?: string | null;
  caption?: string | null;
  onOpen: () => void;
  openLabel?: string;
  aspect?: "square" | "landscape";
}) {
  return (
    <li className="overflow-hidden rounded-sm border border-border bg-paper-raised">
      <button
        type="button"
        onClick={onOpen}
        className="focus-film block w-full"
        aria-label={openLabel}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            "w-full object-cover",
            aspect === "square" ? "aspect-square" : "aspect-[4/3]",
          )}
        />
      </button>
      {author || caption ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="truncate text-caption text-brown">{author ?? "Invitado anónimo"}</p>
          {caption ? <p className="truncate text-caption text-muted">{caption}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
