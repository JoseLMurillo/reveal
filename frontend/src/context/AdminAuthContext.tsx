/* eslint-disable react-refresh/only-export-components */
import type { AdminMeResponse, LoginInput } from "@rollo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { ApiError } from "@/services/api";
import { adminApi } from "@/services/admin";

const ME_QUERY_KEY = ["admin", "me"] as const;

export type AdminAuthStatus = "loading" | "authenticated" | "anonymous";

type AdminAuthContextValue = {
  status: AdminAuthStatus;
  admin: AdminMeResponse["admin"] | null;
  session: AdminMeResponse["session"] | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [signedOut, setSignedOut] = useState(false);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: adminApi.me,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: !signedOut,
  });

  const loginMutation = useMutation({
    mutationFn: adminApi.login,
    onSuccess(data) {
      setSignedOut(false);
      queryClient.setQueryData<AdminMeResponse>(ME_QUERY_KEY, {
        admin: { ...data.admin, isActive: true },
        session: data.session,
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: adminApi.logout,
    onSettled() {
      queryClient.setQueryData(ME_QUERY_KEY, null);
      setSignedOut(true);
    },
  });

  const value = useMemo<AdminAuthContextValue>(() => {
    const isUnauthorized =
      meQuery.error instanceof ApiError &&
      (meQuery.error.status === 401 || meQuery.error.code === "ADMIN_DISABLED");

    const admin = signedOut || isUnauthorized ? null : (meQuery.data?.admin ?? null);
    const session = signedOut || isUnauthorized ? null : (meQuery.data?.session ?? null);

    let status: AdminAuthStatus;
    if (admin) {
      status = "authenticated";
    } else if (!signedOut && meQuery.isLoading) {
      status = "loading";
    } else {
      status = "anonymous";
    }

    return {
      status,
      admin,
      session,
      async login(input) {
        await loginMutation.mutateAsync(input);
      },
      async logout() {
        await logoutMutation.mutateAsync();
      },
      async refresh() {
        const result = await meQuery.refetch();
        if (result.data) {
          setSignedOut(false);
        }
      },
    };
  }, [loginMutation, logoutMutation, meQuery, signedOut]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider.");
  }

  return context;
}
