import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { VBStatusPill, FUEL_LEVELS } from "../../components/VehicleStatus";
import { ArrowLeft, Loader2, Check, X, Car as CarIcon, AlertTriangle, LogIn, LogOut } from "lucide-react";
import { formatDate } from "../../utils/dates";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{children || <span className="text-slate-400">—</span>}</div>
    </div>
  );
}

function AssignDialog({ booking, onClose, onSaved }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [pickup, setPickup] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: v }, { data: d }] = await Promise.all([api.get("/vehicles"), api.get("/drivers")]);
        setVehicles(v.filter((x) => x.status !== "retired"));
        setDrivers(d);
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!vehicleId) {
      setError("Please select a vehicle.");
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/vehicle-bookings/${booking.id}/assign`, {
        vehicle_id: vehicleId,
        driver_id: booking.with_driver ? driverId || null : null,
        pickup_schedule: pickup || null,
        admin_notes: notes || null,
      });
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="assign-dialog">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-display text-xl font-semibold text-slate-900">Assign vehicle{booking.with_driver ? " & driver" : ""}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="assign-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle *</label>
            <select required data-testid="assign-vehicle-select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]">
              <option value="">— Select vehicle —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} disabled={v.status === "maintenance"}>
                  {v.name} · {v.plate_number} ({v.status})
                </option>
              ))}
            </select>
          </div>
          {booking.with_driver && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Driver</label>
              <select data-testid="assign-driver-select" value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]">
                <option value="">— Select driver —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pickup schedule</label>
            <input data-testid="assign-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. 2026-04-25 07:30 at HQ lobby" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Internal remarks</label>
            <textarea rows={2} data-testid="assign-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} data-testid="assign-submit" className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectDialog({ booking, onClose, onSaved }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) { setError("Please enter rejection reason."); return; }
    setLoading(true);
    try {
      await api.patch(`/vehicle-bookings/${booking.id}/reject`, { rejection_notes: notes });
      onSaved?.();
    } catch (err) { setError(formatApiError(err)); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="reject-dialog">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-display text-xl font-semibold text-slate-900">Reject booking</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="reject-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rejection reason *</label>
            <textarea required rows={3} data-testid="reject-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} data-testid="reject-submit" className="flex items-center gap-2 rounded-sm bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Reject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminConfirmDialog({ booking, scope, onClose, onSaved }) {
  const isReturn = scope === "return";
  const ho = booking.handover || {};
  const ri = booking.return_info || {};
  const [form, setForm] = useState(
    isReturn
      ? {
          odometer_end: ri.odometer_end ?? "",
          fuel_level_end: ri.fuel_level_end || "Full",
          condition_after: ri.condition_after || "",
          photo_url: ri.photo_url || "",
          damage_notes: ri.damage_notes || "",
          signature_name: "",
        }
      : {
          odometer_start: ho.odometer_start ?? "",
          fuel_level_start: ho.fuel_level_start || "Full",
          condition_before: ho.condition_before || "",
          photo_url: ho.photo_url || "",
          signature_name: "",
        }
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isReturn ? `/vehicle-bookings/${booking.id}/return/admin` : `/vehicle-bookings/${booking.id}/handover/admin`;
      const payload = isReturn
        ? { ...form, odometer_end: form.odometer_end !== "" ? Number(form.odometer_end) : null }
        : { ...form, odometer_start: form.odometer_start !== "" ? Number(form.odometer_start) : null };
      await api.post(url, payload);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="admin-confirm-dialog">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-display text-xl font-semibold text-slate-900">
            Confirm {isReturn ? "return" : "handover"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="admin-confirm-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Odometer ({isReturn ? "end" : "start"})</label>
              <input
                type="number"
                min={0}
                value={isReturn ? form.odometer_end : form.odometer_start}
                onChange={(e) => set(isReturn ? "odometer_end" : "odometer_start", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fuel</label>
              <select
                value={isReturn ? form.fuel_level_end : form.fuel_level_start}
                onChange={(e) => set(isReturn ? "fuel_level_end" : "fuel_level_start", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              >
                {FUEL_LEVELS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Condition</label>
            <textarea rows={2} value={isReturn ? form.condition_after : form.condition_before} onChange={(e) => set(isReturn ? "condition_after" : "condition_before", e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {isReturn && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Damage / inspection notes</label>
              <textarea rows={2} value={form.damage_notes} onChange={(e) => set("damage_notes", e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Photo URL</label>
            <input value={form.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Admin signature *</label>
            <input required value={form.signature_name} onChange={(e) => set("signature_name", e.target.value)} placeholder="Type your full name" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCarBookingDetail() {
  const { id } = useParams();
  const [b, setB] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(null); // 'assign' | 'reject' | 'handover' | 'return'

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/vehicle-bookings/${id}`);
      setB(data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const approve = async () => {
    try { await api.patch(`/vehicle-bookings/${id}/approve`); await load(); } catch (e) { alert(formatApiError(e)); }
  };

  if (loading) return <div className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</div>;
  if (error || !b) return <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "Not found"}</div>;

  const canApprove = b.status === "pending";
  const canReject = ["pending", "approved"].includes(b.status);
  const canAssign = ["approved", "assigned"].includes(b.status);
  const canHandover = b.status === "assigned";
  const canReturn = b.status === "in_use";

  return (
    <div data-testid="admin-car-detail-page">
      <Link to="/admin/cars/bookings" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Booking · {b.id.slice(0, 8)}</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{b.purpose}</h1>
          <div className="mt-2"><VBStatusPill status={b.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <button onClick={approve} data-testid="admin-approve-btn" className="inline-flex items-center gap-1 rounded-sm bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <Check className="h-4 w-4" /> Approve
            </button>
          )}
          {canReject && (
            <button onClick={() => setDlg("reject")} data-testid="admin-reject-btn" className="inline-flex items-center gap-1 rounded-sm bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <X className="h-4 w-4" /> Reject
            </button>
          )}
          {canAssign && (
            <button onClick={() => setDlg("assign")} data-testid="admin-assign-btn" className="inline-flex items-center gap-1 rounded-sm bg-[#0055FF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]">
              <CarIcon className="h-4 w-4" /> {b.vehicle_id ? "Re-assign" : "Assign vehicle"}
            </button>
          )}
          {canHandover && b.handover?.user_confirmed_at && (
            <button onClick={() => setDlg("handover")} data-testid="admin-handover-btn" className="inline-flex items-center gap-1 rounded-sm bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              <LogIn className="h-4 w-4" /> Confirm handover → In use
            </button>
          )}
          {canReturn && b.return_info?.user_confirmed_at && (
            <button onClick={() => setDlg("return")} data-testid="admin-return-btn" className="inline-flex items-center gap-1 rounded-sm bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <LogOut className="h-4 w-4" /> Confirm return → Completed
            </button>
          )}
        </div>
      </div>

      {b.status === "rejected" && b.rejection_notes && (
        <div className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Rejection reason</div>
          <p className="mt-1">{b.rejection_notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 font-display text-base font-semibold text-slate-900">Booking Details</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee">{b.employee_name}</Field>
            <Field label="Job title">{b.job_title}</Field>
            <Field label="Department">{b.department}</Field>
            <Field label="Email">{b.user_email}</Field>
            <Field label="Type">
              {b.booking_type === "single_trip" ? "Single trip" : "Multi-day"} · {b.with_driver ? "with driver" : "self-drive"}
            </Field>
            <Field label="Passengers">{b.passengers}</Field>
            <Field label="Pickup">{b.pickup_location}</Field>
            <Field label="Destination">{b.destination}</Field>
            <Field label="Usage area">{b.usage_area}</Field>
            <Field label="Dates">
              {formatDate(b.start_date)}
              {b.start_date !== b.end_date && ` → ${formatDate(b.end_date)}`}
            </Field>
            <Field label="Times">{b.start_time} – {b.end_time}</Field>
            <Field label="Submitted">{fmt(b.created_at)}</Field>
          </div>
          <div className="mt-4"><Field label="Purpose">{b.purpose}</Field></div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 font-display text-base font-semibold text-slate-900">Assignment</div>
          {b.vehicle_id ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle">{b.vehicle_name}</Field>
              <Field label="Plate">{b.vehicle_plate}</Field>
              <Field label="Driver">{b.driver_name || (b.with_driver ? "Not assigned" : "Self-drive")}</Field>
              <Field label="Pickup schedule">{b.pickup_schedule}</Field>
              <div className="col-span-2"><Field label="Internal remarks">{b.admin_notes}</Field></div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not assigned yet.</p>
          )}
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 font-display text-base font-semibold text-slate-900">Handover</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="User confirmed">{fmt(b.handover?.user_confirmed_at)}</Field>
            <Field label="Admin confirmed">{fmt(b.handover?.admin_confirmed_at)}</Field>
            <Field label="Odometer (start)">{b.handover?.odometer_start != null ? `${b.handover.odometer_start} km` : "—"}</Field>
            <Field label="Fuel (start)">{b.handover?.fuel_level_start}</Field>
            <Field label="Condition before">{b.handover?.condition_before}</Field>
            <Field label="User signature">{b.handover?.user_signature_name}</Field>
            <Field label="Admin signature">{b.handover?.admin_signature_name}</Field>
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 font-display text-base font-semibold text-slate-900">Return</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="User confirmed">{fmt(b.return_info?.user_confirmed_at)}</Field>
            <Field label="Admin confirmed">{fmt(b.return_info?.admin_confirmed_at)}</Field>
            <Field label="Odometer (end)">{b.return_info?.odometer_end != null ? `${b.return_info.odometer_end} km` : "—"}</Field>
            <Field label="Fuel (end)">{b.return_info?.fuel_level_end}</Field>
            <Field label="Condition after">{b.return_info?.condition_after}</Field>
            <Field label="Damage notes">{b.return_info?.damage_notes}</Field>
            <Field label="User signature">{b.return_info?.user_signature_name}</Field>
            <Field label="Admin signature">{b.return_info?.admin_signature_name}</Field>
          </div>
        </div>
      </div>

      {dlg === "assign" && <AssignDialog booking={b} onClose={() => setDlg(null)} onSaved={async () => { setDlg(null); await load(); }} />}
      {dlg === "reject" && <RejectDialog booking={b} onClose={() => setDlg(null)} onSaved={async () => { setDlg(null); await load(); }} />}
      {(dlg === "handover" || dlg === "return") && (
        <AdminConfirmDialog booking={b} scope={dlg} onClose={() => setDlg(null)} onSaved={async () => { setDlg(null); await load(); }} />
      )}
    </div>
  );
}
