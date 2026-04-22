import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../api";
import { StatusPill } from "./Status";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
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
  // Previous-month padding
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month, -startWeekday + i + 1);
    cells.push({ date: d, outside: true });
  }
  // Current month
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  // Fill up to 42 cells (6 rows)
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, outside: true });
  }
  return cells;
}

const STATUS_DOT = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  cancelled: "bg-red-400",
  completed: "bg-blue-500",
};

export default function BookingsCalendar({ scope = "mine", title = "Calendar" }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const url = scope === "admin" ? "/bookings" : "/bookings/mine";
        const { data } = await api.get(url);
        if (alive) setBookings(data);
      } catch (e) {
        if (alive) setError(formatApiError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scope]);

  // Group bookings by date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const map = {};
    for (const b of bookings) {
      (map[b.date] ||= []).push(b);
    }
    // Sort each day by start_time
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [bookings]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayYMD = toYMD(today);
  const selectedBookings = selected ? byDate[selected] || [] : [];

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
            <div className="min-w-[140px] px-3 text-center font-display text-sm font-semibold text-slate-900" data-testid="cal-month-label">
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
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" /> Cancelled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Completed
          </span>
        </div>
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
                  {items.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-1 truncate text-[11px]"
                      title={`${b.start_time} ${b.title} (${b.room_name})`}
                    >
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[b.status] || "bg-slate-400"}`} />
                      <span className="truncate text-slate-600">
                        {b.start_time} {scope === "admin" ? b.room_name : b.title}
                      </span>
                    </div>
                  ))}
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
        <div className="mt-6 rounded-sm border border-slate-200 bg-white p-5" data-testid="cal-day-detail">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#0055FF]" />
            <h3 className="font-display text-lg font-semibold text-slate-900">
              {formatDate(selected)}
            </h3>
            <span className="text-xs text-slate-500">
              {selectedBookings.length} {selectedBookings.length === 1 ? "booking" : "bookings"}
            </span>
          </div>
          {selectedBookings.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-1 rounded-sm border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                  data-testid={`cal-detail-${b.id}`}
                >
                  <div>
                    <div className="font-medium text-slate-900">
                      {b.title}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        · {b.room_name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {b.start_time} – {b.end_time}
                      {scope === "admin" && ` · ${b.user_name} (${b.user_email})`}
                      {b.participants && ` · ${b.participants} people`}
                    </div>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && bookings.length === 0 && (
        <div className="mt-3 text-xs text-slate-500">Loading bookings…</div>
      )}
      {!loading && (
        <div className="sr-only">{title}</div>
      )}
    </div>
  );
}
