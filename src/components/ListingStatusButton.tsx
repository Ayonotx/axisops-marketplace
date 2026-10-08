"use client";

import { useTransition } from "react";
import { setListingStatus } from "@/app/actions";

export default function ListingStatusButton({
  listingId,
  status,
}: {
  listingId: number;
  status: "active" | "sold" | "reserved" | "pending" | "expired";
}) {
  const [pending, startTransition] = useTransition();

  if (status === "sold") {
    return (
      <button
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void setListingStatus(listingId, "active");
          })
        }
        className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-sand-100 disabled:opacity-50"
      >
        Relist
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void setListingStatus(listingId, "sold");
        })
      }
      className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
    >
      {pending ? "…" : "Mark sold"}
    </button>
  );
}
