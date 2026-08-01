import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import Layout from "./components/Layout";
import BarLayout from "./pages/bar/BarLayout";
import KitchenLayout from "./pages/kitchen/KitchenLayout";
import SecurityLayout from "./pages/security/SecurityLayout";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import SecurityLogin from "./pages/SecurityLogin";
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
import KitchenDashboard from "./pages/kitchen/KitchenDashboard";
import KitchenOrders from "./pages/kitchen/KitchenOrders";
import KitchenInventory from "./pages/kitchen/KitchenInventory";
import KitchenShifts from "./pages/kitchen/KitchenShifts";
import KitchenReports from "./pages/kitchen/KitchenReports";
import FoodOrderPage from "./pages/FoodOrderPage";
import SecurityPortal from "./pages/security/SecurityPortal";
import SecurityHistory from "./pages/security/SecurityHistory";
import Attendance from "./pages/Attendance";
import AttendancePayroll from "./pages/AttendancePayroll";

function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/abvichoteldashboard" replace />;
  // Portal-only roles should not access hotel routes
  if (user.role === "bar_attendant") return <Navigate to="/bar" replace />;
  if (user.role === "chef") return <Navigate to="/kitchen" replace />;
  if (user.role === "security") return <Navigate to="/security" replace />;
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

function KitchenProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!["chef", "admin", "supervisor"].includes(user.role)) return <Navigate to="/abvichoteldashboard" replace />;
  return <KitchenLayout>{children}</KitchenLayout>;
}

function SecurityProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/security-login" replace />;
  if (!["security", "admin"].includes(user.role)) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/security" replace />;
  return <SecurityLayout>{children}</SecurityLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/superadmin-login" element={<SuperAdminLogin />} />
      <Route path="/security-login" element={<SecurityLogin />} />
      <Route path="/" element={<Navigate to="/abvichoteldashboard" replace />} />

      {/* Hotel routes */}
      <Route path="/abvichoteldashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/walk-in" element={<ProtectedRoute><WalkInBooking /></ProtectedRoute>} />
      <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
      <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute adminOnly><Staff /></ProtectedRoute>} />
      <Route path="/branches" element={<ProtectedRoute adminOnly><Branches /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><HotelSettings /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/food-order" element={<ProtectedRoute><FoodOrderPage source="reception" /></ProtectedRoute>} />

      {/* Bar routes */}
      <Route path="/bar" element={<BarProtectedRoute><BarDashboard /></BarProtectedRoute>} />
      <Route path="/bar/sales" element={<BarProtectedRoute><BarSales /></BarProtectedRoute>} />
      <Route path="/bar/inventory" element={<BarProtectedRoute><BarInventory /></BarProtectedRoute>} />
      <Route path="/bar/waiters" element={<BarProtectedRoute><BarWaiters /></BarProtectedRoute>} />
      <Route path="/bar/reports" element={<BarProtectedRoute><BarReports /></BarProtectedRoute>} />
      <Route path="/bar/shifts" element={<BarProtectedRoute><BarShiftHistory /></BarProtectedRoute>} />
      <Route path="/bar/food-order" element={<BarProtectedRoute><FoodOrderPage source="bar" /></BarProtectedRoute>} />
      <Route path="/bar/notifications" element={<BarProtectedRoute><NotificationsPage /></BarProtectedRoute>} />

      {/* Kitchen routes */}
      <Route path="/kitchen" element={<KitchenProtectedRoute><KitchenDashboard /></KitchenProtectedRoute>} />
      <Route path="/kitchen/orders" element={<KitchenProtectedRoute><KitchenOrders /></KitchenProtectedRoute>} />
      <Route path="/kitchen/inventory" element={<KitchenProtectedRoute><KitchenInventory /></KitchenProtectedRoute>} />
      <Route path="/kitchen/shifts" element={<KitchenProtectedRoute><KitchenShifts /></KitchenProtectedRoute>} />
      <Route path="/kitchen/reports" element={<KitchenProtectedRoute><KitchenReports /></KitchenProtectedRoute>} />
      <Route path="/kitchen/notifications" element={<KitchenProtectedRoute><NotificationsPage /></KitchenProtectedRoute>} />

      {/* Security routes */}
      <Route path="/security" element={<SecurityProtectedRoute><SecurityPortal /></SecurityProtectedRoute>} />
      <Route path="/security/history" element={<SecurityProtectedRoute><SecurityHistory /></SecurityProtectedRoute>} />

      {/* Attendance (admin) routes */}
      <Route path="/attendance" element={<SecurityProtectedRoute adminOnly><Attendance /></SecurityProtectedRoute>} />
      <Route path="/attendance/payroll" element={<SecurityProtectedRoute adminOnly><AttendancePayroll /></SecurityProtectedRoute>} />

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
