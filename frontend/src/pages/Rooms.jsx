import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../api";
import { ActiveTag } from "../components/Status";
import { rangeDays, dayAvailability, toYMD, formatDate } from "../utils/dates";
import { Users, MapPin, Search, DoorOpen, CalendarClock, Loader2 } from "lucide-react";
import BookingDialog from "../components/BookingDialog";

function HeatBar({ days, bookings }) {
  // For up to 14 days show day abbreviations; beyond that show only start/end markers for clarity.
  const showLabels = days.length <= 14;
  return (
    <div className="mt-3">
      <div
        className="heat-bar"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const status = dayAvailability(bookings, d.ymd);
          return (
            <div
              key={d.ymd}
              className={`heat-cell ${status}`}
              title={`${d.ymd}: ${status}`}
            />
          );
        })}
      </div>
      {showLabels ? (
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {days.map((d) => (
            <span key={d.ymd}>{d.day}</span>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>{formatDate(days[0].ymd)}</span>
          <span>{formatDate(days[days.length - 1].ymd)}</span>
        </div>
      )}
    </div>
  );
}

export default function Rooms() {
  const todayYMD = useMemo(() => toYMD(new Date()), []);
  const defaultEndYMD = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return toYMD(d);
  }, []);

  // Draft inputs (what the user is typing)
  const [startInput, setStartInput] = useState(todayYMD);
  const [endInput, setEndInput] = useState(defaultEndYMD);
  // Applied range (last searched)
  const [appliedRange, setAppliedRange] = useState({ start: todayYMD, end: defaultEndYMD });

  const [rooms, setRooms] = useState([]);
  const [bookingsByRoom, setBookingsByRoom] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [bookingRoom, setBookingRoom] = useState(null);

  const days = useMemo(
    () => rangeDays(appliedRange.start, appliedRange.end, 31),
    [appliedRange]
  );

  const fetchData = async (start, end) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/rooms");
      setRooms(data);
      const map = {};
      await Promise.all(
        data.map(async (r) => {
          const { data: avail } = await api.get(`/rooms/${r.id}/availability`, {
            params: { start_date: start, end_date: end },
          });
          map[r.id] = avail.bookings || [];
        })
      );
      setBookingsByRoom(map);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(appliedRange.start, appliedRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (e) => {
    e?.preventDefault?.();
    setRangeError("");
    if (!startInput || !endInput) {
      setRangeError("Please select both a start and end date.");
      return;
    }
    if (endInput < startInput) {
      setRangeError("End date must be on or after the start date.");
      return;
    }
    // Clamp range to 31 days
    const start = new Date(startInput + "T00:00:00");
    const end = new Date(endInput + "T00:00:00");
    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 31) {
      setRangeError("Please choose a range of 31 days or less.");
      return;
    }
    setAppliedRange({ start: startInput, end: endInput });
    fetchData(startInput, endInput);
  };

  const quickPick = (daysCount) => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + daysCount - 1);
    const s = toYMD(start);
    const e = toYMD(end);
    setStartInput(s);
    setEndInput(e);
    setAppliedRange({ start: s, end: e });
    fetchData(s, e);
  };

  const filtered = rooms.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesQ =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      r.facilities.some((f) => f.toLowerCase().includes(q));
    if (!matchesQ) return false;
    if (filter === "available") return r.is_active;
    if (filter === "unavailable") return !r.is_active;
    return true;
  });

  return (
    <div data-testid="rooms-page">
      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Meeting Rooms
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Find your space
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Pick a date range, then search to see live availability across all
          rooms. Select a room to request a booking — admins will review and
          confirm.
        </p>
      </div>

      {/* Date range search bar */}
      <form
        onSubmit={onSearch}
        className="mb-6 rounded-sm border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="date-range-form"
      >
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[auto_auto_auto_1fr]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Start date
            </label>
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              data-testid="range-start-input"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15 md:w-44"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              End date
            </label>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              data-testid="range-end-input"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15 md:w-44"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            data-testid="range-search-btn"
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-5 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="text-xs uppercase tracking-wider text-slate-400">Quick:</span>
            {[
              { label: "Today", n: 1 },
              { label: "7 days", n: 7 },
              { label: "14 days", n: 14 },
              { label: "30 days", n: 30 },
            ].map((q) => (
              <button
                type="button"
                key={q.label}
                onClick={() => quickPick(q.n)}
                data-testid={`range-quick-${q.n}`}
                className="rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        {rangeError && (
          <div
            className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            data-testid="range-error"
          >
            {rangeError}
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500" data-testid="applied-range-label">
          Showing availability <span className="font-semibold text-slate-700">
            {formatDate(appliedRange.start)}
          </span>{" "}
          → <span className="font-semibold text-slate-700">{formatDate(appliedRange.end)}</span>
          {" "}({days.length} {days.length === 1 ? "day" : "days"})
        </div>
      </form>

      {/* Search & filter row */}
      <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="rooms-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter rooms by name, location, facilities…"
            className="w-full rounded-sm border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
          />
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-slate-300 bg-white p-1">
          {[
            { v: "all", label: "All" },
            { v: "available", label: "Active" },
            { v: "unavailable", label: "Inactive" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              data-testid={`filter-${o.v}`}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === o.v
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-emerald-500" /> Free
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-amber-400" /> Partially booked
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-red-500" /> Fully booked
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-slate-200" /> No data / closed
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-sm border border-slate-200 bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-12 text-center" data-testid="rooms-empty">
          <DoorOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No rooms match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <article
              key={r.id}
              data-testid={`room-card-${r.id}`}
              className="group flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition-all hover:border-[#0055FF] hover:shadow-md"
            >
              <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                {r.image_url && (
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute right-3 top-3">
                  <ActiveTag active={r.is_active} />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-900">{r.name}</h3>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" /> {r.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    <Users className="h-3 w-3" /> {r.capacity}
                  </div>
                </div>
                {r.facilities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {r.facilities.slice(0, 4).map((f) => (
                      <span
                        key={f}
                        className="rounded-sm bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {f}
                      </span>
                    ))}
                    {r.facilities.length > 4 && (
                      <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        +{r.facilities.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {days.length > 0 && <HeatBar days={days} bookings={bookingsByRoom[r.id] || []} />}
                <div className="mt-5 flex gap-2">
                  <button
                    disabled={!r.is_active}
                    onClick={() => setBookingRoom(r)}
                    data-testid={`book-btn-${r.id}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0044CC] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Book Room
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {bookingRoom && (
        <BookingDialog
          room={bookingRoom}
          onClose={() => setBookingRoom(null)}
          onBooked={async () => {
            setBookingRoom(null);
            await fetchData(appliedRange.start, appliedRange.end);
          }}
        />
      )}
    </div>
  );
}
