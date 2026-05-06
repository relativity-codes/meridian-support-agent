"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

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
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
