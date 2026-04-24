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
import CarVehicle from "@/pages/CarVehicle";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminBookings from "@/pages/admin/Bookings";
import AdminRooms from "@/pages/admin/Rooms";
import AdminCalendar from "@/pages/admin/Calendar";
import AdminUsers from "@/pages/admin/Users";
import AdminCars from "@/pages/admin/Cars";
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
  // Car admin has no meeting-room dashboard data — send them to their console
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
              <Route path="/car" element={<CarVehicle />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/calendar" element={<MyCalendar />} />
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
              <Route path="/admin/cars" element={<AdminCars />} />
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
