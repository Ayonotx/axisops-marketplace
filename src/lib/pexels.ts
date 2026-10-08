// Server-side stock imagery via the Pexels API (PEXELS_API_KEY in .env.local).
// One search per category is cached in-process and shared across listings, so a
// cold page render costs at most one API call per category. Callers persist the
// chosen URL on the listing row, so steady-state renders are pure DB reads.
const POOL_SIZE = 8;

const CATEGORY_QUERY: Record<string, string> = {
  electronics: "smartphone product photography",
  vehicles: "used car for sale",
  property: "modern house exterior",
  fashion: "fashion clothing rack",
  home: "modern living room furniture",
  agriculture: "fresh farm produce market",
  food: "catering food platter",
  services: "professional tradesperson working",
  jobs: "modern office team working",
  beauty: "beauty salon interior",
  education: "students classroom learning",
};

type Pool = Promise<string[]>;
const pools = new Map<string, Pool>();

function searchPool(query: string): Pool {
  const key = query;
  const inflight = pools.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    const key2 = process.env.PEXELS_API_KEY;
    if (!key2) return [];
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${POOL_SIZE}&orientation=landscape`,
      { headers: { Authorization: key2 }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { photos?: { src?: { large?: string } }[] };
    return (json.photos ?? []).map((p) => p.src?.large).filter((u): u is string => !!u);
  })().catch(() => [] as string[]);

  pools.set(key, p);
  return p;
}

/** Deterministic pick from the category pool so listings vary but stay stable. */
export async function listingImage(category: string, seed: number): Promise<string | null> {
  const pool = await searchPool(CATEGORY_QUERY[category] ?? "marketplace products");
  if (pool.length === 0) return null;
  return pool[Math.abs(seed) % pool.length];
}

/** First image of a category pool — for category tiles and the hero collage. */
export async function categoryImage(category: string): Promise<string | null> {
  const pool = await searchPool(CATEGORY_QUERY[category] ?? "marketplace products");
  return pool[0] ?? null;
}

/** Hand-picked hero collage queries — richer than the category defaults. */
export async function heroImages(): Promise<string[]> {
  const queries = ["accra market vendor", "smartphone in hand", "modern apartment interior", "car dealership"];
  const pools = await Promise.all(queries.map(searchPool));
  return pools.map((p) => p[0]).filter((u): u is string => !!u);
}
