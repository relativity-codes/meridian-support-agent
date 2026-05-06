"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  LogOut, 
  Home, 
  MessageSquare, 
  Send, 
  Brain, 
  Menu, 
  X, 
  ChevronRight,
  Clock,
  Sparkles,
  User,
  Bot
} from "lucide-react";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  
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
    setMessage("");
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

  const send = async (overrideText?: string) => {
    const text = overrideText || message.trim();
    if (!text) return;
    
    setLoading(true);
    setError(null);
    setScratchpad(null);
    if (!overrideText) setMessage("");

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
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Resuming your session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-80" : "w-0"
        } relative flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out lg:static`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6">
            <Link href="/" className="flex items-center gap-3">
              <MeridianMark size="sm" />
              <span className="text-lg font-bold tracking-tight">Meridian</span>
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-1.5 hover:bg-muted lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={() => void startNewChat()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={18} />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 chat-scroll">
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                    conversationId === c.id 
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <MessageSquare size={18} className={conversationId === c.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">
                      {c.title || "New Chat"}
                    </p>
                    {c.updated_at && (
                      <p className="truncate text-[10px] opacity-60">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <User size={20} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">Support Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LogoutButton />
              <Link
                href="/"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                <Home size={16} />
                Portal
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <Menu size={20} />
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold leading-none sm:text-xl">{MERIDIAN_SUPPORT_TITLE}</h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{MERIDIAN_CHAT_SUBTITLE}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {scratchpad && (
              <button
                onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  isReasoningOpen 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Brain size={14} />
                {isReasoningOpen ? "Hide Reasoning" : "View Reasoning"}
              </button>
            )}
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-foreground sm:flex">
              <Sparkles size={12} />
              AI Active
            </div>
          </div>
        </header>

        {/* Message Area */}
        <div className="chat-scroll flex-1 overflow-y-auto bg-background/50 p-6 lg:p-8">
          <div className="mx-auto max-w-4xl space-y-8">
            {loadingThread && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading workspace...</p>
              </div>
            )}

            {!loadingThread && messages.length === 0 && !loading && (
              <div className="animate-in flex flex-col items-center py-20 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xl shadow-primary/5">
                  <Sparkles size={40} />
                </div>
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {MERIDIAN_EMPTY_STATE_HEADING}
                </h2>
                <p className="mt-3 max-w-md text-base text-muted-foreground">
                  {MERIDIAN_EMPTY_STATE_BODY}
                </p>
                
                <div className="mt-12 w-full max-w-2xl">
                  <p className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">Suggested Queries</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {MERIDIAN_SAMPLE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => void send(p)}
                        className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5"
                      >
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">{p}</span>
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`animate-in flex items-start gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                  m.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {m.role === "assistant" ? <Bot size={20} /> : <User size={20} />}
                </div>
                <div className={`group relative flex max-w-[85%] flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm ring-1 ${
                    m.role === "user"
                      ? "rounded-tr-none bg-primary text-primary-foreground ring-primary/20"
                      : "rounded-tl-none bg-card ring-border"
                  }`}>
                    {m.content}
                  </div>
                  <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                    <Clock size={10} />
                    Just now
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="animate-in flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Bot size={20} />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 rounded-2xl rounded-tl-none bg-card px-6 py-4 ring-1 ring-border shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary animate-pulse">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-px shrink-0" />
          </div>
        </div>

        {/* Reasoning Sidebar (Overlaid) */}
        {isReasoningOpen && scratchpad && (
          <div className="animate-in absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[400px]">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Brain size={18} />
                </div>
                <h3 className="font-bold">Agent Reasoning</h3>
              </div>
              <button 
                onClick={() => setIsReasoningOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 chat-scroll">
              <div className="space-y-6">
                {scratchpad.map((entry, idx) => (
                  <div key={idx} className="relative pl-6 pb-6 last:pb-0">
                    {idx < scratchpad.length - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                    )}
                    <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                      entry.role === "thought" ? "bg-amber-400" : entry.role === "observation" ? "bg-primary" : "bg-muted-foreground"
                    }`} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {entry.role || "Step"}
                      </p>
                      <div className="mt-2 rounded-xl bg-muted/50 p-4 text-xs leading-relaxed">
                        {entry.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Composer Area */}
        <footer className="shrink-0 border-t border-border bg-card/80 p-6 backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            {error && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <X size={16} className="shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div className="relative flex items-end gap-3 rounded-[1.5rem] bg-muted/50 p-2 ring-1 ring-border focus-within:bg-card focus-within:ring-primary/50 focus-within:shadow-2xl focus-within:shadow-primary/5 transition-all">
              <textarea
                className="max-h-60 flex-1 bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
                placeholder={MERIDIAN_COMPOSER_PLACEHOLDER}
                rows={1}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading && !loadingThread && message.trim()) void send();
                  }
                }}
                disabled={loading || loadingThread}
              />
              <button
                onClick={() => void send()}
                disabled={loading || loadingThread || !message.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
            <p className="mt-3 px-4 text-center text-[11px] text-muted-foreground">
              {MERIDIAN_COMPOSER_HELPER}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
