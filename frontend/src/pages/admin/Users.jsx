import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  Plus,
  Pencil,
  KeyRound,
  Trash2,
  X,
  Loader2,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function RoleTag({ role }) {
  const config = {
    super_admin: {
      label: "Super Admin",
      cls: "bg-[#0B4935] text-white",
    },
    meeting_admin: {
      label: "Meeting Admin",
      cls: "bg-[#238B57] text-white",
    },
    car_admin: {
      label: "Car Admin",
      cls: "bg-[#E88A00] text-white",
    },
    manager: {
      label: "Manager",
      cls: "bg-[#FFF0C7] text-[#C87400]",
    },
    user: {
      label: "User",
      cls: "bg-[#E9EEEB] text-[#68736C]",
    },
  };
  const c = config[role] || config.user;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${c.cls}`}
      data-testid={`role-tag-${role}`}
    >
      {c.label}
    </span>
  );
}

function getApprovalStatus(user) {
  return user.approval_status || (user.is_approved ? "approved" : "pending");
}

function ApprovalTag({ status }) {
  const config = {
    approved: { label: "Disetujui", cls: "bg-[#E4F4EB] text-[#1E7C4F]" },
    pending: { label: "Menunggu", cls: "bg-[#FFF0C7] text-[#C87400]" },
    rejected: { label: "Ditolak", cls: "bg-red-50 text-red-700" },
  };
  const current = config[status] || config.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold ${current.cls}`}
      data-testid={`approval-${status}`}
    >
      {current.label}
    </span>
  );
}

function buildingsToInput(buildings = []) {
  return buildings.join(", ");
}

function inputToBuildings(value = "") {
  return value
    .split(",")
    .map((building) => building.trim())
    .filter(Boolean);
}

const userFieldClass = "h-11 w-full rounded-lg border border-[#DCE3DE] bg-white px-3.5 text-sm text-[#303732] outline-none placeholder:text-[#8A938D] focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10";
const userRoleOptions = [
  { value: "super_admin", label: "Super Admin", description: "Kelola seluruh pengguna, role, dan akses sistem" },
  { value: "manager", label: "Manager", description: "Melakukan review dan approval meeting room serta F&B" },
  { value: "user", label: "User", description: "Mengajukan booking untuk diri sendiri" },
  { value: "meeting_admin", label: "Meeting Admin", description: "Meninjau pengajuan dan mengelola ruang meeting" },
  { value: "car_admin", label: "Car Admin", description: "Meninjau pengajuan dan mengelola kendaraan serta driver" },
];

