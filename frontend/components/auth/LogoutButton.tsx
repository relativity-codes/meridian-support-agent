"use client";

import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api/client";
import { useUserStore } from "@/lib/store/userStore";

export default function LogoutButton() {
  const router = useRouter();
  const logout = useUserStore((s) => s.logout);

  const onLogout = async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    logout();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
    >
      Sign out
    </button>
  );
}
