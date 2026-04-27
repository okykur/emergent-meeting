import BookingsCalendar from "../components/BookingsCalendar";

export default function MyCalendar() {
  return (
    <div data-testid="user-calendar-page">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          My Schedule
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Calendar
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A month-at-a-glance view of all your meeting room and vehicle bookings.
        </p>
      </div>
      <BookingsCalendar scope="mine" title="My bookings calendar" />
    </div>
  );
}
