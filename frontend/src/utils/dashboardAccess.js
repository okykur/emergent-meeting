export function dashboardTabsForRole(role) {
  if (role === "meeting_admin") return ["meeting"];
  if (role === "car_admin") return ["vehicle"];
  if (role === "manager" || role === "super_admin") return ["meeting", "vehicle"];
  return [];
}
