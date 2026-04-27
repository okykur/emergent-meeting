import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { StatusPill } from "../../components/Status";
import { formatDate } from "../../utils/dates";
import { Check, X, Search, Filter } from "lucide-react";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userQ, setUserQ] = useState("");
  const [date, setDate] = useState("");

  const load = async () => {
    try {
      const params = {};
      if (status) params.status = status;
      if (roomId) params.room_id = roomId;
      if (userQ) params.user_query = userQ;
      if (date) params.date = date;
      const [{ data }, { data: rs }] = await Promise.all([
        api.get("/bookings", { params }),
        rooms.length ? Promise.resolve({ data: rooms }) : api.get("/rooms"),
      ]);
      setBookings(data);
      if (!rooms.length) setRooms(rs);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roomId, date]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status: newStatus });
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  return (
    <div data-testid="admin-bookings-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Booking Monitoring
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Meeting Room Bookings
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-white p-4 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="admin-bookings-user-search"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by user name or email…"
            className="w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
          />
        </div>
        <select
          data-testid="admin-bookings-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          data-testid="admin-bookings-room-filter"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          data-testid="admin-bookings-date-filter"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Room</th>
              <th className="px-6 py-3 text-left">Title</th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Time</th>
              <th className="px-6 py-3 text-left">People</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  No bookings match the filters.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr
                key={b.id}
                className="border-t border-slate-200 hover:bg-slate-50"
                data-testid={`admin-booking-row-${b.id}`}
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{b.user_name}</div>
                  <div className="text-xs text-slate-500">{b.user_email}</div>
                </td>
                <td className="px-6 py-4 text-slate-700">{b.room_name}</td>
                <td className="px-6 py-4 text-slate-700">{b.title}</td>
                <td className="px-6 py-4 text-slate-700">{formatDate(b.date)}</td>
                <td className="px-6 py-4 text-slate-700">
                  {b.start_time}–{b.end_time}
                </td>
                <td className="px-6 py-4 text-slate-700">{b.participants}</td>
                <td className="px-6 py-4">
                  <StatusPill status={b.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    {b.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(b.id, "confirmed")}
                          data-testid={`approve-btn-${b.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => updateStatus(b.id, "cancelled")}
                          data-testid={`reject-btn-${b.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                    {b.status === "confirmed" && (
                      <>
                        <button
                          onClick={() => updateStatus(b.id, "completed")}
                          data-testid={`complete-btn-${b.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Check className="h-3 w-3" /> Complete
                        </button>
                        <button
                          onClick={() => updateStatus(b.id, "cancelled")}
                          data-testid={`cancel-btn-${b.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
