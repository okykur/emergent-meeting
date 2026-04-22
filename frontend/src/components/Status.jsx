export function StatusPill({ status }) {
  const map = {
    pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-100" },
    confirmed: { label: "Confirmed", color: "text-emerald-700", bg: "bg-emerald-100" },
    cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-100" },
    completed: { label: "Completed", color: "text-blue-700", bg: "bg-blue-100" },
  };
  const s = map[status] || { label: status, color: "text-slate-700", bg: "bg-slate-100" };
  return (
    <span
      className={`status-pill ${s.bg} ${s.color}`}
      data-testid={`status-pill-${status}`}
    >
      {s.label}
    </span>
  );
}

export function ActiveTag({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Non-active
    </span>
  );
}

export const STATUSES = ["pending", "confirmed", "cancelled", "completed"];
