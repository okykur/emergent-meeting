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
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminBookings from "@/pages/admin/Bookings";
import AdminRooms from "@/pages/admin/Rooms";
import AdminCalendar from "@/pages/admin/Calendar";
import AdminUsers from "@/pages/admin/Users";
import { Toaster } from "sonner";

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/rooms"} replace />;
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
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              <Route path="/admin/calendar" element={<AdminCalendar />} />
              <Route path="/admin/rooms" element={<AdminRooms />} />
              <Route path="/admin/users" element={<AdminUsers />} />
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
