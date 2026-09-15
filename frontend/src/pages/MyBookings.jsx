import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../api";
import { StatusPill } from "../components/Status";
import { VBStatusPill } from "../components/VehicleStatus";
import {
  CalendarX2,
  BookMarked,
  LogIn,
  LogOut,
  DoorOpen,
  Car,
  ArrowRight,
  Search,
} from "lucide-react";
import { formatDate, toYMD } from "../utils/dates";
import { vehicleServiceLabel } from "../utils/carBookingRules";

function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Meeting-room check-in window logic
function meetingCheckState(b, now = new Date()) {
  if (b.status !== "confirmed" && !b.checked_in_at) {
    return { canIn: false, canOut: false, reason: null };
  }
  const start = new Date(`${b.date}T${b.start_time}`);
  const end = new Date(`${b.date}T${b.end_time}`);
  if (b.checked_out_at) return { canIn: false, canOut: false, reason: "Checked out" };
  if (b.checked_in_at) return { canIn: false, canOut: true, reason: null };
  if (now < start) return { canIn: false, canOut: false, reason: `Check-in opens at ${b.start_time}` };
  if (now > end) return { canIn: false, canOut: false, reason: "Window has ended" };
  return { canIn: true, canOut: false, reason: null };
}

function meetingCancelState(b, now = new Date()) {
  if (!["pending", "confirmed"].includes(b.status)) return { canCancel: false, reason: null };
  if (b.checked_in_at && !b.checked_out_at) {
    return { canCancel: false, reason: "Check out to release this room" };
  }
  if (b.checked_in_at) return { canCancel: false, reason: null };
  const start = new Date(`${b.date}T${b.start_time}`);
  if (now >= start) return { canCancel: false, reason: "Meeting has already started" };
  return { canCancel: true, reason: null };
}

