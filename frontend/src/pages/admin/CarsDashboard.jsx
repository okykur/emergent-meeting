import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, Download, Star } from "lucide-react";
import { api, formatApiError } from "../../api";

const STATUS_CONFIG = [
  { key: "approved", label: "Approved", color: "#168454" },
  { key: "completed", label: "Completed", color: "#164C3B" },
  { key: "pending", label: "Pending", color: "#E68500" },
  { key: "rejected", label: "Rejected", color: "#E0343C" },
  { key: "cancelled", label: "Cancelled", color: "#98A2B3" },
];

const ASSIGNMENT_CONFIG = [
  { key: "vehicle_driver", label: "Kendaraan + Driver", color: "#168454" },
  { key: "vehicle_only", label: "Kendaraan Tanpa Driver", color: "#2E7C64" },
  { key: "driver_only", label: "Driver, Kendaraan Menunggu", color: "#E68500" },
  { key: "unassigned", label: "Menunggu Assignment", color: "#193E32" },
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

export function vehiclePeriodRange(mode, customStart = "", customEnd = "", now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start;
  if (mode === "week") start = startOfWeek(now);
  else if (mode === "quarter") start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  else if (mode === "custom" && customStart && customEnd) {
    return { start: new Date(`${customStart}T00:00:00`), end: new Date(`${customEnd}T23:59:59`) };
  } else start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end };
}

const inRange = (booking, range) => {
  const date = new Date(`${booking.start_date}T00:00:00`);
  return date >= range.start && date <= range.end;
};

const percent = (value, total) => (total ? Math.round((value / total) * 100) : 0);

export const groupedVehicleStatus = (status) => {
  if (["approved", "assigned", "in_use"].includes(status)) return "approved";
  return STATUS_CONFIG.some((item) => item.key === status) ? status : "cancelled";
};

export const vehicleAssignmentKey = (booking) => {
  if (booking.vehicle_id && booking.driver_id) return "vehicle_driver";
  if (booking.vehicle_id && !booking.with_driver) return "vehicle_only";
  if (!booking.vehicle_id && booking.driver_id) return "driver_only";
  return "unassigned";
};

function Panel({ children, className = "" }) {
  return <section className={`rounded-xl border border-[#E0E5E1] bg-white ${className}`}>{children}</section>;
}

function EmptyState({ children }) {
  return <div className="flex min-h-32 items-center justify-center text-sm text-[#7B847E]">{children}</div>;
}

