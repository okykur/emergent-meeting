import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Rooms from "@/pages/Rooms";
import MyBookings from "@/pages/MyBookings";
import MyCalendar from "@/pages/MyCalendar";
import Hub from "@/pages/Hub";
import CarHome from "@/pages/car/CarHome";
import CarBookingNew from "@/pages/car/CarBookingNew";
import MyCarBookings from "@/pages/car/MyCarBookings";
import CarBookingDetail from "@/pages/car/CarBookingDetail";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminBookings from "@/pages/admin/Bookings";
import AdminRooms from "@/pages/admin/Rooms";
import AdminCalendar from "@/pages/admin/Calendar";
import AdminUsers from "@/pages/admin/Users";
import AdminCarsDashboard from "@/pages/admin/CarsDashboard";
import AdminCarsBookings from "@/pages/admin/CarsBookings";
import AdminCarBookingDetail from "@/pages/admin/CarBookingDetail";
import AdminVehicles from "@/pages/admin/Vehicles";
import AdminDrivers from "@/pages/admin/Drivers";
import { Toaster } from "sonner";

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (user === false) return <Navigate to="/login" replace />;
  const isAdmin = ["meeting_admin", "car_admin", "super_admin"].includes(user.role);
  return <Navigate to={isAdmin ? "/admin" : "/hub"} replace />;
}

function AdminHome() {
  const { user } = useAuth();
  if (user && user.role === "car_admin") {
    return <Navigate to="/admin/cars" replace />;
  }
  return <AdminDashboard />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/hub" element={<Hub />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/calendar" element={<MyCalendar />} />
              <Route path="/car" element={<CarHome />} />
              <Route path="/car/new" element={<CarBookingNew />} />
              <Route path="/car/my-bookings" element={<MyCarBookings />} />
              <Route path="/car/bookings/:id" element={<CarBookingDetail />} />
            </Route>

            <Route
              element={
                <ProtectedRoute adminOnly>
                  <Layout admin />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              <Route path="/admin/calendar" element={<AdminCalendar />} />
              <Route path="/admin/rooms" element={<AdminRooms />} />
              <Route path="/admin/cars" element={<AdminCarsDashboard />} />
              <Route path="/admin/cars/bookings" element={<AdminCarsBookings />} />
              <Route path="/admin/cars/bookings/:id" element={<AdminCarBookingDetail />} />
              <Route path="/admin/cars/vehicles" element={<AdminVehicles />} />
              <Route path="/admin/cars/drivers" element={<AdminDrivers />} />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute superAdminOnly>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
