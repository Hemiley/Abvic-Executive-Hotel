import { pgTable, text, timestamp, uuid, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const receptionists = pgTable("receptionists", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("receptionist"), // receptionist | supervisor | admin
  avatarUrl: text("avatar_url"),
  // Which branch this staff member operates out of. Admins are branch-agnostic (null) —
  // everyone else is scoped to exactly one branch and only sees that branch's data.
  branchId: uuid("branch_id"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  receptionistId: uuid("receptionist_id").notNull(),
  receptionistName: text("receptionist_name").notNull(),
  status: text("status").notNull().default("active"), // active | closed
  openingBalance: numeric("opening_balance").notNull().default("0"),
  closingBalance: numeric("closing_balance"),
  cashVariance: numeric("cash_variance"),
  loginTime: timestamp("login_time").notNull().defaultNow(),
  logoutTime: timestamp("logout_time"),
  guestsServed: integer("guests_served").notNull().default(0),
  roomsBooked: integer("rooms_booked").notNull().default(0),
  reservationsProcessed: integer("reservations_processed").notNull().default(0),
  totalSales: numeric("total_sales").notNull().default("0"),
  cashSales: numeric("cash_sales").notNull().default("0"),
  cardSales: numeric("card_sales").notNull().default("0"),
  transferSales: numeric("transfer_sales").notNull().default("0"),
  discountsGiven: numeric("discounts_given").notNull().default("0"),
  refundsIssued: numeric("refunds_issued").notNull().default("0"),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Every room belongs to exactly one branch. New branches can be added at
  // any time without touching this table's structure — just insert a row
  // into `branches` and start assigning rooms to it.
  branchId: uuid("branch_id").notNull(),
  roomNumber: text("room_number").notNull().unique(),
  roomType: text("room_type").notNull(),
  pricePerNight: numeric("price_per_night").notNull(),
  capacity: integer("capacity").notNull().default(2),
  amenities: jsonb("amenities").notNull().default([]),
  imageUrl: text("image_url"),
  imageUrls: jsonb("image_urls").notNull().default([]),
  status: text("status").notNull().default("available"), // available | occupied | reserved | maintenance
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  nationality: text("nationality"),
  idType: text("id_type"),
  idNumber: text("id_number"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestId: uuid("guest_id").notNull(),
  roomId: uuid("room_id").notNull(),
  checkInDate: text("check_in_date").notNull(),
  checkOutDate: text("check_out_date").notNull(),
  numGuests: integer("num_guests").notNull().default(1),
  specialRequests: text("special_requests"),
  status: text("status").notNull().default("pending"), // pending | confirmed | checked_in | checked_out | cancelled
  source: text("source").notNull().default("walk_in"), // walk_in | reservation
  stayType: text("stay_type").notNull().default("lodge"), // lodge | short_rest
  durationHours: integer("duration_hours"), // only set for short_rest
  receptionistId: uuid("receptionist_id").notNull(),
  shiftId: uuid("shift_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id").notNull(),
  amount: numeric("amount").notNull(),
  method: text("method").notNull(), // cash | pos | bank_transfer | card | flutterwave | paystack | stripe
  type: text("type").notNull().default("payment"), // payment | refund | discount
  transactionId: text("transaction_id"),
  receptionistId: uuid("receptionist_id").notNull(),
  receptionistName: text("receptionist_name").notNull(),
  shiftId: uuid("shift_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  receptionistId: uuid("receptionist_id"),
  receptionistName: text("receptionist_name"),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hotelSettings = pgTable("hotel_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  hotelName: text("hotel_name").notNull().default("AEH"),
  logoUrl: text("logo_url"),
  backgroundStyle: text("background_style"),
  bgOpacity: numeric("bg_opacity").notNull().default("1"),
  bgBlur: integer("bg_blur").notNull().default(0),
  fontColor: text("font_color"),
  fontSize: integer("font_size"),
  shortRestHourlyRate: numeric("short_rest_hourly_rate").notNull().default("3000"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Bar Management ───────────────────────────────────────────────────────────

export const barDrinks = pgTable("bar_drinks", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Beer"), // Beer | Wine | Spirit | Soft Drink | Water | Energy Drink | Other
  brand: text("brand"),
  sellingPrice: numeric("selling_price").notNull(),
  quantityAvailable: integer("quantity_available").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  barcode: text("barcode"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("available"), // available | out_of_stock
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const barWaiters = pgTable("bar_waiters", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const barShifts = pgTable("bar_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  barAttendantId: uuid("bar_attendant_id").notNull(),
  barAttendantName: text("bar_attendant_name").notNull(),
  branchId: uuid("branch_id").notNull(),
  status: text("status").notNull().default("active"), // active | closed
  openTime: timestamp("open_time").notNull().defaultNow(),
  closeTime: timestamp("close_time"),
  openingStockSnapshot: jsonb("opening_stock_snapshot").notNull().default([]),
  closingStockSnapshot: jsonb("closing_stock_snapshot").notNull().default([]),
  totalRevenue: numeric("total_revenue").notNull().default("0"),
  totalBottlesSold: integer("total_bottles_sold").notNull().default(0),
  totalTransactions: integer("total_transactions").notNull().default(0),
});

export const barSales = pgTable("bar_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  barShiftId: uuid("bar_shift_id"),
  barAttendantId: uuid("bar_attendant_id").notNull(),
  barAttendantName: text("bar_attendant_name").notNull(),
  branchId: uuid("branch_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  waiterName: text("waiter_name"),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash | pos | bank_transfer | card | other
  totalAmount: numeric("total_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const barSaleItems = pgTable("bar_sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  barSaleId: uuid("bar_sale_id").notNull(),
  drinkId: uuid("drink_id").notNull(),
  drinkName: text("drink_name").notNull(),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  subtotal: numeric("subtotal").notNull(),
});

// ─── Kitchen Management ───────────────────────────────────────────────────────

export const kitchenInventory = pgTable("kitchen_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Meat|Poultry|Seafood|Grains|Vegetables|Oils & Fats|Seasonings|Drinks|Frozen|Other
  unit: text("unit").notNull().default("kg"), // kg|liters|cartons|pieces|packs|bags|bottles
  pricePerUnit: numeric("price_per_unit").notNull().default("0"),
  openingStock: numeric("opening_stock").notNull().default("0"),
  stockReceived: numeric("stock_received").notNull().default("0"),
  currentStock: numeric("current_stock").notNull().default("0"),
  minimumStock: numeric("minimum_stock").notNull().default("0"),
  supplier: text("supplier"),
  purchaseCost: numeric("purchase_cost"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("available"), // available|low_stock|out_of_stock
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kitchenStockMovements = pgTable("kitchen_stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull(),
  itemName: text("item_name").notNull(),
  branchId: uuid("branch_id").notNull(),
  type: text("type").notNull(), // received|used|waste|adjustment
  quantity: numeric("quantity").notNull(),
  note: text("note"),
  staffId: text("staff_id"),
  staffName: text("staff_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kitchenShifts = pgTable("kitchen_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  chefId: uuid("chef_id").notNull(),
  chefName: text("chef_name").notNull(),
  branchId: uuid("branch_id").notNull(),
  status: text("status").notNull().default("active"), // active|closed
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  openingStockSnapshot: jsonb("opening_stock_snapshot"),
  closingStockSnapshot: jsonb("closing_stock_snapshot"),
  notes: text("notes"),
  ordersCompleted: integer("orders_completed").notNull().default(0),
  mealsCooked: integer("meals_cooked").notNull().default(0),
});

export const kitchenOrders = pgTable("kitchen_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number").notNull().unique(),
  branchId: uuid("branch_id").notNull(),
  tableOrRoom: text("table_or_room"),
  customerName: text("customer_name"),
  source: text("source").notNull().default("restaurant"), // restaurant|bar|room_service|reception
  staffId: text("staff_id"),
  staffName: text("staff_name").notNull(),
  status: text("status").notNull().default("new"), // new|accepted|preparing|ready|served|cancelled
  priority: text("priority").notNull().default("normal"), // normal|urgent|vip
  specialInstructions: text("special_instructions"),
  estimatedMinutes: integer("estimated_minutes"),
  shiftId: uuid("shift_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kitchenOrderItems = pgTable("kitchen_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  mealName: text("meal_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
});

// Kitchen Zod schemas
export const insertKitchenInventorySchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(["Meat", "Poultry", "Seafood", "Grains", "Vegetables", "Oils & Fats", "Seasonings", "Drinks", "Frozen", "Other"]),
  unit: z.enum(["kg", "liters", "cartons", "pieces", "packs", "bags", "bottles"]).default("kg"),
  pricePerUnit: z.number().min(0).default(0),
  openingStock: z.number().min(0).default(0),
  stockReceived: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
  supplier: z.string().optional(),
  purchaseCost: z.number().min(0).optional(),
  expiryDate: z.string().optional(),
  status: z.enum(["available", "low_stock", "out_of_stock"]).default("available"),
});

export const updateKitchenInventorySchema = insertKitchenInventorySchema.partial().omit({ branchId: true });

export const createKitchenOrderSchema = z.object({
  tableOrRoom: z.string().optional(),
  customerName: z.string().optional(),
  source: z.enum(["restaurant", "bar", "room_service", "reception"]).default("restaurant"),
  staffName: z.string().min(1),
  priority: z.enum(["normal", "urgent", "vip"]).default("normal"),
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    mealName: z.string().min(1),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
  })).min(1),
});

export const insertBarDrinkSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(["Beer", "Wine", "Spirit", "Soft Drink", "Water", "Energy Drink", "Other"]),
  brand: z.string().optional(),
  sellingPrice: z.number().min(0),
  quantityAvailable: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  barcode: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(["available", "out_of_stock"]).default("available"),
});

export const updateBarDrinkSchema = insertBarDrinkSchema.partial().omit({ branchId: true });

export const insertBarWaiterSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  active: z.boolean().default(true),
});

export const startBarShiftSchema = z.object({});

export const createBarSaleSchema = z.object({
  waiterName: z.string().optional(),
  paymentMethod: z.enum(["cash", "pos", "bank_transfer", "card", "other"]).default("cash"),
  items: z.array(z.object({
    drinkId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
});

export type BarDrink = typeof barDrinks.$inferSelect;
export type BarWaiter = typeof barWaiters.$inferSelect;
export type BarShift = typeof barShifts.$inferSelect;
export type BarSale = typeof barSales.$inferSelect;
export type BarSaleItem = typeof barSaleItems.$inferSelect;

// ─── Security Attendance ─────────────────────────────────────────────────────

export const securityShifts = pgTable("security_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  officerId: uuid("officer_id").notNull(),
  officerName: text("officer_name").notNull(),
  branchId: uuid("branch_id").notNull(),
  status: text("status").notNull().default("active"), // active | closed
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  attendanceCount: integer("attendance_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(), // YYYY-MM-DD
  staffName: text("staff_name").notNull(),
  position: text("position").notNull(),
  branchId: uuid("branch_id").notNull(),
  securityShiftId: uuid("security_shift_id"),
  signInTime: timestamp("sign_in_time").notNull().defaultNow(),
  signOutTime: timestamp("sign_out_time"),
  status: text("status").notNull().default("signed_in"), // signed_in | signed_out
  totalHours: numeric("total_hours"),
  recordedById: uuid("recorded_by_id").notNull(),
  recordedByName: text("recorded_by_name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const signInSchema = z.object({
  staffName: z.string().min(1),
  position: z.string().min(1),
  branchId: z.string().uuid(),
});

export const updateAttendanceSchema = z.object({
  staffName: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  signInTime: z.string().optional(),
  signOutTime: z.string().optional(),
  status: z.enum(["signed_in", "signed_out"]).optional(),
  notes: z.string().optional(),
});

export type SecurityShift = typeof securityShifts.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type SignIn = z.infer<typeof signInSchema>;
export type UpdateAttendance = z.infer<typeof updateAttendanceSchema>;

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  branchId: z.string().min(1).optional(),
});

export const startShiftSchema = z.object({
  openingBalance: z.number().min(0).default(0),
});

export const closeShiftSchema = z.object({
  closingBalance: z.number().min(0),
});

export const insertBranchSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  active: z.boolean().default(true),
});

export const updateBranchSchema = insertBranchSchema.partial();

export const insertRoomSchema = z.object({
  branchId: z.string().uuid(),
  roomNumber: z.string().min(1),
  roomType: z.string().min(1),
  pricePerNight: z.number().min(0),
  capacity: z.number().min(1).default(2),
  amenities: z.array(z.string()).default([]),
  imageUrl: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).default([]),
  status: z.enum(["available", "occupied", "reserved", "maintenance"]).default("available"),
});

export const updateRoomSchema = insertRoomSchema.partial();

export const guestSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  nationality: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const createBookingSchema = z.object({
  guest: guestSchema,
  roomId: z.string().uuid(),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().optional(),
  numGuests: z.number().min(1).default(1),
  specialRequests: z.string().optional(),
  source: z.enum(["walk_in", "reservation"]).default("walk_in"),
  stayType: z.enum(["lodge", "short_rest"]).default("lodge"),
  durationHours: z.number().min(1).max(24).optional(),
  /** Pass the guest ID from a previous booking to share one guest record across multiple rooms. */
  existingGuestId: z.string().uuid().optional(),
});

/** Atomic booking for one guest across multiple rooms in a single request. */
export const createMultiRoomBookingSchema = z.object({
  guest: guestSchema,
  roomIds: z.array(z.string().uuid()).min(1).max(10),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().optional(),
  numGuests: z.number().min(1).default(1),
  specialRequests: z.string().optional(),
  source: z.enum(["walk_in", "reservation"]).default("walk_in"),
  stayType: z.enum(["lodge", "short_rest"]).default("lodge"),
  durationHours: z.number().min(1).max(24).optional(),
});

export const updateReservationSchema = z.object({
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  numGuests: z.number().min(1).optional(),
  specialRequests: z.string().optional(),
  roomId: z.string().uuid().optional(),
  status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]).optional(),
});

