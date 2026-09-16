function minutesBetween(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function hasValidFnbRule(booking) {
  const food = (booking.food_beverages || "").trim().toLowerCase();
  if (!food) return false;
  const duration = minutesBetween(booking.start_time, booking.end_time);
  if (duration < 4 * 60) return false;
  if (food.includes("makan") && duration < 5 * 60) return false;
  return true;
}

function needsMeetingApproval(booking) {
  return booking.status === "pending" && booking.supervisor_approval_status === "approved";
}

function needsFnbApproval(booking) {
  return booking.status === "confirmed"
    && booking.fnb_status === "pending"
    && hasValidFnbRule(booking);
}

export function isActiveManagerApproval(booking) {
  return needsMeetingApproval(booking) || needsFnbApproval(booking);
}
