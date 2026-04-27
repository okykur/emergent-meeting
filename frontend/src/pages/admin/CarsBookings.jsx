import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { VBStatusPill } from "../../components/VehicleStatus";
import { formatDate } from "../../utils/dates";
import { Search } from "lucide-react";

export default function AdminCarsBookings() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [userQ, setUserQ] = useState("");
  const [date, setDate] = useState("");

  const load = async () => {
    try {
      const params = {};
      if (status) params.status = status;
      if (userQ) params.user_query = userQ;
      if (date) params.date = date;
      const { data } = await api.get("/vehicle-bookings", { params });
      setItems(data);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, date]);

  return (
    <div data-testid="admin-cars-bookings-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Booking Approval & Monitoring
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Vehicle Bookings
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="acb-search"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by employee name, email, or job title…"
            className="w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF]"
          />
        </div>
        <select
          data-testid="acb-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All statuses</option>
          {["pending", "approved", "assigned", "in_use", "completed", "cancelled", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <input
          type="date"
          data-testid="acb-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        />
      </div>

      {error && <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3 text-left">Employee</th>
              <th className="px-6 py-3 text-left">Purpose</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Dates</th>
              <th className="px-6 py-3 text-left">Vehicle</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No bookings match the filters.
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`acb-row-${b.id}`}>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{b.employee_name}</div>
                  <div className="text-xs text-slate-500">{b.job_title}{b.department ? ` · ${b.department}` : ""}</div>
                </td>
                <td className="px-6 py-4 text-slate-700">{b.purpose}</td>
                <td className="px-6 py-4 text-slate-700">
                  {b.booking_type === "single_trip" ? "Single" : "Multi-day"}
                  {b.with_driver ? " · w/ driver" : " · self"}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {formatDate(b.start_date)}
                  {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {b.vehicle_name ? `${b.vehicle_name} · ${b.vehicle_plate}` : "—"}
                </td>
                <td className="px-6 py-4"><VBStatusPill status={b.status} /></td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/admin/cars/bookings/${b.id}`} data-testid={`acb-open-${b.id}`} className="text-sm font-semibold text-[#0055FF] hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
