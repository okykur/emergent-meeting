import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CalendarClock } from "lucide-react";
import { api, formatApiError } from "../api";
import { getRoomOperatingHours, isWithinOperatingHours, roomOperatingHoursLabel, toYMD, nowTime } from "../utils/dates";
import TimeSelect from "./TimeSelect";

const LAYOUT_OPTIONS = ["U-Shape", "Classroom", "Round", "Theater", "Lainnya"];
const ADDITIONAL_FACILITY_OPTIONS = ["LCD", "Pointer", "Laptop", "Zoom"];
const FOOD_BEVERAGE_RULES = [
  { label: "Snack", minMinutes: 4 * 60 },
  { label: "Makan siang", minMinutes: 5 * 60 },
  { label: "Makan malam", minMinutes: 5 * 60 },
];
const GUEST_TYPES = ["Internal", "BOD", "Xternal"];
const SNACK_PACKAGING = ["Plating", "Dus"];
const MEAL_PACKAGING = ["Prasmanan", "Dus"];
const EMPTY_FNB_DETAILS = {
  department: "",
  division: "",
  costCenter: "",
  activityCode: "",
  activityName: "",
  guestTypes: [],
  snackType: "",
  snackTimes: "",
  snackPax: "",
  snackPackaging: "",
  mealPax: "",
  mealPackaging: "",
};

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function roundUpTime(time, stepMinutes = 15) {
  return minutesToTime(Math.ceil(timeToMinutes(time) / stepMinutes) * stepMinutes);
}

function mergeTimeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function availableTimeRangesForDate(bookings, date, operatingStart, operatingEnd, earliestStart) {
  const rangeStart = Math.max(timeToMinutes(operatingStart), timeToMinutes(earliestStart));
  const rangeEnd = timeToMinutes(operatingEnd);
  if (rangeStart >= rangeEnd) return [];

  const busyRanges = mergeTimeRanges(
    (bookings || [])
      .filter((booking) => booking.date === date)
      .map((booking) => ({
        start: Math.max(timeToMinutes(booking.start_time), rangeStart),
        end: Math.min(timeToMinutes(booking.end_time), rangeEnd),
      }))
      .filter((range) => range.end > range.start)
  );

  const availableRanges = [];
  let cursor = rangeStart;
  for (const busy of busyRanges) {
    if (busy.start > cursor) availableRanges.push({ start: cursor, end: busy.start });
    cursor = Math.max(cursor, busy.end);
  }
  if (cursor < rangeEnd) availableRanges.push({ start: cursor, end: rangeEnd });
  return availableRanges.map((range) => `${minutesToTime(range.start)}-${minutesToTime(range.end)}`);
}

