import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Info, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Register.css";

const emptyForm = {
  name: "", email: "", company_name: "", job_title: "", department: "",
  supervisor_name: "", supervisor_email: "", office_address: "", password: "", confirmation: "",
};

function Field({ label, id, children }) {
  return (
    <div className="gass-register__field">
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      {children}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (Object.entries(form).some(([key, value]) => !["password", "confirmation"].includes(key) && !value.trim())) {
      setError("Lengkapi semua informasi data karyawan.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password harus terdiri dari minimal 8 karakter.");
      return;
    }
    if (form.password !== form.confirmation) {
      setError("Konfirmasi password belum sesuai.");
      return;
    }
    if (!accepted) {
      setError("Anda perlu menyetujui pernyataan sebelum mendaftar.");
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        department: form.department.trim(),
        supervisor_name: form.supervisor_name.trim(),
        supervisor_email: form.supervisor_email.trim(),
        office_address: form.office_address.trim(),
        password: form.password,
      });
      if (result.ok) {
        setForm({ ...emptyForm });
        setAccepted(false);
        setSuccess(true);
      } else {
        setError(result.error || "Pendaftaran belum berhasil. Silakan coba kembali.");
      }
    } catch {
      setError("Tidak dapat mengirim pendaftaran. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="gass-register" lang="id" data-testid={success ? "register-pending-page" : "register-page"}>
      <header className="gass-register__header">
        <Link to="/login" className="gass-register__brand" aria-label="GASS - Halaman login">
          <img src="/brand-logo.png" alt="KCSI" />
          <span>GASS</span>
        </Link>
        <Link to="/login" data-testid="go-login-link">Kembali ke Halaman Login</Link>
      </header>

      {success ? (
        <div className="gass-register__content gass-register__content--confirmation">
          <div className="gass-register__intro">
            <h1>Registrasi Hub &amp; Alur Sistem</h1>
            <p>Buat akun untuk memesan aset internal. Alur pendaftaran memerlukan verifikasi admin General Affair (GA).</p>
          </div>

          <section className="gass-register__pending" aria-labelledby="registration-status">
            <div className="gass-register__confirmation-heading">
              <div className="gass-register__confirmation-icon" aria-hidden="true">
                <Check size={22} strokeWidth={2} />
              </div>
              <div>
                <h2 id="registration-status">Pendaftaran Berhasil Diajukan!</h2>
                <span>General Affair Services System - PT KCSI Booking Hub</span>
              </div>
              <div className="gass-register__status-badge">Menunggu approval</div>
            </div>

            <p role="status" data-testid="register-success">
              Akun Anda sedang dalam antrean verifikasi oleh <strong>Super Admin GA (General Affair)</strong>. Tim GA akan
              memeriksa keabsahan email dan unit departemen Anda sebelum membuka akses pemesanan.
            </p>

            <div className="gass-register__confirmation-help">
              <Info size={18} aria-hidden="true" />
              <span>Butuh persetujuan cepat untuk rapat mendesak? Hubungi GA Officer ext: <strong>3102</strong> atau kunjungi GA Desk di Site Pulogadung / Kudus.</span>
            </div>
          </section>
        </div>
      ) : (
        <div className="gass-register__content">
          <div className="gass-register__intro">
            <h1>Registrasi Hub &amp; Alur Sistem</h1>
            <p>Buat akun untuk memesan aset internal. Super Admin akan memverifikasi pendaftaran dan menentukan hak akses Anda.</p>
          </div>

          <section className="gass-register__card" aria-labelledby="employee-form-heading">
            <h2 id="employee-form-heading">Formulir Informasi Data Karyawan</h2>
            <form onSubmit={submit} data-testid="register-form" aria-busy={loading}>
              <fieldset disabled={loading} className="gass-register__grid">
                <legend className="sr-only">Data karyawan. Semua kolom wajib diisi.</legend>
                <Field label="Nama Lengkap" id="register-name">
                  <input id="register-name" autoComplete="name" required maxLength={120}
                    value={form.name} onChange={(event) => update("name", event.target.value)}
                    placeholder="Sesuai ID Card Karyawan" data-testid="register-name-input" />
                </Field>
                <Field label="Email" id="register-email">
                  <input id="register-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
                    value={form.email} onChange={(event) => update("email", event.target.value)}
                    placeholder="nama@email.com" data-testid="register-email-input" />
                </Field>
                <Field label="Nama Perusahaan" id="register-company">
                  <input id="register-company" autoComplete="organization" required maxLength={120}
                    value={form.company_name} onChange={(event) => update("company_name", event.target.value)}
                    placeholder="Nama perusahaan" data-testid="register-company-input" />
                </Field>
                <Field label="Departemen" id="register-department">
                  <input id="register-department" required maxLength={120}
                    value={form.department} onChange={(event) => update("department", event.target.value)}
                    placeholder="Masukkan departemen Anda" data-testid="register-department-input" />
                </Field>
                <Field label="Jabatan" id="register-job-title">
                  <input id="register-job-title" autoComplete="organization-title" required maxLength={120}
                    value={form.job_title} onChange={(event) => update("job_title", event.target.value)}
                    placeholder="Jabatan Anda" data-testid="register-job-title-input" />
                </Field>
                <Field label="Alamat Kantor" id="register-office">
                  <textarea id="register-office" required rows={2} maxLength={240}
                    value={form.office_address} onChange={(event) => update("office_address", event.target.value)}
                    placeholder="Alamat lengkap kantor" data-testid="register-office-address-input" />
                </Field>
                <div className="gass-register__supervisor" role="group" aria-labelledby="register-supervisor-heading">
                  <h3 id="register-supervisor-heading">Atasan</h3>
                  <div className="gass-register__grid">
                    <Field label="Nama Atasan" id="register-supervisor">
                      <input id="register-supervisor" required maxLength={120}
                        value={form.supervisor_name} onChange={(event) => update("supervisor_name", event.target.value)}
                        placeholder="Nama atasan" data-testid="register-supervisor-name-input" />
                    </Field>
                    <Field label="Email Atasan" id="register-supervisor-email">
                      <input id="register-supervisor-email" type="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
                        value={form.supervisor_email} onChange={(event) => update("supervisor_email", event.target.value)}
                        placeholder="atasan@company.com" data-testid="register-supervisor-email-input" />
                    </Field>
                  </div>
                </div>
                <Field label="Password" id="register-password">
                  <input id="register-password" type="password" autoComplete="new-password" minLength={8} required
                    value={form.password} onChange={(event) => update("password", event.target.value)}
                    placeholder="Buat password minimal 8 karakter" data-testid="register-password-input" />
                </Field>
                <Field label="Konfirmasi Password" id="register-confirmation">
                  <input id="register-confirmation" type="password" autoComplete="new-password" minLength={8} required
                    value={form.confirmation} onChange={(event) => update("confirmation", event.target.value)}
                    placeholder="Ulangi password Anda" data-testid="register-confirm-password-input" />
                </Field>
              </fieldset>
              {error && <div className="gass-register__error" role="alert" data-testid="register-error">{error}</div>}
              <div className="gass-register__actions">
                <label className="gass-register__consent">
                  <input type="checkbox" required checked={accepted} disabled={loading}
                    onChange={(event) => setAccepted(event.target.checked)} data-testid="register-consent-input" />
                  <span>Saya menyatakan data di atas benar dan siap mengikuti ketentuan peminjaman internal KCSI.</span>
                </label>
                <button type="submit" disabled={loading} data-testid="register-submit-btn">
                  {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {loading ? "Mendaftarkan..." : "Daftar Akun Baru"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
