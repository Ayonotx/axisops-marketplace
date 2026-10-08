import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, getSessionUser } from "@/lib/auth";
import { getSmsLogs, smsLive } from "@/lib/sms";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "SMS Log — AxisOps Admin" };

export default async function AdminSmsPage() {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") redirect("/admin");

  const logs = getSmsLogs(80);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/admin" className="text-sm font-semibold text-brand-700 hover:underline">← Admin console</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">📨 SMS Delivery Log</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
          smsLive() ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
        }`}>
          {smsLive() ? "LIVE — Arkesel connected" : "DEMO — codes shown on screen"}
        </span>
      </div>
      <p className="text-sm text-navy-800/70">
        Every OTP send attempt, live or demo, is logged here. Failed Arkesel sends show the provider error for diagnosis.
      </p>

      {logs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm text-navy-800/70">No SMS activity yet.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                l.status === "sent" ? "bg-emerald-100 text-emerald-800" :
                l.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
              }`}>{l.status}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy-900">{l.phone} <span className="font-normal text-navy-800/50">· {l.provider}</span></p>
                <p className="truncate text-xs text-navy-800/70">{l.message}</p>
                {l.error && <p className="mt-0.5 text-xs font-semibold text-red-700">⚠ {l.error}</p>}
              </div>
              <span className="shrink-0 text-xs text-navy-800/50">{timeAgo(l.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
