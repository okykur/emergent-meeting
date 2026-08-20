import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { api, formatApiError } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message);
      setResetUrl(data.reset_url || "");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FAF8] lg:flex-row" data-testid="forgot-password-page">
      <div className="relative hidden border-r border-slate-200 bg-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:overflow-hidden lg:p-12">
        <div className="flex items-center gap-2">
          <img
            src="/brand-logo.png"
            alt="KCSI Consulting-Shared Services"
            className="h-24 w-auto object-contain"
          />
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0B7A4B]">
            Account Recovery
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight text-slate-900">
            Reset access
            <br />
            without waiting
            <br />
            for support.
          </h1>
          <p className="mt-6 max-w-md text-base text-slate-600">
            Enter your work email and follow the reset instructions to create a new password.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
          Secure password recovery
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
            Forgot Password
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-[#0B7A4B] hover:underline">
              Sign in
            </Link>
          </p>

          {message ? (
            <div className="mt-8 rounded-sm border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <MailCheck className="h-4 w-4" />
                Request received
              </div>
              <p>{message}</p>
              {resetUrl && (
                <div className="mt-4 rounded-sm border border-emerald-200 bg-white p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Local testing link
                  </div>
                  <Link
                    to={resetUrl.replace(window.location.origin, "")}
                    className="break-all font-medium text-[#0B7A4B] hover:underline"
                    data-testid="local-reset-link"
                  >
                    {resetUrl}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" data-testid="forgot-password-form">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
                <input
                  data-testid="forgot-password-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
                  placeholder="you@company.com"
                />
              </div>
              {error && (
                <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="forgot-password-submit-btn"
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#064E3B] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset instructions
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
