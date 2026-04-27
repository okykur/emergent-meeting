import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { Plus, Pencil, Trash2, X, Loader2, User as UserIcon, Phone, BadgeCheck } from "lucide-react";

const EMPTY = { name: "", phone: "", license_number: "", notes: "", status: "available" };
const STATUSES = ["available", "assigned", "off_duty"];
const STATUS_COLORS = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  assigned: "bg-violet-50 text-violet-700 border-violet-200",
  off_duty: "bg-slate-100 text-slate-500 border-slate-200",
};

function DriverDialog({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (initial) await api.put(`/drivers/${initial.id}`, form);
      else await api.post("/drivers", form);
      onSaved?.();
    } catch (err) { setError(formatApiError(err)); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="driver-dialog">
      <div className="w-full max-w-md rounded-sm border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-display text-xl font-semibold text-slate-900">{initial ? "Edit driver" : "Add driver"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5" data-testid="driver-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
            <input required data-testid="dr-name" value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input data-testid="dr-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">License #</label>
              <input data-testid="dr-license" value={form.license_number} onChange={(e) => set("license_number", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select data-testid="dr-status" value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={2} data-testid="dr-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]" />
          </div>
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} data-testid="dr-submit" className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDrivers() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/drivers"); setItems(data); }
    catch (e) { setError(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (d) => {
    if (!window.confirm(`Remove driver "${d.name}"?`)) return;
    try { await api.delete(`/drivers/${d.id}`); await load(); } catch (e) { alert(formatApiError(e)); }
  };

  return (
    <div data-testid="admin-drivers-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Master Data</div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Drivers</h1>
          <p className="mt-2 text-sm text-slate-500">Manage driver roster and assignment availability.</p>
        </div>
        <button onClick={() => setEditing("new")} data-testid="add-driver-btn" className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]">
          <Plus className="h-4 w-4" /> Add Driver
        </button>
      </div>
      {error && <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <div key={d.id} data-testid={`driver-card-${d.id}`} className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold uppercase text-white">
                  {d.name?.[0] || "D"}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.license_number || "No license #"}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${STATUS_COLORS[d.status] || ""}`}>
                {d.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              {d.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" /> {d.phone}</div>}
              {d.license_number && <div className="flex items-center gap-2"><BadgeCheck className="h-3 w-3 text-slate-400" /> {d.license_number}</div>}
            </div>
            {d.notes && <p className="mt-3 line-clamp-2 text-xs text-slate-500">{d.notes}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditing(d)} data-testid={`edit-driver-${d.id}`} className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Pencil className="mr-1 inline h-3 w-3" /> Edit
              </button>
              <button onClick={() => remove(d)} data-testid={`delete-driver-${d.id}`} className="rounded-sm border border-slate-300 p-1.5 text-red-600 hover:border-red-300 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <DriverDialog initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      )}
    </div>
  );
}