export const createPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.number(),
  method: z.enum(["cash", "pos", "bank_transfer", "card", "flutterwave", "paystack", "stripe"]),
  type: z.enum(["payment", "refund", "discount"]).default("payment"),
  transactionId: z.string().optional(),
});

export const createReceptionistSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["receptionist", "supervisor", "admin", "bar_attendant", "chef", "security"]).default("receptionist"),
  avatarUrl: z.string().optional(),
  // Required for receptionist/supervisor/bar_attendant; admins are branch-agnostic. Enforced in the route handler
  // since the requirement depends on the chosen role, not on the field alone.
  branchId: z.string().uuid().optional(),
});

export const updateHotelSettingsSchema = z.object({
  hotelName: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  backgroundStyle: z.string().optional(),
  bgOpacity: z.number().min(0).max(1).optional(),
  bgBlur: z.number().min(0).max(20).optional(),
  fontColor: z.string().optional(),
  fontSize: z.number().min(10).max(28).optional(),
  shortRestHourlyRate: z.number().min(0).optional(),
});

export const updateReceptionistSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["receptionist", "supervisor", "admin", "bar_attendant", "chef", "security"]).optional(),
  avatarUrl: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  branchId: z.string().uuid().nullable().optional(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UpdateBranch = z.infer<typeof updateBranchSchema>;
export type Receptionist = typeof receptionists.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type HotelSettings = typeof hotelSettings.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type UpdateRoom = z.infer<typeof updateRoomSchema>;
export type CreateBooking = z.infer<typeof createBookingSchema>;
export type UpdateReservation = z.infer<typeof updateReservationSchema>;
export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type CreateReceptionist = z.infer<typeof createReceptionistSchema>;
export type UpdateReceptionist = z.infer<typeof updateReceptionistSchema>;
export type UpdateHotelSettings = z.infer<typeof updateHotelSettingsSchema>;
export type KitchenInventoryItem = typeof kitchenInventory.$inferSelect;
export type KitchenStockMovement = typeof kitchenStockMovements.$inferSelect;
export type KitchenShift = typeof kitchenShifts.$inferSelect;
export type KitchenOrder = typeof kitchenOrders.$inferSelect;
export type KitchenOrderItem = typeof kitchenOrderItems.$inferSelect;
