import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Loader2, Calendar, Route, Users as UsersIcon } from "lucide-react";
import { toYMD } from "../../utils/dates";

export default function CarBookingNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => toYMD(new Date()), []);

  const [form, setForm] = useState({
    booking_type: "single_trip",
    employee_name: user?.name || "",
    job_title: "",
    department: user?.company_name || "",
    with_driver: true,
    pickup_location: "",
    destination: "",
    usage_area: "",
    purpose: "",
    passengers: 1,
    start_date: today,
    start_time: "08:00",
    end_date: today,
    end_time: "17:00",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isMulti = form.booking_type === "multi_day";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.start_date > form.end_date) {
      setError("End date must be on or after start date.");
      return;
    }
    if (!isMulti && form.start_date !== form.end_date) {
      setForm((f) => ({ ...f, end_date: f.start_date }));
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        end_date: isMulti ? form.end_date : form.start_date,
        passengers: Number(form.passengers),
      };
      const { data } = await api.post("/vehicle-bookings", payload);
      navigate(`/car/bookings/${data.id}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="car-new-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          New Vehicle Booking
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Request a company vehicle
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose a single-trip booking with driver, or a multi-day reservation.
        </p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]" data-testid="car-booking-form">
        <div className="space-y-5 rounded-sm border border-slate-200 bg-white p-6">
          {/* Booking type */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Booking type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "single_trip", icon: Route, title: "Single Trip", sub: "One-day with driver" },
                { v: "multi_day", icon: Calendar, title: "Multi-Day", sub: "With or without driver" },
              ].map((t) => {
                const Icon = t.icon;
                const selected = form.booking_type === t.v;
                return (
                  <button
                    type="button"
                    key={t.v}
                    onClick={() => set("booking_type", t.v)}
                    data-testid={`booking-type-${t.v}`}
                    className={`flex items-start gap-3 rounded-sm border-2 p-4 text-left transition-colors ${
                      selected ? "border-[#0055FF] bg-[#0055FF]/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 ${selected ? "text-[#0055FF]" : "text-slate-500"}`} />
                    <div>
                      <div className={`font-semibold ${selected ? "text-[#0055FF]" : "text-slate-900"}`}>
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500">{t.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Employee + Job */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee name *</label>
              <input
                required
                data-testid="cf-name-input"
                value={form.employee_name}
                onChange={(e) => set("employee_name", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Job title / Position *</label>
              <input
                required
                data-testid="cf-title-input"
                value={form.job_title}
                onChange={(e) => set("job_title", e.target.value)}
                placeholder="e.g. Senior Consultant"
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Department / Company</label>
            <input
              data-testid="cf-department-input"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>

          {/* Single-trip specific */}
          {!isMulti && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Pickup / Departure location *</label>
                <input
                  required
                  data-testid="cf-pickup-input"
                  value={form.pickup_location}
                  onChange={(e) => set("pickup_location", e.target.value)}
                  className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Destination *</label>
                <input
                  required
                  data-testid="cf-destination-input"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
                />
              </div>
            </div>
          )}

          {/* Multi-day specific */}
          {isMulti && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Borrowing area / Usage area *</label>
                <input
                  required
                  data-testid="cf-usage-area-input"
                  value={form.usage_area}
                  onChange={(e) => set("usage_area", e.target.value)}
                  placeholder="e.g. Jakarta - Bandung corridor"
                  className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  data-testid="cf-with-driver-checkbox"
                  checked={form.with_driver}
                  onChange={(e) => set("with_driver", e.target.checked)}
                />
                Request a driver (uncheck for self-drive)
              </label>
            </>
          )}

          {/* Dates */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start date *</label>
              <input
                type="date"
                required
                min={today}
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                data-testid="cf-start-date"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                data-testid="cf-start-time"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {isMulti ? "End date *" : "End date"}
              </label>
              <input
                type="date"
                required
                min={form.start_date}
                disabled={!isMulti}
                value={isMulti ? form.end_date : form.start_date}
                onChange={(e) => set("end_date", e.target.value)}
                data-testid="cf-end-date"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
                data-testid="cf-end-time"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
          </div>

          {/* Purpose + passengers */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Purpose of trip *</label>
            <textarea
              required
              rows={2}
              data-testid="cf-purpose-input"
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="Client visit, on-site delivery, conference attendance, etc."
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Estimated passengers *</label>
              <input
                type="number"
                min={1}
                required
                data-testid="cf-passengers-input"
                value={form.passengers}
                onChange={(e) => set("passengers", e.target.value)}
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF]"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="cf-error">
              {error}
            </div>
          )}
        </div>

        {/* Sidebar summary + submit */}
        <div className="space-y-3">
          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Booking Summary
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div>
                <span className="text-slate-400">Type:</span>{" "}
                {isMulti ? "Multi-day" : "Single trip"}
              </div>
              <div>
                <span className="text-slate-400">Driver:</span>{" "}
                {form.with_driver ? "Yes" : "Self-drive"}
              </div>
              <div>
                <span className="text-slate-400">Dates:</span>{" "}
                {form.start_date}
                {isMulti && form.start_date !== form.end_date && ` → ${form.end_date}`}
              </div>
              <div>
                <span className="text-slate-400">Times:</span>{" "}
                {form.start_time} – {form.end_time}
              </div>
              <div>
                <span className="text-slate-400">Passengers:</span>{" "}
                <UsersIcon className="inline h-3 w-3" /> {form.passengers}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            data-testid="cf-submit-btn"
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#0055FF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit booking request
          </button>
          <p className="text-center text-xs text-slate-500">
            Your request will be reviewed by the Car Admin division.
          </p>
        </div>
      </form>
    </div>
  );
}
