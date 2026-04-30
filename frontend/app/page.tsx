"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import SignIn from "@/components/auth/SignIn";
import { useAuth } from "@/lib/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/chat/");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-16">
        <p className="text-sm text-slate-500">Checking session…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-16">
        <p className="text-sm text-slate-500">Redirecting to chat…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          meridian-support-agent — Google sign-in to open the chat.
        </p>
      </div>
      <SignIn />
    </main>
  );
}
