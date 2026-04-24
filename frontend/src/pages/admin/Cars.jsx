import { Link } from "react-router-dom";
import { Car, Wrench, Bell, ArrowLeft } from "lucide-react";

export default function AdminCars() {
  return (
    <div className="mx-auto max-w-2xl py-4" data-testid="admin-cars-page">
      <Link
        to="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="rounded-sm border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm bg-amber-50">
          <Car className="h-8 w-8 text-amber-600" />
        </div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
          Under Development
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Car / Vehicle Admin Console
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-slate-500">
          The car pool management module is currently being built. When it
          ships, you'll be able to manage vehicles, drivers, and approve
          booking requests from this page.
        </p>

        <div className="mx-auto mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Wrench className="h-3 w-3" /> Coming soon
            </div>
            <div className="text-sm text-slate-700">
              Vehicle master data, driver assignments, mileage tracking.
            </div>
          </div>
          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Bell className="h-3 w-3" /> Stay tuned
            </div>
            <div className="text-sm text-slate-700">
              Approval queue and booking monitoring — just like meeting rooms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
