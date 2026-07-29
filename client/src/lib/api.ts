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

export type Branch = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  createdAt: string;
};

export type Room = {
  id: string;
  branchId: string;
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
  branchId: string | null;
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

export type BarDrink = {
  id: string;
  branchId: string;
  name: string;
  category: string;
  brand: string | null;
  sellingPrice: string;
  quantityAvailable: number;
  lowStockThreshold: number;
  barcode: string | null;
  imageUrl: string | null;
  status: "available" | "out_of_stock";
  createdAt: string;
  updatedAt: string;
};

export type BarWaiter = {
  id: string;
  branchId: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export type BarShift = {
  id: string;
  barAttendantId: string;
  barAttendantName: string;
  branchId: string;
  status: "active" | "closed";
  openTime: string;
  closeTime: string | null;
  openingStockSnapshot: any[];
  closingStockSnapshot: any[];
  totalRevenue: string;
  totalBottlesSold: number;
  totalTransactions: number;
};

export type BarSaleItem = {
  id: string;
  barSaleId: string;
  drinkId: string;
  drinkName: string;
  category: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type BarSale = {
  id: string;
  barShiftId: string | null;
  barAttendantId: string;
  barAttendantName: string;
  branchId: string;
  invoiceNumber: string;
  waiterName: string | null;
  paymentMethod: string;
  totalAmount: string;
  createdAt: string;
  items?: BarSaleItem[];
};

export type BarDashboard = {
  shift: BarShift | null;
  totalDrinksInStock: number;
  totalDrinkTypes: number;
  lowStockCount: number;
  lowStockDrinks: BarDrink[];
  todaySalesCount: number;
  todayBottlesSold: number;
  todayRevenue: number;
  recentTransactions: BarSale[];
};

export type BarReport = {
  totalRevenue: number;
  totalBottlesSold: number;
  totalTransactions: number;
  topSelling: { id: string; name: string; category: string; qty: number; revenue: number }[];
  salesByWaiter: { name: string; sales: number; revenue: number }[];
  lowStockDrinks: BarDrink[];
  sales: (BarSale & { items: BarSaleItem[] })[];
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
  login: (username: string, password: string, branchId?: string) =>
    request<{ id: string; username: string; fullName: string; role: string; avatarUrl: string | null; branchId?: string | null; shift: Shift | null }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ username, password, branchId }) }
    ),
  getPublicBranches: () => request<{ id: string; name: string }[]>("/api/branches/public"),
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

  getRooms: (branchId?: string) => request<Room[]>(`/api/rooms${branchId ? `?branchId=${branchId}` : ""}`),
  createRoom: (data: Partial<Room>) => request<Room>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id: string, data: Partial<Room>) =>
    request<Room>(`/api/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRoom: (id: string) =>
    request<{ ok: boolean }>(`/api/rooms/${id}`, { method: "DELETE" }),

  getBranches: () => request<Branch[]>("/api/branches"),
  createBranch: (data: { name: string; code?: string; active?: boolean }) =>
    request<Branch>("/api/branches", { method: "POST", body: JSON.stringify(data) }),
  updateBranch: (id: string, data: Partial<{ name: string; code: string; active: boolean }>) =>
    request<Branch>(`/api/branches/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBranch: (id: string) => request<{ ok: boolean }>(`/api/branches/${id}`, { method: "DELETE" }),

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

  getStaff: (branchId?: string) => request<Staff[]>(`/api/staff${branchId ? `?branchId=${branchId}` : ""}`),
  createStaff: (data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    role: string;
    avatarUrl?: string;
    branchId?: string;
  }) => request<Staff>("/api/staff", { method: "POST", body: JSON.stringify(data) }),
  updateStaff: (
    id: string,
    data: Partial<{ fullName: string; email: string; role: string; avatarUrl: string; active: boolean; password: string; branchId: string | null }>
  ) => request<Staff>(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStaff: (id: string) => request<void>(`/api/staff/${id}`, { method: "DELETE" }),

  getSettings: () => request<HotelSettings>("/api/settings"),
  updateSettings: (data: Partial<{ hotelName: string; logoUrl: string; backgroundStyle: string; bgOpacity: number; bgBlur: number; fontColor: string; fontSize: number; shortRestHourlyRate: number }>) =>
    request<HotelSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Bar Management
  getBarDrinks: (branchId?: string) => request<BarDrink[]>(`/api/bar/drinks${branchId ? `?branchId=${branchId}` : ""}`),
  createBarDrink: (data: Partial<BarDrink>) => request<BarDrink>("/api/bar/drinks", { method: "POST", body: JSON.stringify(data) }),
  updateBarDrink: (id: string, data: Partial<BarDrink>) => request<BarDrink>(`/api/bar/drinks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBarDrink: (id: string) => request<{ ok: boolean }>(`/api/bar/drinks/${id}`, { method: "DELETE" }),

  getBarWaiters: () => request<BarWaiter[]>("/api/bar/waiters"),
  createBarWaiter: (data: { branchId: string; name: string }) => request<BarWaiter>("/api/bar/waiters", { method: "POST", body: JSON.stringify(data) }),
  updateBarWaiter: (id: string, data: { name?: string; active?: boolean }) => request<BarWaiter>(`/api/bar/waiters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBarWaiter: (id: string) => request<{ ok: boolean }>(`/api/bar/waiters/${id}`, { method: "DELETE" }),

  startBarShift: () => request<BarShift>("/api/bar/shifts/start", { method: "POST", body: JSON.stringify({}) }),
  getCurrentBarShift: () => request<BarShift | null>("/api/bar/shifts/current"),
  getBarShifts: () => request<BarShift[]>("/api/bar/shifts"),
  closeBarShift: (id: string) => request<BarShift>(`/api/bar/shifts/${id}/close`, { method: "POST", body: JSON.stringify({}) }),

  createBarSale: (data: { waiterName?: string; paymentMethod: string; items: { drinkId: string; quantity: number }[] }) =>
    request<{ sale: BarSale; items: BarSaleItem[] }>("/api/bar/sales", { method: "POST", body: JSON.stringify(data) }),
  getBarSales: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString();
    return request<BarSale[]>(`/api/bar/sales${qs ? `?${qs}` : ""}`);
  },
  getBarSaleById: (id: string) => request<{ sale: BarSale; items: BarSaleItem[] }>(`/api/bar/sales/${id}`),

  getBarDashboard: () => request<BarDashboard>("/api/bar/dashboard"),
  getBarReports: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString();
    return request<BarReport>(`/api/bar/reports${qs ? `?${qs}` : ""}`);
  },

  getDashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  getNotifications: () => request<Notification[]>("/api/notifications"),
  markNotificationRead: (id: string) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  createNotification: (data: { type?: string; message: string }) =>
    request<Notification>("/api/notifications", { method: "POST", body: JSON.stringify(data) }),
  getAuditLogs: () => request<AuditLog[]>("/api/audit-logs"),
  getReportsSummary: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString();
    return request<{
      totalBookings: number;
      totalReservations: number;
      checkIns: number;
      checkOuts: number;
      occupancyRate: number;
      totalRevenue: number;
    }>(`/api/reports/summary${qs ? `?${qs}` : ""}`);
  },
};
