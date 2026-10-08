export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-sand-200 bg-white shadow-sm" aria-hidden>
      <div className="skeleton-shimmer h-36 w-full" />
      <div className="space-y-2 p-3">
        <div className="skeleton-shimmer h-3 w-3/4 rounded" />
        <div className="skeleton-shimmer h-3 w-1/2 rounded" />
        <div className="skeleton-shimmer h-4 w-1/3 rounded" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {[70, 50, 80, 45].map((w, i) => (
        <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
          <div className="skeleton-shimmer h-8 rounded-xl" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