function getEarliestStartForDate(date, today, operatingStart) {
  if (date !== today) return operatingStart;
  return minutesToTime(Math.max(timeToMinutes(operatingStart), timeToMinutes(roundUpTime(nowTime()))));
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
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return toYMD(d);
  }, []);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(() => getEarliestStartForDate(today, today, operatingHours.start));
  const [endTime, setEndTime] = useState(() => {
    const firstStart = getEarliestStartForDate(today, today, operatingHours.start);
    const oneHourAfterStart = addMinutesToTime(firstStart, 60);
    return oneHourAfterStart <= operatingHours.end ? oneHourAfterStart : operatingHours.end;
  });
  const [participants, setParticipants] = useState(1);
  const [layoutType, setLayoutType] = useState("");
  const [layoutOther, setLayoutOther] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requestAdditionalFacilities, setRequestAdditionalFacilities] = useState(false);
  const [additionalFacilities, setAdditionalFacilities] = useState([]);
  const [selectedFoodBeverages, setSelectedFoodBeverages] = useState([]);
  const [foodBeverageNotes, setFoodBeverageNotes] = useState("");
  const [fnbDetails, setFnbDetails] = useState(EMPTY_FNB_DETAILS);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [dayAvailability, setDayAvailability] = useState(null);
  const [checkingDayAvailability, setCheckingDayAvailability] = useState(false);
  const canChooseLayout = room?.layout_fixed === false;
  const durationMinutes = useMemo(
    () => (startTime && endTime && startTime < endTime ? timeToMinutes(endTime) - timeToMinutes(startTime) : 0),
    [startTime, endTime]
  );
  const availableFoodBeverages = useMemo(
    () => FOOD_BEVERAGE_RULES.filter((item) => durationMinutes >= item.minMinutes),
    [durationMinutes]
  );
  const fnbSelected = selectedFoodBeverages.length > 0;
  const snackSelected = selectedFoodBeverages.includes("Snack");
  const selectedMealTypes = selectedFoodBeverages.filter((item) => item.toLowerCase().startsWith("makan"));
  const mealSelected = selectedMealTypes.length > 0;
  const effectiveMinStartTime = useMemo(
    () => getEarliestStartForDate(date, today, operatingHours.start),
    [date, today, operatingHours.start]
  );
  const isTodayPastOperatingHours = date === today && effectiveMinStartTime >= operatingHours.end;
  const isPastTimeSelection = date === today && startTime < effectiveMinStartTime;

  useEffect(() => {
    const nextStart = getEarliestStartForDate(today, today, operatingHours.start);
    const nextEnd = addMinutesToTime(nextStart, 60);
    setStartTime(nextStart <= operatingHours.end ? nextStart : operatingHours.end);
    setEndTime(nextEnd <= operatingHours.end ? nextEnd : operatingHours.end);
    setLayoutType("");
    setLayoutOther("");
    setRequestAdditionalFacilities(false);
    setAdditionalFacilities([]);
  }, [room?.id, operatingHours.start, operatingHours.end, today]);

  useEffect(() => {
    const nextStart = getEarliestStartForDate(date, today, operatingHours.start);
    if (nextStart >= operatingHours.end) {
      setStartTime(operatingHours.end);
      setEndTime(operatingHours.end);
      return;
    }
    setStartTime((currentStart) => {
      if (currentStart >= nextStart && currentStart < operatingHours.end) return currentStart;
      return nextStart;
    });
    setEndTime((currentEnd) => {
      const minimumEnd = addMinutesToTime(nextStart, 60);
      if (currentEnd > nextStart && currentEnd <= operatingHours.end) return currentEnd;
      return minimumEnd <= operatingHours.end ? minimumEnd : operatingHours.end;
    });
  }, [date, today, operatingHours.start, operatingHours.end]);

  useEffect(() => {
    const allowed = new Set(availableFoodBeverages.map((item) => item.label));
    setSelectedFoodBeverages((items) => items.filter((item) => allowed.has(item)));
    if (availableFoodBeverages.length === 0) {
      setFoodBeverageNotes("");
      setFnbDetails(EMPTY_FNB_DETAILS);
    }
  }, [availableFoodBeverages]);

  useEffect(() => {
    setFnbDetails((current) => {
      const next = { ...current };
      if (!snackSelected) {
        next.snackType = "";
        next.snackTimes = "";
        next.snackPax = "";
        next.snackPackaging = "";
      }
      if (!mealSelected) {
        next.mealPax = "";
        next.mealPackaging = "";
      }
      return next;
    });
  }, [snackSelected, mealSelected]);

  const setFnbDetail = (key, value) => {
    setFnbDetails((current) => ({ ...current, [key]: value }));
  };

  const toggleAdditionalFacility = (facility, checked) => {
    setAdditionalFacilities((items) =>
      checked ? [...items, facility] : items.filter((item) => item !== facility)
    );
  };

  const toggleGuestType = (guestType, checked) => {
    setFnbDetails((current) => ({
      ...current,
      guestTypes: checked
        ? [...current.guestTypes, guestType]
        : current.guestTypes.filter((item) => item !== guestType),
    }));
  };

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
    setDayAvailability(null);
    if (!room?.id || !date) return;
    if (isTodayPastOperatingHours) {
      setDayAvailability({
        availableRanges: [],
        reason: `No more available operational time today. This room can be booked until ${operatingHours.end}.`,
      });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingDayAvailability(true);
      try {
        const { data } = await api.get(`/rooms/${room.id}/availability`, {
          params: { start_date: date, end_date: date },
        });
        const availableRanges = availableTimeRangesForDate(
          data.bookings || [],
          date,
          operatingHours.start,
          operatingHours.end,
          effectiveMinStartTime
        );
        if (!cancelled) {
          setDayAvailability({ availableRanges, reason: availableRanges.length ? "" : "No available booking time for this date." });
        }
      } catch (err) {
        if (!cancelled) setDayAvailability({ availableRanges: [], reason: formatApiError(err) });
      } finally {
        if (!cancelled) setCheckingDayAvailability(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room?.id, date, effectiveMinStartTime, isTodayPastOperatingHours, operatingHours.start, operatingHours.end]);

  useEffect(() => {
    setAvailability(null);
    if (!room?.id || !date || !startTime || !endTime) return;
    if (isTodayPastOperatingHours) {
      setAvailability({
        available: false,
        reason: `No more available operational time today. This room can be booked until ${operatingHours.end}.`,
        conflicts: [],
      });
      return;
    }
    if (startTime >= endTime) return;
    if (isPastTimeSelection) {
      setAvailability({
        available: false,
        reason: `Selected time has passed. For today, choose ${effectiveMinStartTime} or later.`,
        conflicts: [],
      });
      return;
    }

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
  }, [room?.id, date, startTime, endTime, effectiveMinStartTime, isPastTimeSelection, isTodayPastOperatingHours, operatingHours.end]);

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
    if (isTodayPastOperatingHours) {
      setError(`No more available operational time today. This room can be booked until ${operatingHours.end}.`);
      return;
    }
    if (isPastTimeSelection) {
      setError(`Cannot book a time in the past. For today, choose ${effectiveMinStartTime} or later.`);
      return;
    }
    if (requestAdditionalFacilities && additionalFacilities.length === 0) {
      setError("Please select at least one additional facility.");
      return;
    }
    if (fnbSelected) {
      if (
        !fnbDetails.department.trim() ||
        !fnbDetails.division.trim() ||
        !fnbDetails.costCenter.trim() ||
        !fnbDetails.activityCode.trim() ||
        !fnbDetails.activityName.trim() ||
        fnbDetails.guestTypes.length === 0
      ) {
        setError("Please complete department, division, cost center, activity, and guest type for F&B request.");
        return;
      }
    }
    if (snackSelected) {
      if (!fnbDetails.snackType.trim() || !fnbDetails.snackTimes || !fnbDetails.snackPax || !fnbDetails.snackPackaging) {
        setError("Please complete snack type, frequency, pax, and packaging.");
        return;
      }
    }
    if (mealSelected) {
      if (
        !fnbDetails.mealPax ||
        !fnbDetails.mealPackaging
      ) {
        setError("Please complete meal type, pax, and packaging.");
        return;
      }
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
        additional_facilities: requestAdditionalFacilities ? additionalFacilities : [],
        food_beverages: buildFoodBeverages(selectedFoodBeverages, foodBeverageNotes),
        fnb_department: fnbSelected ? fnbDetails.department : "",
        fnb_division: fnbSelected ? fnbDetails.division : "",
        fnb_cost_center: fnbSelected ? fnbDetails.costCenter : "",
        fnb_activity_code: fnbSelected ? fnbDetails.activityCode : "",
        fnb_activity_name: fnbSelected ? fnbDetails.activityName : "",
        guest_type: fnbSelected ? fnbDetails.guestTypes.join(", ") : "",
        snack_type: snackSelected ? fnbDetails.snackType : "",
        snack_times: snackSelected ? Number(fnbDetails.snackTimes) : null,
        snack_pax: snackSelected ? Number(fnbDetails.snackPax) : null,
        snack_packaging: snackSelected ? fnbDetails.snackPackaging : "",
        meal_types: mealSelected ? selectedMealTypes : [],
        meal_pax: mealSelected ? Number(fnbDetails.mealPax) : null,
        meal_packaging: mealSelected ? fnbDetails.mealPackaging : "",
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
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0B7A4B]">
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
              <TimeSelect
                required
                min={effectiveMinStartTime}
                max={operatingHours.end}
                value={startTime}
                onChange={setStartTime}
                data-testid="booking-start-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
              <TimeSelect
                required
                min={startTime < operatingHours.end ? addMinutesToTime(startTime, 15) : operatingHours.end}
                max={operatingHours.end}
                value={endTime}
                onChange={setEndTime}
                data-testid="booking-end-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
              />
            </div>
          </div>
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {isTodayPastOperatingHours
              ? `No more available operational time today. This room can be booked until ${operatingHours.end}.`
              : date === today
              ? `For today, this room can be booked from ${effectiveMinStartTime} until ${operatingHours.end}.`
              : `This room can be booked only between ${roomOperatingHoursLabel(room)}.`}
          </div>
          {checkingDayAvailability && (
            <div
              className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700"
              data-testid="booking-day-availability-checking"
            >
              Checking available booking times for {date}...
            </div>
          )}
          {!checkingDayAvailability && dayAvailability?.availableRanges?.length > 0 && (
            <div
              className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              data-testid="booking-day-availability-available"
            >
              Available booking times for {date}: {dayAvailability.availableRanges.join(", ")}.
            </div>
          )}
          {!checkingDayAvailability && dayAvailability && dayAvailability.availableRanges.length === 0 && (
            <div
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="booking-day-availability-unavailable"
            >
              {dayAvailability.reason}
            </div>
          )}
          {checkingAvailability && (
            <div
              className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700"
              data-testid="booking-availability-checking"
            >
              Checking selected time...
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
                  className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
                    className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
            />
          </div>
          <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={requestAdditionalFacilities}
                onChange={(e) => {
                  setRequestAdditionalFacilities(e.target.checked);
                  if (!e.target.checked) setAdditionalFacilities([]);
                }}
                data-testid="booking-request-additional-facilities"
              />
              Request Fasilitas Tambahan
            </label>
            {requestAdditionalFacilities && (
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Pilih fasilitas:</div>
                <div className="flex flex-wrap gap-2">
                  {ADDITIONAL_FACILITY_OPTIONS.map((facility) => (
                    <label key={facility} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={additionalFacilities.includes(facility)}
                        onChange={(e) => toggleAdditionalFacility(facility, e.target.checked)}
                        data-testid={`booking-additional-facility-${facility.toLowerCase()}`}
                      />
                      {facility}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {availableFoodBeverages.length > 0 ? (
            <div className="space-y-3 rounded-sm border border-amber-200 bg-amber-50 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Food and Beverages</div>
                <p className="mt-1 text-xs text-slate-500">
                  Tambah pilihan jenis konsumsi sesuai durasi meeting.
                </p>
              </div>
              <div className="space-y-3 rounded-sm border border-amber-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Detail F&amp;B</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Departement</label>
                    <input value={fnbDetails.department} onChange={(e) => setFnbDetail("department", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Divisi</label>
                    <input value={fnbDetails.division} onChange={(e) => setFnbDetail("division", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Cost Center</label>
                    <input value={fnbDetails.costCenter} onChange={(e) => setFnbDetail("costCenter", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Activity Code</label>
                    <input value={fnbDetails.activityCode} onChange={(e) => setFnbDetail("activityCode", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Activity Name</label>
                    <input value={fnbDetails.activityName} onChange={(e) => setFnbDetail("activityName", e.target.value)} className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-700">Tamu</div>
                  <div className="flex flex-wrap gap-2">
                    {GUEST_TYPES.map((item) => (
                      <label key={item} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={fnbDetails.guestTypes.includes(item)}
                          onChange={(e) => toggleGuestType(item, e.target.checked)}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Pilihan konsumsi</div>
                <div className="flex flex-wrap gap-2">
                  {FOOD_BEVERAGE_RULES.map((item) => {
                    const enabled = availableFoodBeverages.some((available) => available.label === item.label);
                    return (
                      <label
                        key={item.label}
                        className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium ${
                          enabled
                            ? "border-amber-200 bg-white text-slate-700"
                            : "border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!enabled}
                          checked={selectedFoodBeverages.includes(item.label)}
                          onChange={(e) =>
                            setSelectedFoodBeverages((items) =>
                              e.target.checked ? [...items, item.label] : items.filter((value) => value !== item.label)
                            )
                          }
                          data-testid={`booking-food-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                        />
                        {item.label}
                        {!enabled && <span className="text-[11px] font-normal">min {item.minMinutes / 60} jam</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
              {snackSelected && (
                <div className="space-y-3 rounded-sm border border-amber-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Snack</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Jenis</label>
                      <input
                        value={fnbDetails.snackType}
                        onChange={(e) => setFnbDetail("snackType", e.target.value)}
                        placeholder="Contoh: morning snack"
                        className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Berapa kali</label>
                      <input
                        type="number"
                        min={1}
                        value={fnbDetails.snackTimes}
                        onChange={(e) => setFnbDetail("snackTimes", e.target.value)}
                        placeholder="1"
                        className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Jumlah pax</label>
                      <input
                        type="number"
                        min={1}
                        value={fnbDetails.snackPax}
                        onChange={(e) => setFnbDetail("snackPax", e.target.value)}
                        placeholder="10"
                        className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-700">Kemasan</div>
                    <div className="flex flex-wrap gap-2">
                      {SNACK_PACKAGING.map((item) => (
                        <label key={item} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={fnbDetails.snackPackaging === item}
                            onChange={(e) => setFnbDetail("snackPackaging", e.target.checked ? item : "")}
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {mealSelected && (
                <div className="space-y-3 rounded-sm border border-amber-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Makan</div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Jumlah pax</label>
                    <input
                      type="number"
                      min={1}
                      value={fnbDetails.mealPax}
                      onChange={(e) => setFnbDetail("mealPax", e.target.value)}
                      placeholder="10"
                      className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-700">Kemasan</div>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_PACKAGING.map((item) => (
                        <label key={item} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={fnbDetails.mealPackaging === item}
                            onChange={(e) => setFnbDetail("mealPackaging", e.target.checked ? item : "")}
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <textarea
                value={foodBeverageNotes}
                onChange={(e) => setFoodBeverageNotes(e.target.value)}
                data-testid="booking-food-beverages-input"
                rows={2}
                placeholder="Catatan optional: morning snack, evening snack, kopi"
                className="w-full resize-none rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B7A4B] focus:ring-2 focus:ring-[#0B7A4B]/15"
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
              disabled={
                loading ||
                checkingAvailability ||
                availability?.available === false ||
                isPastTimeSelection ||
                isTodayPastOperatingHours
              }
              data-testid="booking-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0B7A4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#064E3B] disabled:opacity-60"
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
