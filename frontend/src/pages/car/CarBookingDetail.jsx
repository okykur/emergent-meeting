import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { VBStatusPill, FUEL_LEVELS } from "../../components/VehicleStatus";
import { ArrowLeft, Loader2, LogIn, LogOut, X, AlertTriangle, Car, User as UserIcon } from "lucide-react";
import { formatDate } from "../../utils/dates";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, children, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{children || <span className="text-slate-400">—</span>}</div>
    </div>
  );
}

function HandoverDialog({ booking, scope, onClose, onSaved }) {
  const isReturn = scope === "return";
  const [form, setForm] = useState(
    isReturn
      ? {
          odometer_end: "",
          fuel_level_end: "Full",
          condition_after: "",
          photo_url: "",
          damage_notes: "",
          signature_name: "",
        }
      : {
          odometer_start: "",
          fuel_level_start: "Full",
          condition_before: "",
          photo_url: "",
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
      const url = isReturn
        ? `/vehicle-bookings/${booking.id}/return/user`
        : `/vehicle-bookings/${booking.id}/handover/user`;
      const payload = isReturn
        ? { ...form, odometer_end: Number(form.odometer_end) }
        : { ...form, odometer_start: Number(form.odometer_start) };
      await api.post(url, payload);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="handover-dialog">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {isReturn ? "Vehicle Return" : "Vehicle Handover"}
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {booking.vehicle_name} · {booking.vehicle_plate}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="handover-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Odometer {isReturn ? "end" : "start"} (km) *
              </label>
              <input
                type="number"
                required
                min={0}
                data-testid={`hd-odo-${isReturn ? "end" : "start"}`}
                value={isReturn ? form.odometer_end : form.odometer_start}
                onChange={(e) => set(isReturn ? "odometer_end" : "odometer_start", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fuel level {isReturn ? "after" : "before"}
              </label>
              <select
                data-testid={`hd-fuel-${isReturn ? "end" : "start"}`}
                value={isReturn ? form.fuel_level_end : form.fuel_level_start}
                onChange={(e) => set(isReturn ? "fuel_level_end" : "fuel_level_start", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              >
                {FUEL_LEVELS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Vehicle condition {isReturn ? "after use" : "before use"}
            </label>
            <textarea
              rows={2}
              data-testid="hd-condition"
              value={isReturn ? form.condition_after : form.condition_before}
              onChange={(e) => set(isReturn ? "condition_after" : "condition_before", e.target.value)}
              placeholder={isReturn ? "Cleanliness, scratches, dents…" : "Visual inspection notes…"}
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>
          {isReturn && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Damage / issue notes</label>
              <textarea
                rows={2}
                data-testid="hd-damage"
                value={form.damage_notes}
                onChange={(e) => set("damage_notes", e.target.value)}
                placeholder="Leave blank if no damage"
                className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Photo URL (optional)</label>
            <input
              data-testid="hd-photo"
              value={form.photo_url}
              onChange={(e) => set("photo_url", e.target.value)}
              placeholder="https://…"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
            <p className="mt-1 text-xs text-slate-400">Paste a link to an uploaded handover/return photo.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Digital signature (your full name) *</label>
            <input
              required
              data-testid="hd-signature"
              value={form.signature_name}
              onChange={(e) => set("signature_name", e.target.value)}
              placeholder="Type your full name as acknowledgment"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>
          {error && (
            <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="hd-submit"
              className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isReturn ? "Confirm return" : "Confirm handover"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CarBookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(null); // 'handover' | 'return'

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

  const cancel = async () => {
    if (!window.confirm("Cancel this vehicle booking?")) return;
    try {
      await api.post(`/vehicle-bookings/${id}/cancel`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading booking…
      </div>
    );
  }
  if (error || !b) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "Not found"}</div>
    );
  }

  const isOwner = user?.id === b.user_id;
  const userCanCancel = isOwner && ["pending", "approved", "assigned"].includes(b.status);
  const userCanHandover = isOwner && b.status === "assigned" && !b.handover?.user_confirmed_at;
  const userCanReturn = isOwner && b.status === "in_use" && !b.return_info?.user_confirmed_at;

  return (
    <div data-testid="car-detail-page">
      <Link to="/car/my-bookings" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> My Bookings
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Booking · {b.id.slice(0, 8)}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{b.purpose}</h1>
          <div className="mt-2"><VBStatusPill status={b.status} /></div>
        </div>
        <div className="flex gap-2">
          {userCanHandover && (
            <button
              onClick={() => setDlg("handover")}
              data-testid="user-handover-btn"
              className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
            >
              <LogIn className="h-4 w-4" /> Confirm Handover
            </button>
          )}
          {userCanReturn && (
            <button
              onClick={() => setDlg("return")}
              data-testid="user-return-btn"
              className="inline-flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <LogOut className="h-4 w-4" /> Confirm Return
            </button>
          )}
          {userCanCancel && (
            <button
              onClick={cancel}
              data-testid="user-cancel-btn"
              className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {b.status === "rejected" && b.rejection_notes && (
        <div className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Rejected by Car Admin
          </div>
          <p className="mt-1">{b.rejection_notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Booking info */}
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <UserIcon className="h-4 w-4 text-[#0055FF]" /> Booking Details
          </div>
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
            <Field label="Times">
              {b.start_time} – {b.end_time}
            </Field>
            <Field label="Submitted">{fmt(b.created_at)}</Field>
          </div>
          <div className="mt-4">
            <Field label="Purpose">{b.purpose}</Field>
          </div>
        </div>

        {/* Assignment */}
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Car className="h-4 w-4 text-[#0055FF]" /> Vehicle Assignment
          </div>
          {b.vehicle_id ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle">{b.vehicle_name}</Field>
              <Field label="Plate">{b.vehicle_plate}</Field>
              <Field label="Driver">{b.driver_name || "Self-drive"}</Field>
              <Field label="Pickup schedule">{b.pickup_schedule}</Field>
              <div className="col-span-2"><Field label="Admin notes">{b.admin_notes}</Field></div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No vehicle assigned yet. Once approved, the Car Admin will assign a vehicle and (if requested) a driver.
            </p>
          )}
        </div>

        {/* Handover */}
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <LogIn className="h-4 w-4 text-emerald-600" /> Handover (Pickup)
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="User confirmed">{fmt(b.handover?.user_confirmed_at)}</Field>
            <Field label="Admin confirmed">{fmt(b.handover?.admin_confirmed_at)}</Field>
            <Field label="Odometer (start)">
              {b.handover?.odometer_start != null ? `${b.handover.odometer_start} km` : "—"}
            </Field>
            <Field label="Fuel (start)">{b.handover?.fuel_level_start}</Field>
            <Field label="Condition before">{b.handover?.condition_before}</Field>
            <Field label="User signature">{b.handover?.user_signature_name}</Field>
          </div>
          {b.handover?.photo_url && (
            <a href={b.handover.photo_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#0055FF] hover:underline">
              View handover photo →
            </a>
          )}
        </div>

        {/* Return */}
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <LogOut className="h-4 w-4 text-blue-600" /> Return
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="User confirmed">{fmt(b.return_info?.user_confirmed_at)}</Field>
            <Field label="Admin confirmed">{fmt(b.return_info?.admin_confirmed_at)}</Field>
            <Field label="Odometer (end)">
              {b.return_info?.odometer_end != null ? `${b.return_info.odometer_end} km` : "—"}
            </Field>
            <Field label="Fuel (end)">{b.return_info?.fuel_level_end}</Field>
            <Field label="Condition after">{b.return_info?.condition_after}</Field>
            <Field label="Damage notes">{b.return_info?.damage_notes}</Field>
          </div>
          {b.return_info?.photo_url && (
            <a href={b.return_info.photo_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#0055FF] hover:underline">
              View return photo →
            </a>
          )}
        </div>
      </div>

      {dlg && (
        <HandoverDialog
          booking={b}
          scope={dlg}
          onClose={() => setDlg(null)}
          onSaved={async () => {
            setDlg(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
