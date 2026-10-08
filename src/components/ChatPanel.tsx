"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatSkeleton } from "@/components/Skeletons";

type Msg = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  body: string;
  created_at: string;
  from_name: string;
};

export default function ChatPanel({
  listingId,
  meId,
  sellerName,
  isOwner,
}: {
  listingId: number;
  meId: number | null; // null = signed out (demo fallback user id used server-side)
  sellerName: string;
  isOwner: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await fetch(`/api/messages?listingId=${listingId}`, { cache: "no-store" });
    if (res.status === 401) {
      setSignedOut(true);
      return;
    }
    const data = (await res.json()) as { ok: boolean; messages?: Msg[] };
    if (data.ok) {
      setMessages(data.messages ?? []);
      setSignedOut(false);
      setFirstLoad(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Async fetch resolves after the effect body — setState happens in a
    // callback, not synchronously during the effect.
    const t = setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    timer.current = setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, body: text }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setError(data.error ?? "Message failed to send.");
      setDraft(text);
      return;
    }
    setError("");
    void load();
  };

  return (
    <div className="rounded-xl border border-sand-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-navy-900">
          💬 {isOwner ? `Buyer chat (${messages.length})` : `Chat with ${sellerName}`}
          {messages.some((m) => m.to_user_id === meId) && (
            <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              New
            </span>
          )}
        </span>
        <span className="text-xs font-semibold text-brand-600">{open ? "Hide" : "Open"}</span>
      </button>

      {open && (
        <div className="border-t border-sand-100">
          {signedOut ? (
            <div className="p-4 text-center text-sm text-navy-800/80">
              <p className="mb-3">Sign in with your phone to start chatting.</p>
              <Link
                href="/signin"
                className="inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="h-64 space-y-2 overflow-y-auto px-4 py-3">
                {firstLoad && <ChatSkeleton />}
                {!firstLoad && messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-navy-800/60">
                    {isOwner
                      ? "Buyers' messages about this listing appear here."
                      : `Say hello to ${sellerName} — ask about condition, price or pickup.`}
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.from_user_id === meId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "rounded-br-sm bg-brand-500 text-white"
                            : "rounded-bl-sm bg-sand-100 text-navy-900"
                        }`}
                      >
                        {!mine && !isOwner && (
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">
                            {m.from_name}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-navy-800/50"}`}>
                          {new Date(m.created_at.replace(" ", "T") + "Z").toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-sand-100 p-3">
                {error && <p className="mb-2 text-xs font-semibold text-rose-700">{error}</p>}
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={isOwner ? "Reply to buyer…" : "Type a message…"}
                    className="min-w-0 flex-1 rounded-full border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!draft.trim()}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 transition disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
