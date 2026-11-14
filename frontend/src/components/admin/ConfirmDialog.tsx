import { useEffect, useRef, type ReactNode } from "react";

import { VintageButton } from "@/components/common/VintageButton";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
      className="w-[min(92vw,34rem)] rounded-md border border-border bg-paper-raised p-0 text-ink shadow-lift backdrop:bg-ink/45"
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-heading-md font-semibold">{title}</h2>
        {description ? <p className="mt-2 text-body-sm text-brown">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <VintageButton variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </VintageButton>
          <VintageButton
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {pending ? "Procesando…" : confirmLabel}
          </VintageButton>
        </div>
      </div>
    </dialog>
  );
}
