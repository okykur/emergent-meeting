import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#f8f9fa]"
        data-testid="auth-loading"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#0055FF]" />
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/hub" replace />;
  }

  return children;
}
