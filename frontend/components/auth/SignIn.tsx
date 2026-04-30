"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiUrl } from "@/lib/apiBase";
import type { AuthUser } from "@/lib/store/userStore";
import { useUserStore } from "@/lib/store/userStore";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function SignIn() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError("No credential from Google.");
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/v1/auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_token: idToken }),
      });
      if (res.ok) {
        const u = (await res.json()) as AuthUser;
        setUser(u);
        router.replace("/chat/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === "string" ? data.detail : "Login failed.");
    } catch {
      setError("Network error during login.");
    }
  };

  if (!clientId) {
    return (
      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{" "}
        <code className="font-mono">.env.local</code> (same Web client as backend{" "}
        <code className="font-mono">GOOGLE_CLIENT_ID</code>).
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <GoogleLogin onSuccess={handleSuccess} onError={() => setError("Google sign-in failed.")} useOneTap />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
