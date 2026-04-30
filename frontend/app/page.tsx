"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import SignIn from "@/components/auth/SignIn";
import MeridianMark from "@/components/meridian/MeridianMark";
import {
  MERIDIAN_AUTH_HINT,
  MERIDIAN_CAPABILITIES,
  MERIDIAN_COMPANY_NAME,
  MERIDIAN_PROTOTYPE_DISCLAIMER,
  MERIDIAN_TAGLINE,
} from "@/lib/meridian";
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
      <main className="flex min-h-[100dvh] items-center justify-center bg-meridian-page px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking session…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-meridian-page px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Opening support workspace…</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-meridian-page">
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-14 sm:py-20">
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/90 bg-white/90 p-8 shadow-xl shadow-slate-300/20 ring-1 ring-slate-200/50 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/85 dark:shadow-black/40 dark:ring-slate-800/60 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <MeridianMark size="md" className="shadow-lg shadow-meridian-600/25" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-meridian-700 dark:text-meridian-400">
                Customer support preview
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {MERIDIAN_COMPANY_NAME}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">{MERIDIAN_TAGLINE}</p>
              <ul className="mt-5 list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                {MERIDIAN_CAPABILITIES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <strong className="font-semibold">Prototype.</strong> {MERIDIAN_PROTOTYPE_DISCLAIMER}
          </div>

          <div className="border-t border-slate-200/80 pt-8 dark:border-slate-700/80">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Authorized access</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{MERIDIAN_AUTH_HINT}</p>
            <div className="mt-6 flex justify-center sm:justify-start">
              <SignIn />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
