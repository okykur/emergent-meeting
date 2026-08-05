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

const WORKDAY_START_MINUTES = 8 * 60;
const WORKDAY_END_MINUTES = 17 * 60 + 30;
const FULL_WORKDAY_MINUTES = WORKDAY_END_MINUTES - WORKDAY_START_MINUTES;

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

// Compute availability status for a given day given bookings.
// Pending requests reserve the slot operationally, but the heat bar only turns
// red after approved bookings cover the 08:00-17:30 working day.
// Returns: 'free' | 'partial' | 'full'
export function dayAvailability(bookings, ymd) {
  const sameDay = bookings.filter((b) => b.date === ymd && (b.status === "pending" || b.status === "confirmed"));
  if (sameDay.length === 0) return "free";

  const confirmed = sameDay.filter((b) => b.status === "confirmed");
  const workdayIntervals = confirmed
    .map((b) => [
      Math.max(timeToMinutes(b.start_time), WORKDAY_START_MINUTES),
      Math.min(timeToMinutes(b.end_time), WORKDAY_END_MINUTES),
    ])
    .filter(([start, end]) => end > start);
  const confirmedMinutes = mergedMinutes(workdayIntervals);
  if (confirmedMinutes >= FULL_WORKDAY_MINUTES) return "full";
  return "partial";
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
