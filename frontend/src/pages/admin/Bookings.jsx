import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { StatusPill } from "../../components/Status";
import { formatDate } from "../../utils/dates";
import { Check, X, Search, Filter, RefreshCw, Loader2 } from "lucide-react";

const LAYOUT_OPTIONS = ["U-Shape", "Classroom", "Round", "Theater", "Lainnya"];

function SupervisorApprovalTag({ status }) {
  const config = {
    approved: { label: "Approved", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    pending: { label: "Awaiting supervisor", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    rejected: { label: "Rejected", cls: "border-red-200 bg-red-50 text-red-700" },
  };
  const value = config[status] || config.pending;
  return <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${value.cls}`}>{value.label}</span>;
}

function ReassignRoomDialog({ booking, rooms, canManageRoom, onClose, onSaved }) {
  const [roomId, setRoomId] = useState("");
  const [layoutType, setLayoutType] = useState(booking.layout_type || "");
  const [layoutOther, setLayoutOther] = useState(booking.layout_other || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const assignableRooms = rooms.filter(
    (room) => room.id !== booking.room_id && room.is_active && canManageRoom(room)
  );
  const selectedRoom = assignableRooms.find((room) => room.id === roomId);

  const chooseRoom = (value) => {
    setRoomId(value);
    const room = assignableRooms.find((item) => item.id === value);
    if (room?.layout_fixed) {
      setLayoutType("");
      setLayoutOther("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedRoom) {
      setError("Please select an available replacement room.");
      return;
    }
    if (!selectedRoom.layout_fixed && !layoutType) {
      setError("Please select a layout for the replacement room.");
      return;
    }
    if (!selectedRoom.layout_fixed && layoutType === "Lainnya" && !layoutOther.trim()) {
      setError("Please describe the custom room layout.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/bookings/${booking.id}/room`, {
        room_id: selectedRoom.id,
        layout_type: selectedRoom.layout_fixed ? "" : layoutType,
        layout_other: selectedRoom.layout_fixed ? "" : layoutOther,
      });
      onSaved();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        data-testid="reassign-room-dialog"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#087045]">Room assignment</div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">Reassign meeting room</h3>
            <p className="mt-1 text-sm text-slate-500">{booking.title} - {booking.date}, {booking.start_time}-{booking.end_time}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Requested room</div>
            <div className="mt-1 font-semibold text-slate-900">{booking.room_name}</div>
            <div className="mt-1 text-slate-500">{booking.room_building || "Unassigned"} - {booking.participants} participant(s)</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Assign replacement room</label>
            <select
              required
              value={roomId}
              onChange={(e) => chooseRoom(e.target.value)}
              data-testid="reassign-room-select"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
            >
              <option value="">Select an available room</option>
              {assignableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} - {room.building || "Unassigned"} ({room.capacity} pax)
                </option>
              ))}
            </select>
            {assignableRooms.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">No other active rooms are available under your assigned building.</p>
            )}
          </div>

          {selectedRoom && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="block text-xs text-slate-500">Capacity</span>{selectedRoom.capacity} pax</div>
                <div><span className="block text-xs text-slate-500">Operational hours</span>{selectedRoom.operating_start_time}-{selectedRoom.operating_end_time}</div>
              </div>
            </div>
          )}

          {selectedRoom && !selectedRoom.layout_fixed && (
            <div className="space-y-3 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Room layout</label>
                <select
                  value={layoutType}
                  onChange={(e) => setLayoutType(e.target.value)}
                  data-testid="reassign-layout-select"
                  className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                >
                  <option value="">Select layout</option>
                  {LAYOUT_OPTIONS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                </select>
              </div>
              {layoutType === "Lainnya" && (
                <input
                  value={layoutOther}
                  onChange={(e) => setLayoutOther(e.target.value)}
                  data-testid="reassign-layout-other-input"
                  placeholder="Describe the layout"
                  className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                />
              )}
            </div>
          )}

          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            type="submit"
            disabled={saving || !assignableRooms.length}
            data-testid="reassign-room-submit-btn"
            className="inline-flex items-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064E3B] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign room
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminBookings() {
  const { user: me } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [building, setBuilding] = useState("");
  const [userQ, setUserQ] = useState("");
  const [date, setDate] = useState("");
  const [reassigning, setReassigning] = useState(null);
  const canManageRoom = (room) =>
    me?.role === "super_admin" || (me?.meeting_buildings || []).includes(room.building || "Unassigned");
  const visibleRooms = rooms.filter(canManageRoom);
  const buildings = [...new Set(visibleRooms.map((r) => r.building || "Unassigned"))].sort();

  const load = async () => {
    try {
      const params = {};
      if (status) params.status = status;
      if (roomId) params.room_id = roomId;
      if (building) params.building = building;
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
  }, [status, roomId, building, date]);

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

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-white p-4 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="admin-bookings-user-search"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by user name or email…"
            className="w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
          />
        </div>
        <select
          data-testid="admin-bookings-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          data-testid="admin-bookings-building-filter"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
        >
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          data-testid="admin-bookings-room-filter"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
        >
          <option value="">All rooms</option>
          {visibleRooms.map((r) => (
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
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {reassigning && (
        <ReassignRoomDialog
          booking={reassigning}
          rooms={rooms}
          canManageRoom={canManageRoom}
          onClose={() => setReassigning(null)}
          onSaved={async () => {
            setReassigning(null);
            await load();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
        <table className="min-w-[1220px] w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Supervisor approval</th>
              <th className="px-6 py-3 text-left">Room / Gedung</th>
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
                <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
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
                  {b.phone_number && (
                    <div className="mt-1 text-xs font-medium text-slate-600">HP: {b.phone_number}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <SupervisorApprovalTag status={b.supervisor_approval_status} />
                  {b.supervisor_name && <div className="mt-1 text-xs text-slate-500">{b.supervisor_name}</div>}
                  {b.supervisor_email && <div className="text-xs text-slate-400">{b.supervisor_email}</div>}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  <div>{b.room_name}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#0B7A4B]">
                    {b.room_building || "Unassigned"}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-700">
                  <div>{b.title}</div>
                  {b.layout_type && (
                    <div className="mt-1 max-w-xs text-xs text-slate-500">
                      Layout: {b.layout_type === "Lainnya" && b.layout_other ? b.layout_other : b.layout_type}
                    </div>
                  )}
                  {(b.additional_facilities || []).length > 0 && (
                    <div className="mt-1 max-w-xs text-xs text-slate-500">
                      Fasilitas: {b.additional_facilities.join(", ")}
                    </div>
                  )}
                  {b.food_beverages && (
                    <div className="mt-1 max-w-xs text-xs text-slate-500">
                      F&amp;B: {b.food_beverages}
                      <span className="ml-2 font-semibold uppercase text-slate-400">
                        ({b.fnb_status || "pending"})
                      </span>
                    </div>
                  )}
                </td>
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
                    {["pending", "confirmed"].includes(b.status) && b.supervisor_approval_status === "approved" && (
                      <button
                        onClick={() => setReassigning(b)}
                        data-testid={`reassign-room-btn-${b.id}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        <RefreshCw className="h-3 w-3" /> Reassign room
                      </button>
                    )}
                    {b.status === "pending" && (
                      <>
                        {b.supervisor_approval_status === "approved" ? (
                          <button
                            onClick={() => updateStatus(b.id, "confirmed")}
                            data-testid={`approve-btn-${b.id}`}
                            className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Check className="h-3 w-3" /> Approve
                          </button>
                        ) : (
                          <span className="self-center text-[11px] font-medium text-amber-700">Waiting supervisor</span>
                        )}
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
