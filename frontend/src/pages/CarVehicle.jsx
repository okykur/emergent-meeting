import { Link } from "react-router-dom";
import { Car, ArrowLeft, Wrench, Bell } from "lucide-react";

export default function CarVehicle() {
  return (
    <div className="mx-auto max-w-2xl py-8" data-testid="car-under-construction">
      <Link
        to="/hub"
        className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        data-testid="back-to-hub-link"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Hub
      </Link>

      <div className="rounded-sm border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm bg-amber-50">
          <Car className="h-8 w-8 text-amber-600" />
        </div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
          Under Development
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Car / Vehicle Booking
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-slate-500">
          This module is currently being built by a different division and
          administrator. Please come back later.
        </p>

        <div className="mx-auto mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Wrench className="h-3 w-3" /> In Progress
            </div>
            <div className="text-sm text-slate-700">
              Fleet, drivers and approval flow for company vehicles.
            </div>
          </div>
          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Bell className="h-3 w-3" /> Stay Tuned
            </div>
            <div className="text-sm text-slate-700">
              You'll be notified here as soon as it's available.
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/hub"
            className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="back-hub-btn"
          >
            Back to Hub
          </Link>
          <Link
            to="/rooms"
            className="rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC]"
            data-testid="go-meeting-room-btn"
          >
            Book a Meeting Room instead
          </Link>
        </div>
      </div>
    </div>
  );
}
