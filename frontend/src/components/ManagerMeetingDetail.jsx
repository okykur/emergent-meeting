import { useRef, useState } from "react";
import { Check, X, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { formatDate } from "../utils/dates";

export default function ManagerMeetingDetail({ booking, onClose, onUpdateFnb, onUpdateMeeting, initialConfirm = false, initialReject = false }) {
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(initialConfirm);
  const [rejecting, setRejecting] = useState(initialReject);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);
  if (!booking) return null;
  const hasFnb = Boolean(booking.food_beverages?.trim());
  const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
  const duration = toMinutes(booking.end_time) - toMinutes(booking.start_time);
  const validFnb = hasFnb && duration >= (booking.food_beverages.toLowerCase().includes("makan") ? 300 : 240);
  const supervisor = booking.supervisor_approval_status || "approved";
  const roomApproved = ["confirmed", "ongoing", "completed"].includes(booking.status);
  const cancelled = booking.status === "cancelled";
  const fnbStopped = ["rejected", "cancelled"].includes(booking.fnb_status);
  const canMeeting = booking.status === "pending" && supervisor === "approved";
  const canFnb = booking.status === "confirmed" && validFnb && booking.fnb_status === "pending";
  const complete = roomApproved && (!hasFnb || booking.fnb_status === "approved" || booking.fnb_status === "not_required");
  const active = supervisor !== "approved" ? 1 : !roomApproved ? 2 : hasFnb && !complete ? 3 : hasFnb ? 4 : 3;
  const stopped = cancelled || supervisor === "rejected" || fnbStopped;
  const steps = ["Diajukan", "Manager User", "Admin Ruang / GA (Backup)", ...(hasFnb ? ["Manager GA (F&B)"] : []), "Disetujui"];
  const status = supervisor === "rejected" ? "Ditolak oleh atasan" : cancelled ? "Booking dibatalkan / ditolak" : fnbStopped ? `F&B ${booking.fnb_status === "rejected" ? "ditolak" : "dibatalkan"}` : complete ? "Persetujuan selesai" : supervisor !== "approved" ? "Menunggu persetujuan atasan" : !roomApproved ? "Menunggu persetujuan ruang meeting" : !validFnb ? "Request F&B tidak sesuai aturan durasi" : "Menunggu persetujuan F&B Manager GA";
  const decide = async (approved, reason = "") => {
    if (inFlight.current || (!canMeeting && !canFnb)) return;
    inFlight.current = true;
    setSaving(true);
    setActionError("");
    try {
      const success = canMeeting
        ? await onUpdateMeeting(booking.id, approved ? "confirmed" : "cancelled", ...(approved ? [] : [reason]))
        : await onUpdateFnb(booking.id, approved ? "approved" : "rejected", ...(approved ? [] : [reason]));
      if (success === false) setActionError(`${approved ? "Persetujuan" : "Penolakan"} belum tersimpan. Silakan coba lagi.`);
    } catch {
      setActionError(`${approved ? "Persetujuan" : "Penolakan"} belum tersimpan. Silakan coba lagi.`);
    } finally { inFlight.current = false; setSaving(false); }
  };
  const labelClass = "mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500";
  if (rejecting) return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) setRejecting(false); }}>
      <DialogContent data-testid="manager-rejection-confirmation" className="w-[calc(100%-2rem)] max-w-[440px] gap-0 rounded-2xl bg-white p-7 shadow-2xl sm:rounded-2xl [&>button]:hidden" onEscapeKeyDown={(event) => { if (inFlight.current) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogTitle className="break-words text-center text-lg font-bold text-[#272c29]">Tolak pengajuan {booking.id}?</DialogTitle>
        <DialogDescription className="mt-2 text-center text-xs leading-relaxed text-slate-500">Silakan jelaskan alasan dan detail penolakan agar pemohon dapat memperbaiki pengajuannya.</DialogDescription>
        <label htmlFor="manager-rejection-reason" className="mt-6 text-xs font-bold text-slate-700">Alasan penolakan <span className="text-red-600">*</span></label>
        <textarea
          id="manager-rejection-reason"
          autoFocus
          maxLength={500}
          rows={4}
          value={rejectionReason}
          disabled={saving}
          onChange={(event) => { setRejectionReason(event.target.value); setActionError(""); }}
          placeholder="Jelaskan bagian mana yang perlu diperbaiki pemohon..."
          className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-[11px] text-slate-500">
          <p>ⓘ Pemohon akan menerima email berisi alasan ini dan perlu mengajukan booking baru dari awal.</p>
          <span className="shrink-0">{rejectionReason.length}/500</span>
        </div>
        {actionError && <p role="alert" className="mt-3 text-sm text-red-600">{actionError}</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" disabled={saving} onClick={() => { setRejecting(false); setRejectionReason(""); setActionError(""); }} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
          <button type="button" disabled={saving || !rejectionReason.trim() || (!canMeeting && !canFnb)} onClick={() => decide(false, rejectionReason.trim())} className="rounded-xl bg-[#cf3034] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b8272b] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Mengirim…" : "Kirim Penolakan"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
  if (confirming) return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) setConfirming(false); }}>
      <DialogContent data-testid="manager-approval-confirmation" className="w-[calc(100%-2rem)] max-w-[440px] gap-0 rounded-2xl bg-white p-7 text-center shadow-2xl sm:rounded-2xl [&>button]:hidden" onEscapeKeyDown={(event) => { if (inFlight.current) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-amber-500"><TriangleAlert className="h-5 w-5" aria-hidden="true" /></div>
        <DialogTitle className="break-words text-lg font-bold text-[#272c29]">Setujui pengajuan {booking.id}?</DialogTitle>
        <DialogDescription className="mt-3 text-xs leading-relaxed text-slate-500">Tindakan ini tidak dapat dibatalkan setelah disetujui.</DialogDescription>
        <p className="mt-2 text-xs text-slate-500">{canMeeting ? "Persetujuan ruang meeting" : "Persetujuan F&B"}</p>
        {actionError && <p role="alert" className="mt-3 text-sm text-red-600">{actionError}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" autoFocus disabled={saving} onClick={() => { setConfirming(false); setActionError(""); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
          <button type="button" disabled={saving || (!canMeeting && !canFnb)} onClick={() => decide(true)} className="rounded-xl bg-[#1b8052] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#166942] disabled:opacity-50">{saving ? "Menyimpan…" : "Ya, Setujui"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent data-testid="manager-meeting-detail" className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[520px] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 p-6 shadow-2xl [&>button]:rounded-full [&>button]:bg-slate-100 [&>button]:p-2">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5 pr-8">
          <DialogTitle className="break-all font-mono text-sm font-bold text-slate-700">{booking.id}</DialogTitle>
          <span className="rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">{canFnb ? "Persetujuan Terakhir" : canMeeting ? "Persetujuan Ruang" : "Detail Persetujuan"}</span>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800" aria-hidden="true">{(booking.user_name || "?").split(" ").slice(0, 2).map((name) => name[0]).join("")}</div>
            <div className="min-w-0"><h3 className="font-bold text-[#1c4032]">{booking.user_name}</h3><p className="break-words text-xs text-slate-500">{booking.fnb_department || booking.user_email}</p></div>
          </div>
          <DialogDescription className="text-sm font-medium text-slate-700">{booking.title}</DialogDescription>
          <div className="grid grid-cols-1 gap-4 text-sm font-medium text-slate-800 sm:grid-cols-2">
            <div><div className={labelClass}>Ruang & Lokasi</div>{booking.room_name}<span className="ml-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{booking.room_building || "Unassigned"}</span></div>
            <div><div className={labelClass}>Jadwal Pemakaian</div>{formatDate(booking.date)}<div className="text-xs">{booking.start_time} – {booking.end_time} ({Number((duration / 60).toFixed(2))} jam)</div></div>
            <div><div className={labelClass}>Jumlah Peserta</div>{booking.participants} Orang</div>
            <div><div className={labelClass}>Fasilitas & Akomodasi</div><div className="flex flex-wrap gap-1">{[...(booking.additional_facilities || []), ...(hasFnb ? booking.food_beverages.split(",").map((item) => item.trim()).filter(Boolean) : [])].map((item, index) => <span key={index} className="rounded border border-emerald-600/50 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">{item}</span>)}{!hasFnb && !booking.additional_facilities?.length && <span>—</span>}</div></div>
          </div>
          <section className="rounded-xl border border-slate-200 p-3" aria-label="Progress persetujuan">
            <h4 className="mb-3 text-xs font-bold text-[#1c4032]">Progress Persetujuan</h4>
            <ol className="flex">
              {steps.map((step, index) => {
                const done = index < active || complete;
                const current = index === active && !complete;
                return <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                  {index < steps.length - 1 && <span className={`absolute left-1/2 top-3 h-0.5 w-full ${index < active ? "bg-[#24523f]" : "bg-slate-200"}`} />}
                  <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${done ? "border-[#1c4032] bg-[#1c4032] text-white" : current ? stopped ? "border-red-600 bg-red-50 text-red-600" : "border-[#24523f] bg-emerald-100 text-[#24523f]" : "border-slate-100 bg-slate-100 text-slate-400"}`}>{done ? <Check className="h-3 w-3" /> : current && stopped ? <X className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
                  <span className={`mt-2 px-1 text-[9px] leading-tight ${done || current ? "text-[#1c4032]" : "text-slate-400"}`}>{step}</span>
                </li>;
              })}
            </ol>
            <p className={`mt-3 text-[11px] ${stopped ? "text-red-600" : complete ? "text-emerald-700" : "text-amber-600"}`} role="status"><span className="text-slate-500">Status saat ini: </span>{status}</p>
          </section>
          <section className="rounded-xl border border-slate-200 p-4"><h4 className="text-xs font-bold uppercase text-emerald-800">Catatan Pemesanan</h4><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{booking.notes || "Tidak ada catatan."}</p></section>
          {(booking.rejection_reason || booking.fnb_rejection_reason) && <section className="rounded-xl border border-red-200 bg-red-50 p-4"><h4 className="text-xs font-bold uppercase text-red-700">Alasan Penolakan</h4><p className="mt-2 whitespace-pre-wrap text-sm text-red-800">{booking.fnb_rejection_reason || booking.rejection_reason}</p></section>}
          <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-emerald-800">Detail tambahan & konsumsi</summary><dl className="mt-3 grid grid-cols-2 gap-3">{Object.entries({ "Nomor HP": booking.phone_number, Layout: booking.layout_type === "Lainnya" ? booking.layout_other : booking.layout_type, Departemen: booking.fnb_department, Divisi: booking.fnb_division, "Cost Center": booking.fnb_cost_center, "Activity Code": booking.fnb_activity_code, "Activity Name": booking.fnb_activity_name, Tamu: booking.guest_type, Snack: [booking.snack_type, booking.snack_times && `${booking.snack_times} kali`, booking.snack_pax && `${booking.snack_pax} pax`, booking.snack_packaging].filter(Boolean).join(", "), Makan: [...(booking.meal_types || []), booking.meal_pax && `${booking.meal_pax} pax`, booking.meal_packaging].filter(Boolean).join(", ") }).map(([label, value]) => <div key={label}><dt className={labelClass}>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></details>
        </div>
        {actionError && <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p>}
        {(canMeeting || canFnb) && <div className="grid shrink-0 grid-cols-2 gap-3 pt-1"><button disabled={saving} onClick={() => { setActionError(""); setRejecting(true); }} className="rounded-md border border-red-500 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Tolak</button><button disabled={saving} onClick={() => { setActionError(""); setConfirming(true); }} className="rounded-md bg-[#2c6b50] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#20533d] disabled:opacity-50">{saving ? "Menyimpan…" : "Setujui"}</button></div>}
      </DialogContent>
    </Dialog>
  );
}
