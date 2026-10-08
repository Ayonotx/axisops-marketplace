"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { ok: boolean; devCode?: string; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not send code.");
        return;
      }
      setDevCode(data.devCode ?? null);
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-sand-200 bg-white px-4 py-3 text-base tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-md sm:p-8">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-2xl text-white shadow">
            🔐
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-navy-900">
            {step === "phone" ? "Sign in to AxisOps" : "Enter your code"}
          </h1>
          <p className="mt-1 text-sm text-navy-800/70">
            {step === "phone"
              ? "One account for buying, selling and chatting. We verify by phone (OTP)."
              : `We sent a 6-digit code to ${phone}.`}
          </p>
        </div>

        {step === "phone" ? (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
          >
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={input}
              required
            />
            {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={busy || phone.trim().length < 9}
              className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white hover:bg-brand-600 transition disabled:opacity-60"
            >
              {busy ? "Sending…" : "Continue"}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            {devCode && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-center text-sm text-sky-900">
                <span className="font-semibold">Demo mode —</span> your code is{" "}
                <span className="font-mono text-lg font-extrabold tracking-[0.3em]">{devCode}</span>
              </div>
            )}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${input} text-center font-mono text-2xl font-extrabold tracking-[0.5em]`}
              required
            />
            {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white hover:bg-brand-600 transition disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setDevCode(null);
              }}
              className="w-full text-center text-sm font-semibold text-navy-800/70 hover:text-navy-900"
            >
              ← Use a different number
            </button>
          </form>
        )}

        <p className="mt-6 border-t border-sand-100 pt-4 text-center text-[11px] leading-relaxed text-navy-800/60">
          New here? Signing in with a phone number automatically creates your account — no password
          to forget. By continuing you agree to keep deals inside AxisOps.
        </p>
      </div>
    </div>
  );
}
