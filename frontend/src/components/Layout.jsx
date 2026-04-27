import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarDays,
  DoorOpen,
  Users,
  LogOut,
  Building2,
  BookMarked,
  Home,
  Car,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

function BrandMark() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2"
      data-testid="brand-link"
      aria-label="KCSI — Meeting Room Booking"
    >
      <img
        src="/brand-logo.png"
        alt="KCSI Consulting-Shared Services"
        className="h-14 w-auto object-contain"
      />
    </Link>
  );
}

export default function Layout({ admin = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userNav = [
    { to: "/hub", label: "Home", icon: Home, testid: "nav-hub", end: true },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, testid: "nav-calendar" },
  ];

  const role = user?.role;
  const isSuper = role === "super_admin";
  const isMeetingAdmin = role === "meeting_admin" || isSuper;
  const isCarAdmin = role === "car_admin" || isSuper;

  const adminNavFull = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, testid: "nav-admin-dashboard", end: true, show: true },
    { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck2, testid: "nav-admin-bookings", show: isMeetingAdmin },
    { to: "/admin/calendar", label: "Calendar", icon: CalendarDays, testid: "nav-admin-calendar", show: isMeetingAdmin },
    { to: "/admin/rooms", label: "Rooms", icon: DoorOpen, testid: "nav-admin-rooms", show: isMeetingAdmin },
    { to: "/admin/cars", label: "Car Dashboard", icon: Car, testid: "nav-admin-cars", show: isCarAdmin, end: true },
    { to: "/admin/cars/bookings", label: "Car Bookings", icon: CalendarCheck2, testid: "nav-admin-cars-bookings", show: isCarAdmin },
    { to: "/admin/cars/vehicles", label: "Vehicles", icon: Car, testid: "nav-admin-vehicles", show: isCarAdmin },
    { to: "/admin/cars/drivers", label: "Drivers", icon: Users, testid: "nav-admin-drivers", show: isCarAdmin },
    { to: "/admin/users", label: "Users", icon: Users, testid: "nav-admin-users", show: isSuper },
  ];
  const adminNav = adminNavFull.filter((n) => n.show);

  const nav = admin ? adminNav : userNav;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl"
        data-testid="app-header"
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-8">
            <BrandMark />
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  data-testid={n.testid}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && ["meeting_admin", "car_admin", "super_admin"].includes(user.role) && !admin && (
              <Link
                to="/admin"
                data-testid="go-admin-link"
                className="hidden rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 md:inline-flex"
              >
                Admin Console
              </Link>
            )}
            {user && user.role === "user" && admin && (
              <Link
                to="/hub"
                data-testid="go-user-link"
                className="hidden rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 md:inline-flex"
              >
                User App
              </Link>
            )}
            {admin && (
              <Link
                to="/hub"
                data-testid="go-user-from-admin"
                className="hidden rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 md:inline-flex"
              >
                User View
              </Link>
            )}
            <div className="hidden items-center gap-3 md:flex" data-testid="user-menu">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">{user?.name}</div>
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  {
                    {
                      user: "User",
                      meeting_admin: "Meeting Admin",
                      car_admin: "Car Admin",
                      super_admin: "Super Admin",
                    }[user?.role] || user?.role
                  }
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold uppercase text-white">
                {user?.name?.[0] || "U"}
              </div>
              <button
                onClick={handleLogout}
                data-testid="logout-btn"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <button
              className="md:hidden"
              onClick={() => setMobileOpen((s) => !s)}
              data-testid="mobile-menu-btn"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden" data-testid="mobile-nav">
            <nav className="flex flex-col p-2">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-sm px-3 py-3 text-sm font-medium ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-700"
                    }`
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 flex items-center gap-2 rounded-sm px-3 py-3 text-sm font-medium text-red-600"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export { BrandMark };
