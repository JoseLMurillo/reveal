import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export type LightboxPhoto = {
  url: string;
  originalFilename: string;
  caption?: string;
};

export function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: LightboxPhoto | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (photo) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }

    previousFocus.current?.focus();
    previousFocus.current = null;
    return undefined;
  }, [photo]);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (photo && !dialog.open) {
      dialog.showModal();
    } else if (!photo && dialog.open) {
      dialog.close();
    }
  }, [photo]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      aria-labelledby="photo-lightbox-title"
      className="w-[min(96vw,72rem)] rounded-md border border-border bg-paper-raised p-0 text-ink shadow-lift backdrop:bg-ink/70"
    >
      {photo ? (
        <div className="relative">
          <h2 id="photo-lightbox-title" className="sr-only">
            {photo.originalFilename}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista de la fotografía"
            className="focus-film absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-paper-raised/90 text-ink shadow-sm"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          <img
            src={photo.url}
            alt={photo.originalFilename}
            className="max-h-[80vh] w-full object-contain"
          />
          <div className="border-t border-border px-4 py-3">
            <p className="truncate text-body-sm font-semibold">{photo.originalFilename}</p>
            {photo.caption ? (
              <p className="mt-0.5 text-caption text-muted">{photo.caption}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
