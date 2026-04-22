import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../api";
import { ActiveTag } from "../components/Status";
import { next7Days, dayAvailability } from "../utils/dates";
import { Users, MapPin, Filter, Search, DoorOpen, CalendarClock } from "lucide-react";
import BookingDialog from "../components/BookingDialog";

function HeatBar({ days, bookings }) {
  return (
    <div className="mt-3">
      <div className="heat-bar">
        {days.map((d) => {
          const status = dayAvailability(bookings, d.ymd);
          return (
            <div key={d.ymd} className={`heat-cell ${status}`} title={`${d.ymd}: ${status}`} />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {days.map((d) => (
          <span key={d.ymd}>{d.label.slice(0, 3)}</span>
        ))}
      </div>
    </div>
  );
}

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [bookingsByRoom, setBookingsByRoom] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | available | unavailable
  const [bookingRoom, setBookingRoom] = useState(null);
  const days = useMemo(() => next7Days(), []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/rooms");
      setRooms(data);
      const start = days[0].ymd;
      const end = days[days.length - 1].ymd;
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Meeting Rooms
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find your space
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Browse all meeting rooms with live availability for the next 7 days.
            Select a room to request a booking — admins will review and confirm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="rooms-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms, locations, facilities…"
              className="w-64 rounded-sm border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
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
      </div>

      <div className="mb-6 flex items-center gap-6 text-xs text-slate-500">
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
                <HeatBar days={days} bookings={bookingsByRoom[r.id] || []} />
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
            await fetchData();
          }}
        />
      )}
    </div>
  );
}
