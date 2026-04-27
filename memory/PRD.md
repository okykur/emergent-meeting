# KCSI Corporate Booking System — PRD

## Original Problem Statement
Corporate Meeting Room and Vehicle Booking Application (User App & Admin App) accessible via web browser and mobile PWA. Users book meeting rooms and corporate vehicles; admins manage approvals, assignments, and master data. KCSI corporate branding.

## User Personas
- **Employee / End User** — books rooms or requests vehicles, performs check-in/handover/return on the go (mobile PWA).
- **Meeting Admin** — approves room bookings, manages room master data.
- **Car Admin** — approves vehicle requests, assigns vehicle+driver, signs off handovers and returns, manages vehicle/driver master data.
- **Super Admin** — manages users (only role allowed to create/edit/reset-password/delete users).

## Core Requirements (static)
- Web + Mobile PWA, responsive (desktop table, mobile cards).
- JWT bearer auth (email + password) with self-registration.
- Role matrix: `super_admin` (everything + user mgmt), `meeting_admin` (rooms + room bookings), `car_admin` (vehicles + drivers + vehicle bookings), `user` (own bookings).
- **Meeting rooms**: availability view, double-booking prevention, admin approval, time-window-enforced check-in/check-out.
- **Vehicles**: single-trip / multi-day requests, optional driver, admin assignment, user handover (odometer/fuel/condition), admin sign-off, user return, admin sign-off.
- Unified My Bookings dashboard (rooms + vehicles).
- KCSI branding (logo on white background).

## What's Been Implemented
### Backend (FastAPI + MongoDB) — `/app/backend/server.py`
- JWT auth: `/api/auth/register|login|me|logout`.
- Users CRUD (super_admin only): `/api/users` GET/POST, `/api/users/{id}` PATCH/DELETE, `/api/users/{id}/password`.
- Rooms CRUD (meeting_admin): `/api/rooms` + `/api/rooms/{id}/availability`.
- Meeting bookings: `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings` (admin), `PATCH /api/bookings/{id}/status`, `POST /api/bookings/{id}/cancel|check-in|check-out`. Overlap prevention, time-window check-in.
- Vehicles + Drivers CRUD (car_admin): `/api/vehicles`, `/api/drivers`.
- Vehicle bookings full lifecycle: `POST /api/vehicle-bookings`, `GET /api/vehicle-bookings/mine`, admin assign, user handover, admin handover sign-off, user return, admin return sign-off, cancel.
- Mongo `_id` excluded on every read; bcrypt password hashing.
- Seeds super_admin + meeting_admin + car_admin + sample rooms on startup.

### Frontend (React + Tailwind + Shadcn)
- AuthContext + ProtectedRoute with role-aware gating.
- Hub landing page with 3 tiles (My Booking, Meeting Room, Car/Vehicle).
- Unified `MyBookings.jsx` — desktop table + mobile card layout (no overflow at 390px).
- Meeting room booking + admin approval + check-in/out flows.
- Vehicle booking new/detail (handover & return forms) + admin dashboards (vehicles, drivers, bookings).
- KCSI logo & corporate styling, PWA manifest + service worker.

## Recent Changes (2026-02 fork session)
- 🗓️ **Unified Calendar** (`BookingsCalendar.jsx`): merged meeting room + vehicle bookings into a single month grid. Multi-day vehicle bookings expand across every covered date. Type filter pills (All / Meeting Rooms / Vehicles). Type+Status legends. Day-detail panel shows type chip, multi-day range badge, status pill, and an "Open" deep-link to the booking detail. Uses `Promise.allSettled` so a meeting_admin or car_admin viewing `/admin/calendar` only sees the slice they're authorized for (the other endpoint silently 403s).
- 🛡️ **CRITICAL FIX**: `POST /api/users/{id}/password` was using `require_admin` (= meeting_admin), allowing privilege escalation where any meeting_admin could reset another user's password. Now uses `require_super_admin`. Verified by 26/26 pytest cases passing.
- 🐛 Fixed broken `MyBookings.jsx` (orphaned duplicate JSX from a prior incomplete edit was breaking the build).
- ✅ First full system test run via `testing_agent_v3_fork` — backend 26/26 pytest, frontend playwright on login, hub redirect, my-bookings desktop+mobile (no horizontal overflow at 390px), /admin RBAC enforcement.
- Pytest suite at `/app/backend/tests/backend_test.py` covers auth, RBAC (9 cross-role 403 checks), user mgmt, meeting flow (overlap, check-in window), full vehicle lifecycle, `_id` leak guards.

## Backlog / Roadmap

### P1
- **Super Admin console** (deferred by user): unified KPI dashboard, better Users page (search/filter/bulk), system-wide booking oversight, audit log.

### P2
- Real photo uploads (object storage) + canvas signature pad for vehicle handover/return (currently text URL + typed name).
- Email notifications via Resend (booking status changes).
- Brute-force lockout on `/api/auth/login` (5 fails → temp lock).
- Reject `pending` status on `PATCH /api/bookings/{id}/status` and re-validate overlap when re-confirming a cancelled booking.
- Past-date + HH:MM format validation on vehicle bookings.
- Tighten CORS_ORIGINS away from `*` if cookie auth is added.

### Refactoring
- Split `server.py` (1455 lines) into `routes/auth.py`, `users.py`, `rooms.py`, `bookings.py`, `vehicles.py`, `drivers.py`, `vehicle_bookings.py`.
- Replace inline `if admin['role'] not in CAR_ADMIN_ROLES: 403` checks with `Depends(require_car_admin)` everywhere.
- Pick one path between `Field(default_factory=HandoverInfo)` and manual `setdefault` in `_public_booking`.

## Test Credentials
See `/app/memory/test_credentials.md`. All 4 accounts work.
