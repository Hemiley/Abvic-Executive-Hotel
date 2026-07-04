import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import WalkInBooking from "./pages/WalkInBooking";
import Reservations from "./pages/Reservations";
import Rooms from "./pages/Rooms";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import Staff from "./pages/Staff";
import HotelSettings from "./pages/HotelSettings";
import NotificationsPage from "./pages/Notifications";

function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/abvichoteldashboard" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/" element={<Navigate to="/abvichoteldashboard" replace />} />
      <Route
        path="/abvichoteldashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walk-in"
        element={
          <ProtectedRoute>
            <WalkInBooking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <Reservations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <Rooms />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute>
            <AuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute adminOnly>
            <Staff />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute adminOnly>
            <HotelSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/abvichoteldashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <NotificationsProvider>
            <AppRoutes />
          </NotificationsProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
