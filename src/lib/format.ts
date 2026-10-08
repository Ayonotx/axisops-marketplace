export function formatPrice(price: number, currency = "GHS"): string {
  const symbol = currency === "GHS" ? "GH₵" : currency;
  const formatted = price.toLocaleString("en-GH", { maximumFractionDigits: 0 });
  return `${symbol} ${formatted}`;
}

export function timeAgo(dateStr: string): string {
  // SQLite datetime('now') is UTC
  const then = new Date(dateStr.replace(" ", "T") + "Z").getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

export const LISTING_TYPE_LABEL: Record<string, string> = {
  product: "Product",
  service: "Service",
  property: "Property",
  vehicle: "Vehicle",
  job: "Job",
};
