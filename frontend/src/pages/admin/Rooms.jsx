import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { ActiveTag } from "../../components/Status";
import { Plus, Users, MapPin, Pencil, Trash2, X, Loader2, Clock3 } from "lucide-react";

const FLEXIBLE_LAYOUT_OPTIONS = ["U-Shape", "Classroom", "Round", "Theater", "Lainnya"];

const EMPTY_ROOM = {
  name: "",
  building: "",
  location: "",
  capacity: 4,
  facilities: "",
  description: "",
  image_url: "",
  is_active: true,
  operating_start_time: "08:00",
  operating_end_time: "17:30",
  layout_fixed: true,
};

function RoomFormDialog({ initial, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? { ...initial, facilities: initial.facilities.join(", ") }
      : {
          ...EMPTY_ROOM,
          building:
            currentUser?.role === "meeting_admin" && currentUser?.meeting_buildings?.length
              ? currentUser.meeting_buildings[0]
              : "",
        }
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if ((form.operating_start_time || "08:00") >= (form.operating_end_time || "17:30")) {
      setError("Operational end time must be after start time.");
      return;
    }
    setLoading(true);
    const payload = {
      name: form.name,
      building: form.building || "Unassigned",
      location: form.location,
      capacity: Number(form.capacity),
      facilities: form.facilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      description: form.description,
      image_url: form.image_url || null,
      is_active: !!form.is_active,
      operating_start_time: form.operating_start_time || "08:00",
      operating_end_time: form.operating_end_time || "17:30",
      layout_fixed: !!form.layout_fixed,
    };
    try {
      if (initial) await api.put(`/rooms/${initial.id}`, payload);
      else await api.post("/rooms", payload);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
      data-testid="room-dialog"
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {initial ? "Edit Room" : "New Room"}
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {initial ? initial.name : "Add meeting room"}
            </h3>
          </div>
          <button onClick={onClose} data-testid="room-dialog-close" className="p-1 text-slate-400 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="min-h-0 space-y-4 overflow-y-auto p-5" data-testid="room-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                required
                data-testid="room-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Gedung</label>
              <input
                required
                data-testid="room-building-input"
                value={form.building || ""}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="Head Office"
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <input
                required
                data-testid="room-location-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Capacity</label>
              <input
                required
                type="number"
                min={1}
                data-testid="room-capacity-input"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Facilities (comma-separated)</label>
              <input
                data-testid="room-facilities-input"
                value={form.facilities}
                onChange={(e) => setForm({ ...form, facilities: e.target.value })}
                placeholder="Projector, Whiteboard, Video Conference"
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Operational start</label>
              <input
                type="time"
                required
                data-testid="room-operating-start-input"
                value={form.operating_start_time || "08:00"}
                onChange={(e) => setForm({ ...form, operating_start_time: e.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Operational end</label>
              <input
                type="time"
                required
                data-testid="room-operating-end-input"
                value={form.operating_end_time || "17:30"}
                onChange={(e) => setForm({ ...form, operating_end_time: e.target.value })}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <label className="col-span-2 flex items-start gap-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                data-testid="room-layout-fixed-checkbox"
                checked={!!form.layout_fixed}
                onChange={(e) => setForm({ ...form, layout_fixed: e.target.checked })}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-slate-900">Fixed layout</span>
                <span className="text-xs text-slate-500">
                  Jika dicentang, layout ruangan tidak bisa berubah dan user tidak perlu memilih layout saat booking.
                </span>
              </span>
            </label>
            {!form.layout_fixed && (
              <div
                className="col-span-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-3"
                data-testid="room-flexible-layout-options"
              >
                <div className="text-sm font-semibold text-slate-900">Layout options shown to users</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FLEXIBLE_LAYOUT_OPTIONS.map((layout) => (
                    <span
                      key={layout}
                      className="rounded-sm border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700"
                    >
                      {layout}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Jika user memilih Lainnya, form booking akan meminta detail layout dalam free text.
                </p>
              </div>
            )}
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Image URL (optional)</label>
              <input
                data-testid="room-image-input"
                value={form.image_url || ""}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                rows={3}
                data-testid="room-description-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                data-testid="room-active-checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active (available for booking)
            </label>
          </div>
          {error && (
            <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="room-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064E3B] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Save changes" : "Create room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminRooms() {
  const { user: me } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // room or 'new'

  const load = async () => {
    try {
      const { data } = await api.get("/rooms");
      setRooms(data);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (r) => {
    try {
      await api.put(`/rooms/${r.id}`, { is_active: !r.is_active });
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  const canManageRoom = (room) =>
    me?.role === "super_admin" || (me?.meeting_buildings || []).includes(room.building || "Unassigned");
  const visibleRooms = rooms.filter(canManageRoom);
  const canCreateRoom = me?.role === "super_admin" || (me?.meeting_buildings || []).length > 0;

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/rooms/${r.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  return (
    <div data-testid="admin-rooms-page">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Master Data
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Meeting Rooms
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Add rooms, edit facilities, and toggle availability status.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={!canCreateRoom}
          data-testid="add-room-btn"
          className="inline-flex items-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064E3B] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          title={!canCreateRoom ? "Assign at least one meeting building to this admin first" : "Add Room"}
        >
          <Plus className="h-4 w-4" />
          Add Room
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visibleRooms.map((r) => (
          <div
            key={r.id}
            data-testid={`admin-room-card-${r.id}`}
            className="flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative h-32 w-full bg-slate-100">
              {r.image_url && <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />}
              <div className="absolute right-3 top-3">
                <ActiveTag active={r.is_active} />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg font-semibold text-slate-900">{r.name}</h3>
                <div className="flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  <Users className="h-3 w-3" /> {r.capacity}
                </div>
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#0B7A4B]">
                {r.building || "Unassigned"}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" /> {r.location}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                <Clock3 className="h-3 w-3" /> {r.operating_start_time || "08:00"}-{r.operating_end_time || "17:30"}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                Layout: {r.layout_fixed !== false ? "Fixed" : "Flexible"}
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.description}</p>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <button
                  onClick={() => toggleActive(r)}
                  data-testid={`toggle-active-${r.id}`}
                  className={`flex-1 rounded-sm border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    r.is_active
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {r.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => setEditing(r)}
                  data-testid={`edit-room-${r.id}`}
                  className="rounded-sm border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(r)}
                  data-testid={`delete-room-${r.id}`}
                  className="rounded-sm border border-slate-300 p-1.5 text-red-600 hover:border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RoomFormDialog
          initial={editing === "new" ? null : editing}
          currentUser={me}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
