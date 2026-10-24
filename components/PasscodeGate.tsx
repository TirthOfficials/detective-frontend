"use client";
import { useState } from "react";
import { storage } from "@/lib/client/storage";

export default function PasscodeGate({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/status", { headers: { "x-passcode": code } }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      storage.set("mm:passcode", code);
      onOk();
    } else setErr(res?.status === 401 ? "That's not the word, detective." : "Couldn't reach the precinct. Try again.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        className="panel w-full max-w-sm space-y-4 rounded-sm p-6 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="font-display text-3xl text-gold">What&apos;s the password?</h1>
        <p className="text-sm text-cream-dim">This speakeasy is members only. Ask the people who sent you.</p>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-sm border border-gold/30 bg-ink-2 px-3 py-2 text-center text-cream focus:border-gold focus:outline-none"
          aria-label="Passcode"
        />
        {err && <p className="font-type text-sm text-blood-bright">{err}</p>}
        <button className="btn btn-blood w-full" disabled={busy || !code}>
          {busy ? "Checking…" : "Knock twice"}
        </button>
      </form>
    </div>
  );
}
