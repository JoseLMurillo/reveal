import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@rollo/shared";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { BrandMark } from "@/components/common/BrandMark";
import { VintageButton } from "@/components/common/VintageButton";
import { fieldInputClass, fieldLabelClass, fieldErrorClass } from "@/components/admin/form";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ApiError } from "@/services/api";

export function AdminLoginPage() {
  const { status, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const from =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof (location.state as { from?: unknown }).from === "string"
      ? (location.state as { from: string }).from
      : "/admin";

  const passwordChanged =
    typeof location.state === "object" &&
    location.state !== null &&
    "passwordChanged" in location.state &&
    (location.state as { passwordChanged?: unknown }).passwordChanged === true;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (status === "authenticated") {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: LoginInput): Promise<void> {
    setFormError(null);

    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    }
  }

  return (
    <div className="grid min-h-dvh bg-paper text-ink lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-ink p-10 text-paper-raised lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="film-perforation absolute inset-x-0 top-0 h-3 opacity-20"
        />
        <div
          aria-hidden="true"
          className="film-perforation absolute inset-x-0 bottom-0 h-3 opacity-20"
        />
        <Link to="/" className="focus-film relative z-10 w-fit rounded-sm">
          <BrandMark tone="inverted" />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="font-mono text-caption uppercase tracking-[0.18em] text-yellow">
            Panel administrativo
          </p>
          <p className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] font-medium leading-[1.05] tracking-[-0.02em]">
            Cada rollo necesita alguien que lo cuide.
          </p>
          <p className="mt-5 text-body-sm text-paper-raised/70">
            Crea eventos, comparte el QR y observa cómo se revelan las miradas. Las fotografías
            originales nunca se alteran.
          </p>
        </div>
        <p className="relative z-10 font-mono text-caption uppercase tracking-[0.14em] text-paper-raised/45">
          Acceso privado · Sesión de servidor
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="focus-film inline-block rounded-sm">
              <BrandMark />
            </Link>
          </div>

          <div className="paper-card p-6 sm:p-8">
            <span className="grid size-11 place-items-center rounded-sm border border-brown/30 bg-cream/50 text-brown">
              <LockKeyhole aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <h1 className="mt-5 text-heading-lg font-semibold">Entrar al panel</h1>
            <p className="mt-2 text-body-sm text-brown">
              Usa las credenciales de administrador. No hay registro público.
            </p>

            {passwordChanged ? (
              <p
                className="mt-4 rounded-sm border border-success/30 bg-success/5 px-3 py-2.5 text-body-sm text-success"
                role="status"
              >
                Contraseña actualizada. Todas las sesiones se cerraron; entra con la nueva.
              </p>
            ) : null}

            <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <label htmlFor="email" className={fieldLabelClass}>
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className={fieldInputClass}
                  aria-invalid={errors.email ? "true" : "false"}
                  {...register("email")}
                />
                {errors.email ? (
                  <p className={fieldErrorClass} role="alert">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className={fieldLabelClass}>
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={fieldInputClass}
                  aria-invalid={errors.password ? "true" : "false"}
                  {...register("password")}
                />
                {errors.password ? (
                  <p className={fieldErrorClass} role="alert">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <p
                  className="rounded-sm border border-red/30 bg-red/5 px-3 py-2.5 text-body-sm text-red"
                  role="alert"
                >
                  {formError}
                </p>
              ) : null}

              <VintageButton type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Entrando…" : "Entrar"}
              </VintageButton>
            </form>
          </div>

          <Link
            to="/"
            className="focus-film mt-6 inline-flex items-center gap-2 rounded-sm text-body-sm text-brown underline-offset-4 hover:text-ink hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al sitio público
          </Link>
        </div>
      </section>
    </div>
  );
}
