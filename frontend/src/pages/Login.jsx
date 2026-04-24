import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Building2, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      if (from) return navigate(from, { replace: true });
      navigate(res.user.role === "admin" ? "/admin" : "/rooms", { replace: true });
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa] lg:flex-row" data-testid="login-page">
      <div
        className="relative hidden border-r border-slate-200 bg-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:overflow-hidden lg:p-12"
      >
        <div className="flex items-center gap-2">
          <img
            src="/brand-logo.png"
            alt="KCSI Consulting-Shared Services"
            className="h-24 w-auto object-contain"
          />
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0055FF]">
            Enterprise Booking Platform
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight text-slate-900">
            Meeting rooms,
            <br />
            booked the way
            <br />
            they should be.
          </h1>
          <p className="mt-6 max-w-md text-base text-slate-600">
            A structured, real-time availability platform for teams — from
            huddle spaces to executive boardrooms.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
          Secure • Real-time • PWA-ready
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
            Welcome Back
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Don't have an account yet?{" "}
            <Link
              to="/register"
              className="font-medium text-[#0055FF] hover:underline"
              data-testid="go-register-link"
            >
              Create one
            </Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div
                className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                data-testid="login-error"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <div className="mt-8 rounded-sm border border-slate-200 bg-white p-4 text-xs text-slate-500">
            <div className="mb-2 font-semibold uppercase tracking-wider text-slate-600">
              Demo Admin
            </div>
            <div>
              Email: <code>admin@roombook.com</code>
            </div>
            <div>
              Password: <code>Admin@123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
