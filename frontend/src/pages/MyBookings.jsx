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
} from "lucide-react";
import { formatDate } from "../utils/dates";

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
  const [now, setNow] = useState(new Date());
  const [scope, setScope] = useState("all"); // all | meeting | vehicle

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
  const cancelMeeting = async (id) => {
    if (!window.confirm("Cancel this meeting-room booking?")) return;
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

  const filtered = all.filter((row) => {
    if (scope === "meeting") return row._kind === "meeting";
    if (scope === "vehicle") return row._kind === "vehicle";
    return true;
  });

  const counts = {
    all: all.length,
    meeting: meetingItems.length,
    vehicle: vehicleItems.length,
  };

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
            One place for every reservation — meeting rooms and vehicles. Each
            booking shows its own next step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/rooms"
            data-testid="quick-book-room"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <DoorOpen className="h-4 w-4" /> Book Room
          </Link>
          <Link
            to="/car/new"
            data-testid="quick-book-car"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Car className="h-4 w-4" /> Book Vehicle
          </Link>
        </div>
      </div>

      {/* Scope tabs */}
      <div className="mb-4 inline-flex rounded-sm border border-slate-300 bg-white p-1">
        {[
          { k: "all", label: "All", icon: BookMarked },
          { k: "meeting", label: "Meeting Rooms", icon: DoorOpen },
          { k: "vehicle", label: "Vehicles", icon: Car },
        ].map((t) => {
          const Icon = t.icon;
          const active = scope === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setScope(t.k)}
              data-testid={`scope-tab-${t.k}`}
              className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
              <span className={`rounded-sm px-1.5 ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                {counts[t.k]}
              </span>
            </button>
          );
        })}
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
            No bookings here yet. Use the buttons above to make a request.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-sm border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Title / Room or Vehicle</th>
                  <th className="px-6 py-3 text-left">When</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Attendance / Process</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  if (row._kind === "meeting") {
                    const b = row.raw;
                    const { canIn, canOut, reason } = meetingCheckState(b, now);
                    return (
                      <tr
                        key={`m-${row.id}`}
                        className="border-t border-slate-200 hover:bg-slate-50"
                        data-testid={`mb-row-meeting-${row.id}`}
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                            <DoorOpen className="h-3 w-3" /> Meeting Room
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{b.title}</div>
                          <div className="text-xs text-slate-500">{b.room_name}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <div>{formatDate(b.date)}</div>
                          <div className="text-xs text-slate-500">
                            {b.start_time} – {b.end_time}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={b.status} />
                        </td>
                        <td className="px-6 py-4 text-xs">
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
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canIn && (
                              <button
                                onClick={() => checkInMeeting(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`mb-check-in-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <LogIn className="h-3 w-3" /> Check in
                              </button>
                            )}
                            {canOut && (
                              <button
                                onClick={() => checkOutMeeting(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`mb-check-out-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                              >
                                <LogOut className="h-3 w-3" /> Check out
                              </button>
                            )}
                            {(b.status === "pending" || b.status === "confirmed") && !b.checked_in_at && (
                              <button
                                onClick={() => cancelMeeting(b.id)}
                                disabled={actingId === b.id}
                                data-testid={`mb-cancel-meeting-${b.id}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                              >
                                <CalendarX2 className="h-3 w-3" /> Cancel
                              </button>
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
                      className="border-t border-slate-200 hover:bg-slate-50"
                      data-testid={`mb-row-vehicle-${row.id}`}
                    >
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                          <Car className="h-3 w-3" /> Vehicle
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{b.purpose}</div>
                        <div className="text-xs text-slate-500">
                          {b.vehicle_name
                            ? `${b.vehicle_name} · ${b.vehicle_plate}${b.driver_name ? ` · ${b.driver_name}` : ""}`
                            : `${b.booking_type === "single_trip" ? "Single trip" : "Multi-day"} · ${
                                b.with_driver ? "with driver" : "self-drive"
                              }`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <div>
                          {formatDate(b.start_date)}
                          {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {b.start_time} – {b.end_time}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <VBStatusPill status={b.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">{processBlurb}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Link
                            to={`/car/bookings/${b.id}`}
                            data-testid={`mb-vehicle-open-${b.id}`}
                            className="inline-flex items-center gap-1 rounded-sm bg-[#0055FF] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0044CC]"
                          >
                            {actionLabel}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                          {canCancel && (
                            <button
                              onClick={() => cancelVehicle(b.id)}
                              disabled={actingId === b.id}
                              data-testid={`mb-cancel-vehicle-${b.id}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
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
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => {
              if (row._kind === "meeting") {
                const b = row.raw;
                const { canIn, canOut, reason } = meetingCheckState(b, now);
                return (
                  <div
                    key={`mc-${row.id}`}
                    className="rounded-sm border border-slate-200 bg-white p-4"
                    data-testid={`mb-card-meeting-${row.id}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                        <DoorOpen className="h-3 w-3" /> Meeting Room
                      </span>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="font-display text-base font-semibold text-slate-900">{b.title}</div>
                    <div className="text-sm text-slate-500">{b.room_name}</div>
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
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <LogIn className="h-4 w-4" /> Check in
                        </button>
                      )}
                      {canOut && (
                        <button
                          onClick={() => checkOutMeeting(b.id)}
                          disabled={actingId === b.id}
                          data-testid={`mb-mobile-check-out-${b.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" /> Check out
                        </button>
                      )}
                      {(b.status === "pending" || b.status === "confirmed") && !b.checked_in_at && (
                        <button
                          onClick={() => cancelMeeting(b.id)}
                          disabled={actingId === b.id}
                          data-testid={`mb-mobile-cancel-meeting-${b.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                        >
                          <CalendarX2 className="h-4 w-4" /> Cancel
                        </button>
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
                  className="rounded-sm border border-slate-200 bg-white p-4"
                  data-testid={`mb-card-vehicle-${row.id}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                      <Car className="h-3 w-3" /> Vehicle
                    </span>
                    <VBStatusPill status={b.status} />
                  </div>
                  <div className="font-display text-base font-semibold text-slate-900">{b.purpose}</div>
                  <div className="text-sm text-slate-500">
                    {b.vehicle_name
                      ? `${b.vehicle_name} · ${b.vehicle_plate}${b.driver_name ? ` · ${b.driver_name}` : ""}`
                      : `${b.booking_type === "single_trip" ? "Single trip" : "Multi-day"} · ${
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
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-sm bg-[#0055FF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
                    >
                      {actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    {canCancel && (
                      <button
                        onClick={() => cancelVehicle(b.id)}
                        disabled={actingId === b.id}
                        data-testid={`mb-mobile-cancel-vehicle-${b.id}`}
                        className="inline-flex items-center justify-center gap-1 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
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
