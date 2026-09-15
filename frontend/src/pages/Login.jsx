import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Video, CarFront, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
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
    <main className="gass-login" lang="id" data-testid="login-page">
      <div className="gass-login__layout">
        <section
          className="gass-login__story relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14"
          aria-label="Tentang GASS"
          style={{ backgroundImage: 'linear-gradient(180deg, rgba(20, 51, 32, .88), rgba(18, 52, 32, .85)), url("/login-meeting.jpg")' }}
        >
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/15" />
          <div className="absolute -right-12 -top-36 h-80 w-80 rounded-full border border-[#78d3aa]/20" aria-hidden="true" />

          <div className="relative flex items-center justify-between">
            <img
              src="/brand-logo.png"
              alt="KCSI Consulting-Shared Services"
              className="h-14 w-auto rounded-xl bg-white px-2 py-1 object-contain"
            />
            <span className="inline-flex items-center gap-2 rounded-full border border-white/60 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/90">
              <LockKeyhole size={14} aria-hidden="true" />Portal karyawan
            </span>
          </div>

          <div className="gass-login__intro relative max-w-xl py-12">
            <div className="mb-5 flex items-baseline gap-3">
              <span className="font-brand text-6xl font-extrabold tracking-[-0.045em] text-white xl:text-7xl">GASS.</span>
            </div>
            <p className="text-[11px] font-bold uppercase text-[#83c56f]">
              General Affair Services System
            </p>
            <h1 className="font-brand mt-7 text-3xl font-bold leading-[1.3] tracking-[-0.035em] text-white xl:text-4xl">
              Atur hari kerja Anda dengan percaya diri.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/75">
              Satu tempat terpercaya untuk memesan ruang rapat, mengajukan kendaraan perusahaan, dan memantau setiap persetujuan.
            </p>

            <div className="gass-login__services grid grid-cols-[1fr_1fr_1.25fr] gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <Video className="gass-login__service-icon" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-white">Ruang rapat</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <CarFront className="gass-login__service-icon" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-white">Mobil perusahaan</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <ShieldCheck className="gass-login__service-icon" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-white">Persetujuan yang jelas</p>
              </div>
            </div>
          </div>

          <div className="relative text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-100/60">
            KCSI Consulting-Shared Services
          </div>
        </section>

        <section className="gass-login__form-panel flex items-center justify-center bg-white" aria-labelledby="login-heading">
          <div className="gass-login__form-content w-full">
            <div className="mb-12 flex items-center justify-between lg:hidden">
              <div>
                <div className="font-brand text-3xl font-extrabold tracking-[-0.045em] text-[#064E3B]">GASS.</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">General Affair Services System</div>
              </div>
              <img src="/brand-logo.png" alt="KCSI Consulting-Shared Services" className="h-11 w-auto object-contain" />
            </div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#087045]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0B7A4B]" />
              Akses ruang kerja aman
            </div>
            <h2 id="login-heading" className="font-brand text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl">
              Selamat datang kembali
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Masuk untuk mengelola reservasi dan permintaan Anda.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5" data-testid="login-form" aria-busy={loading}>
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-slate-700">Alamat email</label>
                <input
                  id="login-email"
                  name="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B7A4B] focus:bg-white focus:ring-4 focus:ring-[#0B7A4B]/10"
                  placeholder="lorem@kcsi.com"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">Kata sandi</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[#0B7A4B] hover:text-[#064E3B] hover:underline"
                    data-testid="forgot-password-link"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="gass-login__password">
                  <input
                    id="login-password"
                    name="password"
                    autoComplete="current-password"
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B7A4B] focus:bg-white focus:ring-4 focus:ring-[#0B7A4B]/10"
                    placeholder="Masukkan kata sandi"
                  />
                  <button
                    type="button"
                    className="gass-login__password-toggle"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-pressed={showPassword}
                    aria-controls="login-password"
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  data-testid="login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="gass-login__submit flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sedang masuk..." : "Masuk"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Baru di GASS?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#0B7A4B] hover:text-[#064E3B] hover:underline"
                data-testid="go-register-link"
              >
                Buat akun
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
