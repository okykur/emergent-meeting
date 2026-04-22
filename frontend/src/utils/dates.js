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

// Compute availability status for a given day given bookings
// Returns: 'free' | 'partial' | 'full'
// Heuristic: working hours 08:00-20:00 (12h). If total booked minutes >= 11.5h => full. 0 => free. else partial.
export function dayAvailability(bookings, ymd) {
  const sameDay = bookings.filter((b) => b.date === ymd && (b.status === "pending" || b.status === "confirmed"));
  if (sameDay.length === 0) return "free";
  let minutes = 0;
  for (const b of sameDay) {
    const [sh, sm] = b.start_time.split(":").map(Number);
    const [eh, em] = b.end_time.split(":").map(Number);
    minutes += eh * 60 + em - (sh * 60 + sm);
  }
  if (minutes >= 11 * 60) return "full";
  return "partial";
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
