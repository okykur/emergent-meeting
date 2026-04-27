import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { VBStatusPill } from "../../components/VehicleStatus";
import { Plus, ListChecks, Car as CarIcon, ArrowRight, Loader2 } from "lucide-react";
import { formatDate } from "../../utils/dates";

function StatCard({ label, value, accent = "#0055FF" }) {
  return (
    <div
      className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

export default function CarHome() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/vehicle-bookings/mine");
        setItems(data);
      } catch (e) {
        setError(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = items.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const upcoming = items
    .filter((b) => ["approved", "assigned", "in_use"].includes(b.status))
    .slice(0, 5);

  return (
    <div data-testid="car-home-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Vehicle Booking
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Company Vehicles
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Request a company car for official trips. Single-trip with driver, or
            multi-day usage with or without a driver.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/car/new"
            data-testid="new-car-booking-btn"
            className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
          >
            <Plus className="h-4 w-4" />
            New Booking
          </Link>
          <Link
            to="/car/my-bookings"
            data-testid="goto-my-car-bookings"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ListChecks className="h-4 w-4" />
            My Bookings
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Pending" value={counts.pending || 0} accent="#F59E0B" />
        <StatCard label="Approved" value={counts.approved || 0} accent="#0EA5E9" />
        <StatCard label="In Use" value={counts.in_use || 0} accent="#10B981" />
        <StatCard label="Completed" value={counts.completed || 0} accent="#3B82F6" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
          Upcoming
        </h2>
        <Link to="/car/my-bookings" className="text-sm font-semibold text-[#0055FF] hover:underline">
          View all <ArrowRight className="inline h-3 w-3" />
        </Link>
      </div>
      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : upcoming.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-10 text-center">
          <CarIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No upcoming vehicle bookings. Click "New Booking" to request one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Purpose</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Dates</th>
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {upcoming.map((b) => (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`car-row-${b.id}`}>
                  <td className="px-6 py-4 font-medium text-slate-900">{b.purpose}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {b.booking_type === "single_trip" ? "Single trip" : "Multi-day"}
                    {b.with_driver ? " · with driver" : " · self-drive"}
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
                    <Link
                      to={`/car/bookings/${b.id}`}
                      data-testid={`car-detail-${b.id}`}
                      className="text-sm font-semibold text-[#0055FF] hover:underline"
                    >
                      Open →
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
