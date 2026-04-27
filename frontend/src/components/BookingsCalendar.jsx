import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../api";
import { StatusPill } from "./Status";
import { VBStatusPill } from "./VehicleStatus";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  DoorOpen,
  Car,
  ArrowRight,
} from "lucide-react";
import { formatDate, toYMD } from "../utils/dates";

function startOfMonth(y, m) {
  return new Date(y, m, 1);
}
function endOfMonth(y, m) {
  return new Date(y, m + 1, 0);
}
// Returns 6x7 grid of day cells (sun-first) covering the given month
function buildMonthGrid(year, month) {
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);
  const startWeekday = first.getDay(); // 0..6
  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month, -startWeekday + i + 1);
    cells.push({ date: d, outside: true });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, outside: true });
  }
  return cells;
}

// Dot colour by life-cycle status (works for both kinds)
const STATUS_DOT = {
  // meeting
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  cancelled: "bg-red-400",
  completed: "bg-blue-500",
  // vehicle (extra)
  approved: "bg-emerald-400",
  assigned: "bg-emerald-500",
  in_use: "bg-blue-400",
  rejected: "bg-red-400",
};

// Iterate every YYYY-MM-DD between start and end, inclusive
function daysBetween(startYMD, endYMD) {
  const out = [];
  const [sy, sm, sd] = startYMD.split("-").map(Number);
  const [ey, em, ed] = endYMD.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    out.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function normaliseMeeting(b) {
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
    days: [b.date],
  };
}
function normaliseVehicle(b) {
  return {
    _kind: "vehicle",
    id: b.id,
    raw: b,
    title: b.purpose,
    sub: b.vehicle_name ? `${b.vehicle_name} · ${b.vehicle_plate}` : "Vehicle TBA",
    status: b.status,
    dateStart: b.start_date,
    dateEnd: b.end_date,
    timeStart: b.start_time,
    timeEnd: b.end_time,
    days: daysBetween(b.start_date, b.end_date),
  };
}

const TYPE_META = {
  meeting: {
    Icon: DoorOpen,
    label: "Meeting Room",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cellBar: "bg-emerald-500",
  },
  vehicle: {
    Icon: Car,
    label: "Vehicle",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    cellBar: "bg-amber-500",
  },
};