function CancelMeetingDialog({ booking, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [cancelFnb, setCancelFnb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasFnb = Boolean((booking.food_beverages || "").trim()) && booking.fnb_status !== "cancelled";
  const fnbCanBeCancelled = hasFnb && booking.date > toYMD(new Date());

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ reason: reason.trim(), cancel_fnb: fnbCanBeCancelled && cancelFnb });
    } catch (err) {
      setError(formatApiError(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
        data-testid="cancel-meeting-dialog"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Cancel booking</div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">Cancel meeting room</h3>
            <p className="mt-1 text-sm text-slate-500">{booking.room_name} - {formatDate(booking.date)}, {booking.start_time}-{booking.end_time}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900" aria-label="Close">
            <CalendarX2 className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Cancellation reason</label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="cancel-meeting-reason-input"
              placeholder="Explain why this meeting is being cancelled"
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
            />
          </div>

          {hasFnb && fnbCanBeCancelled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={cancelFnb}
                onChange={(event) => setCancelFnb(event.target.checked)}
                data-testid="cancel-meeting-fnb-checkbox"
                className="mt-1 h-4 w-4 accent-[#0B7A4B]"
              />
              <span>
                <span className="block font-semibold text-slate-900">Cancel F&amp;B accommodation as well</span>
                <span className="mt-1 block text-xs text-slate-600">Leave unchecked to cancel only the meeting room and keep the F&amp;B request active.</span>
              </span>
            </label>
          )}

          {hasFnb && !fnbCanBeCancelled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="cancel-meeting-fnb-day-of-note">
              This booking is on the meeting day. F&amp;B accommodation cannot be cancelled; only the meeting room will be cancelled.
            </div>
          )}

          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Keep booking</button>
          <button
            type="submit"
            disabled={saving}
            data-testid="cancel-meeting-submit-btn"
            className="inline-flex items-center gap-2 rounded-sm bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <CalendarX2 className="h-4 w-4" /> {saving ? "Cancelling..." : "Cancel meeting room"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Normalise both booking shapes into a single timeline row
function normalise(b, kind) {
  if (kind === "meeting") {
    return {
      _kind: "meeting",
      id: b.id,
      raw: b,
      title: b.title,
      sub: b.room_name,
      status: b.status,
      dateStart: b.date,
      dateEnd: b.date,
      timeStart: b.start_time,
      timeEnd: b.end_time,
      sortKey: `${b.date}T${b.start_time}`,
    };
  }
  return {
    _kind: "vehicle",
    id: b.id,
    raw: b,
    title: b.purpose,
    sub: b.vehicle_name ? `${b.vehicle_name} · ${b.vehicle_plate}` : "Vehicle not assigned",
    status: b.status,
    dateStart: b.start_date,
    dateEnd: b.end_date,
    timeStart: b.start_time,
    timeEnd: b.end_time,
    sortKey: `${b.start_date}T${b.start_time}`,
  };
}

export default function MyBookings() {
  const [meetingItems, setMeetingItems] = useState([]);
  const [vehicleItems, setVehicleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [cancellingMeeting, setCancellingMeeting] = useState(null);
  const [now, setNow] = useState(new Date());
  const [scope, setScope] = useState("all"); // all | meeting | vehicle
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: m }, { data: v }] = await Promise.all([
        api.get("/bookings/mine"),
        api.get("/vehicle-bookings/mine"),
      ]);
      setMeetingItems(m);
      setVehicleItems(v);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Inline actions for meeting room
  const cancelMeeting = async (booking, payload) => {
    setActingId(booking.id);
    try {
      await api.post(`/bookings/${booking.id}/cancel`, payload);
      setCancellingMeeting(null);
      await load();
    } catch (e) {
      throw e;
    } finally {
      setActingId(null);
    }
  };
  const checkInMeeting = async (id) => {
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
  const checkOutMeeting = async (id) => {
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
  const cancelVehicle = async (id) => {
    if (!window.confirm("Cancel this vehicle booking?")) return;
    setActingId(id);
    try {
      await api.post(`/vehicle-bookings/${id}/cancel`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setActingId(null);
    }
  };

  const all = [
    ...meetingItems.map((b) => normalise(b, "meeting")),
    ...vehicleItems.map((b) => normalise(b, "vehicle")),
  ].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));

  const normalisedQuery = query.trim().toLowerCase();
  const filtered = all.filter((row) => {
    if (scope === "meeting") return row._kind === "meeting";
    if (scope === "vehicle") return row._kind === "vehicle";
    return true;
  }).filter((row) => {
    if (!normalisedQuery) return true;
    return [row.title, row.sub, row.status, row.dateStart, row.dateEnd, row._kind]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalisedQuery);
  });

  const counts = {
    all: all.length,
    meeting: meetingItems.length,
    vehicle: vehicleItems.length,
  };

  return (
    <div data-testid="my-bookings-page">
      {cancellingMeeting && (
        <CancelMeetingDialog
          booking={cancellingMeeting}
          onClose={() => setCancellingMeeting(null)}
          onSubmit={(payload) => cancelMeeting(cancellingMeeting, payload)}
        />
      )}
      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#657169]">
            Aktivitas Saya
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#252A27] sm:text-4xl">
            Booking Saya
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/rooms"
            data-testid="quick-book-room"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCE3DE] bg-white px-6 py-3 text-sm font-bold text-[#303732] transition-colors hover:bg-[#F3F6F4]"
          >
            <DoorOpen className="h-4 w-4" /> Pesan Ruang Rapat
          </Link>
          <Link
            to="/car/new"
            data-testid="quick-book-car"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#238B57] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#176E43]"
          >
            <Car className="h-4 w-4" /> Pesan Kendaraan Dinas
          </Link>
        </div>
      </div>

      {/* Scope tabs */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter booking">
        {[
          { k: "all", label: "Semua Booking", icon: BookMarked },
          { k: "meeting", label: "Ruang Rapat", icon: DoorOpen },
          { k: "vehicle", label: "Kendaraan", icon: Car },
        ].map((t) => {
          const Icon = t.icon;
          const active = scope === t.k;
          return (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setScope(t.k)}
              data-testid={`scope-tab-${t.k}`}
              className={`inline-flex min-h-10 flex-shrink-0 items-center gap-3 rounded-lg px-4 text-sm font-bold transition-colors ${
                active ? "bg-[#0B4935] text-white" : "border border-[#DCE3DE] bg-white text-[#333A35] hover:bg-[#F3F6F4]"
              }`}
            >
              <Icon className="hidden h-3.5 w-3.5 sm:block" /> {t.label}
              <span className={`rounded px-2 py-0.5 text-[10px] ${active ? "bg-[#238B57] text-white" : "bg-[#EDF1EE] text-[#768079]"}`}>
                {counts[t.k]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="relative w-full lg:w-[320px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69736D]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="bookings-search-input"
          placeholder="Cari pengajuan..."
          className="h-10 w-full rounded-lg border border-[#DCE3DE] bg-white py-2 pl-10 pr-3 text-sm text-[#39413C] outline-none placeholder:text-[#7B847E] focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10"
        />
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
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[#DCE3DE] bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-[#C9D3CC] bg-white p-12 text-center"
          data-testid="my-bookings-empty"
        >
          <BookMarked className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No bookings here yet. Use the buttons above to make a request.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_8px_24px_rgba(24,55,39,0.025)] md:block">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-[#FAFBFA] text-[10px] font-bold uppercase tracking-[0.04em] text-[#657169]">
                <tr>
                  <th className="px-6 py-4 text-left">Tipe</th>
                  <th className="px-6 py-4 text-left">Keperluan / Ruang atau Kendaraan</th>
                  <th className="px-6 py-4 text-left">Jadwal Pemakaian</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Kehadiran / Proses</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  if (row._kind === "meeting") {
                    const b = row.raw;
                    const { canIn, canOut, reason } = meetingCheckState(b, now);
                    const { canCancel, reason: cancelReason } = meetingCancelState(b, now);
                    return (
                      <tr
                        key={`m-${row.id}`}
                        className="border-t border-[#E3E8E5] transition-colors hover:bg-[#F8FAF8]"
                        data-testid={`mb-row-meeting-${row.id}`}
                      >
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F4EB] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1E7C4F]">
                            <DoorOpen className="h-3 w-3" /> Meeting Room
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-[#303732]">{b.title}</div>
                          <div className="mt-1 text-xs text-[#747D77]">{b.room_name}</div>
                          {(b.additional_facilities || []).length > 0 && (
                            <div className="mt-1 text-[11px] text-[#747D77]">
                              Fasilitas: {b.additional_facilities.join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 text-[#3F4742]">
                          <div>{formatDate(b.date)}</div>
                          <div className="mt-1 text-xs text-[#747D77]">
                            {b.start_time} – {b.end_time}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <StatusPill status={b.status} />
                        </td>
                        <td className="px-6 py-5 text-xs">
                          {b.checked_in_at ? (
                            <div>
                              <div className="font-medium text-emerald-700">In: {fmtTime(b.checked_in_at)}</div>
                              {b.checked_out_at ? (
                                <div className="font-medium text-blue-700">Out: {fmtTime(b.checked_out_at)}</div>
                              ) : (
                                <div className="text-slate-400">In meeting…</div>
                              )}
                            </div>
                          ) : reason ? (
                            <span className="text-slate-400">{reason}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canIn && (
                              <button
                                onClick={() => checkInMeeting(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`mb-check-in-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#238B57] px-3 py-2 text-xs font-bold text-white hover:bg-[#176E43] disabled:opacity-50"
                              >
                                <LogIn className="h-3 w-3" /> Check in
                              </button>
                            )}
                            {canOut && (
                              <button
                                onClick={() => checkOutMeeting(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`mb-check-out-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0B4935] px-3 py-2 text-xs font-bold text-white hover:bg-[#073A2A] disabled:opacity-50"
                              >
                                <LogOut className="h-3 w-3" /> Check out
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => setCancellingMeeting(b)}
                                disabled={actingId === b.id}
                                data-testid={`mb-cancel-meeting-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3DE] px-3 py-2 text-xs font-bold text-[#626C65] hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              >
                                <CalendarX2 className="h-3 w-3" /> Cancel
                              </button>
                            )}
                            {!canCancel && cancelReason && (
                              <span className="text-right text-[11px] font-medium text-slate-400">{cancelReason}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const b = row.raw;
                  const handoverDone = !!b.handover?.user_confirmed_at;
                  const returnDone = !!b.return_info?.user_confirmed_at;
                  let processBlurb = "—";
                  if (b.status === "pending") processBlurb = "Awaiting Car Admin approval";
                  else if (b.status === "approved") processBlurb = "Approved — vehicle assignment pending";
                  else if (b.status === "assigned" && !handoverDone) processBlurb = "Confirm handover when picking up";
                  else if (b.status === "assigned" && handoverDone) processBlurb = "Awaiting admin handover sign-off";
                  else if (b.status === "in_use" && !returnDone) processBlurb = "Trip in progress — confirm return when done";
                  else if (b.status === "in_use" && returnDone) processBlurb = "Awaiting admin return sign-off";
                  else if (b.status === "completed") processBlurb = "Trip completed";
                  else if (b.status === "rejected") processBlurb = "Rejected";
                  else if (b.status === "cancelled") processBlurb = "Cancelled";
                  const canCancel = ["pending", "approved", "assigned"].includes(b.status) && !handoverDone;
                  const actionLabel =
                    b.status === "assigned" && !handoverDone
                      ? "Confirm handover"
                      : b.status === "in_use" && !returnDone
                        ? "Confirm return"
                        : "Open";
                  return (
                    <tr
                      key={`v-${row.id}`}
                      className="border-t border-[#E3E8E5] transition-colors hover:bg-[#F8FAF8]"
                      data-testid={`mb-row-vehicle-${row.id}`}
                    >
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF1EF] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5F6A63]">
                          <Car className="h-3 w-3" /> Vehicle
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-[#303732]">{b.purpose}</div>
                        <div className="mt-1 text-xs text-[#747D77]">
                          {b.vehicle_name
                            ? `${b.vehicle_name} · ${b.vehicle_plate}${b.driver_name ? ` · ${b.driver_name}` : ""}`
                            : `${vehicleServiceLabel(b)} · ${
                                b.with_driver ? "with driver" : "self-drive"
                              }`}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-[#3F4742]">
                        <div>
                          {formatDate(b.start_date)}
                          {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`}
                        </div>
                        <div className="mt-1 text-xs text-[#747D77]">
                          {b.start_time} – {b.end_time}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <VBStatusPill status={b.status} />
                      </td>
                      <td className="px-6 py-5 text-xs text-[#68726C]">{processBlurb}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Link
                            to={`/car/bookings/${b.id}`}
                            data-testid={`mb-vehicle-open-${b.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#238B57] px-3 py-2 text-xs font-bold text-white hover:bg-[#176E43]"
                          >
                            {actionLabel}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                          {canCancel && (
                            <button
                              onClick={() => cancelVehicle(b.id)}
                              disabled={actingId === b.id}
                              data-testid={`mb-cancel-vehicle-${b.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3DE] px-3 py-2 text-xs font-bold text-[#626C65] hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <CalendarX2 className="h-3 w-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-4 md:hidden">
            {filtered.map((row) => {
              if (row._kind === "meeting") {
                const b = row.raw;
                const { canIn, canOut, reason } = meetingCheckState(b, now);
                const { canCancel, reason: cancelReason } = meetingCancelState(b, now);
                return (
                  <div
                    key={`mc-${row.id}`}
                    className="rounded-2xl border border-[#DDE4DF] bg-white p-5 shadow-[0_8px_24px_rgba(24,55,39,0.025)]"
                    data-testid={`mb-card-meeting-${row.id}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F4EB] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1E7C4F]">
                        <DoorOpen className="h-3 w-3" /> Meeting Room
                      </span>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="font-display text-base font-bold text-[#303732]">{b.title}</div>
                    <div className="mt-1 text-sm text-[#747D77]">{b.room_name}</div>
                    {(b.additional_facilities || []).length > 0 && (
                      <div className="mt-1 text-xs text-slate-500">
                        Fasilitas: {b.additional_facilities.join(", ")}
                      </div>
                    )}
                    <div className="mt-2 text-sm text-slate-700">
                      {formatDate(b.date)} · {b.start_time} – {b.end_time}
                    </div>
                    {b.checked_in_at && (
                      <div className="mt-2 text-xs">
                        <div className="font-medium text-emerald-700">In: {fmtTime(b.checked_in_at)}</div>
                        {b.checked_out_at ? (
                          <div className="font-medium text-blue-700">Out: {fmtTime(b.checked_out_at)}</div>
                        ) : (
                          <div className="text-slate-400">In meeting…</div>
                        )}
                      </div>
                    )}
                    {!b.checked_in_at && reason && (
                      <div className="mt-2 text-xs text-slate-400">{reason}</div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canIn && (
                        <button
                          onClick={() => checkInMeeting(b.id)}
                          disabled={actingId === b.id}
                          data-testid={`mb-mobile-check-in-${b.id}`}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#238B57] px-3 py-2 text-sm font-bold text-white hover:bg-[#176E43] disabled:opacity-50"
                        >
                          <LogIn className="h-4 w-4" /> Check in
                        </button>
                      )}
                      {canOut && (
                        <button
                          onClick={() => checkOutMeeting(b.id)}
                          disabled={actingId === b.id}
                          data-testid={`mb-mobile-check-out-${b.id}`}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#0B4935] px-3 py-2 text-sm font-bold text-white hover:bg-[#073A2A] disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" /> Check out
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => setCancellingMeeting(b)}
                          disabled={actingId === b.id}
                          data-testid={`mb-mobile-cancel-meeting-${b.id}`}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#DCE3DE] bg-white px-3 py-2 text-sm font-bold text-[#626C65] hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <CalendarX2 className="h-4 w-4" /> Cancel
                        </button>
                      )}
                      {!canCancel && cancelReason && (
                        <div className="w-full rounded-sm bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-500">
                          {cancelReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              const b = row.raw;
              const handoverDone = !!b.handover?.user_confirmed_at;
              const returnDone = !!b.return_info?.user_confirmed_at;
              let processBlurb = "—";
              if (b.status === "pending") processBlurb = "Awaiting Car Admin approval";
              else if (b.status === "approved") processBlurb = "Approved — vehicle assignment pending";
              else if (b.status === "assigned" && !handoverDone) processBlurb = "Confirm handover when picking up";
              else if (b.status === "assigned" && handoverDone) processBlurb = "Awaiting admin handover sign-off";
              else if (b.status === "in_use" && !returnDone) processBlurb = "Trip in progress — confirm return when done";
              else if (b.status === "in_use" && returnDone) processBlurb = "Awaiting admin return sign-off";
              else if (b.status === "completed") processBlurb = "Trip completed";
              else if (b.status === "rejected") processBlurb = "Rejected";
              else if (b.status === "cancelled") processBlurb = "Cancelled";
              const canCancel = ["pending", "approved", "assigned"].includes(b.status) && !handoverDone;
              const actionLabel =
                b.status === "assigned" && !handoverDone
                  ? "Confirm handover"
                  : b.status === "in_use" && !returnDone
                    ? "Confirm return"
                    : "Open details";
              return (
                <div
                  key={`vc-${row.id}`}
                  className="rounded-2xl border border-[#DDE4DF] bg-white p-5 shadow-[0_8px_24px_rgba(24,55,39,0.025)]"
                  data-testid={`mb-card-vehicle-${row.id}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF1EF] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5F6A63]">
                      <Car className="h-3 w-3" /> Vehicle
                    </span>
                    <VBStatusPill status={b.status} />
                  </div>
                  <div className="font-display text-base font-bold text-[#303732]">{b.purpose}</div>
                  <div className="mt-1 text-sm text-[#747D77]">
                    {b.vehicle_name
                      ? `${b.vehicle_name} · ${b.vehicle_plate}${b.driver_name ? ` · ${b.driver_name}` : ""}`
                      : `${vehicleServiceLabel(b)} · ${
                          b.with_driver ? "with driver" : "self-drive"
                        }`}
                  </div>
                  <div className="mt-2 text-sm text-slate-700">
                    {formatDate(b.start_date)}
                    {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`} · {b.start_time} – {b.end_time}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{processBlurb}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/car/bookings/${b.id}`}
                      data-testid={`mb-mobile-vehicle-open-${b.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#238B57] px-3 py-2 text-sm font-bold text-white hover:bg-[#176E43]"
                    >
                      {actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    {canCancel && (
                      <button
                        onClick={() => cancelVehicle(b.id)}
                        disabled={actingId === b.id}
                        data-testid={`mb-mobile-cancel-vehicle-${b.id}`}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#DCE3DE] bg-white px-3 py-2 text-sm font-bold text-[#626C65] hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <CalendarX2 className="h-4 w-4" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
