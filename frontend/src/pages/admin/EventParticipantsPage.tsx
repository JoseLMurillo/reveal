import type {
  AdminParticipant,
  AdminParticipantCreateResult,
  ParticipantSource,
  RegistrationCount,
} from "@rollo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Check,
  ClipboardCopy,
  Download,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { fieldHintClass, fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { VintageButton } from "@/components/common/VintageButton";
import { vintageButtonStyles } from "@/components/common/vintage-button.styles";
import { adminApi } from "@/services/admin";
import { ApiError } from "@/services/api";
import { formatDateTime, formatNumber } from "@/utils/format";

const PAGE_SIZE = 20;

type BooleanFilter = "" | "true" | "false";

type GeneratedLinks = {
  created: AdminParticipantCreateResult[];
  registration: RegistrationCount;
};

type EditState = {
  participant: AdminParticipant;
  displayName: string;
  note: string;
  isActive: boolean;
};

const ACCESS_STATUS_LABELS = {
  active: "Activo",
  revoked: "Revocado",
  none: "Sin código",
} as const;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(links: AdminParticipantCreateResult[]): void {
  const rows = [
    ["nombre", "url"],
    ...links.map((item) => [item.participant.displayName ?? "Anónimo", item.access.url]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rollo-participantes.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function GeneratedLinksDialog({
  links,
  onClose,
}: {
  links: GeneratedLinks | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (links && !dialog.open) {
      dialog.showModal();
    } else if (!links && dialog.open) {
      dialog.close();
    }
  }, [links]);

  useEffect(() => {
    setCopied(null);
  }, [links]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="w-[min(94vw,48rem)] rounded-md border border-border bg-paper-raised p-0 text-ink shadow-lift backdrop:bg-ink/45"
    >
      {links ? (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <p className="editorial-kicker">Enlaces generados</p>
          <h2 className="mt-2 text-heading-md font-semibold">
            Cópialos ahora: no se pueden recuperar después.
          </h2>
          <p className="mt-2 text-body-sm text-brown">
            Cada enlace es personal. El servidor solo guarda el hash del código. Si se pierde,
            tendrás que regenerarlo.
          </p>

          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <caption className="sr-only">Enlaces personales generados</caption>
              <thead className="bg-cream/45">
                <tr className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brown">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Participante
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Enlace
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Copiar
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.created.map((item) => (
                  <tr key={item.participant.id} className="border-t border-border">
                    <td className="px-3 py-2.5 text-body-sm">
                      {item.participant.displayName ?? "Anónimo"}
                    </td>
                    <td className="max-w-[22rem] px-3 py-2.5">
                      <span className="block truncate font-mono text-caption text-muted">
                        {item.access.url}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(item.access.url)
                            .then(() => setCopied(item.participant.id))
                            .catch(() => setCopied(null));
                        }}
                        className="focus-film inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-brown hover:bg-cream/50"
                      >
                        {copied === item.participant.id ? (
                          <Check aria-hidden="true" className="size-3.5 text-success" />
                        ) : (
                          <ClipboardCopy aria-hidden="true" className="size-3.5" />
                        )}
                        {copied === item.participant.id ? "Copiado" : "Copiar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-mono text-caption uppercase tracking-[0.1em] text-muted">
            {formatNumber(links.registration.used)} usados
            {links.registration.remaining === null
              ? " · sin cupo definido"
              : ` · ${formatNumber(links.registration.remaining)} lugares restantes`}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <VintageButton variant="ghost" onClick={() => downloadCsv(links.created)}>
              <Download aria-hidden="true" className="size-4" />
              Descargar CSV
            </VintageButton>
            <VintageButton onClick={onClose}>Entendido, cerrar</VintageButton>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function CreateDialog({
  open,
  mode,
  pending,
  error,
  onClose,
  onSingle,
  onBulk,
}: {
  open: boolean;
  mode: "single" | "bulk";
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSingle: (values: { displayName?: string; note?: string }) => void;
  onBulk: (participants: Array<{ displayName?: string; note?: string }>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [bulk, setBulk] = useState("");

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

  useEffect(() => {
    if (open) {
      setName("");
      setNote("");
      setBulk("");
    }
  }, [open, mode]);

  const bulkEntries = bulk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [displayName, ...noteParts] = line.split("|");
      return {
        displayName: displayName?.trim() || undefined,
        note: noteParts.join("|").trim() || undefined,
      };
    });

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
      className="w-[min(94vw,40rem)] rounded-md border border-border bg-paper-raised p-0 text-ink shadow-lift backdrop:bg-ink/45"
    >
      <div className="p-5 sm:p-6">
        <p className="editorial-kicker">
          {mode === "single" ? "Nuevo participante" : "Carga masiva"}
        </p>
        <h2 className="mt-2 text-heading-md font-semibold">
          {mode === "single" ? "Crea un enlace personal." : "Crea varios enlaces de una vez."}
        </h2>

        {mode === "single" ? (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="participant-name" className={fieldLabelClass}>
                Nombre <span className="normal-case tracking-normal text-muted">(opcional)</span>
              </label>
              <input
                id="participant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoComplete="off"
                className={fieldInputClass}
                placeholder="Ana"
              />
              <p className={fieldHintClass}>
                Si el evento exige nombre, la persona podrá escribirlo al abrir su enlace.
              </p>
            </div>
            <div>
              <label htmlFor="participant-note" className={fieldLabelClass}>
                Nota interna{" "}
                <span className="normal-case tracking-normal text-muted">(opcional)</span>
              </label>
              <input
                id="participant-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={280}
                autoComplete="off"
                className={fieldInputClass}
                placeholder="Mesa 4"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="participant-bulk" className={fieldLabelClass}>
              Un participante por línea
            </label>
            <textarea
              id="participant-bulk"
              rows={8}
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
              className={`${fieldInputClass} min-h-40 font-mono text-caption`}
              placeholder={"Ana | mesa 4\nLuis | mesa 4\nMarta"}
            />
            <p className={fieldHintClass}>
              Usa «Nombre | nota» si quieres añadir una nota interna. Máximo 100 participantes.
              También se pueden dejar nombres vacíos.
            </p>
          </div>
        )}

        {error ? (
          <InlineAlert className="mt-4">
            {messageOf(error, "No se pudieron crear los participantes.")}
          </InlineAlert>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <VintageButton variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </VintageButton>
          <VintageButton
            onClick={() => {
              if (mode === "single") {
                onSingle({
                  displayName: name.trim() || undefined,
                  note: note.trim() || undefined,
                });
              } else {
                onBulk(bulkEntries);
              }
            }}
            disabled={
              pending || (mode === "bulk" && (bulkEntries.length === 0 || bulkEntries.length > 100))
            }
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <UserPlus aria-hidden="true" className="size-4" />
            )}
            {pending
              ? "Creando…"
              : mode === "single"
                ? "Crear enlace"
                : `Crear ${bulkEntries.length}`}
          </VintageButton>
        </div>
      </div>
    </dialog>
  );
}

export function EventParticipantsPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [anonymous, setAnonymous] = useState<BooleanFilter>("");
  const [isActive, setIsActive] = useState<BooleanFilter>("");
  const [source, setSource] = useState<ParticipantSource | "">("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const [createMode, setCreateMode] = useState<"single" | "bulk" | null>(null);
  const [links, setLinks] = useState<GeneratedLinks | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<AdminParticipant | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminParticipant | null>(null);

  const detail = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => adminApi.detail(id),
    enabled: id.length > 0,
  });

  const participants = useQuery({
    queryKey: ["admin", "participants", id, page, deferredSearch, anonymous, isActive, source],
    queryFn: () =>
      adminApi.listParticipants(id, {
        page,
        limit: PAGE_SIZE,
        search: deferredSearch.trim() || undefined,
        anonymous: anonymous === "" ? undefined : anonymous === "true",
        isActive: isActive === "" ? undefined : isActive === "true",
        source: source === "" ? undefined : source,
      }),
    enabled: id.length > 0,
  });

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["admin", "participants", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "event", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  }

  const create = useMutation({
    mutationFn: (values: { displayName?: string; note?: string }) =>
      adminApi.createParticipant(id, values),
    async onSuccess(result) {
      setCreateMode(null);
      setLinks({ created: [result], registration: result.registration });
      await refresh();
    },
  });

  const bulkCreate = useMutation({
    mutationFn: (values: Array<{ displayName?: string; note?: string }>) =>
      adminApi.bulkCreateParticipants(id, { participants: values }),
    async onSuccess(result) {
      setCreateMode(null);
      setLinks({ created: result.created, registration: result.registration });
      await refresh();
    },
  });

  const update = useMutation({
    mutationFn: (values: EditState) =>
      adminApi.updateParticipant(values.participant.id, {
        displayName: values.displayName.trim() || null,
        note: values.note.trim() || null,
        isActive: values.isActive,
      }),
    async onSuccess() {
      setEdit(null);
      await refresh();
    },
  });

  const regenerate = useMutation({
    mutationFn: (participant: AdminParticipant) =>
      adminApi.regenerateAccessCode(participant.id, { revokeSessions: true }),
    async onSuccess(result) {
      setRegenerateTarget(null);
      setLinks({
        created: [
          {
            participant: {
              id: result.participantId,
              displayName: regenerateTarget?.displayName ?? null,
              anonymous: regenerateTarget?.anonymous ?? false,
              note: regenerateTarget?.note ?? null,
              registrationSource: regenerateTarget?.registrationSource ?? "admin",
              accessCodePrefix: result.access.code.slice(0, 6),
              isActive: regenerateTarget?.isActive ?? true,
              createdAt: regenerateTarget?.createdAt ?? result.access.createdAt,
              lastSeenAt: regenerateTarget?.lastSeenAt ?? result.access.createdAt,
            },
            access: result.access,
            registration: {
              limit: null,
              used: 0,
              remaining: null,
            },
          },
        ],
        registration: {
          limit: null,
          used: participants.data?.meta.total ?? 0,
          remaining: null,
        },
      });
      await refresh();
    },
  });

  const revoke = useMutation({
    mutationFn: (participant: AdminParticipant) =>
      adminApi.revokeAccessCode(participant.id, { revokeSessions: true }),
    async onSuccess() {
      setRevokeTarget(null);
      await refresh();
    },
  });

  const rows = participants.data?.data ?? [];
  const meta = participants.data?.meta;
  const actionError =
    create.error ?? bulkCreate.error ?? update.error ?? regenerate.error ?? revoke.error;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Participantes"
        title={detail.data ? detail.data.name : "Participantes del evento"}
        description="Cada participante recibe un enlace personal. El código completo se muestra una sola vez."
        actions={
          <>
            <Link to={`/admin/events/${id}`} className={vintageButtonStyles({ variant: "ghost" })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Volver al evento
            </Link>
            <VintageButton variant="ghost" onClick={() => setCreateMode("bulk")}>
              <Users aria-hidden="true" className="size-4" />
              Carga masiva
            </VintageButton>
            <VintageButton onClick={() => setCreateMode("single")}>
              <Plus aria-hidden="true" className="size-4" />
              Nuevo participante
            </VintageButton>
          </>
        }
      />

      {detail.data ? (
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-caption text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-3.5" />
            {formatNumber(detail.data.counts.participants)} participantes
          </span>
          <span>
            {detail.data.counts.remainingSlots === null
              ? "Sin cupo definido"
              : `${formatNumber(detail.data.counts.remainingSlots)} lugares restantes`}
          </span>
          <span className="font-mono">/e/{detail.data.slug}</span>
        </p>
      ) : null}

      <div className="grid gap-3 border border-border bg-paper-raised p-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <label htmlFor="participant-search" className={fieldLabelClass}>
            Buscar
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="participant-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nombre, nota o prefijo"
              className={`${fieldInputClass} pl-9`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="participant-anonymous" className={fieldLabelClass}>
            Identidad
          </label>
          <select
            id="participant-anonymous"
            value={anonymous}
            onChange={(event) => {
              setAnonymous(event.target.value as BooleanFilter);
              setPage(1);
            }}
            className={fieldInputClass}
          >
            <option value="">Todos</option>
            <option value="false">Con nombre</option>
            <option value="true">Anónimos</option>
          </select>
        </div>

        <div>
          <label htmlFor="participant-active" className={fieldLabelClass}>
            Estado
          </label>
          <select
            id="participant-active"
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value as BooleanFilter);
              setPage(1);
            }}
            className={fieldInputClass}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Deshabilitados</option>
          </select>
        </div>

        <div>
          <label htmlFor="participant-source" className={fieldLabelClass}>
            Origen
          </label>
          <select
            id="participant-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as ParticipantSource | "");
              setPage(1);
            }}
            className={fieldInputClass}
          >
            <option value="">Todos</option>
            <option value="admin">Administrador</option>
            <option value="self">Auto-registro</option>
          </select>
        </div>
      </div>

      {actionError && !createMode ? (
        <InlineAlert>{messageOf(actionError, "La acción no se pudo completar.")}</InlineAlert>
      ) : null}

      {participants.isPending ? (
        <LoadingBlock label="Cargando participantes…" />
      ) : participants.isError ? (
        <ErrorBlock
          message="No se pudieron cargar los participantes."
          onRetry={() => void participants.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            deferredSearch || anonymous || isActive || source
              ? "Sin resultados"
              : "Aún no hay participantes"
          }
          description={
            deferredSearch || anonymous || isActive || source
              ? "Prueba con otra búsqueda o cambia los filtros."
              : "Crea el primer enlace personal o activa el auto-registro en el evento."
          }
          action={
            <VintageButton onClick={() => setCreateMode("single")}>
              <UserPlus aria-hidden="true" className="size-4" />
              Crear participante
            </VintageButton>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[64rem] border-collapse text-left">
              <caption className="sr-only">Participantes del evento</caption>
              <thead className="bg-cream/45">
                <tr className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brown">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Participante
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Código
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Hoy
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Última visita
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((participant) => (
                  <tr key={participant.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="text-body-sm font-medium">
                        {participant.displayName ?? "Anónimo"}
                      </p>
                      <p className="mt-0.5 text-caption text-muted">
                        {participant.registrationSource === "admin"
                          ? "Creado por administrador"
                          : "Auto-registro"}
                        {participant.note ? ` · ${participant.note}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-caption text-muted">
                        {participant.accessCodePrefix}…
                      </p>
                      <p className="mt-0.5 text-caption text-brown">
                        {ACCESS_STATUS_LABELS[participant.accessCodeStatus]}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          participant.isActive
                            ? "inline-flex rounded-full border border-success/35 bg-success/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-success"
                            : "inline-flex rounded-full border border-red/30 bg-red/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-red"
                        }
                      >
                        {participant.isActive ? "Activo" : "Deshabilitado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm">
                      {participant.photosToday}
                      <span className="text-muted"> / {participant.remainingToday ?? "∞"}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm">
                      {formatNumber(participant.photosTotal)}
                    </td>
                    <td className="px-4 py-3 text-caption text-muted">
                      {formatDateTime(participant.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEdit({
                              participant,
                              displayName: participant.displayName ?? "",
                              note: participant.note ?? "",
                              isActive: participant.isActive,
                            })
                          }
                          className="focus-film inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] hover:bg-cream/50"
                        >
                          <Pencil aria-hidden="true" className="size-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegenerateTarget(participant)}
                          className="focus-film inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] hover:bg-cream/50"
                        >
                          <RefreshCw aria-hidden="true" className="size-3" />
                          Regenerar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(participant)}
                          disabled={participant.accessCodeStatus === "revoked"}
                          className="focus-film inline-flex items-center gap-1 rounded-sm border border-red/30 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-red hover:bg-red/5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Ban aria-hidden="true" className="size-3" />
                          Revocar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-muted">
                {formatNumber(meta.total)} participantes · página {meta.page} de {meta.totalPages}
              </p>
              <div className="flex gap-2">
                <VintageButton
                  variant="ghost"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={meta.page <= 1}
                >
                  Anterior
                </VintageButton>
                <VintageButton
                  variant="ghost"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={meta.page >= meta.totalPages}
                >
                  Siguiente
                </VintageButton>
              </div>
            </div>
          ) : null}
        </>
      )}

      <CreateDialog
        open={createMode !== null}
        mode={createMode ?? "single"}
        pending={create.isPending || bulkCreate.isPending}
        error={createMode === "bulk" ? bulkCreate.error : create.error}
        onClose={() => {
          if (!create.isPending && !bulkCreate.isPending) {
            setCreateMode(null);
          }
        }}
        onSingle={(values) => create.mutate(values)}
        onBulk={(values) => bulkCreate.mutate(values)}
      />

      <GeneratedLinksDialog links={links} onClose={() => setLinks(null)} />

      {edit ? (
        <EditParticipantDialog
          state={edit}
          pending={update.isPending}
          error={update.error}
          onChange={setEdit}
          onClose={() => setEdit(null)}
          onSave={() => update.mutate(edit)}
        />
      ) : null}

      <ConfirmDialog
        open={regenerateTarget !== null}
        title="Regenerar el código de acceso"
        description="El código anterior dejará de funcionar y todas las sesiones abiertas se cerrarán. El nuevo enlace se mostrará una sola vez."
        confirmLabel="Regenerar enlace"
        tone="primary"
        pending={regenerate.isPending}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={() => {
          if (regenerateTarget) {
            regenerate.mutate(regenerateTarget);
          }
        }}
      >
        {regenerateTarget ? (
          <p className="rounded-sm border border-border bg-cream/35 px-3 py-2 text-body-sm">
            {regenerateTarget.displayName ?? "Anónimo"}{" "}
            <span className="font-mono text-caption text-muted">
              {regenerateTarget.accessCodePrefix}…
            </span>
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revocar el enlace personal"
        description="La persona no podrá volver a canjear su enlace y sus sesiones se cerrarán. Sus fotos se conservan. Esta acción es idempotente."
        confirmLabel="Revocar enlace"
        pending={revoke.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) {
            revoke.mutate(revokeTarget);
          }
        }}
      >
        {revokeTarget ? (
          <p className="rounded-sm border border-border bg-cream/35 px-3 py-2 text-body-sm">
            {revokeTarget.displayName ?? "Anónimo"}{" "}
            <span className="font-mono text-caption text-muted">
              {revokeTarget.accessCodePrefix}…
            </span>
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function EditParticipantDialog({
  state,
  pending,
  error,
  onChange,
  onClose,
  onSave,
}: {
  state: EditState;
  pending: boolean;
  error: unknown;
  onChange: (state: EditState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
      className="w-[min(94vw,36rem)] rounded-md border border-border bg-paper-raised p-0 text-ink shadow-lift backdrop:bg-ink/45"
    >
      <div className="p-5 sm:p-6">
        <p className="editorial-kicker">Editar participante</p>
        <h2 className="mt-2 text-heading-md font-semibold">
          {state.participant.displayName ?? "Participante anónimo"}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-name" className={fieldLabelClass}>
              Nombre
            </label>
            <input
              id="edit-name"
              value={state.displayName}
              onChange={(event) => onChange({ ...state, displayName: event.target.value })}
              maxLength={60}
              className={fieldInputClass}
            />
            <p className={fieldHintClass}>Déjalo vacío para borrar el nombre.</p>
          </div>

          <div>
            <label htmlFor="edit-note" className={fieldLabelClass}>
              Nota interna
            </label>
            <input
              id="edit-note"
              value={state.note}
              onChange={(event) => onChange({ ...state, note: event.target.value })}
              maxLength={280}
              className={fieldInputClass}
            />
          </div>

          <label className="flex items-start gap-3 rounded-sm border border-border bg-cream/25 px-3 py-2.5 text-body-sm">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={(event) => onChange({ ...state, isActive: event.target.checked })}
              className="mt-0.5 size-4 accent-ink"
            />
            <span>
              Participante activo
              <span className="mt-0.5 block text-caption text-muted">
                Al deshabilitarlo se revocan sus sesiones. El código no se reactiva solo.
              </span>
            </span>
          </label>
        </div>

        {error ? (
          <InlineAlert className="mt-4">
            {messageOf(error, "No se pudo actualizar el participante.")}
          </InlineAlert>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <VintageButton variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </VintageButton>
          <VintageButton onClick={onSave} disabled={pending}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <KeyRound aria-hidden="true" className="size-4" />
            )}
            {pending ? "Guardando…" : "Guardar cambios"}
          </VintageButton>
        </div>
      </div>
    </dialog>
  );
}
