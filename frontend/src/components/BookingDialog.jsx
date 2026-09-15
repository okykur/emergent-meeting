import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CalendarClock, AlertTriangle } from "lucide-react";
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
  const [meetingPurpose, setMeetingPurpose] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
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
  const [requestLayoutChange, setRequestLayoutChange] = useState(room?.layout_fixed === false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requestAdditionalFacilities, setRequestAdditionalFacilities] = useState(false);
  const [additionalFacilities, setAdditionalFacilities] = useState([]);
  const [selectedFoodBeverages, setSelectedFoodBeverages] = useState([]);
  const [accommodationPackaging, setAccommodationPackaging] = useState("");
  const [foodBeverageNotes, setFoodBeverageNotes] = useState("");
  const [fnbDetails, setFnbDetails] = useState(EMPTY_FNB_DETAILS);
  const [involvesGuests, setInvolvesGuests] = useState(false);
  const [guestPic, setGuestPic] = useState("");
  const [guestCounts, setGuestCounts] = useState({ Internal: "", BOD: "", Xternal: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [dayAvailability, setDayAvailability] = useState(null);
  const [checkingDayAvailability, setCheckingDayAvailability] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
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
    setRequestLayoutChange(room?.layout_fixed === false);
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
      setAccommodationPackaging("");
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
        ? current.guestTypes.includes(guestType) ? current.guestTypes : [...current.guestTypes, guestType]
        : current.guestTypes.filter((item) => item !== guestType),
    }));
  };

  const setGuestCount = (guestType, value) => {
    const normalized = value === "" ? "" : Math.max(0, Number(value));
    setGuestCounts((current) => ({ ...current, [guestType]: normalized }));
    toggleGuestType(guestType, Number(normalized) > 0);
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

  const buildGuestTypeSummary = () => {
    const categories = GUEST_TYPES
      .filter((type) => Number(guestCounts[type]) > 0)
      .map((type) => `${type} (${guestCounts[type]})`);
    if (involvesGuests && guestPic.trim()) categories.push(`PIC: ${guestPic.trim()}`);
    return categories.join(", ");
  };

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
    if (canChooseLayout && requestLayoutChange && !layoutType) {
      setError("Please select a room layout.");
      return;
    }
    if (canChooseLayout && requestLayoutChange && layoutType === "Lainnya" && !layoutOther.trim()) {
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
    const totalCategorizedGuests = GUEST_TYPES.reduce((total, type) => total + Number(guestCounts[type] || 0), 0);
    if (totalCategorizedGuests > Number(participants)) {
      setError("Jumlah kategori tamu tidak boleh melebihi jumlah peserta rapat.");
      return;
    }
    if (involvesGuests && !guestPic.trim()) {
      setError("Isi nama PIC atau penanggung jawab tamu.");
      return;
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
      const { data: createdBooking } = await api.post("/bookings", {
        room_id: room.id,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        participants: Number(participants),
        layout_type: canChooseLayout && requestLayoutChange ? layoutType : "",
        layout_other: canChooseLayout && requestLayoutChange && layoutType === "Lainnya" ? layoutOther : "",
        phone_number: phoneNumber,
        additional_facilities: requestAdditionalFacilities ? additionalFacilities : [],
        food_beverages: buildFoodBeverages(selectedFoodBeverages, foodBeverageNotes),
        fnb_department: fnbSelected ? fnbDetails.department : "",
        fnb_division: fnbSelected ? fnbDetails.division : "",
        fnb_cost_center: fnbSelected ? fnbDetails.costCenter : "",
        fnb_activity_code: fnbSelected ? fnbDetails.activityCode : "",
        fnb_activity_name: fnbSelected ? fnbDetails.activityName : "",
        guest_type: fnbDetails.guestTypes.join(", "),
        guest_pic: guestPic.trim(),
        guest_counts: Object.fromEntries(
          GUEST_TYPES.map((type) => [type, Number(guestCounts[type] || 0)])
        ),
        snack_type: snackSelected ? fnbDetails.snackType : "",
        snack_times: snackSelected ? Number(fnbDetails.snackTimes) : null,
        snack_pax: snackSelected ? Number(fnbDetails.snackPax) : null,
        snack_packaging: snackSelected ? fnbDetails.snackPackaging : "",
        meal_types: mealSelected ? selectedMealTypes : [],
        meal_pax: mealSelected ? Number(fnbDetails.mealPax) : null,
        meal_packaging: mealSelected ? fnbDetails.mealPackaging : "",
        notes: meetingPurpose.trim()
          ? `Tujuan Rapat: ${meetingPurpose.trim()}\nAgenda / Keperluan Rapat: ${notes.trim()}`
          : notes,
      });
      setConfirmation(createdBooking || {});
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const continueFromDetails = () => {
    setError("");
    if (!title.trim() || !meetingPurpose.trim() || !notes.trim() || !phoneNumber.trim()) {
      setError("Lengkapi seluruh informasi rapat yang bertanda wajib.");
      return;
    }
    if (Number(participants) < 1 || Number(participants) > room.capacity) {
      setError(`Jumlah peserta harus antara 1 dan ${room.capacity} orang.`);
      return;
    }
    if (startTime >= endTime) {
      setError("Jam selesai harus setelah jam mulai.");
      return;
    }
    if (!isWithinOperatingHours(room, startTime, endTime)) {
      setError(`Waktu rapat harus berada dalam jam operasional ${roomOperatingHoursLabel(room)}.`);
      return;
    }
    if (isTodayPastOperatingHours || isPastTimeSelection) {
      setError(`Untuk hari ini, pilih waktu mulai ${effectiveMinStartTime} atau setelahnya.`);
      return;
    }
    if (availability?.available === false) {
      setError(availabilityMessage(availability));
      return;
    }
    setCurrentStep(2);
  };

  const continueFromLayout = () => {
    setError("");
    if (canChooseLayout && requestLayoutChange && !layoutType) {
      setError("Pilih salah satu layout ruangan atau nonaktifkan permintaan perubahan layout.");
      return;
    }
    if (canChooseLayout && requestLayoutChange && layoutType === "Lainnya" && !layoutOther.trim()) {
      setError("Isi deskripsi layout khusus yang dibutuhkan.");
      return;
    }
    if (requestAdditionalFacilities && additionalFacilities.length === 0) {
      setError("Pilih minimal satu fasilitas tambahan.");
      return;
    }
    setCurrentStep(3);
  };

  const toggleAccommodation = (label) => {
    setSelectedFoodBeverages((items) =>
      items.includes(label) ? items.filter((item) => item !== label) : [...items, label]
    );
  };

  const selectAccommodationPackaging = (packaging) => {
    setAccommodationPackaging(packaging);
    setFnbDetails((current) => ({
      ...current,
      snackPackaging: packaging === "boxed" ? "Dus" : "Plating",
      mealPackaging: packaging === "boxed" ? "Dus" : "Prasmanan",
    }));
  };

  const continueFromAccommodation = () => {
    setError("");
    if (selectedFoodBeverages.length > 0 && !accommodationPackaging) {
      setError("Pilih jenis kemasan untuk akomodasi yang diminta.");
      return;
    }
    setCurrentStep(4);
  };

  if (confirmation) {
    const confirmationDate = new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const guestSummary = buildGuestTypeSummary() || "Tidak ada kategori tamu";
    const summaryRows = [
      ["Ruangan", room.name],
      ["Lokasi", `${room.building || "Belum ditentukan"} · ${room.location}`],
      ["Tanggal", confirmationDate],
      ["Waktu", `${startTime} - ${endTime}`],
      ["PIC", confirmation.user_name || guestPic || phoneNumber || "-"],
      ["Departemen", fnbDetails.department || "-"],
      ["Divisi", fnbDetails.division || "-"],
      ["Cost Center", fnbDetails.costCenter || "-"],
      ["Activity", fnbDetails.activityName || "-"],
      ["Tamu", guestSummary],
    ];

    return (
      <div key="booking-confirmation" className="fixed inset-0 z-50 flex items-center justify-center bg-[#092D22]/70 p-3 backdrop-blur-[2px] animate-fade-in-up" data-testid="booking-confirmation" onClick={() => onBooked?.()}>
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_24px_70px_rgba(3,31,22,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-[#E7ECE8] px-6 py-4">
            <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-[#0B4935]">Ringkasan Pesanan</h2>
            <button type="button" onClick={() => onBooked?.()} className="rounded-lg p-1.5 text-[#87928B] hover:bg-[#F0F4F1]" aria-label="Tutup ringkasan"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-5">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F5EB] text-xl font-bold text-[#238B57]">✓</span>
              <h3 className="mt-3 text-base font-extrabold text-[#238B57]">Pemesanan Anda Berhasil</h3>
              <p className="mt-1 text-xs text-[#7B867F]">Permintaan telah dikirim dan menunggu proses persetujuan.</p>
            </div>
            <dl className="mt-5 divide-y divide-[#E7ECE8] border-y border-[#E7ECE8]">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[105px_1fr] gap-3 py-2.5 text-xs sm:grid-cols-[130px_1fr]">
                  <dt className="font-medium text-[#657169]">{label}</dt>
                  <dd className="text-right font-extrabold text-[#0B4935]">{value}</dd>
                </div>
              ))}
            </dl>
            {(selectedFoodBeverages.length > 0 || additionalFacilities.length > 0) && (
              <div className="mt-4 rounded-lg bg-[#F2F6F3] px-3 py-3 text-xs text-[#526058]">
                {selectedFoodBeverages.length > 0 && <p><span className="font-bold">Konsumsi:</span> {selectedFoodBeverages.join(", ")} · {accommodationPackaging === "boxed" ? "Dus/Kemasan" : "Prasmanan/Buffet"}</p>}
                {additionalFacilities.length > 0 && <p className={selectedFoodBeverages.length > 0 ? "mt-1" : ""}><span className="font-bold">Fasilitas tambahan:</span> {additionalFacilities.join(", ")}</p>}
              </div>
            )}
          </div>
          <div className="border-t border-[#E7ECE8] px-6 py-4">
            <button type="button" onClick={() => onBooked?.()} data-testid="booking-confirmation-home" className="w-full rounded-lg bg-[#238B57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#176E43]">Kembali ke Beranda</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 1) {
    const participantInvalid = Number(participants) > room.capacity || Number(participants) < 1;
    const nextDisabled = checkingAvailability || availability?.available === false || isPastTimeSelection || isTodayPastOperatingHours || participantInvalid;
    const fieldClass = "mt-1.5 w-full rounded-lg border border-[#DCE3DE] bg-white px-3 py-2.5 text-sm text-[#303732] outline-none transition focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10";

    return (
      <div key="booking-step-1" className="fixed inset-0 z-50 flex items-center justify-center bg-[#092D22]/70 p-3 backdrop-blur-[2px] animate-fade-in-up" data-testid="booking-dialog" onClick={onClose}>
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_24px_70px_rgba(3,31,22,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="shrink-0 px-6 pb-4 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[#0B4935]">
                  <img src="/brand-logo.png" alt="KCSI" className="h-6 w-auto object-contain" />
                  <span className="font-brand text-sm font-extrabold tracking-[-0.03em]">GASS</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold tracking-[-0.035em] text-[#252A27] sm:text-2xl">{room.name}</h2>
                  <span className="rounded-full bg-[#E2F4E9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#167849]">{room.building || "Belum ditentukan"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-[#6D7871]">
                  <span>{room.location} · Kapasitas maks. {room.capacity} orang</span>
                  <span>Jam operasional {roomOperatingHoursLabel(room)}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} data-testid="booking-dialog-close" className="rounded-lg p-1.5 text-[#87928B] transition hover:bg-[#F0F4F1] hover:text-[#252A27]" aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-4" aria-label="Tahapan booking">
              {["Detail", "Layout", "Akomodasi", "Tamu"].map((label, index) => {
                const step = index + 1;
                return (
                  <div key={label} className="relative flex flex-col items-center">
                    {step > 1 && <span className="absolute right-1/2 top-3 h-px w-full bg-[#DDE4DF]" />}
                    <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${step === 1 ? "bg-[#238B57] text-white" : "bg-[#E9EEEA] text-[#7B867F]"}`}>{step}</span>
                    <span className={`mt-1 text-[10px] font-bold ${step === 1 ? "text-[#167849]" : "text-[#657169]"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-y border-[#E7ECE8] px-6 py-5 sm:px-7">
            <div className="space-y-4">
              <label className="block text-xs font-bold text-[#3F4943]">Nama Rapat <span className="text-[#D33F37]">*</span>
                <input required value={title} onChange={(event) => setTitle(event.target.value)} data-testid="booking-title-input" placeholder="Rapat Tinjauan Manajemen Bulanan" className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-[#3F4943]">Tujuan Rapat <span className="text-[#D33F37]">*</span>
                <input required value={meetingPurpose} onChange={(event) => setMeetingPurpose(event.target.value)} data-testid="booking-purpose-input" placeholder="Mis. Evaluasi kinerja Q3" className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-[#3F4943]">Agenda / Keperluan Rapat <span className="text-[#D33F37]">*</span>
                <textarea required value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="booking-notes-input" rows={2} placeholder="Pembahasan pencapaian target, review KPI antar departemen, rencana taktis Q4..." className={`${fieldClass} resize-none`} />
                {room.facilities.length > 0 && <span className="mt-1 block text-[10px] italic text-[#87928B]">Fasilitas: {room.facilities.join(" · ")}</span>}
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-bold text-[#3F4943]">Tanggal <span className="text-[#D33F37]">*</span>
                  <input type="date" required min={today} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} data-testid="booking-date-input" className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">Mulai <span className="text-[#D33F37]">*</span>
                  <TimeSelect required min={effectiveMinStartTime} max={operatingHours.end} value={startTime} onChange={setStartTime} data-testid="booking-start-input" className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">Selesai <span className="text-[#D33F37]">*</span>
                  <TimeSelect required min={startTime < operatingHours.end ? addMinutesToTime(startTime, 15) : operatingHours.end} max={operatingHours.end} value={endTime} onChange={setEndTime} data-testid="booking-end-input" className={fieldClass} />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#3F4943]">Jumlah Peserta <span className="text-[#D33F37]">*</span>
                  <input type="number" min={1} required value={participants} onChange={(event) => setParticipants(event.target.value)} data-testid="booking-participants-input" className={`${fieldClass} ${participantInvalid ? "border-[#E0524D] focus:border-[#E0524D] focus:ring-[#E0524D]/10" : ""}`} />
                  <span className="mt-1 block text-[10px] text-[#87928B]">Maks. {room.capacity} orang</span>
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">HP Penanggung Jawab <span className="text-[#D33F37]">*</span>
                  <input type="tel" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} data-testid="booking-phone-input" placeholder="+62 812 9876 5432" className={fieldClass} />
                </label>
              </div>

              {participantInvalid && <div className="flex items-center gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-capacity-error"><AlertTriangle className="h-3.5 w-3.5" /> Jumlah peserta melebihi kapasitas ruangan.</div>}
              {checkingAvailability && <div className="flex items-center gap-2 rounded-lg bg-[#EEF7F2] px-3 py-2 text-xs text-[#167849]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memeriksa ketersediaan jadwal...</div>}
              {!checkingAvailability && availability?.available === false && <div className="flex items-center gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-availability-unavailable"><AlertTriangle className="h-3.5 w-3.5" /> {availabilityMessage(availability)}</div>}
              {error && <div className="flex items-start gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-error"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4 sm:px-7">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#DCE3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#526058] hover:bg-[#F7FAF8]" data-testid="booking-cancel-btn">Kembali</button>
            <button type="button" onClick={continueFromDetails} disabled={nextDisabled} data-testid="booking-next-btn" className="rounded-lg bg-[#238B57] px-7 py-2.5 text-sm font-bold text-white transition hover:bg-[#176E43] disabled:cursor-not-allowed disabled:bg-[#A8CFB9]">Lanjut</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div key="booking-step-2" className="fixed inset-0 z-50 flex items-center justify-center bg-[#092D22]/70 p-3 backdrop-blur-[2px] animate-fade-in-up" data-testid="booking-dialog" onClick={onClose}>
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_24px_70px_rgba(3,31,22,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="shrink-0 px-6 pb-4 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[#0B4935]">
                  <img src="/brand-logo.png" alt="KCSI" className="h-6 w-auto object-contain" />
                  <span className="font-brand text-sm font-extrabold tracking-[-0.03em]">GASS</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold tracking-[-0.035em] text-[#252A27] sm:text-2xl">{room.name}</h2>
                  <span className="rounded-full bg-[#E2F4E9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#167849]">{room.building || "Belum ditentukan"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-[#6D7871]">
                  <span>{room.location} · Kapasitas maks. {room.capacity} orang</span>
                  <span>Jam operasional {roomOperatingHoursLabel(room)}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} data-testid="booking-dialog-close" className="rounded-lg p-1.5 text-[#87928B] transition hover:bg-[#F0F4F1] hover:text-[#252A27]" aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-4" aria-label="Tahapan booking">
              {["Detail", "Layout", "Akomodasi", "Tamu"].map((label, index) => {
                const step = index + 1;
                const active = step === 2;
                const complete = step < 2;
                return (
                  <div key={label} className="relative flex flex-col items-center">
                    {step > 1 && <span className={`absolute right-1/2 top-3 h-px w-full ${step <= 2 ? "bg-[#238B57]" : "bg-[#DDE4DF]"}`} />}
                    <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${active || complete ? "bg-[#238B57] text-white" : "bg-[#E9EEEA] text-[#7B867F]"}`}>{step}</span>
                    <span className={`mt-1 text-[10px] font-bold ${active ? "text-[#167849]" : "text-[#657169]"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-y border-[#E7ECE8] px-6 py-5 sm:px-7">
            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#0B4935]">Layout Ruangan</h3>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#DCE3DE] bg-[#FBFCFB] px-3 py-2.5 text-sm text-[#657169]">
                <span>{canChooseLayout ? "Layout ruangan dapat disesuaikan" : "Layout ruangan ini tetap (Fixed)"}</span>
                <span className="rounded-md bg-[#E7ECE8] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#5D6861]">{canChooseLayout ? "Flexible" : "Fixed"}</span>
              </div>

              <label className={`mt-3 flex items-center gap-2 text-sm font-bold ${canChooseLayout ? "text-[#3F4943]" : "text-[#98A29C]"}`}>
                <input
                  type="checkbox"
                  checked={canChooseLayout && requestLayoutChange}
                  disabled={!canChooseLayout}
                  onChange={(event) => {
                    setRequestLayoutChange(event.target.checked);
                    if (!event.target.checked) {
                      setLayoutType("");
                      setLayoutOther("");
                    }
                  }}
                  data-testid="booking-request-layout-change"
                  className="h-4 w-4 accent-[#238B57]"
                />
                Request Perubahan Layout
              </label>

              {canChooseLayout && requestLayoutChange && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {LAYOUT_OPTIONS.map((layout) => {
                      const selected = layoutType === layout;
                      return (
                        <button
                          type="button"
                          key={layout}
                          onClick={() => {
                            setLayoutType(layout);
                            if (layout !== "Lainnya") setLayoutOther("");
                          }}
                          data-testid={`booking-layout-${layout.toLowerCase()}`}
                          className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold transition ${selected ? "border-[#238B57] bg-[#EDF8F1] text-[#167849]" : "border-[#DCE3DE] bg-white text-[#657169] hover:border-[#9FC6B2]"}`}
                        >
                          <span className={`h-3 w-3 rounded-full border ${selected ? "border-[#238B57] bg-[#238B57] shadow-[inset_0_0_0_3px_white]" : "border-[#CBD2CD]"}`} />
                          {layout}
                        </button>
                      );
                    })}
                  </div>
                  {layoutType === "Lainnya" && <input value={layoutOther} onChange={(event) => setLayoutOther(event.target.value)} data-testid="booking-layout-other-input" placeholder="Deskripsi layout khusus..." className="mt-2.5 w-full rounded-lg border border-[#DCE3DE] px-3 py-2.5 text-sm outline-none focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10" />}
                </div>
              )}
            </section>

            <section className="mt-6 border-t border-[#E7ECE8] pt-5">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#0B4935]">Fasilitas Tambahan</h3>
              <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#3F4943]">
                <input
                  type="checkbox"
                  checked={requestAdditionalFacilities}
                  onChange={(event) => {
                    setRequestAdditionalFacilities(event.target.checked);
                    if (!event.target.checked) setAdditionalFacilities([]);
                  }}
                  data-testid="booking-request-additional-facilities"
                  className="h-4 w-4 accent-[#238B57]"
                />
                Request Fasilitas Tambahan
              </label>
              {requestAdditionalFacilities && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ADDITIONAL_FACILITY_OPTIONS.map((facility) => {
                    const selected = additionalFacilities.includes(facility);
                    return (
                      <button type="button" key={facility} onClick={() => toggleAdditionalFacility(facility, !selected)} data-testid={`booking-additional-facility-${facility.toLowerCase()}`} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? "border-[#43A678] bg-[#EDF8F1] text-[#167849]" : "border-[#DCE3DE] bg-white text-[#7B867F] hover:border-[#9FC6B2]"}`}>
                        {selected ? "✓ " : ""}{facility}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="mt-10 text-xs italic text-[#7B867F]">
              {durationMinutes < 240 ? "Meeting kamu di bawah 4 jam? Tidak ada opsi akomodasi di langkah berikutnya." : "Pilihan akomodasi tersedia pada langkah berikutnya sesuai durasi meeting."}
            </p>
            {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-error"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4 sm:px-7">
            <button type="button" onClick={() => { setError(""); setCurrentStep(1); }} className="rounded-lg border border-[#DCE3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#526058] hover:bg-[#F7FAF8]" data-testid="booking-back-btn">Kembali</button>
            <button type="button" onClick={continueFromLayout} data-testid="booking-next-btn" className="rounded-lg bg-[#238B57] px-7 py-2.5 text-sm font-bold text-white transition hover:bg-[#176E43]">Lanjut</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    const durationHours = Number.isInteger(durationMinutes / 60)
      ? durationMinutes / 60
      : (durationMinutes / 60).toFixed(1);
    const accommodationActive = availableFoodBeverages.length > 0;
    const accommodationOptions = [
      { label: "Snack", display: "Snack", detail: "Durasi minimal 4 jam" },
      { label: "Makan siang", display: "Makan Siang", detail: "Durasi minimal 5 jam" },
      { label: "Makan malam", display: "Makan Malam", detail: "Durasi minimal 5 jam" },
    ];

    return (
      <div key="booking-step-3" className="fixed inset-0 z-50 flex items-center justify-center bg-[#092D22]/70 p-3 backdrop-blur-[2px] animate-fade-in-up" data-testid="booking-dialog" onClick={onClose}>
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_24px_70px_rgba(3,31,22,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="shrink-0 px-6 pb-4 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[#0B4935]">
                  <img src="/brand-logo.png" alt="KCSI" className="h-6 w-auto object-contain" />
                  <span className="font-brand text-sm font-extrabold tracking-[-0.03em]">GASS</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold tracking-[-0.035em] text-[#252A27] sm:text-2xl">{room.name}</h2>
                  <span className="rounded-full bg-[#E2F4E9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#167849]">{room.building || "Belum ditentukan"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-[#6D7871]">
                  <span>{room.location} · Kapasitas maks. {room.capacity} orang</span>
                  <span>Jam operasional {roomOperatingHoursLabel(room)}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} data-testid="booking-dialog-close" className="rounded-lg p-1.5 text-[#87928B] transition hover:bg-[#F0F4F1] hover:text-[#252A27]" aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-4" aria-label="Tahapan booking">
              {["Detail", "Layout", "Akomodasi", "Tamu"].map((label, index) => {
                const step = index + 1;
                const active = step === 3;
                const complete = step < 3;
                return (
                  <div key={label} className="relative flex flex-col items-center">
                    {step > 1 && <span className={`absolute right-1/2 top-3 h-px w-full ${step <= 3 ? "bg-[#238B57]" : "bg-[#DDE4DF]"}`} />}
                    <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${active || complete ? "bg-[#238B57] text-white" : "bg-[#E9EEEA] text-[#7B867F]"}`}>{step}</span>
                    <span className={`mt-1 text-[10px] font-bold ${active ? "text-[#167849]" : "text-[#657169]"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-y border-[#E7ECE8] px-6 py-5 sm:px-7">
            <div className={`rounded-lg border px-4 py-3 ${accommodationActive ? "border-[#5AAF82] bg-[#EDF8F1]" : "border-[#DCE3DE] bg-[#F7F9F7]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-extrabold ${accommodationActive ? "text-[#167849]" : "text-[#657169]"}`}>{accommodationActive ? "Akomodasi & Konsumsi Aktif" : "Tanpa Akomodasi & Konsumsi"}</h3>
                  <p className="mt-0.5 text-xs text-[#657169]">Total durasi meeting: {durationHours} jam</p>
                </div>
                <span className={`rounded-md px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.04em] text-white ${accommodationActive ? "bg-[#238B57]" : "bg-[#87928B]"}`}>{accommodationActive ? "Durasi ≥ 4 jam" : "Durasi < 4 jam"}</span>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-[#707B74]">Aturan: minimal 4 jam tersedia Snack; minimal 5 jam tersedia Snack, Makan Siang, dan Makan Malam.</p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {accommodationOptions.map((option) => {
                const enabled = availableFoodBeverages.some((item) => item.label === option.label);
                const selected = selectedFoodBeverages.includes(option.label);
                return (
                  <button
                    type="button"
                    key={option.label}
                    disabled={!enabled}
                    onClick={() => toggleAccommodation(option.label)}
                    data-testid={`booking-food-${option.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`min-h-[92px] rounded-xl border px-3 py-4 text-center transition ${selected ? "border-[#238B57] bg-[#EDF8F1] text-[#167849]" : enabled ? "border-[#DCE3DE] bg-white text-[#303732] hover:border-[#9FC6B2]" : "cursor-not-allowed border-[#E6EAE7] bg-[#FAFBFA] text-[#B3BBB6]"}`}
                  >
                    <span className="block text-sm font-extrabold">{selected ? "✓ " : !enabled ? "▣ " : ""}{option.display}</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-75">{option.detail}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="text-xs font-bold text-[#3F4943]">Jenis Kemasan:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "boxed", label: "Dus / Kemasan" },
                  { value: "buffet", label: "Prasmanan / Buffet" },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    disabled={selectedFoodBeverages.length === 0}
                    onClick={() => selectAccommodationPackaging(option.value)}
                    data-testid={`booking-packaging-${option.value}`}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${accommodationPackaging === option.value ? "border-[#238B57] bg-[#238B57] text-white" : selectedFoodBeverages.length > 0 ? "border-[#DCE3DE] bg-white text-[#657169] hover:border-[#9FC6B2]" : "cursor-not-allowed border-[#E6EAE7] bg-[#F5F7F5] text-[#B3BBB6]"}`}
                  >{option.label}</button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs text-[#7B867F]">Pilihan detail jumlah, tamu, dan informasi konsumsi dilengkapi pada langkah berikutnya.</p>
            {selectedFoodBeverages.length > 0 && <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F4D58B] bg-[#FFF6D9] px-3 py-2.5 text-xs font-semibold text-[#A5660B]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Pengajuan dengan konsumsi akan melalui persetujuan Atasan, Admin Ruang Meeting, dan Manager F&amp;B.</div>}
            {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-error"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4 sm:px-7">
            <button type="button" onClick={() => { setError(""); setCurrentStep(2); }} className="rounded-lg border border-[#DCE3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#526058] hover:bg-[#F7FAF8]" data-testid="booking-back-btn">Kembali</button>
            <button type="button" onClick={continueFromAccommodation} data-testid="booking-next-btn" className="rounded-lg bg-[#238B57] px-7 py-2.5 text-sm font-bold text-white transition hover:bg-[#176E43]">Lanjut</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 4) {
    const organizationRequired = fnbSelected;
    const categorizedGuestTotal = GUEST_TYPES.reduce((total, type) => total + Number(guestCounts[type] || 0), 0);
    const fieldClass = "mt-1.5 w-full rounded-lg border border-[#DCE3DE] bg-white px-3 py-2.5 text-sm text-[#303732] outline-none transition focus:border-[#238B57] focus:ring-2 focus:ring-[#238B57]/10";

    return (
      <div key="booking-step-4" className="fixed inset-0 z-50 flex items-center justify-center bg-[#092D22]/70 p-3 backdrop-blur-[2px] animate-fade-in-up" data-testid="booking-dialog" onClick={onClose}>
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DDE4DF] bg-white shadow-[0_24px_70px_rgba(3,31,22,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="shrink-0 px-6 pb-4 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[#0B4935]">
                  <img src="/brand-logo.png" alt="KCSI" className="h-6 w-auto object-contain" />
                  <span className="font-brand text-sm font-extrabold tracking-[-0.03em]">GASS</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold tracking-[-0.035em] text-[#252A27] sm:text-2xl">{room.name}</h2>
                  <span className="rounded-full bg-[#E2F4E9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#167849]">{room.building || "Belum ditentukan"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-[#6D7871]">
                  <span>{room.location} · Kapasitas maks. {room.capacity} orang</span>
                  <span>Jam operasional {roomOperatingHoursLabel(room)}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} data-testid="booking-dialog-close" className="rounded-lg p-1.5 text-[#87928B] transition hover:bg-[#F0F4F1] hover:text-[#252A27]" aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-4" aria-label="Tahapan booking">
              {["Detail", "Layout", "Akomodasi", "Tamu"].map((label, index) => {
                const step = index + 1;
                return (
                  <div key={label} className="relative flex flex-col items-center">
                    {step > 1 && <span className="absolute right-1/2 top-3 h-px w-full bg-[#238B57]" />}
                    <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#238B57] text-[11px] font-extrabold text-white">{step}</span>
                    <span className={`mt-1 text-[10px] font-bold ${step === 4 ? "text-[#167849]" : "text-[#657169]"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" data-testid="booking-form">
            <div className="min-h-0 flex-1 overflow-y-auto border-y border-[#E7ECE8] px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#25302A]">Melibatkan BOD / Tamu Eksternal</h3>
                  <p className="mt-1 text-xs text-[#7B867F]">Aktifkan jika melibatkan pejabat/direksi atau tamu khusus.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={involvesGuests}
                  onClick={() => {
                    const next = !involvesGuests;
                    setInvolvesGuests(next);
                    if (!next) {
                      setGuestPic("");
                      setGuestCounts((current) => ({ ...current, BOD: "", Xternal: "" }));
                      toggleGuestType("BOD", false);
                      toggleGuestType("Xternal", false);
                    }
                  }}
                  data-testid="booking-involves-guests"
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${involvesGuests ? "bg-[#238B57]" : "bg-[#CAD2CD]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${involvesGuests ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>

              {involvesGuests && <label className="mt-4 block text-xs font-bold text-[#3F4943]">Nama PIC / Penanggung Jawab Tamu <span className="text-[#D33F37]">*</span>
                <input required value={guestPic} onChange={(event) => setGuestPic(event.target.value)} data-testid="booking-guest-pic" placeholder="Nama lengkap PIC" className={fieldClass} />
              </label>}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#3F4943]">Departemen {organizationRequired && <span className="text-[#D33F37]">*</span>}
                  <input required={organizationRequired} value={fnbDetails.department} onChange={(event) => setFnbDetail("department", event.target.value)} data-testid="booking-fnb-department" placeholder="Business Development" className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">Divisi {organizationRequired && <span className="text-[#D33F37]">*</span>}
                  <input required={organizationRequired} value={fnbDetails.division} onChange={(event) => setFnbDetail("division", event.target.value)} data-testid="booking-fnb-division" placeholder="Marketing Division" className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">Cost Center {organizationRequired && <span className="text-[#D33F37]">*</span>}
                  <input required={organizationRequired} value={fnbDetails.costCenter} onChange={(event) => setFnbDetail("costCenter", event.target.value)} data-testid="booking-fnb-cost-center" placeholder="CC-BD-012" className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943]">Activity Code {organizationRequired && <span className="text-[#D33F37]">*</span>}
                  <input required={organizationRequired} value={fnbDetails.activityCode} onChange={(event) => setFnbDetail("activityCode", event.target.value)} data-testid="booking-fnb-activity-code" placeholder="Search Activity Code..." className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-[#3F4943] sm:col-span-2">Activity Name {organizationRequired && <span className="text-[#D33F37]">*</span>}
                  <input required={organizationRequired} value={fnbDetails.activityName} onChange={(event) => setFnbDetail("activityName", event.target.value)} data-testid="booking-fnb-activity-name" placeholder="Product Launching Q1 2026" className={fieldClass} />
                </label>
              </div>

              <div className="mt-4 rounded-lg bg-[#F2F5F3] px-3 py-2.5">
                <div className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#69756D]">Waktu Meeting</div>
                <div className="mt-1 text-sm font-extrabold text-[#0B4935]">{date} · {startTime} - {endTime}</div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#3F4943]">Kategori Tamu</span>
                  <span className={`text-[10px] font-semibold ${categorizedGuestTotal > Number(participants) ? "text-[#C73D36]" : "text-[#7B867F]"}`}>{categorizedGuestTotal}/{participants} peserta</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {GUEST_TYPES.map((type) => {
                    const disabled = type !== "Internal" && !involvesGuests;
                    const display = type === "Xternal" ? "Eksternal" : type;
                    return (
                      <label key={type} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${disabled ? "border-[#E6EAE7] bg-[#F7F9F7] text-[#A5AEA8]" : "border-[#DCE3DE] bg-white text-[#526058]"}`}>
                        <span className="text-xs font-bold">{display}</span>
                        <input type="number" min={0} max={participants} disabled={disabled} value={guestCounts[type]} onChange={(event) => setGuestCount(type, event.target.value)} data-testid={`booking-guest-count-${type.toLowerCase()}`} placeholder="0" className="h-8 w-14 rounded-md border border-[#DCE3DE] bg-white px-2 text-center text-xs outline-none focus:border-[#238B57]" />
                      </label>
                    );
                  })}
                </div>
              </div>

              {fnbSelected && <section className="mt-5 border-t border-[#E7ECE8] pt-5">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#0B4935]">Detail Konsumsi</h3>
                {snackSelected && <div className="mt-3 rounded-xl border border-[#DDE4DF] bg-[#FBFCFB] p-3">
                  <div className="text-xs font-extrabold text-[#3F4943]">Snack</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input required value={fnbDetails.snackType} onChange={(event) => setFnbDetail("snackType", event.target.value)} placeholder="Jenis snack" className={fieldClass} />
                    <input required type="number" min={1} value={fnbDetails.snackTimes} onChange={(event) => setFnbDetail("snackTimes", event.target.value)} placeholder="Berapa kali" className={fieldClass} />
                    <input required type="number" min={1} value={fnbDetails.snackPax} onChange={(event) => setFnbDetail("snackPax", event.target.value)} placeholder="Jumlah pax" className={fieldClass} />
                  </div>
                </div>}
                {mealSelected && <div className="mt-3 rounded-xl border border-[#DDE4DF] bg-[#FBFCFB] p-3">
                  <div className="text-xs font-extrabold text-[#3F4943]">{selectedMealTypes.join(" & ")}</div>
                  <input required type="number" min={1} value={fnbDetails.mealPax} onChange={(event) => setFnbDetail("mealPax", event.target.value)} placeholder="Jumlah pax" className={fieldClass} />
                </div>}
                <textarea value={foodBeverageNotes} onChange={(event) => setFoodBeverageNotes(event.target.value)} data-testid="booking-food-beverages-input" rows={2} placeholder="Catatan konsumsi (opsional)" className={`${fieldClass} resize-none`} />
              </section>}

              {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FDE8E7] px-3 py-2 text-xs font-semibold text-[#C73D36]" data-testid="booking-error"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4 sm:px-7">
              <button type="button" onClick={() => { setError(""); setCurrentStep(3); }} className="rounded-lg border border-[#DCE3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#526058] hover:bg-[#F7FAF8]" data-testid="booking-back-btn">Kembali</button>
              <button type="submit" disabled={loading || checkingAvailability || availability?.available === false} data-testid="booking-submit-btn" className="flex items-center gap-2 rounded-lg bg-[#238B57] px-7 py-2.5 text-sm font-bold text-white transition hover:bg-[#176E43] disabled:cursor-not-allowed disabled:bg-[#A8CFB9]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Lanjut
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

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