export default function BookingsCalendar({ scope = "mine", title = "Calendar" }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [meetingItems, setMeetingItems] = useState([]);
  const [vehicleItems, setVehicleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all"); // all | meeting | vehicle

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      const meetingUrl = scope === "admin" ? "/bookings" : "/bookings/mine";
      const vehicleUrl = scope === "admin" ? "/vehicle-bookings" : "/vehicle-bookings/mine";
      const [m, v] = await Promise.allSettled([api.get(meetingUrl), api.get(vehicleUrl)]);
      if (!alive) return;
      // For admin scope, a meeting_admin will 403 on vehicles and a car_admin on meetings.
      // Silently skip whichever the current admin is not allowed to see.
      if (m.status === "fulfilled") setMeetingItems(m.value.data);
      else setMeetingItems([]);
      if (v.status === "fulfilled") setVehicleItems(v.value.data);
      else setVehicleItems([]);
      // Surface error only if BOTH failed (network down / token invalid)
      if (m.status === "rejected" && v.status === "rejected") {
        setError(formatApiError(m.reason));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [scope]);

  // Build day -> entries map. Vehicle multi-day bookings appear on every covered date.
  const byDate = useMemo(() => {
    const map = {};
    const normalised = [];
    if (filter !== "vehicle") {
      for (const b of meetingItems) normalised.push(normaliseMeeting(b));
    }
    if (filter !== "meeting") {
      for (const b of vehicleItems) normalised.push(normaliseVehicle(b));
    }
    for (const row of normalised) {
      for (const d of row.days) {
        (map[d] ||= []).push(row);
      }
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
    }
    return map;
  }, [meetingItems, vehicleItems, filter]);

  const counts = {
    all: meetingItems.length + vehicleItems.length,
    meeting: meetingItems.length,
    vehicle: vehicleItems.length,
  };

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayYMD = toYMD(today);
  const selectedRows = selected ? byDate[selected] || [] : [];

  const go = (delta) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(toYMD(today));
  };

  return (
    <div data-testid="bookings-calendar">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-sm border border-slate-300 bg-white">
            <button
              onClick={() => go(-1)}
              data-testid="cal-prev-btn"
              className="rounded-sm p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              className="min-w-[140px] px-3 text-center font-display text-sm font-semibold text-slate-900"
              data-testid="cal-month-label"
            >
              {monthLabel}
            </div>
            <button
              onClick={() => go(1)}
              data-testid="cal-next-btn"
              className="rounded-sm p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={goToday}
            data-testid="cal-today-btn"
            className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
        </div>

        {/* Type filter */}
        <div className="inline-flex rounded-sm border border-slate-300 bg-white p-1">
          {[
            { k: "all", label: "All" },
            { k: "meeting", label: "Meeting Rooms", Icon: DoorOpen },
            { k: "vehicle", label: "Vehicles", Icon: Car },
          ].map((t) => {
            const Icon = t.Icon;
            const active = filter === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setFilter(t.k)}
                data-testid={`cal-filter-${t.k}`}
                className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />} {t.label}
                <span
                  className={`rounded-sm px-1.5 ${
                    active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[t.k]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-wider text-slate-400">Type</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Meeting Room
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Vehicle
        </span>
        <span className="ml-2 font-semibold uppercase tracking-wider text-slate-400">Status</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmed / Assigned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> In&nbsp;use / Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" /> Cancelled / Rejected
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const ymd = toYMD(cell.date);
            const items = byDate[ymd] || [];
            const isToday = ymd === todayYMD;
            const isSelected = ymd === selected;
            return (
              <button
                key={idx}
                onClick={() => setSelected(ymd)}
                data-testid={`cal-day-${ymd}`}
                className={`flex min-h-[96px] flex-col items-start gap-1 border-b border-r border-slate-200 p-2 text-left transition-colors last:border-r-0 ${
                  cell.outside ? "bg-slate-50/50 text-slate-400" : "text-slate-900 hover:bg-slate-50"
                } ${isSelected ? "ring-2 ring-inset ring-[#0055FF]" : ""}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`text-sm font-semibold ${
                      isToday
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#0055FF] text-white"
                        : ""
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="rounded-sm bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="flex w-full flex-col gap-0.5">
                  {items.slice(0, 3).map((row) => {
                    const meta = TYPE_META[row._kind];
                    return (
                      <div
                        key={`${row._kind}-${row.id}-${ymd}`}
                        className="flex items-center gap-1 truncate text-[11px]"
                        title={`${row.timeStart} ${row.title} · ${row.sub}`}
                      >
                        <span className={`h-2.5 w-1 flex-shrink-0 rounded-sm ${meta.cellBar}`} />
                        <span
                          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                            STATUS_DOT[row.status] || "bg-slate-400"
                          }`}
                        />
                        <span className="truncate text-slate-600">
                          {row.timeStart} {row.title}
                        </span>
                      </div>
                    );
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div
          className="mt-6 rounded-sm border border-slate-200 bg-white p-5"
          data-testid="cal-day-detail"
        >
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#0055FF]" />
            <h3 className="font-display text-lg font-semibold text-slate-900">
              {formatDate(selected)}
            </h3>
            <span className="text-xs text-slate-500">
              {selectedRows.length} {selectedRows.length === 1 ? "booking" : "bookings"}
            </span>
          </div>
          {selectedRows.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedRows.map((row) => {
                const meta = TYPE_META[row._kind];
                const TypeIcon = meta.Icon;
                const b = row.raw;
                const isMulti =
                  row._kind === "vehicle" && row.dateStart !== row.dateEnd;
                return (
                  <div
                    key={`${row._kind}-${row.id}`}
                    className="flex flex-col gap-2 rounded-sm border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                    data-testid={`cal-detail-${row._kind}-${row.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${meta.chip}`}
                        >
                          <TypeIcon className="h-3 w-3" /> {meta.label}
                        </span>
                        {isMulti && (
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {formatDate(row.dateStart)} → {formatDate(row.dateEnd)}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-slate-900">
                        {row.title}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          · {row.sub}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.timeStart} – {row.timeEnd}
                        {scope === "admin" && b.user_name && ` · ${b.user_name}`}
                        {row._kind === "meeting" && b.participants
                          ? ` · ${b.participants} people`
                          : ""}
                        {row._kind === "vehicle" && b.driver_name
                          ? ` · driver: ${b.driver_name}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {row._kind === "meeting" ? (
                        <StatusPill status={row.status} />
                      ) : (
                        <VBStatusPill status={row.status} />
                      )}
                      {row._kind === "vehicle" && (
                        <Link
                          to={
                            scope === "admin"
                              ? `/admin/cars/bookings/${row.id}`
                              : `/car/bookings/${row.id}`
                          }
                          data-testid={`cal-open-vehicle-${row.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading && counts.all === 0 && (
        <div className="mt-3 text-xs text-slate-500">Loading bookings…</div>
      )}
      {!loading && <div className="sr-only">{title}</div>}
    </div>
  );
}
