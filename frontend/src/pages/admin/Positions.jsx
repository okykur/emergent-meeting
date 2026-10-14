import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api, formatApiError } from "../../api";

const EMPTY_FORM = { code_position: "", position_name: "" };
const inputClass = "w-full rounded-lg border border-[#DCE3DE] bg-white px-3.5 py-2.5 text-sm text-[#26312B] outline-none transition focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/15";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function PositionDialog({ position, onClose, onSaved }) {
  const [form, setForm] = useState(position ? {
    code_position: position.code_position,
    position_name: position.position_name,
  } : EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        code_position: form.code_position.trim().toUpperCase(),
        position_name: form.position_name.trim(),
      };
      if (position) await api.put(`/positions/${position.id}`, payload);
      else await api.post("/positions", payload);
      await onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271F]/70 p-4 backdrop-blur-[1px]" onClick={onClose} data-testid="position-dialog">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#DCE3DE] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E4E9E6] px-6 py-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#238B57]">Master Jabatan</div>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#202622]">{position ? "Edit Jabatan" : "Tambah Jabatan"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#7A857E] hover:bg-[#F1F5F2] hover:text-[#202622]" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6" data-testid="position-form">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#657169]">Code Jabatan *</label>
              <input required maxLength={20} value={form.code_position} onChange={(event) => setForm((current) => ({ ...current, code_position: event.target.value.toUpperCase() }))} placeholder="Contoh: JOB001" className={`${inputClass} font-mono font-bold uppercase`} data-testid="position-code" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#657169]">Nama Jabatan *</label>
              <input required maxLength={240} value={form.position_name} onChange={(event) => setForm((current) => ({ ...current, position_name: event.target.value }))} placeholder="Nama jabatan" className={inputClass} data-testid="position-name" />
            </div>
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 border-t border-[#E4E9E6] pt-5">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#D4DBD6] px-5 py-2.5 text-sm font-bold text-[#536057] hover:bg-[#F5F7F6]">Batal</button>
            <button type="submit" disabled={saving} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-[#238B57] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#176E43] disabled:opacity-60" data-testid="position-submit">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {position ? "Simpan Perubahan" : "Tambah Jabatan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Positions() {
  const [positions, setPositions] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const { data } = await api.get("/positions");
      setPositions(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return positions;
    return positions.filter((position) => [position.code_position, position.position_name]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [positions, query]);

  const remove = async (position) => {
    if (!window.confirm(`Hapus ${position.code_position} - ${position.position_name}?`)) return;
    try {
      await api.delete(`/positions/${position.id}`);
      await load();
    } catch (err) {
      window.alert(formatApiError(err));
    }
  };

  return (
    <div data-testid="admin-positions-page">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#66736B]">Master Data</div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-[#202622] sm:text-5xl">Jabatan</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#68746D]">Kelola kode dan nama jabatan yang digunakan di dalam GASS.</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#238B57] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#176E43]" data-testid="add-position-btn">
          <Plus className="h-4 w-4" /> Tambah Jabatan
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#DFE5E1] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6F2EB] text-[#238B57]"><BriefcaseBusiness className="h-5 w-5" /></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-[#7A857E]">Total Jabatan</div><div className="text-xl font-bold text-[#202622]">{positions.length}</div></div>
        </div>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A958E]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari code atau nama jabatan..." className="w-full rounded-lg border border-[#DCE3DE] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/15" data-testid="position-search" />
        </label>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#DFE5E1] bg-white shadow-sm">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-[#F4F7F5] text-[11px] font-bold uppercase tracking-wide text-[#66736B]">
            <tr>
              <th className="px-5 py-4">Code Jabatan</th><th className="px-5 py-4">Nama Jabatan</th><th className="px-5 py-4">Created Date</th><th className="px-5 py-4">Created By</th><th className="px-5 py-4">Updated By</th><th className="px-5 py-4">Updated Date</th><th className="px-5 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAE7]">
            {filtered.map((position) => (
              <tr key={position.id} className="text-[#344038] hover:bg-[#FAFCFB]" data-testid={`position-row-${position.code_position}`}>
                <td className="px-5 py-4"><span className="rounded-md bg-[#E5F2EA] px-2.5 py-1 font-mono text-xs font-bold text-[#176E43]">{position.code_position}</span></td>
                <td className="px-5 py-4 font-semibold text-[#202622]">{position.position_name}</td>
                <td className="px-5 py-4 text-xs text-[#657169]">{formatDate(position.created_date)}</td>
                <td className="px-5 py-4 text-xs">{position.created_by}</td>
                <td className="px-5 py-4 text-xs">{position.updated_by}</td>
                <td className="px-5 py-4 text-xs text-[#657169]">{formatDate(position.updated_date)}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setEditing(position)} className="rounded-lg border border-[#D8DFDA] p-2 text-[#536057] hover:border-[#238B57] hover:bg-[#EFF7F2] hover:text-[#238B57]" title="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(position)} className="rounded-lg border border-[#D8DFDA] p-2 text-red-600 hover:border-red-300 hover:bg-red-50" title="Hapus"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="px-6 py-14 text-center text-sm text-[#7A857E]">Tidak ada jabatan yang sesuai.</div>}
        {loading && <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-[#7A857E]"><Loader2 className="h-4 w-4 animate-spin" /> Memuat data jabatan...</div>}
      </div>

      {editing && <PositionDialog position={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}
