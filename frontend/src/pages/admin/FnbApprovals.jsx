import { useEffect, useState } from "react";
import { Check, Eye, Filter, Search, X } from "lucide-react";
import { api, formatApiError } from "../../api";
import { StatusPill } from "../../components/Status";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/dates";

function FnbStatusPill({ status }) {
  const map = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
    not_required: { label: "No F&B", cls: "bg-slate-100 text-slate-600" },
  };
  const config = map[status] || { label: status || "No F&B", cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${config.cls}`}>
      {config.label}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

function BookingDetailDialog({ booking, onClose, onUpdateFnb }) {
  if (!booking) return null;
  const hasFnb = Boolean((booking.food_beverages || "").trim());
  const canApproveFnb = booking.status === "confirmed" && hasFnb && booking.fnb_status === "pending";
  const waitingForRoomApproval = booking.status === "pending" && hasFnb && booking.fnb_status === "pending";
  const layout = booking.layout_type
    ? booking.layout_type === "Lainnya" && booking.layout_other
      ? booking.layout_other
      : booking.layout_type
    : "Fixed layout / not selected";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
      data-testid="fnb-detail-dialog"
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Booking Detail
            </div>
            <h3 className="mt-1 font-display text-2xl font-semibold text-slate-900">{booking.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {booking.room_name} - {booking.room_building || "Unassigned"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DetailItem label="Meeting Status" value={<StatusPill status={booking.status} />} />
            <DetailItem label="F&B Status" value={<FnbStatusPill status={booking.fnb_status} />} />
            <DetailItem label="Date & Time" value={`${formatDate(booking.date)} ${booking.start_time}-${booking.end_time}`} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DetailItem label="Requester" value={`${booking.user_name} (${booking.user_email})`} />
            <DetailItem label="Nomor HP" value={booking.phone_number || "-"} />
            <DetailItem label="Room / Lokasi" value={`${booking.room_name} / ${booking.room_building || "Unassigned"}`} />
            <DetailItem label="Participants" value={booking.participants} />
            <DetailItem label="Layout" value={layout} />
            <DetailItem label="Created At" value={booking.created_at ? new Date(booking.created_at).toLocaleString() : "-"} />
          </div>

          <div className="rounded-sm border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Food &amp; Beverages</div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">
              {hasFnb ? booking.food_beverages : "Tidak ada request F&B untuk booking ini."}
            </div>
            {booking.fnb_reviewed_at && (
              <div className="mt-2 text-xs text-slate-500">
                Reviewed at {new Date(booking.fnb_reviewed_at).toLocaleString()}
              </div>
            )}
          </div>

          {booking.notes && (
            <div className="rounded-sm border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{booking.notes}</div>
            </div>
          )}

          {waitingForRoomApproval && (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              F&amp;B belum bisa diapprove karena meeting room masih menunggu approval admin ruang meeting.
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          {canApproveFnb && (
            <>
              <button
                onClick={() => onUpdateFnb(booking.id, "approved")}
                className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Check className="h-4 w-4" /> Approve F&amp;B
              </button>
              <button
                onClick={() => onUpdateFnb(booking.id, "rejected")}
                className="inline-flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <X className="h-4 w-4" /> Reject F&amp;B
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminFnbApprovals() {
  const { user: me } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [fnbStatus, setFnbStatus] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [building, setBuilding] = useState("");
  const [date, setDate] = useState("");
  const [userQ, setUserQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const canManageLocation = (room) =>
    me?.role === "super_admin" || (me?.fnb_locations || []).includes(room.building || "Unassigned");
  const visibleRooms = rooms.filter(canManageLocation);
  const buildings = [...new Set(visibleRooms.map((room) => room.building || "Unassigned"))].sort();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (fnbStatus) params.fnb_status = fnbStatus;
      if (bookingStatus) params.booking_status = bookingStatus;
      if (building) params.building = building;
      if (date) params.date = date;
      if (userQ) params.user_query = userQ;
      const [{ data }, { data: roomData }] = await Promise.all([
        api.get("/fnb/bookings", { params }),
        rooms.length ? Promise.resolve({ data: rooms }) : api.get("/rooms"),
      ]);
      setBookings(data);
      if (!rooms.length) setRooms(roomData);
      if (selectedBooking) {
        setSelectedBooking(data.find((booking) => booking.id === selectedBooking.id) || null);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnbStatus, bookingStatus, building, date]);

  const updateFnbStatus = async (id, nextStatus) => {
    try {
      const { data } = await api.patch(`/fnb/bookings/${id}/status`, { status: nextStatus });
      setSelectedBooking(data);
      await load();
    } catch (err) {
      alert(formatApiError(err));
    }
  };

  return (
    <div data-testid="admin-fnb-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Manager View
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Meeting Activities
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manager melihat semua booking meeting sesuai lokasi, lalu approve F&amp;B setelah meeting room disetujui admin.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
        className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-white p-4 md:grid-cols-6"
      >
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="admin-fnb-search"
            value={userQ}
            onChange={(event) => setUserQ(event.target.value)}
            placeholder="Search user, email, title, or F&B..."
            className="w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
          />
        </div>
        <select
          data-testid="admin-fnb-booking-status-filter"
          value={bookingStatus}
          onChange={(event) => setBookingStatus(event.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All meeting statuses</option>
          <option value="pending">Waiting room approval</option>
          <option value="confirmed">Room approved</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          data-testid="admin-fnb-status-filter"
          value={fnbStatus}
          onChange={(event) => setFnbStatus(event.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All F&amp;B statuses</option>
          <option value="pending">F&amp;B pending</option>
          <option value="approved">F&amp;B approved</option>
          <option value="rejected">F&amp;B rejected</option>
          <option value="not_required">No F&amp;B</option>
        </select>
        <select
          data-testid="admin-fnb-building-filter"
          value={building}
          onChange={(event) => setBuilding(event.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All locations</option>
          {buildings.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            data-testid="admin-fnb-date-filter"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </form>

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
              <th className="px-6 py-3 text-left">Room / Lokasi</th>
              <th className="px-6 py-3 text-left">Meeting &amp; F&amp;B</th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Time</th>
              <th className="px-6 py-3 text-left">Meeting Status</th>
              <th className="px-6 py-3 text-left">F&amp;B Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  Loading meeting activities...
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  No meeting activities match the filters.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => {
                const hasFnb = Boolean((booking.food_beverages || "").trim());
                const canApproveFnb = booking.status === "confirmed" && hasFnb && booking.fnb_status === "pending";
                const waitingForRoomApproval = booking.status === "pending" && hasFnb && booking.fnb_status === "pending";
                return (
                  <tr
                    key={booking.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                    data-testid={`admin-fnb-row-${booking.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{booking.user_name}</div>
                      <div className="text-xs text-slate-500">{booking.user_email}</div>
                      {booking.phone_number && (
                        <div className="mt-1 text-xs font-medium text-slate-600">HP: {booking.phone_number}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div>{booking.room_name}</div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#0055FF]">
                        {booking.room_building || "Unassigned"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-medium text-slate-900">{booking.title}</div>
                      <div className="mt-1 max-w-xs text-xs text-slate-500">
                        F&amp;B: {hasFnb ? booking.food_beverages : "Tidak ada request"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{formatDate(booking.date)}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {booking.start_time}-{booking.end_time}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={booking.status} />
                    </td>
                    <td className="px-6 py-4">
                      <FnbStatusPill status={booking.fnb_status} />
                      {waitingForRoomApproval && (
                        <div className="mt-1 text-[11px] font-medium text-amber-600">Waiting room approval</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          data-testid={`detail-fnb-${booking.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" /> Detail
                        </button>
                        {canApproveFnb && (
                          <>
                            <button
                              onClick={() => updateFnbStatus(booking.id, "approved")}
                              data-testid={`approve-fnb-${booking.id}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button
                              onClick={() => updateFnbStatus(booking.id, "rejected")}
                              data-testid={`reject-fnb-${booking.id}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <BookingDetailDialog
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onUpdateFnb={updateFnbStatus}
      />
    </div>
  );
}
