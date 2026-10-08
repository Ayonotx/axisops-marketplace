"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateListing } from "@/app/actions";

export default function AdminListingActions({
  listingId,
  status,
  featured,
}: {
  listingId: number;
  status: string;
  featured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (action: "approve" | "reject" | "feature" | "unfeature") =>
    startTransition(async () => {
      const res = await moderateListing(listingId, action);
      if (res.ok) router.refresh();
    });

  const btn =
    "rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      {status === "pending" && (
        <>
          <button onClick={() => act("approve")} disabled={pending} className={`${btn} bg-brand-500 text-white hover:bg-brand-600`}>
            ✓ Approve
          </button>
          <button onClick={() => act("reject")} disabled={pending} className={`${btn} border border-rose-300 text-rose-700 hover:bg-rose-50`}>
            ✕ Reject
          </button>
          <button onClick={() => act("feature")} disabled={pending} className={`${btn} bg-accent-500 text-navy-950 hover:bg-accent-600`}>
            ⭐ Approve &amp; Feature
          </button>
        </>
      )}
      {status === "active" && (
        featured ? (
          <button onClick={() => act("unfeature")} disabled={pending} className={`${btn} border border-sand-300 text-navy-800 hover:bg-sand-50`}>
            Remove featured
          </button>
        ) : (
          <button onClick={() => act("feature")} disabled={pending} className={`${btn} bg-accent-500 text-navy-950 hover:bg-accent-600`}>
            ⭐ Feature
          </button>
        )
      )}
    </div>
  );
}
