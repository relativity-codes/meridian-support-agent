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
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Initializing Meridian Support...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background">
      {/* Background Blobs */}
      <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />
      
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col items-center justify-center px-6 py-12 lg:px-8">
        <div className="animate-in flex w-full flex-col items-center text-center">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-2xl shadow-primary/20 ring-1 ring-border dark:bg-slate-900">
            <MeridianMark size="md" />
          </div>
          
          <div className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary ring-1 ring-inset ring-primary/20">
            Experimental Support Agent
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {MERIDIAN_COMPANY_NAME}
          </h1>
          
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            {MERIDIAN_TAGLINE}
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <div className="glass-card flex w-full max-w-lg flex-col gap-8 rounded-[2rem] p-8 sm:p-10">
              <div className="flex flex-col gap-6">
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-foreground">Get Started</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {MERIDIAN_AUTH_HINT}
                  </p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <SignIn />
                </div>
              </div>

              <div className="border-t border-border pt-6 text-left">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Key Capabilities</h3>
                <ul className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  {MERIDIAN_CAPABILITIES.map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                <span className="font-bold">Prototype Warning:</span> {MERIDIAN_PROTOTYPE_DISCLAIMER}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Meridian Electronics. Internal Use Only.
        </p>
      </footer>
    </main>
  );
}
