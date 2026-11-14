import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema } from "@rollo/shared";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { InlineAlert } from "@/components/admin/Feedback";
import { PageHeader } from "@/components/admin/PageHeader";
import { fieldErrorClass, fieldInputClass, fieldLabelClass } from "@/components/admin/form";
import { VintageButton } from "@/components/common/VintageButton";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";
import { formatDateTime } from "@/utils/format";

const accountPasswordSchema = changePasswordSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas nuevas no coinciden.",
  });

type AccountPasswordValues = z.infer<typeof accountPasswordSchema>;

export function AdminAccountPage() {
  const { admin, session, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountPasswordValues>({
    resolver: zodResolver(accountPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: AccountPasswordValues): Promise<void> {
    setFormError(null);

    try {
      await adminApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();

      try {
        await logout();
      } catch {
        // El servidor ya revocó todas las sesiones; el estado local se limpia igualmente.
      }

      navigate("/admin/login", { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Cuenta"
        title="Tu acceso"
        description="Credenciales propias de Rollo. No hay recuperación por email: la contraseña se restablece desde el CLI del servidor."
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="paper-card h-fit p-5" aria-labelledby="account-identity">
          <h2 id="account-identity" className="text-heading-sm font-semibold">
            Identidad
          </h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                Nombre
              </dt>
              <dd className="mt-1 text-body-sm">{admin?.displayName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                Correo
              </dt>
              <dd className="mt-1 break-all text-body-sm">{admin?.email}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                Rol
              </dt>
              <dd className="mt-1 text-body-sm">
                {admin?.role === "owner" ? "Propietario" : "Administrador"}
              </dd>
            </div>
            {session ? (
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
                  Sesión válida hasta
                </dt>
                <dd className="mt-1 text-body-sm">{formatDateTime(session.expiresAt)}</dd>
                <dd className="mt-1 text-caption text-muted">
                  Por inactividad: {formatDateTime(session.idleExpiresAt)}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-caption text-muted">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            La cookie de sesión es HttpOnly y el panel exige un token CSRF en cada cambio.
          </p>
        </section>

        <section className="paper-card p-5" aria-labelledby="account-password">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-sm border border-brown/30 bg-cream/50 text-brown">
              <KeyRound aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 id="account-password" className="text-heading-sm font-semibold">
                Cambiar contraseña
              </h2>
              <p className="text-body-sm text-brown">
                Se revocan todas las sesiones, incluida esta.
              </p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="currentPassword" className={fieldLabelClass}>
                Contraseña actual
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                className={fieldInputClass}
                {...register("currentPassword")}
              />
              {errors.currentPassword ? (
                <p className={fieldErrorClass} role="alert">
                  {errors.currentPassword.message}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="newPassword" className={fieldLabelClass}>
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className={fieldInputClass}
                {...register("newPassword")}
              />
              {errors.newPassword ? (
                <p className={fieldErrorClass} role="alert">
                  {errors.newPassword.message}
                </p>
              ) : (
                <p className="mt-1.5 text-caption text-muted">Mínimo 12 caracteres, máximo 128.</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className={fieldLabelClass}>
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className={fieldInputClass}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className={fieldErrorClass} role="alert">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {formError ? <InlineAlert tone="error">{formError}</InlineAlert> : null}

            <VintageButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando…" : "Cambiar contraseña"}
            </VintageButton>
          </form>
        </section>
      </div>
    </div>
  );
}
