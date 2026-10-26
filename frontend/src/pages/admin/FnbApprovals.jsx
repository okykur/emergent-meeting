import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarDays, CircleCheckBig, Clock3, Eye, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "../../api";
import ManagerMeetingDetail from "../../components/ManagerMeetingDetail";
import { StatusPill } from "../../components/Status";
import { useAuth } from "../../context/AuthContext";
import { isActiveManagerApproval, isActiveManagerUserApproval } from "../../utils/managerApproval";

function formatApprovalDate(date) {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function bookingCode(booking) {
  return booking.booking_number || booking.booking_code || booking.code || booking.id;
}

function accommodationItems(booking) {
  const items = [];
  if (booking.snack_type) items.push(booking.snack_type);
  if ((booking.meal_types || []).length) items.push(...booking.meal_types);
  if (!items.length && booking.food_beverages) {
    items.push(...booking.food_beverages.split(/\s*(?:,|\+|&)\s*/).filter(Boolean));
  }
  return [...new Set(items)];
}

function UserInitials({ name }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcece4] text-[10px] font-bold text-[#184b37]" aria-hidden="true">
      {initials}
    </span>
  );
}

function ApprovalTable({ bookings, loading, onDetail }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce4df] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
          <thead className="border-b border-[#dce4df] bg-[#fbfcfb] text-[10px] font-bold uppercase tracking-wide text-[#5f6c65]">
            <tr>
              <th className="w-[13%] px-6 py-4">Kode</th>
              <th className="w-[20%] px-6 py-4">User</th>
              <th className="w-[20%] px-6 py-4">Ruang &amp; Lokasi</th>
              <th className="w-[17%] px-6 py-4">Jadwal</th>
              <th className="w-[11%] px-6 py-4">Peserta</th>
              <th className="w-[13%] px-6 py-4">Akomodasi</th>
              <th className="w-[6%] px-4 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8e4] text-[#202823]">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-14 text-center text-sm text-slate-500">Memuat daftar persetujuan...</td></tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <div className="font-semibold text-[#253b32]">Tidak ada persetujuan aktif</div>
                  <div className="mt-1 text-xs text-slate-500">Semua booking telah selesai diverifikasi.</div>
                </td>
              </tr>
            ) : bookings.map((booking) => {
              const accommodations = accommodationItems(booking);
              return (
                <tr key={booking.id} data-testid={`manager-meeting-row-${booking.id}`} className="transition-colors hover:bg-[#f7faf8]">
                  <td className="px-6 py-4 align-middle">
                    <span title={bookingCode(booking)} className="block truncate font-mono text-xs font-bold tracking-wide text-[#29352f]">{bookingCode(booking)}</span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <UserInitials name={booking.user_name} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[#1f2e27]">{booking.user_name}</div>
                        <div className="mt-0.5 truncate text-[10px] text-[#6d7872]">{booking.fnb_department || booking.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="truncate text-xs font-semibold text-[#25312b]">{booking.room_name}</div>
                    <span className="mt-1 inline-flex rounded bg-[#e7f3ec] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#178153]">{booking.room_building || "Unassigned"}</span>
                  </td>
                  <td className="px-6 py-4 align-middle text-xs leading-relaxed text-[#34433c]">
                    <div>{formatApprovalDate(booking.date)}</div>
                    <div>{booking.start_time} – {booking.end_time}</div>
                  </td>
                  <td className="px-6 py-4 align-middle text-xs text-[#34433c]">{booking.participants} Orang</td>
                  <td className="px-6 py-4 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      {accommodations.length ? accommodations.map((item) => (
                        <span key={item} className="rounded-md border border-[#279469] bg-[#f2fbf6] px-2 py-1 text-[9px] font-semibold text-[#16754f]">{item}</span>
                      )) : <span className="text-xs text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center align-middle">
                    <button type="button" onClick={() => onDetail(booking)} aria-label={`Lihat detail ${bookingCode(booking)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#25362e] transition-colors hover:bg-[#e5f1ea] focus:outline-none focus:ring-2 focus:ring-[#237650]/30">
                      <Eye className="h-[18px] w-[18px]" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalFlowTag({ status }) {
  const config = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    waiting: "border-slate-200 bg-slate-50 text-slate-600",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${config[status] || config.pending}`}>
      {status || "pending"}
    </span>
  );
}

function ManagerUserApprovalPage({ bookings, loading, error, onDetail }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const pendingBookings = bookings.filter(isActiveManagerUserApproval);
  const visibleBookings = pendingBookings.filter((booking) => {
    if (!normalizedQuery) return true;
    return [bookingCode(booking), booking.user_name, booking.user_email, booking.title, booking.room_name]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("id-ID").includes(normalizedQuery));
  });
  const approvedCount = bookings.filter((booking) => booking.manager_user_approval_status === "approved").length;

  return (
    <div data-testid="manager-user-approval-page" className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#238B57]">Approval Ruang Rapat</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#202521] sm:text-4xl">Persetujuan Meeting</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6D766F]">Review permintaan meeting yang ditugaskan oleh Admin Meeting kepada Anda.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[350px]">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700"><Clock3 className="h-4 w-4" /> Perlu Review</div>
            <div className="mt-1 text-2xl font-bold text-[#202521]">{pendingBookings.length}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700"><CircleCheckBig className="h-4 w-4" /> Disetujui</div>
            <div className="mt-1 text-2xl font-bold text-[#202521]">{approvedCount}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#DCE3DE] bg-white p-4 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="manager-user-bookings-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Booking ID, nama, email, agenda, atau ruangan..."
            className="w-full rounded-lg border border-[#DCE3DE] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/15"
          />
        </div>
      </div>

      {error && <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#DCE3DE] bg-white shadow-sm">
        <table className="w-full min-w-[1520px] text-sm">
          <thead className="bg-[#F3F6F4] text-[11px] font-bold uppercase tracking-wider text-[#68736B]">
            <tr>
              <th className="px-5 py-4 text-left">Booking ID</th>
              <th className="px-5 py-4 text-left">Pemohon</th>
              <th className="px-5 py-4 text-left">Alur Approval</th>
              <th className="px-5 py-4 text-left">Ruang / Gedung</th>
              <th className="px-5 py-4 text-left">Agenda</th>
              <th className="px-5 py-4 text-left">Tanggal</th>
              <th className="px-5 py-4 text-left">Waktu</th>
              <th className="px-5 py-4 text-left">Peserta</th>
              <th className="w-[150px] min-w-[150px] px-5 py-4 text-left">Status</th>
              <th className="sticky right-0 z-20 w-[150px] min-w-[150px] border-l border-[#DCE3DE] bg-[#F3F6F4] px-5 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">Memuat daftar persetujuan...</td></tr>
            ) : visibleBookings.length === 0 ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada booking yang perlu direview.</td></tr>
            ) : visibleBookings.map((booking) => (
              <tr key={booking.id} data-testid={`manager-meeting-row-${booking.id}`} className="group border-t border-[#E5EAE7] hover:bg-[#FAFCFA]">
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-bold text-[#0B4935]">{bookingCode(booking)}</td>
                <td className="px-5 py-4"><div className="font-medium text-slate-900">{booking.user_name}</div><div className="text-xs text-slate-500">{booking.user_email}</div></td>
                <td className="px-5 py-4"><div className="space-y-1.5"><div className="text-[10px] font-semibold text-slate-500">Admin</div><ApprovalFlowTag status={booking.meeting_admin_approval_status} /><div className="text-[10px] font-semibold text-slate-500">Manager User</div><ApprovalFlowTag status={booking.manager_user_approval_status} />{booking.approval_require_manager_ga && <><div className="text-[10px] font-semibold text-slate-500">Manager GA</div><ApprovalFlowTag status={booking.manager_ga_approval_status} /></>}</div></td>
                <td className="px-5 py-4 text-slate-700"><div>{booking.room_name}</div><div className="text-xs font-semibold uppercase tracking-wider text-[#0B7A4B]">{booking.room_building || "Unassigned"}</div></td>
                <td className="px-5 py-4 text-slate-700"><div>{booking.title}</div>{booking.food_beverages && <div className="mt-1 max-w-xs text-xs text-slate-500">F&amp;B: {booking.food_beverages}</div>}</td>
                <td className="px-5 py-4 text-slate-700">{formatApprovalDate(booking.date)}</td>
                <td className="px-5 py-4 text-slate-700">{booking.start_time}–{booking.end_time}</td>
                <td className="px-5 py-4 text-slate-700">{booking.participants}</td>
                <td className="w-[150px] min-w-[150px] whitespace-nowrap px-5 py-4 pr-8"><StatusPill status={booking.status} /></td>
                <td className="sticky right-0 z-10 w-[150px] min-w-[150px] border-l border-[#E5EAE7] bg-white px-5 py-4 group-hover:bg-[#FAFCFA]"><div className="flex justify-end"><button type="button" onClick={() => onDetail(booking)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#238B57] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#176E43]"><CalendarCheck2 className="h-3.5 w-3.5" /> Review</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminFnbApprovals() {
  const { user } = useAuth();
  const managerUserMode = user?.role === "manager_user";
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dialogMode, setDialogMode] = useState("detail");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(managerUserMode ? "/manager-user/bookings" : "/fnb/bookings");
      setBookings(data);
      setSelectedBooking((current) => current ? data.find((booking) => booking.id === current.id) || null : null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [managerUserMode]);

  useEffect(() => { load(); }, [load]);

  const activeBookings = useMemo(
    () => bookings.filter(managerUserMode ? isActiveManagerUserApproval : isActiveManagerApproval),
    [bookings, managerUserMode],
  );

  const openBooking = (booking, mode = "detail") => {
    setDialogMode(mode);
    setSelectedBooking(booking);
  };

  const updateStatus = async (id, nextStatus, kind, reason = "") => {
    try {
      const payload = { status: nextStatus };
      if (reason) payload.reason = reason;
      const endpoint = managerUserMode ? `/manager-user/bookings/${id}/status` : `/fnb/bookings/${id}/${kind}`;
      const { data } = await api.patch(endpoint, payload);
      const approved = nextStatus === "confirmed" || nextStatus === "approved";
      const rejected = nextStatus === "cancelled" || nextStatus === "rejected";
      setBookings((current) => current.map((booking) => booking.id === id ? data : booking));
      setSelectedBooking(null);
      if (approved) toast.success("Booking berhasil disetujui", {
        position: "top-center",
        duration: 4000,
        style: { background: "#1b8052", color: "#fff", border: "none", borderRadius: "999px", width: "fit-content", margin: "0 auto" },
      });
      if (rejected) toast.error("Booking berhasil ditolak", {
        position: "top-center",
        duration: 4000,
        style: { background: "#cf3034", color: "#fff", border: "none", borderRadius: "999px", width: "fit-content", margin: "0 auto" },
      });
      await load();
      return true;
    } catch (err) {
      toast.error(formatApiError(err), { position: "top-center" });
      return false;
    }
  };

  const updateFnbStatus = (id, nextStatus, reason) => updateStatus(id, nextStatus, "status", reason);

  if (managerUserMode) {
    return (
      <>
        <ManagerUserApprovalPage bookings={bookings} loading={loading} error={error} onDetail={openBooking} />
        {selectedBooking && (
          <ManagerMeetingDetail
            key={selectedBooking.id}
            booking={selectedBooking}
            approvalStage="manager_user"
            initialConfirm={dialogMode === "approve"}
            initialReject={dialogMode === "reject"}
            onClose={() => setSelectedBooking(null)}
            onUpdateFnb={updateFnbStatus}
          />
        )}
      </>
    );
  }

  return (
    <div data-testid="manager-approval-page">
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen border-b border-[#dceae2] bg-[#eef8f2]">
        <div className="mx-auto flex min-h-14 max-w-[1400px] items-center justify-between gap-4 px-4 py-3 text-xs md:px-8">
          <p className="font-semibold text-[#174a37]">{managerUserMode ? "Persetujuan Manager User" : "Persetujuan akhir aktif"} – {activeBookings.length} booking menunggu verifikasi.</p>
          <Link to="/admin/calendar" className="inline-flex shrink-0 items-center gap-1.5 font-bold text-[#174a37] underline decoration-[#174a37]/50 underline-offset-2 hover:text-[#0b7a4b]">
            <CalendarDays className="h-3.5 w-3.5" /> Lihat Kalender Rapat
          </Link>
        </div>
      </div>

      <header className="mb-8 mt-14">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6b7771]">{managerUserMode ? "Manager User Verification" : "Final Verification"}</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#202823] sm:text-4xl">{managerUserMode ? "Approval Manager User" : "Approval Manager GA – Persetujuan Akhir"}</h1>
        <p className="mt-2 text-sm text-[#69756f]">{managerUserMode ? "Persetujuan pengajuan meeting yang ditugaskan oleh Admin Meeting kepada Anda." : "Langkah final persetujuan ruangan dan akomodasi makanan untuk departemen internal."}</p>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <ApprovalTable bookings={activeBookings} loading={loading} onDetail={openBooking} />

      {selectedBooking && (
        <ManagerMeetingDetail
          key={selectedBooking.id}
          booking={selectedBooking}
          approvalStage={managerUserMode ? "manager_user" : "manager_ga"}
          initialConfirm={dialogMode === "approve"}
          initialReject={dialogMode === "reject"}
          onClose={() => setSelectedBooking(null)}
          onUpdateFnb={updateFnbStatus}
        />
      )}
    </div>
  );
}
