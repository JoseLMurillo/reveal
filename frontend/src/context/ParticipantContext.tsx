/* eslint-disable react-refresh/only-export-components */
import type { ParticipantMe } from "@rollo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "@/services/api";
import { publicApi } from "@/services/public";

export type StoredParticipantSession = {
  sessionToken: string;
  accessCode: string | null;
};

type ParticipantContextValue = {
  slug: string;
  sessionToken: string | null;
  accessCode: string | null;
  me: ParticipantMe | null;
  isLoading: boolean;
  isRenewing: boolean;
  error: unknown;
  renewError: unknown;
  saveSession: (sessionToken: string, accessCode: string | null) => void;
  clearSession: () => void;
  refetch: () => void;
};

const ParticipantContext = createContext<ParticipantContextValue | null>(null);

export function participantStorageKey(slug: string): string {
  return `rollo:participant:${slug}`;
}

function readStoredSession(slug: string): StoredParticipantSession | null {
  if (typeof window === "undefined" || slug.length === 0) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(participantStorageKey(slug));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredParticipantSession> | null;

    if (!parsed || typeof parsed.sessionToken !== "string" || parsed.sessionToken.length < 32) {
      return null;
    }

    return {
      sessionToken: parsed.sessionToken,
      accessCode: typeof parsed.accessCode === "string" ? parsed.accessCode : null,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(slug: string, session: StoredParticipantSession | null): void {
  if (typeof window === "undefined" || slug.length === 0) {
    return;
  }

  if (session === null) {
    window.localStorage.removeItem(participantStorageKey(slug));
    return;
  }

  window.localStorage.setItem(participantStorageKey(slug), JSON.stringify(session));
}

export function ParticipantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [stored, setStored] = useState<StoredParticipantSession | null>(() =>
    readStoredSession(slug),
  );
  const [renewError, setRenewError] = useState<unknown>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const attemptedToken = useRef<string | null>(null);

  const saveSession = useCallback(
    (sessionToken: string, accessCode: string | null) => {
      const next = { sessionToken, accessCode };
      writeStoredSession(slug, next);
      setStored(next);
      setRenewError(null);
      attemptedToken.current = null;
    },
    [slug],
  );

  const clearSession = useCallback(() => {
    writeStoredSession(slug, null);
    setStored(null);
    setRenewError(null);
    attemptedToken.current = null;
    queryClient.removeQueries({ queryKey: ["participant", slug] });
  }, [queryClient, slug]);

  // Si cambia el slug (por ejemplo al abrir otro enlace en la misma pestaña),
  // la sesión guardada debe ser la del nuevo evento.
  useEffect(() => {
    setStored(readStoredSession(slug));
    setRenewError(null);
    attemptedToken.current = null;
  }, [slug]);

  const meQuery = useQuery({
    queryKey: ["participant", slug, stored?.sessionToken ?? "anonymous"],
    queryFn: () => publicApi.me(stored?.sessionToken ?? ""),
    enabled: Boolean(stored?.sessionToken),
    retry: false,
    staleTime: 15_000,
  });

  const meError = meQuery.error;
  const meData = meQuery.data;
  const meIsPending = meQuery.isPending;
  const meRefetch = meQuery.refetch;

  useEffect(() => {
    if (!(meError instanceof ApiError) || meError.code !== "PARTICIPANT_SESSION_EXPIRED") {
      return;
    }

    if (!stored?.sessionToken) {
      return;
    }

    if (!stored.accessCode) {
      clearSession();
      return;
    }

    if (attemptedToken.current === stored.sessionToken) {
      return;
    }

    attemptedToken.current = stored.sessionToken;
    let active = true;
    setIsRenewing(true);

    publicApi
      .redeem(slug, { accessCode: stored.accessCode })
      .then((result) => {
        if (!active) {
          return;
        }

        saveSession(result.session.token, stored.accessCode);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setRenewError(error);

        if (error instanceof ApiError && error.code === "ACCESS_CODE_INVALID") {
          clearSession();
          setRenewError(error);
        }
      })
      .finally(() => {
        if (active) {
          setIsRenewing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clearSession, meError, saveSession, slug, stored?.accessCode, stored?.sessionToken]);

  const value = useMemo<ParticipantContextValue>(
    () => ({
      slug,
      sessionToken: stored?.sessionToken ?? null,
      accessCode: stored?.accessCode ?? null,
      me: meData ?? null,
      isLoading: Boolean(stored?.sessionToken) && (meIsPending || isRenewing),
      isRenewing,
      error: meError,
      renewError,
      saveSession,
      clearSession,
      refetch: () => {
        void meRefetch();
      },
    }),
    [
      slug,
      stored?.sessionToken,
      stored?.accessCode,
      meData,
      meIsPending,
      meError,
      meRefetch,
      isRenewing,
      renewError,
      saveSession,
      clearSession,
    ],
  );

  return <ParticipantContext.Provider value={value}>{children}</ParticipantContext.Provider>;
}

export function useParticipant(): ParticipantContextValue {
  const context = useContext(ParticipantContext);

  if (!context) {
    throw new Error("useParticipant debe usarse dentro de ParticipantProvider.");
  }

  return context;
}