function UserFormDialog({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name || "",
          company_name: initial.company_name || "",
          job_title: initial.job_title || "",
          department: initial.department || "",
          office_address: initial.office_address || "",
          supervisor_name: initial.supervisor_name || "",
          supervisor_email: initial.supervisor_email || "",
          meeting_buildings: buildingsToInput(initial.meeting_buildings || []),
          fnb_locations: buildingsToInput(initial.fnb_locations || []),
          role: initial.role || "user",
        }
      : {
          email: "",
          password: "",
          name: "",
          company_name: "",
          job_title: "",
          department: "",
          office_address: "",
          supervisor_name: "",
          supervisor_email: "",
          meeting_buildings: "",
          fnb_locations: "",
          role: "user",
          is_approved: true,
        }
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        meeting_buildings: inputToBuildings(form.meeting_buildings),
        fnb_locations: inputToBuildings(form.fnb_locations),
      };
      if (initial) {
        await api.patch(`/users/${initial.id}`, {
          name: payload.name,
          company_name: payload.company_name,
          job_title: payload.job_title,
          department: payload.department,
          office_address: payload.office_address,
          supervisor_name: payload.supervisor_name,
          supervisor_email: payload.supervisor_email,
          meeting_buildings: payload.meeting_buildings,
          fnb_locations: payload.fnb_locations,
          role: payload.role,
        });
      } else {
        await api.post("/users", payload);
      }
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271F]/70 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      data-testid="user-dialog"
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DCE3DE] bg-white shadow-[0_28px_80px_rgba(8,35,25,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E9E6] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-extrabold tracking-[-0.03em] text-[#252A27]">
              {initial ? "Edit Pengguna" : "Tambah Pengguna Baru"}
            </h3>
            {initial && <p className="mt-1 truncate text-xs text-[#79827C]">{initial.email}</p>}
          </div>
          <button type="button" onClick={onClose} data-testid="user-dialog-close" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#69736D] hover:bg-[#EEF2EF] hover:text-[#253029]" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" data-testid="user-form">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
          {!initial && (
            <>
              <div>
                <label className="mb-2 block text-xs font-bold text-[#343B36]">Email Perusahaan *</label>
                <input
                  required
                  type="email"
                  data-testid="user-email-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama.karyawan@kcsi.co.id"
                  className={userFieldClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-[#343B36]">
                  Password Internal *
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  data-testid="user-password-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className={userFieldClass}
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-2 block text-xs font-bold text-[#343B36]">Nama Lengkap *</label>
            <input
              required
              data-testid="user-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Bagus Prasetyo"
              className={userFieldClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-[#343B36]">Perusahaan (Company)</label>
            <input
              data-testid="user-company-input"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              placeholder="Nama perusahaan"
              className={userFieldClass}
            />
          </div>
          <div className="contents">
            <div>
              <label className="mb-2 block text-xs font-bold text-[#343B36]">Jabatan</label>
              <input
                data-testid="user-job-title-input"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="Jabatan pengguna"
                className={userFieldClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold text-[#343B36]">Departemen / Divisi</label>
              <input
                data-testid="user-department-input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Departemen pengguna"
                className={userFieldClass}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-bold text-[#343B36]">Alamat Kantor</label>
            <textarea
              data-testid="user-office-address-input"
              value={form.office_address}
              onChange={(e) => setForm({ ...form, office_address: e.target.value })}
              placeholder="Alamat atau lokasi kantor"
              className="min-h-20 w-full resize-y rounded-lg border border-[#DCE3DE] bg-white px-3.5 py-3 text-sm text-[#303732] outline-none placeholder:text-[#8A938D] focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10"
            />
          </div>
          <div className="rounded-xl border border-[#D7E9DE] bg-[#F6FAF7] p-4 md:col-span-2">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#238B57]">Informasi Atasan</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold text-[#343B36]">Nama Atasan *</label>
                <input
                  required
                  data-testid="user-supervisor-name-input"
                  value={form.supervisor_name}
                  onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })}
                  placeholder="Nama atasan"
                  className={userFieldClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-[#343B36]">Email Atasan *</label>
                <input
                  required
                  type="email"
                  data-testid="user-supervisor-email-input"
                  value={form.supervisor_email}
                  onChange={(e) => setForm({ ...form, supervisor_email: e.target.value })}
                  placeholder="atasan@company.com"
                  className={userFieldClass}
                />
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-bold text-[#343B36]">Pilih Peran Sistem (Role) *</label>
            <select
              data-testid="user-role-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              <option value="user">User</option>
              <option value="meeting_admin">Meeting Admin — approve meeting-room bookings</option>
              <option value="car_admin">Car Admin — approve car/vehicle bookings</option>
              <option value="manager">Manager - approve meeting room &amp; F&amp;B</option>
              <option value="super_admin">Super Admin — full access</option>
            </select>
            <div className="space-y-2" role="radiogroup" aria-label="Pilih role pengguna">
              {userRoleOptions.map((option) => {
                const selected = form.role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setForm({ ...form, role: option.value })}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      selected ? "border-[#238B57] bg-[#F0F8F3] ring-1 ring-[#238B57]/20" : "border-[#DCE3DE] bg-white hover:bg-[#F8FAF8]"
                    }`}
                  >
                    <span className={`h-3 w-3 flex-shrink-0 rounded-full border ${selected ? "border-[#238B57] bg-[#238B57] shadow-[inset_0_0_0_3px_#fff]" : "border-[#C8D0CB] bg-white"}`} />
                    <span>
                      <strong className="block text-xs font-bold text-[#303732]">{option.label}</strong>
                      <small className="mt-0.5 block text-[10px] leading-4 text-[#79827C]">{option.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="sr-only">
              Each admin role only manages its own division. Super Admin has access to everything, including user management.
            </p>
          </div>
          {form.role === "meeting_admin" && (
            <div className="rounded-xl border border-[#D7E9DE] bg-[#F6FAF7] p-4 md:col-span-2">
              <label className="mb-2 block text-xs font-bold text-[#343B36]">Gedung Approval Meeting *</label>
              <input
                required
                data-testid="user-meeting-buildings-input"
                value={form.meeting_buildings}
                onChange={(e) => setForm({ ...form, meeting_buildings: e.target.value })}
                placeholder="Head Office, Annex"
                className={userFieldClass}
              />
              <p className="mt-2 text-[11px] text-[#747D77]">
                Satu meeting admin bisa menangani beberapa gedung. Pisahkan dengan koma.
              </p>
            </div>
          )}
          {form.role === "manager" && (
            <div className="rounded-xl border border-[#D7E9DE] bg-[#F6FAF7] p-4 md:col-span-2">
              <label className="mb-2 block text-xs font-bold text-[#343B36]">Lokasi Approval Meeting &amp; F&amp;B *</label>
              <input
                required
                data-testid="user-fnb-locations-input"
                value={form.fnb_locations}
                onChange={(e) => setForm({ ...form, fnb_locations: e.target.value })}
                placeholder="Kudus, Pulogadung"
                className={userFieldClass}
              />
              <p className="mt-2 text-[11px] text-[#747D77]">
                Satu manager bisa menangani approval meeting room dan F&amp;B untuk beberapa lokasi. Pisahkan dengan koma.
              </p>
            </div>
          )}
          {!initial && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#DCE3DE] bg-[#FAFBFA] px-3.5 py-3 text-sm text-[#39413C] md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_approved}
              onChange={(e) => setForm({ ...form, is_approved: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-[#238B57]"
              data-testid="user-approved-checkbox"
            />
            <span>
              <span className="block text-xs font-bold text-[#303732]">Setujui akun langsung</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-[#79827C]">
                Pengguna yang belum disetujui tidak dapat login sampai pilihan ini dicentang dan disimpan.
              </span>
            </span>
          </label>}
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#E4E9E6] bg-white px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-lg bg-[#EEF1EF] px-5 text-sm font-bold text-[#626C65] hover:bg-[#E2E8E4]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="user-submit-btn"
              className="flex min-h-10 items-center gap-2 rounded-lg bg-[#238B57] px-6 text-sm font-bold text-white hover:bg-[#176E43] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Simpan Perubahan" : "Simpan Pengguna"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApprovalDialog({ user, onClose, onSaved }) {
  const [decision, setDecision] = useState("approve");
  const [role, setRole] = useState(user.role || "user");
  const [meetingBuildings, setMeetingBuildings] = useState(buildingsToInput(user.meeting_buildings || []));
  const [fnbLocations, setFnbLocations] = useState(buildingsToInput(user.fnb_locations || []));
  const [reason, setReason] = useState(user.rejection_reason || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (decision === "reject" && !reason.trim()) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/users/${user.id}/approval`, {
        action: decision,
        role,
        meeting_buildings: inputToBuildings(meetingBuildings),
        fnb_locations: inputToBuildings(fnbLocations),
        rejection_reason: reason.trim(),
      });
      onSaved?.(decision);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const detailRows = [
    ["Nama", user.name],
    ["Email", user.email],
    ["Perusahaan", user.company_name || "-"],
    ["Departemen / Jabatan", [user.department, user.job_title].filter(Boolean).join(" / ") || "-"],
    ["Lokasi kantor", user.office_address || "-"],
    ["Atasan", user.supervisor_name && user.supervisor_email ? `${user.supervisor_name} (${user.supervisor_email})` : "Belum lengkap"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271F]/70 p-4 backdrop-blur-[1px]" onClick={onClose} data-testid="approval-dialog">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DCE3DE] bg-white shadow-[0_28px_80px_rgba(8,35,25,0.28)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#E4E9E6] px-6 py-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#238B57]">Review Pendaftaran</div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-[#252A27]">Approval Pengguna</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#69736D] hover:bg-[#EEF2EF]" aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#DDE6E0] bg-[#F8FAF8] p-4 sm:grid-cols-2">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#78817B]">{label}</div>
                  <div className="mt-1 break-words text-sm font-semibold text-[#303732]">{value}</div>
                </div>
              ))}
            </div>
            {(!user.supervisor_name || !user.supervisor_email) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Data atasan belum lengkap. Tutup dialog ini dan lengkapi melalui tombol Edit sebelum menyetujui.</div>
            )}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F1F4F2] p-1.5">
              <button type="button" onClick={() => setDecision("approve")} className={`rounded-lg px-4 py-2.5 text-sm font-bold ${decision === "approve" ? "bg-white text-[#1E7C4F] shadow-sm" : "text-[#69736D]"}`}>Setujui</button>
              <button type="button" onClick={() => setDecision("reject")} className={`rounded-lg px-4 py-2.5 text-sm font-bold ${decision === "reject" ? "bg-white text-red-700 shadow-sm" : "text-[#69736D]"}`}>Tolak</button>
            </div>
            {decision === "approve" ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#343B36]">Role yang diberikan *</label>
                  <select value={role} onChange={(event) => setRole(event.target.value)} className={userFieldClass} data-testid="approval-role-select">
                    {userRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                {role === "meeting_admin" && (
                  <div>
                    <label className="mb-2 block text-xs font-bold text-[#343B36]">Gedung Approval Meeting *</label>
                    <input required value={meetingBuildings} onChange={(event) => setMeetingBuildings(event.target.value)} placeholder="Pulogadung, Kudus" className={userFieldClass} />
                    <p className="mt-1 text-[11px] text-[#747D77]">Pisahkan beberapa gedung dengan koma.</p>
                  </div>
                )}
                {role === "manager" && (
                  <div>
                    <label className="mb-2 block text-xs font-bold text-[#343B36]">Lokasi Approval Meeting &amp; F&amp;B *</label>
                    <input required value={fnbLocations} onChange={(event) => setFnbLocations(event.target.value)} placeholder="Pulogadung, Kudus" className={userFieldClass} />
                    <p className="mt-1 text-[11px] text-[#747D77]">Pisahkan beberapa lokasi dengan koma.</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-bold text-[#343B36]">Alasan penolakan *</label>
                <textarea required value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Jelaskan alasan agar pemohon dapat melakukan perbaikan." className="w-full resize-y rounded-lg border border-[#DCE3DE] px-3.5 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" data-testid="approval-rejection-reason" />
              </div>
            )}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#E4E9E6] px-6 py-4">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg bg-[#EEF1EF] px-5 text-sm font-bold text-[#626C65]">Batal</button>
            <button type="submit" disabled={loading} className={`flex min-h-10 items-center gap-2 rounded-lg px-6 text-sm font-bold text-white disabled:opacity-60 ${decision === "approve" ? "bg-[#238B57] hover:bg-[#176E43]" : "bg-red-600 hover:bg-red-700"}`} data-testid="approval-submit-btn">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {decision === "approve" ? "Setujui & Aktifkan" : "Tolak Pendaftaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordDialog({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/users/${user.id}/password`, { password });
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
      data-testid="password-dialog"
    >
      <div
        className="w-full max-w-md rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Reset Password
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {user.name}
            </h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={onClose} data-testid="password-dialog-close" className="p-1 text-slate-400 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5" data-testid="password-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input
              required
              type="password"
              minLength={6}
              data-testid="new-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              required
              type="password"
              minLength={6}
              data-testid="confirm-password-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
            />
          </div>
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            The user's password will be overwritten immediately. Please share the new password with them securely.
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
              data-testid="password-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064E3B] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [approval, setApproval] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // user | 'new' | null
  const [approvalTarget, setApprovalTarget] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = q.trim().toLowerCase();
  const visibleUsers = users.filter((user) => {
    const searchable = [
      user.name,
      user.email,
      user.company_name,
      user.job_title,
      user.department,
      user.office_address,
      user.supervisor_name,
      user.supervisor_email,
      ...(user.meeting_buildings || []),
      ...(user.fnb_locations || []),
    ].filter(Boolean).join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (role && user.role !== role) return false;
    if (approval && getApprovalStatus(user) !== approval) return false;
    return true;
  });
  const pendingCount = users.filter((user) => getApprovalStatus(user) === "pending").length;

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.email}"? Their past bookings will be kept for audit.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  return (
    <div data-testid="admin-users-page">
      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#657169]">
            Sistem Kontrol Akses
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-[#252A27] sm:text-4xl">
            Manajemen Pengguna
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          data-testid="add-user-btn"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#238B57] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#176E43]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Tambah Pengguna
        </button>
      </div>

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tampilan pengguna">
        <button
          type="button"
          role="tab"
          aria-selected={!approval}
          onClick={() => setApproval("")}
          className={`inline-flex min-h-10 flex-shrink-0 items-center gap-3 rounded-lg px-4 text-sm font-bold transition-colors ${
            !approval ? "bg-[#0B4935] text-white" : "border border-[#DCE3DE] bg-white text-[#333A35] hover:bg-[#F3F6F4]"
          }`}
        >
          Daftar Pengguna
          <span className={`rounded px-2 py-0.5 text-[10px] ${!approval ? "bg-[#238B57] text-white" : "bg-[#EDF1EE] text-[#768079]"}`}>{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={approval === "pending"}
          onClick={() => setApproval("pending")}
          className={`inline-flex min-h-10 flex-shrink-0 items-center gap-3 rounded-lg px-4 text-sm font-bold transition-colors ${
            approval === "pending" ? "bg-[#0B4935] text-white" : "border border-[#DCE3DE] bg-white text-[#333A35] hover:bg-[#F3F6F4]"
          }`}
        >
          Approval Matrix
          <span className={`rounded px-2 py-0.5 text-[10px] ${approval === "pending" ? "bg-[#238B57] text-white" : "bg-[#EDF1EE] text-[#768079]"}`}>{pendingCount}</span>
        </button>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[610px] lg:grid-cols-[150px_150px_1fr]"
      >
        <div className="relative sm:col-span-2 lg:order-3 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69736D]" />
          <input
            data-testid="users-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau email..."
            className="h-10 w-full rounded-lg border border-[#DCE3DE] bg-white py-2 pl-10 pr-3 text-sm text-[#39413C] outline-none placeholder:text-[#7B847E] focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10"
          />
        </div>
        <select
          data-testid="users-role-filter"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-lg border border-[#DCE3DE] bg-white px-3 text-sm text-[#39413C] outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10 lg:order-1"
        >
          <option value="">Semua Peran</option>
          <option value="user">User</option>
          <option value="meeting_admin">Meeting Admin</option>
          <option value="car_admin">Car Admin</option>
          <option value="manager">Manager</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <select
          data-testid="users-approval-filter"
          value={approval}
          onChange={(e) => setApproval(e.target.value)}
          className="h-10 rounded-lg border border-[#DCE3DE] bg-white px-3 text-sm text-[#39413C] outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10 lg:order-2"
        >
          <option value="">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
        <button
          type="submit"
          data-testid="users-search-btn"
          className="sr-only"
        >
          Cari
        </button>
      </form>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_8px_24px_rgba(24,55,39,0.025)] [scrollbar-gutter:stable]">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-[#FAFBFA] text-[10px] font-bold uppercase tracking-[0.04em] text-[#657169]">
            <tr>
              <th className="px-6 py-4 text-left">Nama Pengguna</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Profil Institusi</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Approval</th>
              <th className="px-6 py-3 text-left">Bergabung</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  Memuat pengguna...
                </td>
              </tr>
            ) : visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500" data-testid="users-empty">
                  Tidak ada pengguna yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              visibleUsers.map((u) => (
                <tr
                  key={u.id}
                  data-testid={`user-row-${u.id}`}
                  className="border-t border-[#E3E8E5] transition-colors hover:bg-[#F8FAF8]"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF1EF] text-[#8A938D]">
                        <UserIcon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="font-bold text-[#2F3531]">
                          {u.name}
                          {me?.id === u.id && (
                            <span className="ml-2 text-[10px] font-medium text-[#238B57]">(Anda)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs text-[#424A45]">{u.email}</td>
                  <td className="px-6 py-5 text-[#424A45]">
                    <div className="text-xs font-bold text-[#343B36]">{u.company_name || "—"}</div>
                    <div className="mt-1 max-w-[260px] text-[11px] leading-4 text-[#747D77]">
                      {[u.job_title, u.department].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {u.office_address && (
                      <div className="mt-1 max-w-[260px] text-[11px] leading-4 text-[#747D77]">{u.office_address}</div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <RoleTag role={u.role} />
                    {u.role === "meeting_admin" && (
                      <div className="mt-2 max-w-[180px] text-[10px] leading-4 text-[#747D77]">
                        Gedung: {(u.meeting_buildings || []).join(", ") || "Belum diset"}
                      </div>
                    )}
                    {u.role === "manager" && (
                      <div className="mt-2 max-w-[180px] text-[10px] leading-4 text-[#747D77]">
                        F&amp;B lokasi: {(u.fnb_locations || []).join(", ") || "Belum diset"}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <ApprovalTag status={getApprovalStatus(u)} />
                    {getApprovalStatus(u) === "rejected" && u.rejection_reason && (
                      <div className="mt-2 max-w-[180px] text-[10px] leading-4 text-red-600" title={u.rejection_reason}>{u.rejection_reason}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-5 text-xs text-[#6B746E]">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-1.5">
                      {getApprovalStatus(u) !== "approved" && (
                        <button
                          type="button"
                          onClick={() => setApprovalTarget(u)}
                          data-testid={`approve-user-${u.id}`}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${getApprovalStatus(u) === "rejected" ? "text-red-600 hover:bg-red-50" : "text-[#238B57] hover:bg-[#E4F4EB]"}`}
                          title="Review pendaftaran"
                          aria-label={`Review ${u.name}`}
                        >
                          {getApprovalStatus(u) === "rejected" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        data-testid={`edit-user-${u.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#637069] hover:bg-[#EDF1EE]"
                        title="Edit pengguna"
                        aria-label={`Edit ${u.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPwTarget(u)}
                        data-testid={`reset-password-${u.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#637069] hover:bg-[#FFF4D8] hover:text-[#B56D00]"
                        title="Reset password"
                        aria-label={`Reset password ${u.name}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(u)}
                        disabled={me?.id === u.id}
                        data-testid={`delete-user-${u.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#D24141] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        title={me?.id === u.id ? "Akun sendiri tidak dapat dihapus" : "Hapus pengguna"}
                        aria-label={`Hapus ${u.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <UserFormDialog
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {approvalTarget && (
        <ApprovalDialog
          user={approvalTarget}
          onClose={() => setApprovalTarget(null)}
          onSaved={async () => {
            setApprovalTarget(null);
            await load();
          }}
        />
      )}

      {pwTarget && (
        <PasswordDialog
          user={pwTarget}
          onClose={() => setPwTarget(null)}
          onSaved={() => {
            setPwTarget(null);
            alert("Password updated successfully.");
          }}
        />
      )}
    </div>
  );
}
