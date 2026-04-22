import { useEffect, useState } from "react";
import { api, formatApiError } from "../api";
import { StatusPill } from "../components/Status";
import { CalendarX2, BookMarked, LogIn, LogOut } from "lucide-react";
import { formatDate } from "../utils/dates";

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Returns current state for check-in/out buttons given a booking.
function checkInState(b, now = new Date()) {
  // Only meaningful for confirmed (and completed when already checked out)
  if (b.status !== "confirmed" && !b.checked_in_at) {
    return { canCheckIn: false, canCheckOut: false, reason: null };
  }
  const start = new Date(`${b.date}T${b.start_time}`);
  const end = new Date(`${b.date}T${b.end_time}`);
  if (b.checked_out_at) {
    return { canCheckIn: false, canCheckOut: false, reason: "Checked out" };
  }
  if (b.checked_in_at) {
    // Can check out anytime after check-in
    return { canCheckIn: false, canCheckOut: true, reason: null };
  }
  if (now < start) {
    return { canCheckIn: false, canCheckOut: false, reason: `Check-in opens at ${b.start_time}` };
  }
  if (now > end) {
    return { canCheckIn: false, canCheckOut: false, reason: "Booking window has ended" };
  }
  return { canCheckIn: true, canCheckOut: false, reason: null };
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [actingId, setActingId] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bookings/mine");
      setBookings(data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 30_000); // refresh window state every 30s
    return () => clearInterval(t);
  }, []);

  const cancel = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    setActingId(id);
    try {
      await api.post(`/bookings/${id}/cancel`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setActingId(null);
    }
  };

  const checkIn = async (id) => {
    setActingId(id);
    try {
      await api.post(`/bookings/${id}/check-in`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setActingId(null);
    }
  };

  const checkOut = async (id) => {
    setActingId(id);
    try {
      await api.post(`/bookings/${id}/check-out`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setActingId(null);
    }
  };

  const filtered = bookings.filter((b) => (filter === "all" ? true : b.status === filter));

  return (
    <div data-testid="my-bookings-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            My Activity
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            My Bookings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Check in/out during your booking window. Pending requests await admin
            approval.
          </p>
        </div>
        <div className="flex gap-1 rounded-sm border border-slate-300 bg-white p-1">
          {["all", "pending", "confirmed", "cancelled", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              data-testid={`my-bookings-filter-${s}`}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === s ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-sm border border-slate-200 bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-sm border border-dashed border-slate-300 bg-white p-12 text-center"
          data-testid="my-bookings-empty"
        >
          <BookMarked className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No bookings yet. Head to Meeting Rooms to make a request.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Room</th>
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Time</th>
                <th className="px-6 py-3 text-left">Attendance</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const { canCheckIn, canCheckOut, reason } = checkInState(b, now);
                return (
                  <tr
                    key={b.id}
                    data-testid={`my-booking-row-${b.id}`}
                    className="border-t border-slate-200 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">{b.room_name}</td>
                    <td className="px-6 py-4 text-slate-700">{b.title}</td>
                    <td className="px-6 py-4 text-slate-700">{formatDate(b.date)}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {b.start_time} – {b.end_time}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {b.checked_in_at ? (
                        <div data-testid={`checkin-ts-${b.id}`}>
                          <div className="font-medium text-emerald-700">
                            In: {fmtTime(b.checked_in_at)}
                          </div>
                          {b.checked_out_at ? (
                            <div className="font-medium text-blue-700" data-testid={`checkout-ts-${b.id}`}>
                              Out: {fmtTime(b.checked_out_at)}
                            </div>
                          ) : (
                            <div className="text-slate-400">In meeting…</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          {canCheckIn && (
                            <button
                              onClick={() => checkIn(b.id)}
                              disabled={actingId === b.id}
                              data-testid={`check-in-btn-${b.id}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <LogIn className="h-3 w-3" />
                              Check in
                            </button>
                          )}
                          {canCheckOut && (
                            <button
                              onClick={() => checkOut(b.id)}
                              disabled={actingId === b.id}
                              data-testid={`check-out-btn-${b.id}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              <LogOut className="h-3 w-3" />
                              Check out
                            </button>
                          )}
                          {(b.status === "pending" || b.status === "confirmed") &&
                            !b.checked_in_at && (
                              <button
                                onClick={() => cancel(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`my-booking-cancel-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                              >
                                <CalendarX2 className="h-3 w-3" />
                                Cancel
                              </button>
                            )}
                        </div>
                        {reason && !b.checked_out_at && b.status === "confirmed" && !b.checked_in_at && (
                          <div
                            className="text-[11px] text-slate-400"
                            data-testid={`check-reason-${b.id}`}
                          >
                            {reason}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
