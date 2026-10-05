import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Star, Building2 } from "lucide-react";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";

const STATUS_CONFIG = [
  { key: "approved", label: "Approved", color: "#148455" },
  { key: "completed", label: "Completed", color: "#164C3B" },
  { key: "pending", label: "Pending", color: "#E68500" },
  { key: "rejected", label: "Rejected", color: "#E0343C" },
  { key: "cancelled", label: "Cancelled", color: "#98A2B3" },
];

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date) => {
  const value = new Date(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  value.setHours(0, 0, 0, 0);
  return value;
};

export function periodRange(mode, customStart = "", customEnd = "", now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start;

  if (mode === "week") {
    start = startOfWeek(now);
  } else if (mode === "quarter") {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (mode === "custom" && customStart && customEnd) {
    start = new Date(`${customStart}T00:00:00`);
    const customEndDate = new Date(`${customEnd}T23:59:59`);
    return { start, end: customEndDate };
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

const hasAccommodation = (booking) => Boolean((booking.food_beverages || "").trim());

const bookingStatusKey = (booking) => {
  if (booking.status === "completed") return "completed";
  if (booking.status === "pending") return "pending";
  if (booking.status === "confirmed" || booking.status === "approved") return "approved";
  if (booking.status === "cancelled") {
    return booking.rejection_reason || booking.rejected_at || booking.meeting_admin_approval_status === "rejected"
      ? "rejected"
      : "cancelled";
  }
  return "cancelled";
};

const inRange = (booking, range) => {
  const date = new Date(`${booking.date}T00:00:00`);
  return date >= range.start && date <= range.end;
};

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function Panel({ children, className = "" }) {
  return <section className={`rounded-xl border border-[#E0E5E1] bg-white ${className}`}>{children}</section>;
}

function EmptyState({ children }) {
  return <div className="flex min-h-32 items-center justify-center text-sm text-[#7B847E]">{children}</div>;
}

export default function GaOperationsDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeTab, setActiveTab] = useState("meeting");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const bookingsEndpoint = user?.role === "manager" ? "/fnb/bookings" : "/bookings";
    Promise.all([api.get(bookingsEndpoint), api.get("/rooms")])
      .then(([bookingResponse, roomResponse]) => {
        if (!active) return;
        setBookings(bookingResponse.data || []);
        setRooms(roomResponse.data || []);
      })
      .catch((requestError) => active && setError(formatApiError(requestError)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.role]);

  const range = useMemo(
    () => periodRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const previousRange = useMemo(() => {
    const duration = range.end.getTime() - range.start.getTime() + 1;
    return {
      start: new Date(range.start.getTime() - duration),
      end: new Date(range.start.getTime() - 1),
    };
  }, [range]);

  const filtered = useMemo(() => bookings.filter((booking) => inRange(booking, range)), [bookings, range]);
  const previousTotal = useMemo(
    () => bookings.filter((booking) => inRange(booking, previousRange)).length,
    [bookings, previousRange]
  );

  const analytics = useMemo(() => {
    const roomTotals = new Map(rooms.map((room) => [room.id, { id: room.id, name: room.name, count: 0 }]));
    const statuses = Object.fromEntries(STATUS_CONFIG.map(({ key }) => [key, 0]));
    let accommodation = 0;

    filtered.forEach((booking) => {
      const room = roomTotals.get(booking.room_id) || {
        id: booking.room_id,
        name: booking.room_name || "Ruang tidak diketahui",
        count: 0,
      };
      room.count += 1;
      roomTotals.set(booking.room_id, room);
      if (hasAccommodation(booking)) accommodation += 1;
      statuses[bookingStatusKey(booking)] += 1;
    });

    const roomRanking = [...roomTotals.values()]
      .filter((room) => room.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      roomRanking,
      statuses,
      accommodation,
      withoutAccommodation: filtered.length - accommodation,
    };
  }, [filtered, rooms]);

  const delta = previousTotal ? Math.round(((filtered.length - previousTotal) / previousTotal) * 100) : null;
  const maxRoomCount = analytics.roomRanking[0]?.count || 1;
  const accommodationRate = percent(analytics.accommodation, filtered.length);
  const periodLabel = {
    week: "Minggu Ini",
    month: "Bulan Ini",
    quarter: "Kuartal Ini",
    custom: customStart && customEnd ? `${customStart} s.d. ${customEnd}` : "Custom Range",
  }[period];

  const downloadExcel = () => {
    const rows = [
      ["Kode", "Tanggal", "Waktu", "Ruangan", "Pemohon", "Judul", "Peserta", "Akomodasi", "Status"],
      ...filtered.map((booking) => [
        booking.id,
        booking.date,
        `${booking.start_time}-${booking.end_time}`,
        booking.room_name,
        booking.user_name,
        booking.title,
        booking.participants,
        hasAccommodation(booking) ? booking.food_beverages : "Tanpa akomodasi",
        bookingStatusKey(booking),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-ruang-rapat-${toDateValue(range.start)}-${toDateValue(range.end)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto max-w-[1280px] pb-8" data-testid="ga-operations-dashboard">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#68726B]">Ringkasan Operasional</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[#202521]">Dashboard</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex overflow-x-auto rounded-lg border border-[#DDE3DE] bg-white p-1 text-xs font-semibold text-[#6D766F]">
            {[
              ["week", "Minggu Ini"],
              ["month", "Bulan Ini"],
              ["quarter", "Kuartal Ini"],
              ["custom", "Custom Range"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`flex min-w-max items-center gap-1.5 rounded-md px-3 py-2 transition ${period === value ? "bg-[#E2F2E8] text-[#13754B]" : "hover:bg-[#F2F5F3]"}`}
              >
                {value === "custom" && <CalendarDays className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={!filtered.length}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#15794F] bg-white px-4 py-2.5 text-xs font-bold text-[#15794F] transition hover:bg-[#EFF8F3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Download Excel
          </button>
        </div>
      </div>

      {period === "custom" && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs">
          <label className="font-semibold text-[#667069]" htmlFor="dashboard-start">Mulai</label>
          <input id="dashboard-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-[#DDE3DE] bg-white px-3 py-2" />
          <label className="font-semibold text-[#667069]" htmlFor="dashboard-end">Selesai</label>
          <input id="dashboard-end" type="date" min={customStart} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-[#DDE3DE] bg-white px-3 py-2" />
        </div>
      )}

      <div className="mt-5 flex border-b border-[#DCE2DE]">
        <button type="button" onClick={() => setActiveTab("meeting")} className={`border-b-2 px-5 py-3 text-sm font-bold ${activeTab === "meeting" ? "border-[#168454] text-[#168454]" : "border-transparent text-[#68726B]"}`}>Ruang Rapat</button>
        <button type="button" onClick={() => setActiveTab("vehicle")} className={`border-b-2 px-5 py-3 text-sm font-bold ${activeTab === "vehicle" ? "border-[#168454] text-[#168454]" : "border-transparent text-[#68726B]"}`}>Kendaraan</button>
      </div>

      {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {activeTab === "vehicle" ? (
        <Panel className="mt-5 p-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F3ED] text-[#15794F]"><Building2 className="h-5 w-5" /></div>
          <h2 className="mt-4 font-display text-lg font-bold text-[#202521]">Dashboard kendaraan tahap berikutnya</h2>
          <p className="mt-2 text-sm text-[#717A74]">Template Ruang Rapat diselesaikan terlebih dahulu. Tab ini sudah disiapkan untuk integrasi data kendaraan.</p>
        </Panel>
      ) : loading ? (
        <div className="mt-5 grid animate-pulse gap-4 md:grid-cols-3"><div className="h-36 rounded-xl bg-slate-200" /><div className="h-36 rounded-xl bg-slate-200" /><div className="h-36 rounded-xl bg-slate-200" /></div>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-[#78817B]">Data periode: <span className="font-bold text-[#354139]">{periodLabel}</span></p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Panel className="p-5">
              <div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Total Booking</p><span className="rounded-md bg-[#E5F3EA] p-2 text-[#168454]"><Building2 className="h-4 w-4" /></span></div>
              <div className="mt-4 flex items-end gap-3"><strong className="font-display text-3xl text-[#242A26]">{filtered.length}</strong>{delta !== null && <span className={`mb-1 rounded px-2 py-1 text-[10px] font-bold ${delta >= 0 ? "bg-[#E1F3E7] text-[#168454]" : "bg-red-50 text-red-600"}`}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% dari periode lalu</span>}</div>
              <p className="mt-3 text-[11px] text-[#808982]">Booking pada periode ini</p>
            </Panel>
            <Panel className="p-5">
              <div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Ruangan Terpopuler</p><span className="rounded-md bg-[#FFF2D9] p-2 text-[#E59A16]"><Star className="h-4 w-4" /></span></div>
              <strong className="mt-4 block truncate font-display text-lg text-[#242A26]">{analytics.roomRanking[0]?.name || "Belum ada data"}</strong>
              <p className="mt-1 text-sm font-bold text-[#168454]">{analytics.roomRanking[0]?.count || 0} Booking</p>
              <p className="mt-3 text-[11px] text-[#808982]">Paling sering digunakan tim</p>
            </Panel>
            <Panel className="flex items-center gap-5 p-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#168454 ${accommodationRate * 3.6}deg, #E6EBE8 0)` }}><div className="grid h-14 w-14 place-items-center rounded-full bg-white text-sm font-extrabold text-[#27302A]">{accommodationRate}%</div></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Rasio Akomodasi</p><p className="mt-2 text-sm font-extrabold text-[#242A26]">{accommodationRate}% pakai akomodasi</p><p className="mt-2 text-[10px] text-[#6F7872]"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#168454]" />Dengan Akomodasi ({analytics.accommodation})</p><p className="mt-1 text-[10px] text-[#6F7872]"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#D9E0DC]" />Tanpa Akomodasi ({analytics.withoutAccommodation})</p></div>
            </Panel>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
            <Panel className="p-6">
              <div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold text-[#242A26]">Booking per Ruangan</h2><span className="text-[10px] text-[#7B847E]">Total Frekuensi</span></div>
              {analytics.roomRanking.length ? <div className="mt-5 space-y-4">{analytics.roomRanking.slice(0, 8).map((room) => <div key={room.id} className="grid grid-cols-[minmax(120px,1fr)_2fr_28px] items-center gap-3"><span className="truncate text-[11px] font-semibold text-[#3D4740]">{room.name}</span><div className="h-2 overflow-hidden rounded-full bg-[#EFF2F0]"><div className="h-full rounded-full bg-[#198657]" style={{ width: `${Math.max(5, (room.count / maxRoomCount) * 100)}%` }} /></div><strong className="text-right text-[11px] text-[#252B27]">{room.count}</strong></div>)}</div> : <EmptyState>Belum ada booking pada periode ini.</EmptyState>}
              <a href="/admin/rooms" className="mt-6 inline-block text-[11px] font-bold text-[#168454] hover:underline">Lihat semua ruangan →</a>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-display text-sm font-bold text-[#242A26]">Jenis Booking: Dengan vs Tanpa Akomodasi</h2>
              {filtered.length ? <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row sm:justify-center"><div className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#198657 ${accommodationRate * 3.6}deg, #E68500 0)` }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><strong className="block font-display text-2xl text-[#252B27]">{filtered.length}</strong><span className="text-[10px] text-[#727B75]">Booking</span></div></div></div><div className="space-y-5 text-xs"><div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#198657]" /><strong>Dengan Akomodasi</strong><p className="ml-5 mt-1 text-[#6D766F]">{analytics.accommodation} Booking &nbsp; ({accommodationRate}%)</p></div><div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#E68500]" /><strong>Tanpa Akomodasi</strong><p className="ml-5 mt-1 text-[#6D766F]">{analytics.withoutAccommodation} Booking &nbsp; ({100 - accommodationRate}%)</p></div></div></div> : <EmptyState>Belum ada booking pada periode ini.</EmptyState>}
            </Panel>
          </div>

          <Panel className="mt-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-sm font-bold text-[#242A26]">Status Approval</h2><p className="mt-1 text-[10px] text-[#7B847E]">Status persetujuan booking ruang rapat pada periode berjalan</p></div><span className="rounded-md bg-[#E1F2E7] px-3 py-1.5 text-[10px] font-bold text-[#168454]">Total: {filtered.length} Pengajuan</span></div>
            <div className="mt-5 flex h-4 overflow-hidden rounded-md bg-[#EEF1EF]">{STATUS_CONFIG.map(({ key, color }) => analytics.statuses[key] > 0 && <div key={key} style={{ width: `${percent(analytics.statuses[key], filtered.length)}%`, backgroundColor: color }} title={`${key}: ${analytics.statuses[key]}`} />)}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{STATUS_CONFIG.map(({ key, label, color }) => <div key={key} className="rounded-lg border border-[#E3E7E4] bg-[#FBFCFB] p-3"><div className="flex items-center gap-2"><span className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} /><div><p className="text-[10px] font-bold text-[#4F5952]">{label}</p><p className="mt-1 text-xs"><strong className="text-[#242A26]">{analytics.statuses[key]}</strong> <span className="text-[#818A84]">{percent(analytics.statuses[key], filtered.length)}%</span></p></div></div></div>)}</div>
          </Panel>
        </>
      )}
    </div>
  );
}
