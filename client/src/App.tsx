import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import Layout from "./components/Layout";
import BarLayout from "./pages/bar/BarLayout";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import WalkInBooking from "./pages/WalkInBooking";
import Reservations from "./pages/Reservations";
import Rooms from "./pages/Rooms";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import Staff from "./pages/Staff";
import Branches from "./pages/Branches";
import HotelSettings from "./pages/HotelSettings";
import NotificationsPage from "./pages/Notifications";
import BarDashboard from "./pages/bar/BarDashboard";
import BarInventory from "./pages/bar/BarInventory";
import BarSales from "./pages/bar/BarSales";
import BarReports from "./pages/bar/BarReports";
import BarWaiters from "./pages/bar/BarWaiters";
import BarShiftHistory from "./pages/bar/BarShiftHistory";

function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/abvichoteldashboard" replace />;
  // Bar attendants should not access hotel routes
  if (user.role === "bar_attendant") return <Navigate to="/bar" replace />;
  return <Layout>{children}</Layout>;
}

function BarProtectedRoute({ children, adminBar = false }: { children: JSX.Element; adminBar?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "bar_attendant" && user.role !== "admin" && user.role !== "supervisor") return <Navigate to="/abvichoteldashboard" replace />;
  if (adminBar && user.role !== "admin") return <Navigate to="/bar" replace />;
  return <BarLayout>{children}</BarLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/" element={<Navigate to="/abvichoteldashboard" replace />} />

      {/* Hotel routes */}
      <Route path="/abvichoteldashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/walk-in" element={<ProtectedRoute><WalkInBooking /></ProtectedRoute>} />
      <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
      <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute adminOnly><Staff /></ProtectedRoute>} />
      <Route path="/branches" element={<ProtectedRoute adminOnly><Branches /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><HotelSettings /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

      {/* Bar routes */}
      <Route path="/bar" element={<BarProtectedRoute><BarDashboard /></BarProtectedRoute>} />
      <Route path="/bar/sales" element={<BarProtectedRoute><BarSales /></BarProtectedRoute>} />
      <Route path="/bar/inventory" element={<BarProtectedRoute><BarInventory /></BarProtectedRoute>} />
      <Route path="/bar/waiters" element={<BarProtectedRoute><BarWaiters /></BarProtectedRoute>} />
      <Route path="/bar/reports" element={<BarProtectedRoute><BarReports /></BarProtectedRoute>} />
      <Route path="/bar/shifts" element={<BarProtectedRoute><BarShiftHistory /></BarProtectedRoute>} />

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
