// Status helpers for vehicle bookings
export const VB_STATUS_LABELS = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  assigned: "Vehicle Assigned",
  in_use: "In Use",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const VB_STATUS_COLORS = {
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  approved: { bg: "bg-sky-100", text: "text-sky-700" },
  rejected: { bg: "bg-red-100", text: "text-red-700" },
  assigned: { bg: "bg-violet-100", text: "text-violet-700" },
  in_use: { bg: "bg-emerald-100", text: "text-emerald-700" },
  completed: { bg: "bg-blue-100", text: "text-blue-700" },
  cancelled: { bg: "bg-slate-100", text: "text-slate-600" },
};

export function VBStatusPill({ status }) {
  const c = VB_STATUS_COLORS[status] || { bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span
      className={`status-pill ${c.bg} ${c.text}`}
      data-testid={`vb-status-${status}`}
    >
      {VB_STATUS_LABELS[status] || status}
    </span>
  );
}

export const VEHICLE_STATUS_LABELS = {
  available: "Available",
  booked: "Booked",
  in_use: "In Use",
  maintenance: "Maintenance",
  retired: "Retired",
};

export const VEHICLE_STATUS_COLORS = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  booked: "bg-violet-50 text-violet-700 border-violet-200",
  in_use: "bg-sky-50 text-sky-700 border-sky-200",
  maintenance: "bg-amber-50 text-amber-700 border-amber-200",
  retired: "bg-slate-100 text-slate-500 border-slate-200",
};

export function VehicleStatusTag({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${VEHICLE_STATUS_COLORS[status] || ""}`}
      data-testid={`vehicle-status-${status}`}
    >
      {VEHICLE_STATUS_LABELS[status] || status}
    </span>
  );
}

export const FUEL_LEVELS = ["Full", "3/4", "1/2", "1/4", "Empty"];
