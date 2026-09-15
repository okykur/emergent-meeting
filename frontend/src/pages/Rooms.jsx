import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../api";
import { rangeDays, dayAvailability, toYMD, formatDate, roomOperatingHoursLabel } from "../utils/dates";
import { Users, MapPin, Search, DoorOpen, CalendarClock, Loader2, Clock3, LayoutGrid } from "lucide-react";
import BookingDialog from "../components/BookingDialog";

function HeatBar({ days, bookings, room }) {
  const showLabels = days.length <= 14;
  return (
    <div className="mt-4 border-t border-[#E7ECE8] pt-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#657169]">
        <span>Jadwal pemakaian</span>
        <span className="font-medium normal-case tracking-normal text-[#7B867F]">{roomOperatingHoursLabel(room)}</span>
      </div>
      <div className="heat-bar" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const status = dayAvailability(bookings, day.ymd, room);
          return <div key={day.ymd} className={`heat-cell ${status}`} title={`${day.ymd}: ${status} (${roomOperatingHoursLabel(room)})`} />;
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] font-medium text-[#87928B]">
        {showLabels ? days.map((day) => <span key={day.ymd}>{day.day}</span>) : <><span>{formatDate(days[0].ymd)}</span><span>{formatDate(days[days.length - 1].ymd)}</span></>}
      </div>
    </div>
  );
}

function getRoomStatus(room, bookings, days) {
  if (!room.is_active) return { label: "Tidak tersedia", className: "bg-[#EEF1EF] text-[#68736C]" };
  const statuses = days.map((day) => dayAvailability(bookings, day.ymd, room));
  if (statuses.length > 0 && statuses.every((status) => status === "full")) return { label: "Penuh", className: "bg-[#FDE8E7] text-[#C73D36]" };
  if (statuses.some((status) => status === "partial" || status === "full")) return { label: "Sebagian terisi", className: "bg-[#FFF2D7] text-[#B66B08]" };
  return { label: "Tersedia", className: "bg-[#E2F4E9] text-[#167849]" };
}

