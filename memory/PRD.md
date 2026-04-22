# Meeting Room Booking Application — PRD

## Original Problem Statement
Create a Meeting Room Booking Application consisting of two applications/modules: User App and Admin App, accessible via web browser and mobile as a Progressive Web App (PWA). Users can view rooms (available/unavailable for next 7 days), filter, and book rooms. Admins manage rooms and approve bookings.

## User Personas
- **Employee / End User** — wants a fast way to find and book a meeting room.
- **Admin / Workplace Manager** — needs to manage rooms, approve bookings, and monitor utilization.

## Core Requirements (static)
- Web + Mobile PWA, responsive.
- JWT-based custom auth (email + password).
- Role-based access: `user` / `admin`.
- Rooms: name, location, capacity, facilities, description, active/non-active.
- Bookings: title, date, start/end time, participants, notes; statuses `pending | confirmed | cancelled | completed`.
- Prevent overlapping bookings for same room & time.
- Default availability display: today → today+7.
- Bookings require admin approval (not auto-confirmed).

## What's Been Implemented (2026-04-22)
### Backend (FastAPI + MongoDB)
- JWT bearer auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/promote` (admin).
- Rooms CRUD: `GET/POST/PUT/DELETE /api/rooms`, `GET /api/rooms/{id}`, `GET /api/rooms/{id}/availability`.
- Bookings: `POST /api/bookings` (user create, pending), `GET /api/bookings/mine`, `GET /api/bookings` (admin, filterable), `PATCH /api/bookings/{id}/status` (admin), `POST /api/bookings/{id}/cancel`.
- Admin stats: `GET /api/admin/stats`.
- Startup: seeds admin (`admin@roombook.com` / `Admin@123`) and 6 sample rooms. Indexes on users.email, rooms.name, bookings.
- Overlap & past-date validation; capacity enforcement; role-based permission checks.

### Frontend (React)
- AuthContext + ProtectedRoute with admin-only gating.
- Pages: `Login`, `Register`, `Rooms`, `MyBookings`, `Admin Dashboard`, `Admin Bookings`, `Admin Rooms`.
- Corporate "Swiss" design (Outfit + IBM Plex Sans, blue accent `#0055FF`, slate neutrals, 1px borders, `rounded-sm`).
- 7-day heat bar for room availability, filters (search, active/inactive), status pills for bookings.
- Admin approve/reject/complete flow.
- PWA: `manifest.json` + `service-worker.js` (registered in production).
- Mobile responsive header with hamburger menu.

## Prioritized Backlog
- **P1:** Email notifications on approval/rejection (Resend integration).
- **P1:** Calendar month view for bookings.
- **P2:** Recurring bookings (weekly stand-ups, etc.).
- **P2:** Room photos upload via object storage.
- **P2:** CSV export of booking history.
- **P2:** Analytics dashboard (utilization % per room).
- **P3:** iCal invites for confirmed bookings.

## Next Tasks
- Run testing agent end-to-end.
- Collect user feedback on core flow and prioritise backlog.
