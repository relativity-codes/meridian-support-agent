"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";
import MeridianMark from "@/components/meridian/MeridianMark";
import { apiUrl } from "@/lib/apiBase";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  MERIDIAN_ASSISTANT_LABEL,
  MERIDIAN_CHAT_SUBTITLE,
  MERIDIAN_COMPOSER_HELPER,
  MERIDIAN_COMPOSER_PLACEHOLDER,
  MERIDIAN_EMPTY_STATE_BODY,
  MERIDIAN_EMPTY_STATE_HEADING,
  MERIDIAN_SAMPLE_PROMPTS,
  MERIDIAN_SCRATCHPAD_SUMMARY,
  MERIDIAN_SUPPORT_TITLE,
} from "@/lib/meridian";

type ScratchEntry = { role?: string; content?: string };

type ChatTurn = { id: string; role: "user" | "assistant"; content: string };

type ConversationSummary = { id: string; title: string | null; updated_at: string | null };

function convStorageKey(userId: string): string {
  return `meridian-support-agent:active-conversation:${userId}`;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [scratchpad, setScratchpad] = useState<ScratchEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/chat/conversations"), { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list as ConversationSummary[]);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (cid: string) => {
    setLoadingThread(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/chat/conversations/${cid}/messages`), {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setConversationId(null);
        setMessages([]);
        if (user?.id && typeof window !== "undefined") {
          try {
            localStorage.removeItem(convStorageKey(user.id));
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Failed to load messages");
        return;
      }
      const raw = Array.isArray(data.messages) ? data.messages : [];
      const next: ChatTurn[] = [];
      for (const m of raw) {
        if (!m || typeof m !== "object") continue;
        const id = typeof (m as { id?: string }).id === "string" ? (m as { id: string }).id : "";
        const role = (m as { role?: string }).role;
        const content = (m as { content?: string }).content;
        if (!id || (role !== "user" && role !== "assistant")) continue;
        if (typeof content !== "string") continue;
        next.push({ id, role, content });
      }
      setMessages(next);
    } catch {
      setError("Failed to load conversation.");
    } finally {
      setLoadingThread(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setConversationId(null);
      setMessages([]);
      setConversations([]);
      return;
    }
    void loadConversations();
    let stored: string | null = null;
    try {
      stored = typeof window !== "undefined" ? localStorage.getItem(convStorageKey(user.id)) : null;
    } catch {
      stored = null;
    }
    if (stored?.trim()) {
      setConversationId(stored.trim());
      void loadMessages(stored.trim());
    } else {
      setConversationId(null);
      setMessages([]);
    }
  }, [user?.id, loadConversations, loadMessages]);

  useEffect(() => {
    if (!user?.id || !conversationId || typeof window === "undefined") return;
    try {
      localStorage.setItem(convStorageKey(user.id), conversationId);
    } catch {
      /* ignore */
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const startNewChat = async () => {
    setError(null);
    setScratchpad(null);
    setMessages([]);
    if (user?.id && typeof window !== "undefined") {
      try {
        localStorage.removeItem(convStorageKey(user.id));
      } catch {
        /* ignore */
      }
    }
    try {
      const res = await fetch(apiUrl("/api/v1/chat/conversations"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Could not start a new conversation");
        setConversationId(null);
        return;
      }
      const cid = typeof data.conversation_id === "string" ? data.conversation_id : null;
      if (cid) {
        setConversationId(cid);
        if (user?.id && typeof window !== "undefined") {
          try {
            localStorage.setItem(convStorageKey(user.id), cid);
          } catch {
            /* ignore */
          }
        }
      }
      void loadConversations();
    } catch {
      setError("Could not start a new conversation.");
      setConversationId(null);
    }
  };

  const selectConversation = (cid: string) => {
    if (!cid || cid === conversationId) return;
    setConversationId(cid);
    void loadMessages(cid);
    setScratchpad(null);
    setError(null);
  };

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setScratchpad(null);
    try {
      const res = await fetch(apiUrl("/api/v1/chat/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || res.statusText));
        return;
      }
      const cid = typeof data.conversation_id === "string" ? data.conversation_id : null;
      if (cid) setConversationId(cid);
      setMessage("");
      setScratchpad(Array.isArray(data.scratchpad) ? data.scratchpad : null);
      if (cid) await loadMessages(cid);
      void loadConversations();
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-meridian-page px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-4 shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/30">
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-meridian-200 border-t-meridian-600 dark:border-meridian-900 dark:border-t-meridian-400"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {isLoading ? "Loading your workspace…" : "Redirecting…"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-meridian-page">
      <div className="mx-auto flex min-h-[100dvh] max-h-[100dvh] max-w-3xl flex-col px-3 py-4 sm:px-5 sm:py-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85 shadow-xl shadow-slate-300/25 ring-1 ring-slate-200/50 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/80 dark:shadow-black/40 dark:ring-slate-800/60">
          <header className="shrink-0 border-b border-slate-200/80 bg-gradient-to-r from-white to-slate-50/90 px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/95 sm:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <MeridianMark size="md" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                    {MERIDIAN_SUPPORT_TITLE}
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{MERIDIAN_CHAT_SUBTITLE}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex w-full flex-wrap items-center gap-2 sm:justify-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:max-w-[280px] sm:flex-initial">
                    <span className="sr-only sm:not-sr-only sm:inline">Thread</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 shadow-sm outline-none transition focus:border-meridian-300 focus:ring-2 focus:ring-meridian-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-meridian-600 dark:focus:ring-meridian-400/20"
                      value={conversationId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) void startNewChat();
                        else selectConversation(v);
                      }}
                      disabled={loading || loadingThread}
                    >
                      <option value="">+ New conversation…</option>
                      {conversationId && !conversations.some((c) => c.id === conversationId) && (
                        <option value={conversationId}>Current conversation</option>
                      )}
                      {conversations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.title || "Untitled").slice(0, 60)}
                          {c.title && c.title.length > 60 ? "…" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void startNewChat()}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-meridian-200 hover:bg-meridian-50/80 hover:text-meridian-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-meridian-500/40 dark:hover:bg-meridian-950/50 dark:hover:text-meridian-100"
                  >
                    New chat
                  </button>
                  <LogoutButton />
                  <Link
                    href="/"
                    className="inline-flex shrink-0 items-center rounded-xl px-3 py-2 text-sm font-medium text-meridian-600 transition hover:bg-meridian-50 dark:text-meridian-400 dark:hover:bg-meridian-950/50"
                    prefetch={false}
                  >
                    Home
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <section
            aria-label="Conversation"
            className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50/90 to-slate-100/50 px-4 py-5 dark:from-slate-950/50 dark:to-slate-950 sm:px-5"
          >
            {loadingThread && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <span
                  className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-meridian-600 dark:border-slate-700 dark:border-t-meridian-400"
                  aria-hidden
                />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading messages…</p>
              </div>
            )}
            {!loadingThread && messages.length === 0 && !loading && (
              <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-10 text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-meridian-100 dark:bg-meridian-950/80"
                  aria-hidden
                >
                  <MeridianMark size="md" className="shadow-lg shadow-meridian-600/20" />
                </div>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {MERIDIAN_EMPTY_STATE_HEADING}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {MERIDIAN_EMPTY_STATE_BODY}
                </p>
                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Try asking
                </p>
                <div className="mt-2 flex max-w-full flex-wrap justify-center gap-2">
                  {MERIDIAN_SAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={loading || loadingThread}
                      onClick={() => setMessage(p)}
                      className="max-w-[min(100%,20rem)] rounded-full border border-meridian-200/90 bg-white px-3 py-1.5 text-left text-xs font-medium leading-snug text-meridian-900 shadow-sm transition hover:border-meridian-300 hover:bg-meridian-50 disabled:opacity-50 dark:border-meridian-800 dark:bg-slate-900 dark:text-meridian-100 dark:hover:bg-meridian-950/50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mt-1 hidden shrink-0 sm:block" aria-hidden>
                    <MeridianMark size="sm" rounding="lg" />
                  </div>
                )}
                <div
                  className={`max-w-[min(100%,36rem)] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-meridian-600 to-meridian-700 text-white shadow-meridian-500/20 dark:from-meridian-500 dark:to-meridian-600"
                      : "rounded-bl-md border border-slate-200/90 bg-white text-slate-800 shadow-slate-200/40 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/20"
                  }`}
                >
                  <span
                    className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wider ${
                      m.role === "user" ? "text-meridian-100/90" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {m.role === "user" ? "You" : MERIDIAN_ASSISTANT_LABEL}
                  </span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {m.role === "user" && (
                  <span
                    className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300 sm:flex"
                    aria-hidden
                  >
                    You
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start gap-2">
                <div className="mt-1 flex shrink-0" aria-hidden>
                  <MeridianMark size="sm" rounding="lg" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  <span className="sr-only">{MERIDIAN_ASSISTANT_LABEL} is preparing a reply</span>
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-meridian-400/80 dark:bg-meridian-500/80" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-meridian-400/80 [animation-delay:160ms] dark:bg-meridian-500/80" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-meridian-400/80 [animation-delay:320ms] dark:bg-meridian-500/80" />
                  </span>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Thinking</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-px shrink-0" />
          </section>

          <footer className="shrink-0 border-t border-slate-200/80 bg-white/95 p-4 dark:border-slate-800 dark:bg-slate-900/95 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-[104px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-[15px] leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-meridian-300 focus:bg-white focus:ring-2 focus:ring-meridian-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-meridian-600 dark:focus:bg-slate-950 dark:focus:ring-meridian-400/15"
                  placeholder={MERIDIAN_COMPOSER_PLACEHOLDER}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={loading || loadingThread}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!loading && !loadingThread && message.trim()) void send();
                    }
                  }}
                  rows={3}
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{MERIDIAN_COMPOSER_HELPER}</p>
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || loadingThread || !message.trim()}
                className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-meridian-600 to-meridian-800 px-8 text-sm font-semibold text-white shadow-md shadow-meridian-500/25 transition hover:from-meridian-500 hover:to-meridian-700 hover:shadow-lg hover:shadow-meridian-500/30 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none sm:h-[104px] sm:self-stretch sm:px-6"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    Running
                  </span>
                ) : (
                  "Send"
                )}
              </button>
            </div>
            {error && (
              <p
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {error}
              </p>
            )}
          </footer>

          {scratchpad && scratchpad.length > 0 && (
            <details className="shrink-0 border-t border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/40 sm:px-5">
              <summary className="cursor-pointer select-none font-semibold text-slate-600 dark:text-slate-400">
                {MERIDIAN_SCRATCHPAD_SUMMARY}
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900/5 p-3 font-mono whitespace-pre-wrap text-slate-600 dark:bg-white/5 dark:text-slate-400">
                {JSON.stringify(scratchpad, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
