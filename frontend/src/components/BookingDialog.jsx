import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CalendarClock } from "lucide-react";
import { api, formatApiError } from "../api";
import { getRoomOperatingHours, isWithinOperatingHours, roomOperatingHoursLabel, toYMD, nowTime } from "../utils/dates";

const LAYOUT_OPTIONS = ["U-Shape", "Classroom", "Round", "Theater", "Lainnya"];
const FOOD_BEVERAGE_RULES = [
  { label: "Snack", minMinutes: 4 * 60 },
  { label: "Makan siang", minMinutes: 5 * 60 },
];

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildFoodBeverages(selectedItems, notes) {
  const parts = [...selectedItems];
  const trimmedNotes = notes.trim();
  if (trimmedNotes) parts.push(trimmedNotes);
  return parts.join(", ");
}

export default function BookingDialog({ room, onClose, onBooked }) {
  const today = useMemo(() => toYMD(new Date()), []);
  const operatingHours = useMemo(() => getRoomOperatingHours(room), [room]);
  const defaultEndTime = useMemo(() => {
    const oneHourAfterOpen = addMinutesToTime(operatingHours.start, 60);
    return oneHourAfterOpen <= operatingHours.end ? oneHourAfterOpen : operatingHours.end;
  }, [operatingHours]);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return toYMD(d);
  }, []);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(operatingHours.start);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [participants, setParticipants] = useState(1);
  const [layoutType, setLayoutType] = useState("");
  const [layoutOther, setLayoutOther] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedFoodBeverages, setSelectedFoodBeverages] = useState([]);
  const [foodBeverageNotes, setFoodBeverageNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const canChooseLayout = room?.layout_fixed === false;
  const durationMinutes = useMemo(
    () => (startTime && endTime && startTime < endTime ? timeToMinutes(endTime) - timeToMinutes(startTime) : 0),
    [startTime, endTime]
  );
  const availableFoodBeverages = useMemo(
    () => FOOD_BEVERAGE_RULES.filter((item) => durationMinutes >= item.minMinutes),
    [durationMinutes]
  );

  useEffect(() => {
    setStartTime(operatingHours.start);
    setEndTime(defaultEndTime);
    setLayoutType("");
    setLayoutOther("");
  }, [room?.id, operatingHours.start, defaultEndTime]);

  useEffect(() => {
    const allowed = new Set(availableFoodBeverages.map((item) => item.label));
    setSelectedFoodBeverages((items) => items.filter((item) => allowed.has(item)));
    if (availableFoodBeverages.length === 0) setFoodBeverageNotes("");
  }, [availableFoodBeverages]);

  const availabilityMessage = (slot) => {
    const conflict = slot?.conflicts?.[0];
    if (conflict) {
      return `${slot.reason}. Existing booking: ${conflict.start_time}-${conflict.end_time}.`;
    }
    return slot?.reason || "Room is not available for this date and time.";
  };

  const checkSlotAvailability = async () => {
    const { data } = await api.get(`/rooms/${room.id}/availability/check`, {
      params: {
        date,
        start_time: startTime,
        end_time: endTime,
      },
    });
    setAvailability(data);
    return data;
  };

  useEffect(() => {
    setAvailability(null);
    if (!room?.id || !date || !startTime || !endTime || startTime >= endTime) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingAvailability(true);
      try {
        const data = await checkSlotAvailability();
        if (!cancelled) setAvailability(data);
      } catch (err) {
        if (!cancelled) {
          setAvailability({
            available: false,
            reason: formatApiError(err),
            conflicts: [],
          });
        }
      } finally {
        if (!cancelled) setCheckingAvailability(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, date, startTime, endTime]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }
    if (participants > room.capacity) {
      setError(`Participants exceed room capacity (${room.capacity}).`);
      return;
    }
    if (canChooseLayout && !layoutType) {
      setError("Please select a room layout.");
      return;
    }
    if (canChooseLayout && layoutType === "Lainnya" && !layoutOther.trim()) {
      setError("Please describe the custom room layout.");
      return;
    }
    if (!isWithinOperatingHours(room, startTime, endTime)) {
      setError(`Booking must be within room operational hours (${roomOperatingHoursLabel(room)}).`);
      return;
    }
    if (date === today && startTime < nowTime()) {
      setError("Cannot book a time in the past.");
      return;
    }
    setLoading(true);
    try {
      const slot = await checkSlotAvailability();
      if (!slot.available) {
        setError(availabilityMessage(slot));
        setLoading(false);
        return;
      }
      await api.post("/bookings", {
        room_id: room.id,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        participants: Number(participants),
        layout_type: canChooseLayout ? layoutType : "",
        layout_other: canChooseLayout && layoutType === "Lainnya" ? layoutOther : "",
        phone_number: phoneNumber,
        food_beverages: buildFoodBeverages(selectedFoodBeverages, foodBeverageNotes),
        notes,
      });
      onBooked?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in-up"
      data-testid="booking-dialog"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Request Booking
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {room.name}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Operational hours: {roomOperatingHoursLabel(room)}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0055FF]">
              {room.building || "Unassigned"}
            </p>
            <p className="text-xs text-slate-500">
              {room.location} · Capacity {room.capacity}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="booking-dialog-close"
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="min-h-0 space-y-4 overflow-y-auto p-5" data-testid="booking-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meeting title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="booking-title-input"
              placeholder="Q2 Strategy Review"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                min={today}
                max={maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="booking-date-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
              <input
                type="time"
                required
                min={operatingHours.start}
                max={operatingHours.end}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="booking-start-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
              <input
                type="time"
                required
                min={operatingHours.start}
                max={operatingHours.end}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="booking-end-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
          </div>
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            This room can be booked only between {roomOperatingHoursLabel(room)}.
          </div>
          {checkingAvailability && (
            <div
              className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700"
              data-testid="booking-availability-checking"
            >
              Checking room availability...
            </div>
          )}
          {!checkingAvailability && availability?.available === true && (
            <div
              className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              data-testid="booking-availability-available"
            >
              Room is available for {date} at {startTime}-{endTime}.
            </div>
          )}
          {!checkingAvailability && availability?.available === false && (
            <div
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="booking-availability-unavailable"
            >
              {availabilityMessage(availability)}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Participants (max {room.capacity})
            </label>
            <input
              type="number"
              min={1}
              max={room.capacity}
              required
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              data-testid="booking-participants-input"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          {canChooseLayout ? (
            <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Layout</label>
                <select
                  required
                  value={layoutType}
                  onChange={(e) => {
                    setLayoutType(e.target.value);
                    if (e.target.value !== "Lainnya") setLayoutOther("");
                  }}
                  data-testid="booking-layout-select"
                  className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                >
                  <option value="">Select layout</option>
                  {LAYOUT_OPTIONS.map((layout) => (
                    <option key={layout} value={layout}>
                      {layout}
                    </option>
                  ))}
                </select>
              </div>
              {layoutType === "Lainnya" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Layout lainnya</label>
                  <input
                    required
                    value={layoutOther}
                    onChange={(e) => setLayoutOther(e.target.value)}
                    data-testid="booking-layout-other-input"
                    placeholder="Contoh: boardroom custom, cluster, standing discussion"
                    className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Room layout is fixed and cannot be changed for this room.
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nomor HP</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              data-testid="booking-phone-input"
              placeholder="0812 3456 7890"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          {availableFoodBeverages.length > 0 ? (
            <div className="space-y-3 rounded-sm border border-amber-200 bg-amber-50 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Food and Beverages</div>
                <p className="mt-1 text-xs text-slate-500">
                  Pilihan ini muncul otomatis untuk meeting berdurasi {durationMinutes >= 5 * 60 ? "5 jam atau lebih" : "4 jam atau lebih"}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableFoodBeverages.map((item) => (
                  <label
                    key={item.label}
                    className="flex items-center gap-2 rounded-sm border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFoodBeverages.includes(item.label)}
                      onChange={(e) =>
                        setSelectedFoodBeverages((items) =>
                          e.target.checked ? [...items, item.label] : items.filter((value) => value !== item.label)
                        )
                      }
                      data-testid={`booking-food-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <textarea
                value={foodBeverageNotes}
                onChange={(e) => setFoodBeverageNotes(e.target.value)}
                data-testid="booking-food-beverages-input"
                rows={2}
                placeholder="Catatan optional: morning snack, evening snack, kopi"
                className="w-full resize-none rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
          ) : (
            <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Pilihan Food and Beverages akan muncul otomatis jika durasi meeting 4 jam atau lebih.
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="booking-notes-input"
              rows={3}
              placeholder="AV setup, catering, etc."
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          {error && (
            <div
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="booking-error"
            >
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              data-testid="booking-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || checkingAvailability || availability?.available === false}
              data-testid="booking-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Submit request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
