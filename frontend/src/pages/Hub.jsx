import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked, DoorOpen, Car, ArrowRight, Clock3 } from "lucide-react";

const TILES = [
  {
    key: "my-bookings",
    title: "My Booking",
    subtitle: "All your bookings in one place",
    description:
      "See every booking activity you've made — meeting rooms, cars, and anything else you've reserved.",
    to: "/my-bookings",
    icon: BookMarked,
    accent: "#0055FF",
    status: "active",
    testid: "hub-tile-my-bookings",
  },
  {
    key: "meeting-room",
    title: "Meeting Room",
    subtitle: "Reserve a meeting space",
    description:
      "Browse available rooms, check live schedules, and request a booking for your next meeting.",
    to: "/rooms",
    icon: DoorOpen,
    accent: "#10B981",
    status: "active",
    testid: "hub-tile-meeting-room",
  },
  {
    key: "car-vehicle",
    title: "Car / Vehicle",
    subtitle: "Reserve a vehicle",
    description:
      "Request a company car or van for official trips — single-trip with driver, or multi-day reservations.",
    to: "/car",
    icon: Car,
    accent: "#F59E0B",
    status: "active",
    testid: "hub-tile-car",
  },
];

export default function Hub() {
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0] || "there";

  return (
    <div data-testid="hub-page">
      <div className="mb-10">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Product Hub
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-2 max-w-2xl text-base text-slate-500">
          What would you like to do today? Pick a product to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          const isComing = t.status === "coming-soon";
          return (
            <Link
              key={t.key}
              to={t.to}
              data-testid={t.testid}
              className="group relative flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute right-6 top-6">
                {isComing && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    <Clock3 className="h-3 w-3" />
                    Soon
                  </span>
                )}
              </div>
              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-sm text-white"
                style={{ backgroundColor: t.accent }}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t.subtitle}
              </div>
              <h3 className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {t.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                {t.description}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {isComing ? "Preview" : "Open"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
