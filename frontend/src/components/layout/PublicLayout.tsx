import { AnimatePresence } from "motion/react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/common/BrandMark";
import { PageTransition } from "@/components/layout/PageTransition";

export function PublicLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <header className="border-b border-border bg-paper/92 backdrop-blur-[2px]">
        <div className="container-editorial flex items-center justify-between gap-6 py-4 sm:py-5">
          <Link to="/" className="focus-film rounded-sm" aria-label="Rollo, volver al inicio">
            <BrandMark />
          </Link>

          <nav aria-label="Navegación principal" className="flex items-center gap-5 sm:gap-7">
            <a
              href="/#como-funciona"
              className="focus-film hidden rounded-sm font-mono text-caption uppercase tracking-[0.14em] text-brown transition-colors duration-200 hover:text-ink sm:inline"
            >
              Cómo funciona
            </a>
            <a
              href="/#privacidad"
              className="focus-film rounded-sm font-mono text-caption uppercase tracking-[0.14em] text-brown transition-colors duration-200 hover:text-ink"
            >
              Privacidad
            </a>
          </nav>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      <footer className="mt-20 border-t border-border bg-cream/45">
        <div className="container-editorial grid gap-10 py-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandMark className="mb-4" />
            <p className="max-w-xs text-body-sm text-brown">
              Un álbum fotográfico colectivo para celebrar mirando desde muchos ángulos.
            </p>
          </div>

          <div>
            <p className="editorial-kicker mb-4">El proyecto</p>
            <ul className="space-y-2 text-body-sm">
              <li>
                <a
                  href="/#como-funciona"
                  className="focus-film rounded-sm text-brown underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  Cómo funciona
                </a>
              </li>
              <li>
                <a
                  href="/#privacidad"
                  className="focus-film rounded-sm text-brown underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  Privacidad
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="editorial-kicker mb-4">Estado</p>
            <p className="text-body-sm text-brown">
              Fase 4 · Carga y gestión de fotografías.
              <br />
              El álbum colectivo llega en la Fase 5.
            </p>
          </div>
        </div>

        <div className="border-t border-border/80">
          <div className="container-editorial flex flex-col gap-2 py-5 text-caption text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Rollo. Hecho para revelar recuerdos.</p>
            <p className="font-mono uppercase tracking-[0.14em]">
              Sin apps. Sin cuentas. Sin filtros.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
