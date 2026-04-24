// Role helpers shared across the app.
export const ROLES = {
  USER: "user",
  MEETING_ADMIN: "meeting_admin",
  CAR_ADMIN: "car_admin",
  SUPER_ADMIN: "super_admin",
};

export const ADMIN_ROLES = [ROLES.MEETING_ADMIN, ROLES.CAR_ADMIN, ROLES.SUPER_ADMIN];

export const ROLE_LABELS = {
  user: "User",
  meeting_admin: "Meeting Admin",
  car_admin: "Car Admin",
  super_admin: "Super Admin",
};

export function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function isMeetingAdmin(role) {
  return role === ROLES.MEETING_ADMIN || role === ROLES.SUPER_ADMIN;
}

export function isCarAdmin(role) {
  return role === ROLES.CAR_ADMIN || role === ROLES.SUPER_ADMIN;
}
