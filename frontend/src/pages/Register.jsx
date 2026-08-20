import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const res = await register({
      name,
      company_name: company,
      job_title: jobTitle,
      department,
      office_address: officeAddress,
      email,
      password,
    });
    setLoading(false);
    if (res.ok) {
      setName("");
      setCompany("");
      setJobTitle("");
      setDepartment("");
      setOfficeAddress("");
      setEmail("");
      setPassword("");
      setSuccess(res.message || "Account created. Please wait for admin approval before signing in.");
    } else {
      setError(res.error);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7FAF8] px-6 py-12" data-testid="register-pending-page">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <img
              src="/brand-logo.png"
              alt="KCSI Consulting-Shared Services"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Account submitted
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Waiting for admin approval
          </h2>
          <div
            className="mt-6 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700"
            data-testid="register-success"
          >
            {success}
          </div>
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-sm bg-[#0B7A4B] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#064E3B]"
            data-testid="register-pending-login-link"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7FAF8] px-6 py-12" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <img
            src="/brand-logo.png"
            alt="KCSI Consulting-Shared Services"
            className="h-16 w-auto object-contain"
          />
        </div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Create your account
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Get started in seconds
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-[#0B7A4B] hover:underline"
            data-testid="go-login-link"
          >
            Sign in
          </Link>
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              data-testid="register-name-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="Alex Rivera"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company name</label>
            <input
              data-testid="register-company-input"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="Acme Corp."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Jabatan</label>
            <input
              data-testid="register-job-title-input"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="Manager"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Departemen</label>
            <input
              data-testid="register-department-input"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="Operations"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alamat kantor</label>
            <textarea
              data-testid="register-office-address-input"
              required
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              className="min-h-20 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="KCSI office address"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
            <input
              data-testid="register-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="alex@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              data-testid="register-password-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2.5 text-base outline-none transition-all focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              placeholder="At least 6 characters"
            />
          </div>
          {error && (
            <div
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="register-error"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            data-testid="register-submit-btn"
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#064E3B] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}
