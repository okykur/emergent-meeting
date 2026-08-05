// Util helpers for date ranges (next 7 days)

export function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function next7Days(from = new Date()) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    days.push({
      ymd: toYMD(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      day: d.getDate(),
    });
  }
  return days;
}

// Build an array of day objects from startYMD to endYMD (inclusive). Caps at `max` days.
export function rangeDays(startYMD, endYMD, max = 31) {
  const out = [];
  if (!startYMD || !endYMD) return out;
  const start = new Date(startYMD + "T00:00:00");
  const end = new Date(endYMD + "T00:00:00");
  if (isNaN(start) || isNaN(end) || end < start) return out;
  const d = new Date(start);
  while (d <= end && out.length < max) {
    out.push({
      ymd: toYMD(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      day: d.getDate(),
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const DEFAULT_OPERATING_START_TIME = "08:00";
export const DEFAULT_OPERATING_END_TIME = "17:30";
const ACTIVE_BOOKING_STATUSES = new Set(["pending", "confirmed", "approved"]);
const APPROVED_BOOKING_STATUSES = new Set(["confirmed", "approved"]);

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function mergedMinutes(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [currentStart, currentEnd] = sorted[0];

  for (const [start, end] of sorted.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += currentEnd - currentStart;
      [currentStart, currentEnd] = [start, end];
    }
  }

  return total + currentEnd - currentStart;
}

export function getRoomOperatingHours(room = {}) {
  const start = room.operating_start_time || DEFAULT_OPERATING_START_TIME;
  const end = room.operating_end_time || DEFAULT_OPERATING_END_TIME;
  return { start, end, startMinutes: timeToMinutes(start), endMinutes: timeToMinutes(end) };
}

export function roomOperatingHoursLabel(room = {}) {
  const { start, end } = getRoomOperatingHours(room);
  return `${start}-${end}`;
}

export function isWithinOperatingHours(room = {}, startTime, endTime) {
  const { start, end } = getRoomOperatingHours(room);
  return startTime >= start && endTime <= end;
}

// Compute availability status for a given day given bookings.
// Pending requests reserve the slot operationally, but the heat bar only turns
// red after approved bookings cover the room operating hours.
// Returns: 'free' | 'partial' | 'full'
export function dayAvailability(bookings, ymd, room = {}) {
  const sameDay = bookings.filter((b) => b.date === ymd && ACTIVE_BOOKING_STATUSES.has(b.status));
  if (sameDay.length === 0) return "free";

  const { startMinutes, endMinutes } = getRoomOperatingHours(room);
  const fullOperatingMinutes = endMinutes - startMinutes;
  if (fullOperatingMinutes <= 0) return "partial";

  const confirmed = sameDay.filter((b) => APPROVED_BOOKING_STATUSES.has(b.status));
  const workdayIntervals = confirmed
    .map((b) => [
      Math.max(timeToMinutes(b.start_time), startMinutes),
      Math.min(timeToMinutes(b.end_time), endMinutes),
    ])
    .filter(([start, end]) => end > start);
  const confirmedMinutes = mergedMinutes(workdayIntervals);
  if (confirmedMinutes >= fullOperatingMinutes) return "full";
  return "partial";
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
