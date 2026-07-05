export type Shift = {
  id: string;
  receptionistId: string;
  receptionistName: string;
  status: string;
  openingBalance: string;
  closingBalance: string | null;
  cashVariance: string | null;
  loginTime: string;
  logoutTime: string | null;
  guestsServed: number;
  roomsBooked: number;
  reservationsProcessed: number;
  totalSales: string;
  cashSales: string;
  cardSales: string;
  transferSales: string;
  discountsGiven: string;
  refundsIssued: string;
};

export type Room = {
  id: string;
  roomNumber: string;
  roomType: string;
  pricePerNight: string;
  capacity: number;
  amenities: string[];
  imageUrl: string | null;
  imageUrls: string[];
  status: "available" | "occupied" | "reserved" | "maintenance";
};

export type Guest = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  emergencyContact: string | null;
};

export type Reservation = {
  id: string;
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  specialRequests: string | null;
  status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
  source: "walk_in" | "reservation";
  stayType: "lodge" | "short_rest";
  durationHours: number | null;
  receptionistId: string;
  createdAt: string;
  updatedAt: string;
  guest?: Guest;
  room?: Room;
};

export type Payment = {
  id: string;
  reservationId: string;
  amount: string;
  method: string;
  type: string;
  transactionId: string | null;
  receptionistName: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  receptionistName: string | null;
  action: string;
  details: string | null;
  createdAt: string;
};

export type Staff = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: "receptionist" | "supervisor" | "admin";
  avatarUrl: string | null;
  active: boolean;
  createdAt: string;
};

export type HotelSettings = {
  id: string;
  hotelName: string;
  logoUrl: string | null;
  backgroundStyle: string | null;
  bgOpacity: string | null;
  bgBlur: number | null;
  fontColor: string | null;
  fontSize: number | null;
  shortRestHourlyRate: string | null;
  updatedAt: string;
};

export type DashboardSummary = {
  shiftActive: boolean;
  shift: Shift | null;
  todaysCheckIns: number;
  todaysCheckOuts: number;
  walkInGuests: number;
  shortRestGuests: number;
  pendingReservations: number;
  occupiedRooms: number;
  availableRooms: number;
  reservedRooms: number;
  totalSalesToday: number;
  paymentsReceived: number;
  outstandingPayments: number;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    credentials: "include",
  });

  // Session expired or was invalidated — redirect to login immediately
  // Skip if already on /login or if this is the auth-check/login request itself
  if (
    res.status === 401 &&
    url !== "/api/auth/login" &&
    url !== "/api/auth/me" &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/admin-login"
  ) {
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ id: string; username: string; fullName: string; role: string; avatarUrl: string | null; shift: Shift | null }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) }
    ),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () =>
    request<{ id: string; username: string; fullName: string; role: string; avatarUrl: string | null; shift: Shift | null }>(
      "/api/auth/me"
    ),

  startShift: (openingBalance: number) =>
    request<Shift>("/api/shifts/start", { method: "POST", body: JSON.stringify({ openingBalance }) }),
  getCurrentShift: () => request<Shift | null>("/api/shifts/current"),
  getShifts: () => request<Shift[]>("/api/shifts"),
  closeShift: (id: string, closingBalance: number) =>
    request<Shift>(`/api/shifts/${id}/close`, { method: "POST", body: JSON.stringify({ closingBalance }) }),
  getShiftReport: (id: string) =>
    request<{
      shift: Shift;
      payments: Payment[];
      reservations: (Reservation & { guest?: Guest; room?: Room })[];
      settings: HotelSettings;
    }>(`/api/shifts/${id}/report`),

  getRooms: () => request<Room[]>("/api/rooms"),
  createRoom: (data: Partial<Room>) => request<Room>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id: string, data: Partial<Room>) =>
    request<Room>(`/api/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  createBooking: (data: any) => request<any>("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
  createMultiRoomBooking: (data: any) =>
    request<{ reservations: Reservation[]; guest: Guest; rooms: Room[] }>(
      "/api/bookings/multi",
      { method: "POST", body: JSON.stringify(data) }
    ),
  getReservations: () => request<Reservation[]>("/api/reservations"),
  updateReservation: (id: string, data: Partial<Reservation>) =>
    request<Reservation>(`/api/reservations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  createPayment: (data: any) => request<Payment>("/api/payments", { method: "POST", body: JSON.stringify(data) }),
  getPayments: () => request<Payment[]>("/api/payments"),

  getStaff: () => request<Staff[]>("/api/staff"),
  createStaff: (data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    role: string;
    avatarUrl?: string;
  }) => request<Staff>("/api/staff", { method: "POST", body: JSON.stringify(data) }),
  updateStaff: (
    id: string,
    data: Partial<{ fullName: string; email: string; role: string; avatarUrl: string; active: boolean; password: string }>
  ) => request<Staff>(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStaff: (id: string) => request<void>(`/api/staff/${id}`, { method: "DELETE" }),

  getSettings: () => request<HotelSettings>("/api/settings"),
  updateSettings: (data: Partial<{ hotelName: string; logoUrl: string; backgroundStyle: string; bgOpacity: number; bgBlur: number; fontColor: string; fontSize: number; shortRestHourlyRate: number }>) =>
    request<HotelSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),

  getDashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  getNotifications: () => request<Notification[]>("/api/notifications"),
  markNotificationRead: (id: string) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  createNotification: (data: { type?: string; message: string }) =>
    request<Notification>("/api/notifications", { method: "POST", body: JSON.stringify(data) }),
  getAuditLogs: () => request<AuditLog[]>("/api/audit-logs"),
  getReportsSummary: () =>
    request<{
      totalBookings: number;
      totalReservations: number;
      checkIns: number;
      checkOuts: number;
      occupancyRate: number;
      totalRevenue: number;
    }>("/api/reports/summary"),
};
