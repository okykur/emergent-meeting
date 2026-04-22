import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { Link } from "react-router-dom";
import {
  CalendarCheck2,
  DoorOpen,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { StatusPill } from "../../components/Status";
import { formatDate } from "../../utils/dates";

function Metric({ icon: Icon, label, value, accent = "#0055FF", testid }) {
  return (
    <div
      className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
      style={{ borderLeft: `4px solid ${accent}` }}
      data-testid={testid}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: p }] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/bookings", { params: { status: "pending" } }),
        ]);
        setStats(s);
        setPending(p.slice(0, 6));
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, []);

  return (
    <div data-testid="admin-dashboard">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Admin Control Room
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Monitor bookings, manage rooms, and keep your workplace running.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric icon={DoorOpen} label="Total Rooms" value={stats?.total_rooms ?? "—"} accent="#0055FF" testid="stat-total-rooms" />
        <Metric icon={CheckCircle2} label="Active Rooms" value={stats?.active_rooms ?? "—"} accent="#10B981" testid="stat-active-rooms" />
        <Metric icon={AlertCircle} label="Pending" value={stats?.pending_bookings ?? "—"} accent="#F59E0B" testid="stat-pending" />
        <Metric icon={CalendarCheck2} label="Confirmed" value={stats?.confirmed_bookings ?? "—"} accent="#3B82F6" testid="stat-confirmed" />
        <Metric icon={Clock} label="Today" value={stats?.today_bookings ?? "—"} accent="#0F172A" testid="stat-today" />
        <Metric icon={Users} label="Users" value={stats?.total_users ?? "—"} accent="#6366F1" testid="stat-users" />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Approval Queue
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              Pending booking requests
            </h2>
          </div>
          <Link
            to="/admin/bookings"
            className="text-sm font-semibold text-[#0055FF] hover:underline"
            data-testid="view-all-bookings-link"
          >
            View all →
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
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Room</th>
                  <th className="px-6 py-3 text-left">Title</th>
                  <th className="px-6 py-3 text-left">When</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                    data-testid={`pending-row-${b.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{b.user_name}</div>
                      <div className="text-xs text-slate-500">{b.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{b.room_name}</td>
                    <td className="px-6 py-4 text-slate-700">{b.title}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {formatDate(b.date)} · {b.start_time}–{b.end_time}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