export default function Rooms() {
  const todayYMD = useMemo(() => toYMD(new Date()), []);
  const defaultEndYMD = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    return toYMD(date);
  }, []);
  const [startInput, setStartInput] = useState(todayYMD);
  const [endInput, setEndInput] = useState(defaultEndYMD);
  const [appliedRange, setAppliedRange] = useState({ start: todayYMD, end: defaultEndYMD });
  const [rooms, setRooms] = useState([]);
  const [bookingsByRoom, setBookingsByRoom] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [search, setSearch] = useState("");
  const [minimumCapacity, setMinimumCapacity] = useState("");
  const [building, setBuilding] = useState("all");
  const [filter, setFilter] = useState("all");
  const [bookingRoom, setBookingRoom] = useState(null);
  const days = useMemo(() => rangeDays(appliedRange.start, appliedRange.end, 31), [appliedRange]);

  const fetchData = async (start, end) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/rooms");
      setRooms(data);
      const map = {};
      await Promise.all(data.map(async (room) => {
        const { data: availability } = await api.get(`/rooms/${room.id}/availability`, { params: { start_date: start, end_date: end } });
        map[room.id] = availability.bookings || [];
      }));
      setBookingsByRoom(map);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(appliedRange.start, appliedRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (event) => {
    event?.preventDefault?.();
    setRangeError("");
    if (!startInput || !endInput) return setRangeError("Pilih tanggal mulai dan tanggal selesai.");
    if (endInput < startInput) return setRangeError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    const start = new Date(`${startInput}T00:00:00`);
    const end = new Date(`${endInput}T00:00:00`);
    if (Math.floor((end - start) / 86400000) + 1 > 31) return setRangeError("Pilih rentang maksimal 31 hari.");
    setAppliedRange({ start: startInput, end: endInput });
    fetchData(startInput, endInput);
  };

  const quickPick = (daysCount) => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + daysCount - 1);
    const startValue = toYMD(start);
    const endValue = toYMD(end);
    setStartInput(startValue);
    setEndInput(endValue);
    setAppliedRange({ start: startValue, end: endValue });
    fetchData(startValue, endValue);
  };

  const buildings = [...new Set(rooms.map((room) => room.building).filter(Boolean))].sort();
  const filtered = rooms.filter((room) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || room.name.toLowerCase().includes(query) || (room.building || "").toLowerCase().includes(query) || room.location.toLowerCase().includes(query) || room.facilities.some((facility) => facility.toLowerCase().includes(query));
    if (!matchesQuery) return false;
    if (minimumCapacity && Number(room.capacity) < Number(minimumCapacity)) return false;
    if (building !== "all" && room.building !== building) return false;
    if (filter === "available") return room.is_active;
    if (filter === "unavailable") return !room.is_active;
    return true;
  });

  return (
    <div data-testid="rooms-page" className="pb-8">
      <header className="mb-7">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#657169]">Pilih fasilitas perusahaan</div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#252A27] sm:text-4xl">Temukan Ruangan Anda</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6E7972]">Pilih jadwal dan kapasitas untuk melihat ketersediaan ruang rapat secara langsung.</p>
      </header>

      <form onSubmit={onSearch} className="mb-7 overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_8px_24px_rgba(24,55,42,0.04)]" data-testid="date-range-form">
        <div className="grid grid-cols-1 items-end gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block text-xs font-bold text-[#3F4943]">Tanggal Mulai
            <input type="date" value={startInput} onChange={(event) => setStartInput(event.target.value)} data-testid="range-start-input" className="mt-2 h-11 w-full rounded-lg border border-[#DCE3DE] px-3 text-sm font-normal text-[#303732] outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10" />
          </label>
          <label className="block text-xs font-bold text-[#3F4943]">Tanggal Selesai
            <input type="date" value={endInput} onChange={(event) => setEndInput(event.target.value)} data-testid="range-end-input" className="mt-2 h-11 w-full rounded-lg border border-[#DCE3DE] px-3 text-sm font-normal text-[#303732] outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10" />
          </label>
          <label className="block text-xs font-bold text-[#3F4943]">Kapasitas Minimum
            <select value={minimumCapacity} onChange={(event) => setMinimumCapacity(event.target.value)} data-testid="minimum-capacity-filter" className="mt-2 h-11 w-full rounded-lg border border-[#DCE3DE] bg-white px-3 text-sm font-normal text-[#303732] outline-none focus:border-[#238B57]">
              <option value="">Semua kapasitas</option>
              {[2, 4, 6, 8, 10, 15, 20, 30].map((capacity) => <option key={capacity} value={capacity}>{capacity}+ orang</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading} data-testid="range-search-btn" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#238B57] px-6 text-sm font-bold text-white transition-colors hover:bg-[#176E43] disabled:opacity-60 md:col-span-2 xl:col-span-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Cari Ruangan
          </button>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#E7ECE8] bg-[#FBFCFB] px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-[#657169]">Jadwal cepat:</span>
            {[{ label: "Hari ini", n: 1 }, { label: "7 hari", n: 7 }, { label: "14 hari", n: 14 }].map((quick) => <button type="button" key={quick.label} onClick={() => quickPick(quick.n)} data-testid={`range-quick-${quick.n}`} className="rounded-full border border-[#DCE3DE] bg-white px-3 py-1.5 text-[11px] font-bold text-[#526058] hover:border-[#238B57] hover:text-[#176E43]">{quick.label}</button>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#87928B]" />
              <input data-testid="rooms-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau fasilitas..." className="h-9 w-full rounded-lg border border-[#E1E7E3] bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#238B57]" />
            </div>
            <select value={building} onChange={(event) => setBuilding(event.target.value)} data-testid="building-filter" className="h-9 rounded-lg border border-[#E1E7E3] bg-white px-3 text-xs font-semibold text-[#526058] outline-none focus:border-[#238B57]">
              <option value="all">Semua lokasi</option>
              {buildings.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        {rangeError && <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="range-error">{rangeError}</div>}
        <div className="sr-only" data-testid="applied-range-label">{formatDate(appliedRange.start)} - {formatDate(appliedRange.end)} ({days.length} days)</div>
      </form>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#657169]">
          <span className="font-bold text-[#3F4943]">Status periode:</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#19A66A]" /> Tersedia</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#E69422]" /> Sebagian terisi</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#D9463E]" /> Penuh</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#CBD2CD]" /> Tidak tersedia</span>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-lg border border-[#DCE3DE] bg-white p-1">
          {[{ v: "all", label: "Semua" }, { v: "available", label: "Aktif" }, { v: "unavailable", label: "Nonaktif" }].map((option) => <button type="button" key={option.v} onClick={() => setFilter(option.v)} data-testid={`filter-${option.v}`} className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === option.v ? "bg-[#0B4935] text-white" : "text-[#657169] hover:text-[#252A27]"}`}>{option.label}</button>)}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-[420px] animate-pulse rounded-2xl border border-[#DDE4DF] bg-white" />)}</div> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CCD5CF] bg-white p-12 text-center" data-testid="rooms-empty"><DoorOpen className="mx-auto h-10 w-10 text-[#B8C1BB]" /><p className="mt-3 text-sm text-[#657169]">Tidak ada ruangan yang sesuai dengan filter.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filtered.map((room) => {
            const roomBookings = bookingsByRoom[room.id] || [];
            const status = getRoomStatus(room, roomBookings, days);
            return (
              <article key={room.id} data-testid={`room-card-${room.id}`} className="group overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_8px_24px_rgba(24,55,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#9FC6B2] hover:shadow-[0_14px_30px_rgba(24,55,42,0.1)]">
                <div className="relative h-48 overflow-hidden bg-[#EEF2EF] sm:h-56">
                  {room.image_url ? <img src={room.image_url} alt={room.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" /> : <div className="flex h-full items-center justify-center"><DoorOpen className="h-12 w-12 text-[#B8C1BB]" /></div>}
                  <span className="absolute left-4 top-4 rounded-full bg-[#0B4935] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-white shadow-sm">{room.building || "Belum ditentukan"}</span>
                  <span className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.05em] shadow-sm ${status.className}`}>{status.label}</span>
                </div>
                <div className="p-5">
                  <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-[#252A27]">{room.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-[#657169]">
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {room.capacity} orang</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {room.location}</span>
                    <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {roomOperatingHoursLabel(room)}</span>
                    <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> {room.layout_fixed !== false ? "Fixed" : "Fleksibel"}</span>
                  </div>
                  {room.facilities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{room.facilities.slice(0, 5).map((facility) => <span key={facility} className="rounded-md border border-[#E1E7E3] bg-[#F8FAF8] px-2 py-1 text-[10px] font-medium text-[#647068]">{facility}</span>)}{room.facilities.length > 5 && <span className="rounded-md bg-[#EDF2EE] px-2 py-1 text-[10px] text-[#647068]">+{room.facilities.length - 5}</span>}</div>}
                  {days.length > 0 && <HeatBar days={days} bookings={roomBookings} room={room} />}
                  <button disabled={!room.is_active} onClick={() => setBookingRoom(room)} data-testid={`book-btn-${room.id}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#238B57] bg-[#238B57] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#176E43] disabled:cursor-not-allowed disabled:border-[#DCE3DE] disabled:bg-white disabled:text-[#87928B]">
                    <CalendarClock className="h-4 w-4" /> {room.is_active ? "Pesan Ruangan Ini" : "Tidak Dapat Dipesan"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {bookingRoom && <BookingDialog room={bookingRoom} onClose={() => setBookingRoom(null)} onBooked={async () => { setBookingRoom(null); await fetchData(appliedRange.start, appliedRange.end); }} />}
    </div>
  );
}
