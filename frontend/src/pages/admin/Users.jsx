import { useEffect, useState } from "react";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  UserPlus,
  Pencil,
  KeyRound,
  Trash2,
  X,
  Loader2,
  Shield,
  User as UserIcon,
} from "lucide-react";

function RoleTag({ role }) {
  if (role === "admin") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm border border-[#0055FF]/30 bg-[#0055FF]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#0055FF]"
        data-testid={`role-tag-admin`}
      >
        <Shield className="h-3 w-3" /> Admin
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600"
      data-testid={`role-tag-user`}
    >
      <UserIcon className="h-3 w-3" /> User
    </span>
  );
}

function UserFormDialog({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name || "",
          company_name: initial.company_name || "",
          role: initial.role || "user",
        }
      : {
          email: "",
          password: "",
          name: "",
          company_name: "",
          role: "user",
        }
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (initial) {
        await api.patch(`/users/${initial.id}`, {
          name: form.name,
          company_name: form.company_name,
          role: form.role,
        });
      } else {
        await api.post("/users", form);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
      data-testid="user-dialog"
    >
      <div
        className="w-full max-w-md rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {initial ? "Edit User" : "New User"}
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {initial ? initial.email : "Add new user"}
            </h3>
          </div>
          <button onClick={onClose} data-testid="user-dialog-close" className="p-1 text-slate-400 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5" data-testid="user-form">
          {!initial && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  required
                  type="email"
                  data-testid="user-email-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Initial password (min 6 chars)
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  data-testid="user-password-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              required
              data-testid="user-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
            <input
              data-testid="user-company-input"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              data-testid="user-role-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
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
              data-testid="user-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Save changes" : "Create user"}
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
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
              className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
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
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // user | 'new' | null
  const [pwTarget, setPwTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (role) params.role = role;
      const { data } = await api.get("/users", { params });
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
  }, [role]);

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
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            User Management
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Users
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Add users, update profiles, reset passwords, and promote admins.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          data-testid="add-user-btn"
          className="inline-flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto]"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="users-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or company…"
            className="w-full rounded-sm border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
          />
        </div>
        <select
          data-testid="users-role-filter"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
        >
          <option value="">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <button
          type="submit"
          data-testid="users-search-btn"
          className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Company</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Joined</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500" data-testid="users-empty">
                  No users match your filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  data-testid={`user-row-${u.id}`}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase text-white">
                        {u.name?.[0] || "U"}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">
                          {u.name}
                          {me?.id === u.id && (
                            <span className="ml-2 text-[11px] font-normal text-[#0055FF]">(you)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{u.email}</td>
                  <td className="px-6 py-4 text-slate-700">{u.company_name || "—"}</td>
                  <td className="px-6 py-4">
                    <RoleTag role={u.role} />
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        data-testid={`edit-user-${u.id}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => setPwTarget(u)}
                        data-testid={`reset-password-${u.id}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <KeyRound className="h-3 w-3" /> Password
                      </button>
                      <button
                        onClick={() => remove(u)}
                        disabled={me?.id === u.id}
                        data-testid={`delete-user-${u.id}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={me?.id === u.id ? "You cannot delete your own account" : "Delete"}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
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
