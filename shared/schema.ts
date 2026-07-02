import { pgTable, text, timestamp, uuid, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const receptionists = pgTable("receptionists", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("receptionist"), // receptionist | supervisor | admin
  avatarUrl: text("avatar_url"),
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
  hotelName: text("hotel_name").notNull().default("Grand Hotel"),
  logoUrl: text("logo_url"),
  backgroundStyle: text("background_style"),
  bgOpacity: numeric("bg_opacity").notNull().default("1"),
  bgBlur: integer("bg_blur").notNull().default(0),
  fontColor: text("font_color"),
  fontSize: integer("font_size"),
  shortRestHourlyRate: numeric("short_rest_hourly_rate").notNull().default("3000"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const startShiftSchema = z.object({
  openingBalance: z.number().min(0).default(0),
});

export const closeShiftSchema = z.object({
  closingBalance: z.number().min(0),
});

export const insertRoomSchema = z.object({
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
  role: z.enum(["receptionist", "supervisor", "admin"]).default("receptionist"),
  avatarUrl: z.string().optional(),
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
  role: z.enum(["receptionist", "supervisor", "admin"]).optional(),
  avatarUrl: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

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
