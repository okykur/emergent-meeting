import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowUpRight, Building2, CarFront, Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      navigate("/hub", { replace: true });
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f7f4] p-3 sm:p-5" data-testid="login-page">
      <div className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(6,78,59,0.12)] lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative hidden overflow-hidden bg-[#064E3B] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/15" />
          <div className="absolute -bottom-36 left-16 h-80 w-80 rounded-full border border-[#78d3aa]/25" />

          <div className="relative flex items-center justify-between">
            <img
              src="/brand-logo.png"
              alt="KCSI Consulting-Shared Services"
              className="h-14 w-auto rounded bg-white px-2 py-1 object-contain"
            />
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Employee Portal
            </span>
          </div>

          <div className="relative max-w-xl py-12">
            <div className="mb-5 flex items-baseline gap-3">
              <span className="font-brand text-6xl font-bold tracking-[-0.08em] text-white xl:text-7xl">GASS</span>
              <span className="h-2 w-2 rounded-full bg-[#81d8ae]" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a6e5c4]">
              General Affair Services System
            </p>
            <h1 className="font-brand mt-7 text-4xl font-semibold leading-[1.12] tracking-[-0.04em] text-white xl:text-5xl">
              Arrange your workday with confidence.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/75">
              One trusted place to reserve meeting rooms, request company vehicles, and follow every approval.
            </p>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <Building2 className="h-4 w-4 text-[#91e0b6]" />
                <p className="mt-4 text-xs font-medium text-white">Meeting rooms</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <CarFront className="h-4 w-4 text-[#91e0b6]" />
                <p className="mt-4 text-xs font-medium text-white">Company cars</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4 text-[#91e0b6]" />
                <p className="mt-4 text-xs font-medium text-white">Clear approvals</p>
              </div>
            </div>
          </div>

          <div className="relative text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-100/60">
            KCSI Consulting-Shared Services
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:px-16 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-12 flex items-center justify-between lg:hidden">
              <div>
                <div className="font-brand text-3xl font-bold tracking-[-0.08em] text-[#064E3B]">GASS</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">General Affair Services System</div>
              </div>
              <img src="/brand-logo.png" alt="KCSI Consulting-Shared Services" className="h-11 w-auto object-contain" />
            </div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#087045]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0B7A4B]" />
              Secure workspace access
            </div>
            <h2 className="font-brand text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Sign in to manage your reservations and requests.
            </p>

            <form onSubmit={submit} className="mt-9 space-y-5" data-testid="login-form">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B7A4B] focus:bg-white focus:ring-4 focus:ring-[#0B7A4B]/10"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[#0B7A4B] hover:text-[#064E3B] hover:underline"
                    data-testid="forgot-password-link"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B7A4B] focus:bg-white focus:ring-4 focus:ring-[#0B7A4B]/10"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  data-testid="login-error"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B7A4B] px-4 py-3.5 font-semibold text-white shadow-[0_10px_24px_rgba(11,122,75,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#064E3B] hover:shadow-[0_14px_28px_rgba(6,78,59,0.25)] disabled:translate-y-0 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
                {!loading && <ArrowUpRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              New to GASS?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#0B7A4B] hover:text-[#064E3B] hover:underline"
                data-testid="go-register-link"
              >
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
