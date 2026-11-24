# Business Rules

## Role Matrix

| Stored role | UI label | Primary responsibility |
| --- | --- | --- |
| `super_admin` | Super Admin | Users, masters, dashboards, all administration |
| `meeting_admin` | Meeting Admin | Meeting approval and room operations |
| `car_admin` | Admin Kendaraan | Vehicle approval and operations |
| `manager` | Manager GA | GA approval step and permitted dashboards |
| `manager_user` | Manager User | Requester's supervisor approval step |
| `user` | User | Own bookings and meeting lifecycle |

UI labels may change without changing stored role values or privileges.

## Account Registration

1. A user may register with a universal email domain; registration is not limited to `@kcsi-id.com`.
2. Company, department, and position use searchable master data selectors.
3. Department and position may use `Others` when no suitable master entry exists.
4. A new account remains pending until Super Admin approval.
5. The requester receives a pending email; Super Admin users receive an activation request.
6. Approval or rejection sends the corresponding result email to the requester.

## Meeting Booking

- Booking ID format is `MRyymmddNNNN`.
- A submitted request is immediately `pending` and blocks the selected room slot.
- Blocking statuses are `pending`, `confirmed`, `approved`, and `in_progress`.
- Guest totals for Internal, BOD, and External must not exceed participant count or room capacity.
- The room availability check and booking creation must prevent overlapping active reservations.

## Meeting Approval

1. Meeting Admin approves or rejects the request.
2. When appropriate, Meeting Admin selects Manager User, Manager GA, or both as subsequent approvers.
3. If Manager User is selected, that approval occurs first.
4. If both are selected, Manager GA remains waiting until Manager User approves.
5. If only Manager GA is selected, Manager GA may act after Meeting Admin approval.
6. Any rejection ends the chain and notifies the requester with the rejection reason.
7. When all required steps approve, the booking becomes `confirmed` and the requester is notified.
8. A request without manager steps becomes `confirmed` after Meeting Admin approval.

Approval actions must be authorized, single-use/idempotent, and recorded with actor and timestamp.

## Room Reassignment

- Meeting Admin and authorized administrators may reassign a room before the meeting starts.
- Reassignment must revalidate room capacity and time-slot availability.
- Reassignment is not allowed after check-in.
- The requester receives an email showing the previous and new room and the latest meeting details.

## Meeting Lifecycle

| Event | Required condition | Result |
| --- | --- | --- |
| Check-in | Confirmed booking at an allowed time | Status `in_progress`, store check-in time |
| Manual check-out | Booking has been checked in | Status `completed`, store check-out time |
| Auto check-out | Still `in_progress` five minutes after scheduled end | Status `completed`, store auto-checkout time |

Manual check-out may occur at any time after check-in. Completion email is sent after either manual or automatic check-out.

## Meeting Reminders

All timing uses Asia/Jakarta:

- Booking confirmation reminder: two hours before start.
- Check-in reminder: ten minutes before start.
- Check-out reminder: ten minutes before scheduled end, only for `in_progress` meetings.
- Auto check-out: five minutes after scheduled end when still `in_progress`.
- Completion confirmation: immediately after manual or auto check-out.

Each reminder must have a persisted sent marker to prevent duplicates.

## Vehicle Booking

- Booking ID format is `BKyymmddNNNN`.
- The flow supports request, admin approval/rejection, driver/vehicle assignment, handover, return, cancellation, and completion.
- Typical statuses are `pending`, `approved`, `rejected`, `assigned`, `in_use`, `completed`, and `cancelled`.
- Vehicle and driver assignment must reject conflicting active schedules.

## Master Data

- Companies, departments, positions, rooms, vehicles, drivers, and users are master data.
- Company, department, and position CRUD is restricted to Super Admin/System Admin authorization as implemented.
- Transaction cleanup must not delete master data.
- Master records should retain created/updated actor and timestamp audit fields where supported.
