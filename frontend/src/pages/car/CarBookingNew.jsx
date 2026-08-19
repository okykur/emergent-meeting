import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Loader2, Car, Map, Plus, UploadCloud, X } from "lucide-react";
import { toYMD } from "../../utils/dates";
import { getCarBookingFormRule } from "../../utils/carBookingRules";

const ACTIVITY_CODES = [
  { value: "ACT-001", label: "ACT-001 - Meeting" },
  { value: "ACT-002", label: "ACT-002 - Site Visit" },
  { value: "ACT-003", label: "ACT-003 - Customer Visit" },
  { value: "ACT-004", label: "ACT-004 - Operational Support" },
];

const PASSENGER_STATUSES = ["Karyawan", "BOD", "FAM", "Karyawan Tamu"];
const MAX_PRO_IN_SIZE = 10 * 1024 * 1024;
const ACCEPTED_PRO_IN_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function Section({ title, children }) {
  return (
    <section className="rounded-sm border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function inputClass(readOnly = false) {
  return `w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] ${
    readOnly ? "bg-slate-50 text-slate-500" : ""
  }`;
}

function emptyPassenger() {
  return { name: "", status: "Karyawan", nik: "" };
}

function PassengerDialog({ initial, onClose, onSave }) {
  const [draft, setDraft] = useState(initial || emptyPassenger());

  const save = () => {
    if (!draft.name.trim()) return;
    onSave({
      name: draft.name.trim(),
      status: draft.status,
      nik: draft.status === "Karyawan" ? draft.nik.trim() : draft.nik.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-sm border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Penumpang
            </div>
            <h3 className="font-display text-xl font-semibold text-slate-900">
              Tambah / Edit Penumpang
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="Nama Penumpang *">
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft((p) => ({ ...p, name: event.target.value }))}
              className={inputClass()}
            />
          </Field>
          <Field label="Status *">
            <select
              value={draft.status}
              onChange={(event) => setDraft((p) => ({ ...p, status: event.target.value }))}
              className={inputClass()}
            >
              {PASSENGER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="NIK / Employee ID">
            <input
              value={draft.nik}
              onChange={(event) => setDraft((p) => ({ ...p, nik: event.target.value }))}
              placeholder={draft.status === "Karyawan" ? "Contoh: 123456" : "Opsional"}
              className={inputClass()}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

export default function CarBookingNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const today = useMemo(() => toYMD(new Date()), []);

  const initialPassenger = useMemo(
    () => ({
      name: user?.name || "",
      status: "Karyawan",
      nik: "",
    }),
    [user?.name]
  );

  const [form, setForm] = useState({
    employee_name: user?.name || "",
    job_title: user?.job_title || "",
    department: user?.department || user?.company_name || "",
    division: "",
    cost_center: "",
    service_type: "dalam_kota",
    with_driver: true,
    distance_km: "",
    pickup_location: "",
    destination: "",
    purpose: "",
    activity_code: "",
    start_date: today,
    start_time: "08:00",
    end_date: today,
    end_time: "17:00",
    notes: "",
  });
  const [passengers, setPassengers] = useState([initialPassenger]);
  const [passengerDialog, setPassengerDialog] = useState(null);
  const [proInFile, setProInFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = getCarBookingFormRule({
    serviceType: form.service_type,
    distanceKm: form.distance_km,
    requesterType: "karyawan",
    withDriver: form.with_driver,
  });

  const set = (key, value) => {
    setError("");
    setMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectServiceType = (serviceType) => {
    setError("");
    setMessage("");
    setForm((current) => ({
      ...current,
      service_type: serviceType,
      with_driver: serviceType === "luar_kota" ? true : current.with_driver,
    }));
  };

  const validateForm = () => {
    const start = `${form.start_date}T${form.start_time}`;
    const end = `${form.end_date}T${form.end_time}`;
    if (end <= start) {
      return "Tanggal dan waktu kembali harus setelah tanggal dan waktu keberangkatan.";
    }
    if (!form.employee_name.trim()) return "Nama peminjam wajib diisi.";
    if (!form.department.trim()) return "Department wajib diisi.";
    if (rules.requireDistance && Number(form.distance_km) < 1) {
      return "Estimasi jarak perjalanan wajib diisi minimal 1 KM.";
    }
    if (!form.pickup_location.trim()) return "Tempat penjemputan wajib diisi.";
    if (!form.destination.trim()) return "Tujuan / rute perjalanan wajib diisi.";
    if (form.destination.length > 500) return "Tujuan / rute perjalanan maksimal 500 karakter.";
    if (!form.purpose.trim()) return "Keperluan / tujuan wajib diisi.";
    if (!form.activity_code) return "Activity Code wajib dipilih.";
    if (passengers.length < 1 || passengers.some((p) => !p.name.trim())) {
      return "Minimal 1 penumpang wajib diisi.";
    }
    if (rules.requireProIn && !proInFile) return "Upload Pro-In wajib dilampirkan.";
    return "";
  };

  const buildPayload = () => ({
    ...form,
    job_title: form.job_title || user?.job_title || "-",
    booking_type: form.start_date === form.end_date ? "single_trip" : "multi_day",
    with_driver: form.with_driver,
    passengers: passengers.length,
    passenger_list: passengers,
    distance_km: rules.showDistance ? Number(form.distance_km) : null,
    require_pro_in: rules.requireProIn,
    require_dept_head_approval: rules.requireDeptHeadApproval,
    pro_in_file: rules.showProIn ? proInFile : null,
  });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/vehicle-bookings", buildPayload());
      localStorage.removeItem("kcsi-car-booking-draft");
      navigate(`/car/bookings/${data.id}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = () => {
    localStorage.setItem(
      "kcsi-car-booking-draft",
      JSON.stringify({ form, passengers, proInFile, saved_at: new Date().toISOString() })
    );
    setMessage("Draft tersimpan di browser ini.");
  };

  const handlePassengerSave = (passenger) => {
    setPassengers((current) => {
      if (passengerDialog?.index != null) {
        return current.map((item, index) => (index === passengerDialog.index ? passenger : item));
      }
      return [...current, passenger];
    });
    setPassengerDialog(null);
  };

  const removePassenger = (index) => {
    setPassengers((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleFile = (file) => {
    setError("");
    if (!file) return;
    if (!ACCEPTED_PRO_IN_TYPES.includes(file.type)) {
      setError("Format file Pro-In harus PDF, JPG, JPEG, atau PNG.");
      return;
    }
    if (file.size > MAX_PRO_IN_SIZE) {
      setError("Ukuran file Pro-In maksimal 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProInFile({
        name: file.name,
        size: file.size,
        type: file.type,
        data_url: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div data-testid="car-new-page">
      <div className="mb-8 rounded-sm border border-slate-200 bg-white p-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Car / Vehicle
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Book kendaraan untuk kebutuhan perjalanan operasional
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Lengkapi informasi peminjam, jadwal, rute perjalanan, dan dokumen pendukung jika diperlukan.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5" data-testid="car-booking-form">
        <Section title="Informasi Peminjam">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nama Peminjam *">
              <input
                required
                readOnly={Boolean(user?.name)}
                value={form.employee_name}
                onChange={(event) => set("employee_name", event.target.value)}
                className={inputClass(Boolean(user?.name))}
              />
            </Field>
            <Field label="Department *">
              <input
                required
                readOnly={Boolean(user?.department || user?.company_name)}
                value={form.department}
                onChange={(event) => set("department", event.target.value)}
                className={inputClass(Boolean(user?.department || user?.company_name))}
              />
            </Field>
            <Field label="Division">
              <input
                value={form.division}
                onChange={(event) => set("division", event.target.value)}
                placeholder="Contoh: Information Technology"
                className={inputClass()}
              />
            </Field>
            <Field label="Cost Center">
              <input
                value={form.cost_center}
                onChange={(event) => set("cost_center", event.target.value)}
                placeholder="Contoh: CC-IT-001"
                className={inputClass()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Jenis Layanan">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                value: "dalam_kota",
                icon: Car,
                title: "Dalam Kota",
                description: "Perjalanan operasional dalam kota",
              },
              {
                value: "luar_kota",
                icon: Map,
                title: "Luar Kota",
                description: "Perjalanan operasional luar kota",
              },
            ].map((option) => {
              const Icon = option.icon;
              const selected = form.service_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectServiceType(option.value)}
                  data-testid={`service-type-${option.value}`}
                  className={`flex items-start gap-3 rounded-sm border-2 p-4 text-left transition-colors ${
                    selected ? "border-[#0055FF] bg-[#0055FF]/5" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 ${selected ? "text-[#0055FF]" : "text-slate-500"}`} />
                  <div>
                    <div className={`font-semibold ${selected ? "text-[#0055FF]" : "text-slate-900"}`}>
                      {option.title}
                    </div>
                    <div className="text-xs text-slate-500">{option.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {form.service_type === "dalam_kota" && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Pilihan Driver</label>
                <div className="grid max-w-2xl grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    {
                      value: true,
                      title: "Dengan Driver",
                      description: "Default. Kendaraan dan driver disiapkan oleh Transportation.",
                    },
                    {
                      value: false,
                      title: "Tanpa Driver",
                      description: "Wajib upload dokumen Pro-In.",
                    },
                  ].map((option) => {
                    const selected = form.with_driver === option.value;
                    return (
                      <button
                        key={option.title}
                        type="button"
                        onClick={() => set("with_driver", option.value)}
                        data-testid={`driver-option-${option.value ? "with-driver" : "without-driver"}`}
                        className={`rounded-sm border p-3 text-left transition-colors ${
                          selected ? "border-[#0055FF] bg-[#0055FF]/5" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className={`text-sm font-semibold ${selected ? "text-[#0055FF]" : "text-slate-900"}`}>
                          {option.title}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{option.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.with_driver ? (
                <div className="rounded-sm border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Kendaraan dan driver akan disiapkan oleh Transportation.
                </div>
              ) : (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Tanpa driver membutuhkan Upload Pro-In sebelum booking dapat dikirim.
                </div>
              )}
            </div>
          )}

          {rules.showDistance && (
            <div className="mt-4 max-w-md">
              <Field label="Estimasi Jarak Perjalanan *">
                <div className="flex items-center">
                  <input
                    type="number"
                    min={1}
                    required={rules.requireDistance}
                    value={form.distance_km}
                    onChange={(event) => set("distance_km", event.target.value)}
                    placeholder="Contoh: 85"
                    className={`${inputClass()} rounded-r-none`}
                  />
                  <span className="rounded-r-sm border border-l-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    KM
                  </span>
                </div>
              </Field>
              {form.distance_km && rules.requireDeptHeadApproval && (
                <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Perjalanan ini memerlukan approval Department Head.
                </div>
              )}
              {rules.requireProIn && (
                <div className="mt-3 rounded-sm border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Pro-In diperlukan untuk perjalanan luar kota 60 KM atau lebih.
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Jadwal Perjalanan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tanggal Berangkat *">
              <input
                type="date"
                required
                min={today}
                value={form.start_date}
                onChange={(event) => set("start_date", event.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Waktu Berangkat *">
              <input
                type="time"
                required
                value={form.start_time}
                onChange={(event) => set("start_time", event.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Tanggal Kembali *">
              <input
                type="date"
                required
                min={form.start_date}
                value={form.end_date}
                onChange={(event) => set("end_date", event.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Waktu Kembali *">
              <input
                type="time"
                required
                value={form.end_time}
                onChange={(event) => set("end_time", event.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Tempat Penjemputan *">
              <input
                required
                value={form.pickup_location}
                onChange={(event) => set("pickup_location", event.target.value)}
                placeholder="Contoh: Lobby Head Office, Gedung A"
                className={inputClass()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Detail Perjalanan">
          <div className="space-y-4">
            <Field label="Tujuan / Rute Perjalanan *">
              <textarea
                required
                rows={3}
                maxLength={500}
                value={form.destination}
                onChange={(event) => set("destination", event.target.value)}
                placeholder="Contoh: Head Office -> Bogor Plant -> Head Office"
                className={`${inputClass()} resize-none`}
              />
              <div className="mt-1 text-right text-xs text-slate-400">{form.destination.length}/500</div>
            </Field>
            <Field label="Keperluan / Tujuan *">
              <textarea
                required
                rows={3}
                value={form.purpose}
                onChange={(event) => set("purpose", event.target.value)}
                placeholder="Contoh: Meeting dengan customer dan site visit"
                className={`${inputClass()} resize-none`}
              />
            </Field>
            <Field label="Activity Code *">
              <select
                required
                value={form.activity_code}
                onChange={(event) => set("activity_code", event.target.value)}
                className={inputClass()}
              >
                <option value="">Search Activity Code...</option>
                {ACTIVITY_CODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Penumpang">
          <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="text-sm font-semibold text-slate-700">
              Jumlah Penumpang: {passengers.length} Orang
            </div>
            <button
              type="button"
              onClick={() => setPassengerDialog({ initial: emptyPassenger() })}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Tambah Penumpang
            </button>
          </div>
          <div className="hidden overflow-x-auto rounded-sm border border-slate-200 md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">NIK</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((passenger, index) => (
                  <tr key={`${passenger.name}-${index}`} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-900">{passenger.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{passenger.status}</td>
                    <td className="px-4 py-3 text-slate-700">{passenger.nik || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPassengerDialog({ index, initial: passenger })}
                        className="mr-3 text-sm font-semibold text-[#0055FF] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        disabled={passengers.length <= 1}
                        className="text-sm font-semibold text-red-600 hover:underline disabled:text-slate-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {passengers.map((passenger, index) => (
              <div key={`${passenger.name}-${index}`} className="rounded-sm border border-slate-200 p-3">
                <div className="font-semibold text-slate-900">{passenger.name || "-"}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {passenger.status} - {passenger.nik || "-"}
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPassengerDialog({ index, initial: passenger })}
                    className="text-sm font-semibold text-[#0055FF]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removePassenger(index)}
                    disabled={passengers.length <= 1}
                    className="text-sm font-semibold text-red-600 disabled:text-slate-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {rules.showProIn && (
          <Section title="Supporting Document">
            <Field label="Upload Pro-In *">
              <p className="mb-3 text-sm text-slate-500">
                {form.service_type === "dalam_kota" && !form.with_driver
                  ? "Pro-In wajib untuk pengajuan Dalam Kota tanpa driver."
                  : "Pro-In wajib untuk perjalanan luar kota 60 KM atau lebih."}
              </p>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFile(event.dataTransfer.files?.[0]);
                }}
                className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
              >
                <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Drag & drop file here</p>
                <p className="text-xs text-slate-500">or</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Select File
                </button>
                <p className="mt-2 text-xs text-slate-500">PDF / JPG / PNG - Max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
              </div>
            </Field>
            {proInFile && (
              <div className="mt-3 flex flex-col justify-between gap-3 rounded-sm border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center">
                <div>
                  <div className="font-semibold text-slate-900">{proInFile.name}</div>
                  <div className="text-xs text-slate-500">{formatBytes(proInFile.size)}</div>
                </div>
                <div className="flex gap-3">
                  <a href={proInFile.data_url} target="_blank" rel="noreferrer" className="font-semibold text-[#0055FF]">
                    View
                  </a>
                  <button type="button" onClick={() => setProInFile(null)} className="font-semibold text-red-600">
                    Remove
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

        <Section title="Informasi Tambahan">
          <Field label="Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Tambahkan catatan tambahan jika diperlukan"
              className={`${inputClass()} resize-none`}
            />
          </Field>
        </Section>

        {message && (
          <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="cf-error">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 z-20 flex flex-col justify-end gap-2 border-t border-slate-200 bg-[#f8f9fa]/95 py-4 backdrop-blur sm:flex-row">
          <button
            type="button"
            onClick={() => navigate("/hub")}
            className="rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            data-testid="cf-submit-btn"
            className="flex items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Booking
          </button>
        </div>
      </form>

      {passengerDialog && (
        <PassengerDialog
          initial={passengerDialog.initial}
          onClose={() => setPassengerDialog(null)}
          onSave={handlePassengerSave}
        />
      )}
    </div>
  );
}
