import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { Car as CarIcon, AlertCircle, Wrench, CheckCircle2, Clock, Users as UsersIcon, ArrowRight } from "lucide-react";
import { VBStatusPill } from "../../components/VehicleStatus";
import { formatDate } from "../../utils/dates";

function Metric({ label, value, accent, icon: Icon, testid }) {
  return (
    <div
      className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
      style={{ borderLeft: `4px solid ${accent}` }}
      data-testid={testid}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">{value}</div>
        </div>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
    </div>
  );
}

export default function AdminCarsDashboard() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: p }] = await Promise.all([
          api.get("/vehicle-admin/stats"),
          api.get("/vehicle-bookings", { params: { status: "pending" } }),
        ]);
        setStats(s);
        setPending(p.slice(0, 6));
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, []);

  return (
    <div data-testid="admin-cars-dashboard">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Fleet Control Room
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Car Booking Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Monitor your fleet, approve bookings, and manage handover/return.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Metric label="Vehicles" value={stats?.total_vehicles ?? "—"} accent="#0055FF" icon={CarIcon} testid="va-total" />
        <Metric label="Available" value={stats?.available_vehicles ?? "—"} accent="#10B981" icon={CheckCircle2} testid="va-available" />
        <Metric label="In Use" value={stats?.in_use_vehicles ?? "—"} accent="#0EA5E9" icon={Clock} testid="va-inuse" />
        <Metric label="Maintenance" value={stats?.maintenance_vehicles ?? "—"} accent="#F59E0B" icon={Wrench} testid="va-maintenance" />
        <Metric label="Pending" value={stats?.pending_bookings ?? "—"} accent="#EF4444" icon={AlertCircle} testid="va-pending" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Approved" value={stats?.approved_bookings ?? "—"} accent="#8B5CF6" icon={CheckCircle2} testid="va-approved" />
        <Metric label="Booked" value={stats?.booked_vehicles ?? "—"} accent="#A855F7" icon={CarIcon} testid="va-booked" />
        <Metric label="Active Trips" value={stats?.in_use_bookings ?? "—"} accent="#10B981" icon={Clock} testid="va-trips" />
        <Metric label="Drivers" value={stats?.total_drivers ?? "—"} accent="#6366F1" icon={UsersIcon} testid="va-drivers" />
      </div>

      <div className="mt-10 mb-3 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Approval Queue</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Pending booking requests</h2>
        </div>
        <Link to="/admin/cars/bookings" className="text-sm font-semibold text-[#0055FF] hover:underline">
          View all <ArrowRight className="inline h-3 w-3" />
        </Link>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No pending requests. Everything's caught up.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Employee</th>
                <th className="px-6 py-3 text-left">Purpose</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Dates</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((b) => (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`acd-pending-${b.id}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{b.employee_name}</div>
                    <div className="text-xs text-slate-500">{b.job_title}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{b.purpose}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {b.booking_type === "single_trip" ? "Single trip" : "Multi-day"}
                    {b.with_driver ? " · w/ driver" : " · self"}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {formatDate(b.start_date)}
                    {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`}
                  </td>
                  <td className="px-6 py-4"><VBStatusPill status={b.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/admin/cars/bookings/${b.id}`} className="text-sm font-semibold text-[#0055FF] hover:underline">
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
