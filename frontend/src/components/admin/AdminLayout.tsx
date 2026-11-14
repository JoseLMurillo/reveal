import {
  Aperture,
  ArrowUpRight,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { BrandMark } from "@/components/common/BrandMark";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/admin/events", label: "Eventos", icon: CalendarDays, end: false },
  { to: "/admin/account", label: "Cuenta", icon: UserRound, end: false },
] as const;

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación administrativa" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "focus-film flex items-center gap-3 rounded-sm px-3 py-2.5 text-body-sm font-medium transition-colors",
                isActive
                  ? "bg-ink text-paper-raised"
                  : "text-brown hover:bg-cream/60 hover:text-ink",
              )
            }
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    try {
      await logout();
    } finally {
      onNavigate?.();
      navigate("/admin/login", { replace: true });
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link to="/admin" onClick={onNavigate} className="focus-film rounded-sm">
        <BrandMark compact />
      </Link>

      <div>
        <Link
          to="/admin/events/new"
          onClick={onNavigate}
          className="focus-film flex min-h-10 items-center justify-center gap-2 rounded-sm border border-ink bg-ink px-3 py-2 text-body-sm font-semibold text-paper-raised transition-colors hover:bg-brown"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nuevo evento
        </Link>
      </div>

      <NavItems onNavigate={onNavigate} />

      <div className="mt-auto space-y-4 border-t border-border pt-4">
        <Link
          to="/"
          onClick={onNavigate}
          className="focus-film flex items-center gap-2 rounded-sm px-3 py-2 text-body-sm text-brown hover:text-ink"
        >
          <ArrowUpRight aria-hidden="true" className="size-4" />
          Ver sitio público
        </Link>

        <div className="rounded-sm border border-border bg-cream/35 px-3 py-2.5">
          <p className="truncate text-body-sm font-medium">{admin?.displayName}</p>
          <p className="truncate font-mono text-caption text-muted">{admin?.email}</p>
          <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-brown">
            {admin?.role === "owner" ? "Propietario" : "Administrador"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="focus-film flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-body-sm text-brown hover:bg-red/5 hover:text-red"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[240px_1fr]">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <aside className="hidden border-r border-border bg-paper-raised/60 lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContent />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-paper/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Link to="/admin" className="focus-film rounded-sm">
            <BrandMark compact />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir navegación"
            className="focus-film grid size-11 place-items-center rounded-sm border border-border bg-paper-raised"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
        </header>

        <main
          id="contenido"
          className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10"
        >
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Cerrar navegación"
              className="absolute inset-0 bg-ink/45"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full w-[min(82vw,18rem)] border-r border-border bg-paper-raised shadow-lift"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar navegación"
                className="focus-film absolute right-3 top-3 grid size-10 place-items-center rounded-sm border border-border"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AdminFooterMark() {
  return (
    <p className="mt-12 flex items-center gap-2 border-t border-border pt-4 font-mono text-caption uppercase tracking-[0.14em] text-muted">
      <Aperture aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      Rollo · panel administrativo
    </p>
  );
}
