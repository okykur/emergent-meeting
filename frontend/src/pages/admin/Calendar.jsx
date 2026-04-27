import BookingsCalendar from "../../components/BookingsCalendar";

export default function AdminCalendar() {
  return (
    <div data-testid="admin-calendar-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Organization Schedule
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Bookings Calendar
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Full month view of every meeting room and vehicle booking across the organization.
        </p>
      </div>
      <BookingsCalendar scope="admin" title="All bookings calendar" />
    </div>
  );
}