export default function AdminCarsDashboard({ dashboardTabs = null }) {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/vehicle-bookings"), api.get("/vehicles")])
      .then(([bookingResponse, vehicleResponse]) => {
        if (!active) return;
        setBookings(bookingResponse.data || []);
        setVehicles(vehicleResponse.data || []);
      })
      .catch((requestError) => active && setError(formatApiError(requestError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const range = useMemo(() => vehiclePeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const previousRange = useMemo(() => {
    const duration = range.end.getTime() - range.start.getTime() + 1;
    return { start: new Date(range.start.getTime() - duration), end: new Date(range.start.getTime() - 1) };
  }, [range]);
  const filtered = useMemo(() => bookings.filter((booking) => inRange(booking, range)), [bookings, range]);
  const previousTotal = useMemo(() => bookings.filter((booking) => inRange(booking, previousRange)).length, [bookings, previousRange]);

  const analytics = useMemo(() => {
    const vehicleTotals = new Map(vehicles.map((vehicle) => [vehicle.id, { id: vehicle.id, name: vehicle.name, plate: vehicle.plate_number, count: 0 }]));
    const statuses = Object.fromEntries(STATUS_CONFIG.map(({ key }) => [key, 0]));
    const assignments = Object.fromEntries(ASSIGNMENT_CONFIG.map(({ key }) => [key, 0]));
    const services = { dalam_kota: 0, luar_kota: 0 };

    filtered.forEach((booking) => {
      statuses[groupedVehicleStatus(booking.status)] += 1;
      assignments[vehicleAssignmentKey(booking)] += 1;
      services[booking.service_type === "luar_kota" ? "luar_kota" : "dalam_kota"] += 1;
      if (booking.vehicle_id) {
        const vehicle = vehicleTotals.get(booking.vehicle_id) || { id: booking.vehicle_id, name: booking.vehicle_name || "Kendaraan tidak diketahui", plate: booking.vehicle_plate || "-", count: 0 };
        vehicle.count += 1;
        vehicleTotals.set(booking.vehicle_id, vehicle);
      }
    });

    return {
      statuses,
      assignments,
      services,
      vehicleRanking: [...vehicleTotals.values()].filter((vehicle) => vehicle.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }, [filtered, vehicles]);

  const delta = previousTotal ? Math.round(((filtered.length - previousTotal) / previousTotal) * 100) : null;
  const cityRate = percent(analytics.services.dalam_kota, filtered.length);
  const maxVehicleCount = analytics.vehicleRanking[0]?.count || 1;
  const assignmentSegments = ASSIGNMENT_CONFIG.map((item) => ({ ...item, value: analytics.assignments[item.key] }));
  let assignmentDegrees = 0;
  const assignmentGradient = filtered.length
    ? `conic-gradient(${assignmentSegments.map((segment) => {
        const start = assignmentDegrees;
        assignmentDegrees += (segment.value / filtered.length) * 360;
        return `${segment.color} ${start}deg ${assignmentDegrees}deg`;
      }).join(", ")})`
    : "#E7ECE9";
  const periodLabel = { week: "Minggu Ini", month: "Bulan Ini", quarter: "Kuartal Ini", custom: customStart && customEnd ? `${customStart} s.d. ${customEnd}` : "Custom Range" }[period];

  const downloadExcel = () => {
    const rows = [
      ["Kode", "Tanggal Mulai", "Tanggal Selesai", "Pemohon", "Tujuan", "Layanan", "Kendaraan", "Driver", "Status"],
      ...filtered.map((booking) => [booking.booking_number || booking.id, `${booking.start_date} ${booking.start_time}`, `${booking.end_date} ${booking.end_time}`, booking.employee_name, booking.purpose, booking.service_type === "luar_kota" ? "Luar Kota" : "Dalam Kota", booking.vehicle_name || "Belum di-assign", booking.driver_name || (booking.with_driver ? "Belum di-assign" : "Tanpa driver"), groupedVehicleStatus(booking.status)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-kendaraan-${toDateValue(range.start)}-${toDateValue(range.end)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto max-w-[1280px] pb-8" data-testid="admin-cars-dashboard">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#68726B]">Ringkasan Operasional</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[#202521]">Dashboard</h1></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex overflow-x-auto rounded-lg border border-[#DDE3DE] bg-white p-1 text-xs font-semibold text-[#6D766F]">{[["week", "Minggu Ini"], ["month", "Bulan Ini"], ["quarter", "Kuartal Ini"], ["custom", "Custom Range"]].map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`flex min-w-max items-center gap-1.5 rounded-md px-3 py-2 transition ${period === value ? "bg-[#E2F2E8] text-[#13754B]" : "hover:bg-[#F2F5F3]"}`}>{value === "custom" && <CalendarDays className="h-3.5 w-3.5" />}{label}</button>)}</div>
          <button type="button" onClick={downloadExcel} disabled={!filtered.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#15794F] bg-white px-4 py-2.5 text-xs font-bold text-[#15794F] transition hover:bg-[#EFF8F3] disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> Download Excel</button>
        </div>
      </div>

      {period === "custom" && <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs"><label className="font-semibold text-[#667069]" htmlFor="vehicle-dashboard-start">Mulai</label><input id="vehicle-dashboard-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-[#DDE3DE] bg-white px-3 py-2" /><label className="font-semibold text-[#667069]" htmlFor="vehicle-dashboard-end">Selesai</label><input id="vehicle-dashboard-end" type="date" min={customStart} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-[#DDE3DE] bg-white px-3 py-2" /></div>}

      {dashboardTabs}
      {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? <div className="mt-5 grid animate-pulse gap-4 md:grid-cols-3"><div className="h-36 rounded-xl bg-slate-200" /><div className="h-36 rounded-xl bg-slate-200" /><div className="h-36 rounded-xl bg-slate-200" /></div> : <>
        <p className="mt-4 text-xs font-medium text-[#78817B]">Data periode: <span className="font-bold text-[#354139]">{periodLabel}</span></p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Panel className="p-5"><div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Total Booking</p><span className="rounded-md bg-[#E5F3EA] p-2 text-[#168454]"><Car className="h-4 w-4" /></span></div><div className="mt-4 flex items-end gap-3"><strong className="font-display text-3xl text-[#242A26]">{filtered.length}</strong>{delta !== null && <span className={`mb-1 rounded px-2 py-1 text-[10px] font-bold ${delta >= 0 ? "bg-[#E1F3E7] text-[#168454]" : "bg-red-50 text-red-600"}`}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% dari periode lalu</span>}</div><p className="mt-3 text-[11px] text-[#808982]">Booking pada periode ini</p></Panel>
          <Panel className="p-5"><div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Kendaraan Terpopuler</p><span className="rounded-md bg-[#FFF2D9] p-2 text-[#E59A16]"><Star className="h-4 w-4" /></span></div><strong className="mt-4 block truncate font-display text-lg text-[#242A26]">{analytics.vehicleRanking[0]?.name || "Belum ada data"}</strong><p className="mt-1 text-xs font-bold text-[#168454]">{analytics.vehicleRanking[0]?.plate || "-"} · {analytics.vehicleRanking[0]?.count || 0} Perjalanan</p><p className="mt-3 text-[11px] text-[#808982]">Paling sering digunakan</p></Panel>
          <Panel className="flex items-center gap-5 p-5"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#168454 ${cityRate * 3.6}deg, #E7ECE9 0)` }}><div className="grid h-14 w-14 place-items-center rounded-full bg-white text-sm font-extrabold text-[#27302A]">{cityRate}%</div></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-[#5F6962]">Rasio Jenis Layanan</p><p className="mt-2 text-sm font-extrabold text-[#242A26]">{cityRate}% Dalam Kota</p><p className="mt-2 text-[10px] text-[#6F7872]"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#168454]" />Dalam Kota ({analytics.services.dalam_kota})</p><p className="mt-1 text-[10px] text-[#6F7872]"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#D9E0DC]" />Luar Kota ({analytics.services.luar_kota})</p></div></Panel>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Panel className="p-6"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold text-[#242A26]">Booking per Jenis Kendaraan</h2><span className="text-[10px] text-[#7B847E]">Total Frekuensi</span></div>{analytics.vehicleRanking.length ? <div className="mt-5 space-y-4">{analytics.vehicleRanking.slice(0, 8).map((vehicle) => <div key={vehicle.id} className="grid grid-cols-[minmax(120px,1fr)_2fr_28px] items-center gap-3"><span className="truncate text-[11px] font-semibold text-[#3D4740]">{vehicle.name}</span><div className="h-2 overflow-hidden rounded-full bg-[#EFF2F0]"><div className="h-full rounded-full bg-[#198657]" style={{ width: `${Math.max(5, (vehicle.count / maxVehicleCount) * 100)}%` }} /></div><strong className="text-right text-[11px] text-[#252B27]">{vehicle.count}</strong></div>)}</div> : <EmptyState>Belum ada kendaraan yang di-assign pada periode ini.</EmptyState>}<a href="/admin/cars/vehicles" className="mt-6 inline-block text-[11px] font-bold text-[#168454] hover:underline">Lihat semua kendaraan →</a></Panel>
          <Panel className="p-6"><h2 className="font-display text-sm font-bold text-[#242A26]">Jenis Booking (Driver + Kendaraan)</h2>{filtered.length ? <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row sm:justify-center"><div className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: assignmentGradient }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><strong className="block font-display text-2xl text-[#252B27]">{filtered.length}</strong><span className="text-[10px] text-[#727B75]">Booking</span></div></div></div><div className="space-y-3 text-[11px]">{assignmentSegments.map((segment) => <div key={segment.key}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} /><strong>{segment.label}</strong><p className="ml-5 mt-0.5 text-[#6D766F]">{segment.value} Booking ({percent(segment.value, filtered.length)}%)</p></div>)}</div></div> : <EmptyState>Belum ada booking pada periode ini.</EmptyState>}</Panel>
        </div>

        <Panel className="mt-5 p-6"><h2 className="font-display text-sm font-bold text-[#242A26]">Jenis Layanan (Dalam Kota vs Luar Kota)</h2><div className="mt-5 space-y-5">{[["Dalam Kota", analytics.services.dalam_kota, "#168454"], ["Luar Kota", analytics.services.luar_kota, "#E68500"]].map(([label, value, color]) => <div key={label}><div className="mb-2 flex justify-between text-[11px]"><strong className="text-[#3C463F]">{label}</strong><span className="font-bold" style={{ color }}>{value} Booking ({percent(value, filtered.length)}%)</span></div><div className="h-3 overflow-hidden rounded-full bg-[#EFF2F0]"><div className="h-full rounded-full" style={{ width: `${percent(value, filtered.length)}%`, backgroundColor: color }} /></div></div>)}</div></Panel>

        <Panel className="mt-5 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-sm font-bold text-[#242A26]">Status Approval</h2><p className="mt-1 text-[10px] text-[#7B847E]">Status persetujuan booking kendaraan pada periode terpilih</p></div><span className="rounded-md bg-[#E1F2E7] px-3 py-1.5 text-[10px] font-bold text-[#168454]">Total: {filtered.length} Pengajuan</span></div><div className="mt-5 flex h-4 overflow-hidden rounded-md bg-[#EEF1EF]">{STATUS_CONFIG.map(({ key, color }) => analytics.statuses[key] > 0 && <div key={key} style={{ width: `${percent(analytics.statuses[key], filtered.length)}%`, backgroundColor: color }} title={`${key}: ${analytics.statuses[key]}`} />)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{STATUS_CONFIG.map(({ key, label, color }) => <div key={key} className="rounded-lg border border-[#E3E7E4] bg-[#FBFCFB] p-3"><div className="flex items-center gap-2"><span className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} /><div><p className="text-[10px] font-bold text-[#4F5952]">{label}</p><p className="mt-1 text-xs"><strong className="text-[#242A26]">{analytics.statuses[key]}</strong> <span className="text-[#818A84]">{percent(analytics.statuses[key], filtered.length)}%</span></p></div></div></div>)}</div></Panel>
      </>}
    </div>
  );
}
