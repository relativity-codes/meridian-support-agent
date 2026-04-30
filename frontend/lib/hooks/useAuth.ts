"use client";

import { useCallback, useEffect } from "react";

import { apiFetch } from "@/lib/api/client";
import type { AuthUser } from "@/lib/store/userStore";
import { useUserStore } from "@/lib/store/userStore";

type AuthMeResponse = { user: AuthUser | null };

async function loadMe(): Promise<void> {
  const hadClientUser = useUserStore.getState().user != null;
  const { setUser, setLoading, setError, logout } = useUserStore.getState();
  setLoading(true);
  setError(null);
  try {
    const res = await apiFetch<AuthMeResponse>("/api/v1/auth/me");
    if (res.success) {
      if (res.data.user) {
        setUser(res.data.user);
      } else if (!hadClientUser) {
        // Server says no session and we were not optimistically logged in — stay logged out.
        logout();
      }
      // If we already have a user (e.g. just set from POST /auth/google) but /auth/me is null
      // because the cookie is not sent on cross-site fetches (127.0.0.1 page vs localhost API),
      // do not clear the store or the chat page will bounce back to "/".
    } else {
      setError(res.error);
      if (!hadClientUser) {
        logout();
      }
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to fetch user");
    if (!hadClientUser) {
      logout();
    }
  } finally {
    useUserStore.getState().setLoading(false);
  }
}

export function useAuth() {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  const error = useUserStore((s) => s.error);
  const logoutStore = useUserStore((s) => s.logout);

  useEffect(() => {
    void loadMe();
  }, []);

  const fetchUser = useCallback(() => {
    void loadMe();
  }, []);

  return { user, isLoading, error, fetchUser, logout: logoutStore };
}
