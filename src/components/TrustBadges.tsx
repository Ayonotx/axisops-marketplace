const BADGES: {
  key: string;
  show: boolean;
  label: string;
  title: string;
  cls: string;
}[] = [
  {
    key: "phone",
    show: true,
    label: "📱 Phone ✓",
    title: "Phone number verified by SMS code",
    cls: "bg-brand-100 text-brand-800",
  },
  {
    key: "id",
    show: false,
    label: "🪪 ID ✓",
    title: "Identity verified by the AxisOps team",
    cls: "bg-sky-100 text-sky-800",
  },
  {
    key: "business",
    show: false,
    label: "🏢 Business ✓",
    title: "Registered business verified by the AxisOps team",
    cls: "bg-violet-100 text-violet-800",
  },
];

export default function TrustBadges({
  idVerified,
  businessVerified,
  size = "sm",
}: {
  idVerified: boolean;
  businessVerified: boolean;
  size?: "sm" | "xs";
}) {
  const cls = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {BADGES.filter((b) => b.show || (b.key === "id" && idVerified) || (b.key === "business" && businessVerified)).map(
        (b) => (
          <span
            key={b.key}
            title={b.title}
            className={`inline-flex items-center gap-0.5 rounded-full font-bold ${b.cls} ${cls}`}
          >
            {b.label}
          </span>
        )
      )}
    </span>
  );
}
