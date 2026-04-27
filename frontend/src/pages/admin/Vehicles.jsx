import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { VehicleStatusTag } from "../../components/VehicleStatus";
import { Plus, Pencil, Trash2, X, Loader2, Car as CarIcon, Users as UsersIcon } from "lucide-react";

const EMPTY = {
  plate_number: "",
  name: "",
  type: "Sedan",
  capacity: 4,
  year: 2024,
  notes: "",
  image_url: "",
  status: "available",
};
const TYPES = ["Sedan", "MPV", "SUV", "Hatchback", "Van", "Pickup", "Truck", "Motorcycle"];
const STATUSES = ["available", "booked", "in_use", "maintenance", "retired"];

function VehicleDialog({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity),
        year: form.year ? Number(form.year) : null,
        image_url: form.image_url || null,
      };
      if (initial) await api.put(`/vehicles/${initial.id}`, payload);
      else await api.post("/vehicles", payload);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="vehicle-dialog">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-display text-xl font-semibold text-slate-900">{initial ? "Edit vehicle" : "Add vehicle"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="vehicle-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Plate number *</label>
              <input required data-testid="vh-plate" value={form.plate_number} onChange={(e) => set("plate_number", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name / Model *</label>
              <input required data-testid="vh-name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select data-testid="vh-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Capacity *</label>
              <input type="number" min={1} required data-testid="vh-capacity" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Year</label>
              <input type="number" min={1990} max={2050} data-testid="vh-year" value={form.year || ""} onChange={(e) => set("year", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select data-testid="vh-status" value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Image URL</label>
            <input data-testid="vh-image" value={form.image_url || ""} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={2} data-testid="vh-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} data-testid="vh-submit" className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminVehicles() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/vehicles"); setItems(data); }
    catch (e) { setError(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (v) => {
    if (!window.confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
    try { await api.delete(`/vehicles/${v.id}`); await load(); } catch (e) { alert(formatApiError(e)); }
  };

  return (
    <div data-testid="admin-vehicles-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Master Data</div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Fleet</h1>
          <p className="mt-2 text-sm text-slate-500">Vehicles available for booking, with status & maintenance flags.</p>
        </div>
        <button onClick={() => setEditing("new")} data-testid="add-vehicle-btn" className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]">
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>
      {error && <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <div key={v.id} data-testid={`vehicle-card-${v.id}`} className="flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
            <div className="relative h-32 w-full bg-slate-100">
              {v.image_url ? <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><CarIcon className="h-8 w-8 text-slate-300" /></div>}
              <div className="absolute right-3 top-3"><VehicleStatusTag status={v.status} /></div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">{v.name}</h3>
                  <div className="mt-1 text-xs text-slate-500">{v.type} · {v.year}</div>
                </div>
                <div className="rounded-sm bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  <UsersIcon className="mr-1 inline h-3 w-3" />{v.capacity}
                </div>
              </div>
              <div className="mt-2 inline-block rounded-sm bg-slate-900 px-2 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-white">
                {v.plate_number}
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-500">{v.notes}</p>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <button onClick={() => setEditing(v)} data-testid={`edit-vehicle-${v.id}`} className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Pencil className="mr-1 inline h-3 w-3" /> Edit
                </button>
                <button onClick={() => remove(v)} data-testid={`delete-vehicle-${v.id}`} className="rounded-sm border border-slate-300 p-1.5 text-red-600 hover:border-red-300 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <VehicleDialog initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      )}
    </div>
  );
}
