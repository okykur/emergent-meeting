import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { VBStatusPill } from "../../components/VehicleStatus";
import { Plus, BookMarked } from "lucide-react";
import { formatDate } from "../../utils/dates";

export default function MyCarBookings() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

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

  const filtered = items.filter((b) => (filter === "all" ? true : b.status === filter));

  return (
    <div data-testid="my-car-bookings-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            My Activity
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            My Vehicle Bookings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track approval, vehicle assignment, and trip completion.
          </p>
        </div>
        <Link
          to="/car/new"
          className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
        >
          <Plus className="h-4 w-4" /> New Booking
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-sm border border-slate-300 bg-white p-1 md:inline-flex">
        {["all", "pending", "approved", "assigned", "in_use", "completed", "cancelled", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            data-testid={`mcb-filter-${s}`}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              filter === s ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-sm border border-slate-200 bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-12 text-center" data-testid="mcb-empty">
          <BookMarked className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No vehicle bookings match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Purpose</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Dates</th>
                <th className="px-6 py-3 text-left">Vehicle / Driver</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`mcb-row-${b.id}`}>
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
                    {b.vehicle_name ? (
                      <div>
                        <div className="font-medium text-slate-900">{b.vehicle_name}</div>
                        <div className="text-xs text-slate-500">
                          {b.vehicle_plate}{b.driver_name ? ` · ${b.driver_name}` : ""}
                        </div>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-4"><VBStatusPill status={b.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/car/bookings/${b.id}`}
                      data-testid={`mcb-detail-${b.id}`}
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
