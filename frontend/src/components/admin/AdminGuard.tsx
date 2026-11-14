import { LoaderCircle } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/common/BrandMark";
import { useAdminAuth } from "@/context/AdminAuthContext";

export function AdminGuard() {
  const { status } = useAdminAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark />
          <p className="flex items-center gap-2 text-body-sm text-brown" role="status">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Restaurando la sesión…
          </p>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
