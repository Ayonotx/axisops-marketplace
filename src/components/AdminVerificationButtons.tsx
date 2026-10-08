"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminVerificationButtons({
  userId,
  idVerified,
  businessVerified,
}: {
  userId: number;
  idVerified: boolean;
  businessVerified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(tier: "id" | "business") {
    setBusy(tier);
    const value = tier === "id" ? !idVerified : !businessVerified;
    await fetch("/api/admin/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tier, value }),
    });
    setBusy(null);
    router.refresh();
  }

  const btn = "rounded-md px-2 py-1 text-[11px] font-bold transition disabled:opacity-50";
  return (
    <span className="flex gap-1.5">
      <button
        disabled={busy !== null}
        onClick={() => toggle("id")}
        title="Identity verification tier"
        className={`${btn} ${idVerified ? "bg-sky-600 text-white" : "border border-sky-300 bg-white text-sky-700 hover:bg-sky-50"}`}
      >
        🪪 ID {idVerified ? "✓ revoke" : "grant"}
      </button>
      <button
        disabled={busy !== null}
        onClick={() => toggle("business")}
        title="Business verification tier"
        className={`${btn} ${businessVerified ? "bg-violet-600 text-white" : "border border-violet-300 bg-white text-violet-700 hover:bg-violet-50"}`}
      >
        🏢 Business {businessVerified ? "✓ revoke" : "grant"}
      </button>
    </span>
  );
}
