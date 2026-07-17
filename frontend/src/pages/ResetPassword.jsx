import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, formatApiError } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset token is missing. Please request a new password reset link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setMessage(data.message);
      setTimeout(() => navigate("/login", { replace: true }), 1600);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa] lg:flex-row" data-testid="reset-password-page">
      <div className="relative hidden border-r border-slate-200 bg-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:overflow-hidden lg:p-12">
        <div className="flex items-center gap-2">
          <img
            src="/brand-logo.png"
            alt="KCSI Consulting-Shared Services"
            className="h-24 w-auto object-contain"
          />
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0055FF]">
            New Password
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight text-slate-900">
            Create a
            <br />
            fresh secure
            <br />
            password.
          </h1>
          <p className="mt-6 max-w-md text-base text-slate-600">
            Reset links are single-use and expire automatically for your account safety.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
          One-time reset link
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img
              src="/brand-logo.png"
              alt="KCSI Consulting-Shared Services"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Reset Password
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Set a new password
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Need a new link?{" "}
            <Link to="/forgot-password" className="font-medium text-[#0055FF] hover:underline">
              Request again
            </Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="reset-password-form">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
              <input
                data-testid="reset-password-input"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
              <input
                data-testid="reset-password-confirm-input"
                type="password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                placeholder="Repeat new password"
              />
            </div>
            {error && (
              <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || Boolean(message)}
              data-testid="reset-password-submit-btn"
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
