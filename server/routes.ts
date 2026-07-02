import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import {
  loginSchema,
  startShiftSchema,
  closeShiftSchema,
  insertRoomSchema,
  updateRoomSchema,
  createBookingSchema,
  updateReservationSchema,
  createPaymentSchema,
} from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    receptionistId?: string;
    receptionistName?: string;
    role?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.receptionistId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diff = Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

export function registerRoutes(app: Express) {
  // ---------- Auth ----------
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid username or password" });
    const { username, password } = parsed.data;
    const receptionist = await storage.getReceptionistByUsername(username);
    if (!receptionist || !receptionist.active) return res.status(401).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, receptionist.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    req.session.receptionistId = receptionist.id;
    req.session.receptionistName = receptionist.fullName;
    req.session.role = receptionist.role;

    const activeShift = await storage.getActiveShiftForReceptionist(receptionist.id);
    await storage.logAction({
      receptionistId: receptionist.id,
      receptionistName: receptionist.fullName,
      action: "login",
      details: `${receptionist.fullName} logged in`,
    });

    res.json({
      id: receptionist.id,
      username: receptionist.username,
      fullName: receptionist.fullName,
      role: receptionist.role,
      shift: activeShift || null,
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const name = req.session.receptionistName;
    const id = req.session.receptionistId;
    req.session.destroy(async () => {
      if (id) {
        await storage.logAction({ receptionistId: id, receptionistName: name, action: "logout" });
      }
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const receptionist = await storage.getReceptionistById(req.session.receptionistId!);
    if (!receptionist) return res.status(401).json({ message: "Not authenticated" });
    const shift = await storage.getActiveShiftForReceptionist(receptionist.id);
    res.json({
      id: receptionist.id,
      username: receptionist.username,
      fullName: receptionist.fullName,
      role: receptionist.role,
      shift: shift || null,
    });
  });

  // ---------- Shifts ----------
  app.post("/api/shifts/start", requireAuth, async (req, res) => {
    const existing = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    if (existing) return res.status(409).json({ message: "Shift already active" });
    const parsed = startShiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid opening balance" });
    const shift = await storage.createShift({
      receptionistId: req.session.receptionistId!,
      receptionistName: req.session.receptionistName!,
      openingBalance: parsed.data.openingBalance,
    });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "shift_start",
      details: `Opening balance ${parsed.data.openingBalance}`,
    });
    res.status(201).json(shift);
  });

  app.get("/api/shifts/current", requireAuth, async (req, res) => {
    const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    res.json(shift || null);
  });

  app.get("/api/shifts", requireAuth, async (req, res) => {
    const all = await storage.getAllShifts();
    if (req.session.role === "receptionist") {
      return res.json(all.filter((s) => s.receptionistId === req.session.receptionistId));
    }
    res.json(all);
  });

  app.post("/api/shifts/:id/close", requireAuth, async (req, res) => {
    const parsed = closeShiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid closing balance" });
    const shift = await storage.getShiftById(req.params.id);
    if (!shift || shift.receptionistId !== req.session.receptionistId) {
      return res.status(404).json({ message: "Shift not found" });
    }
    const variance = parsed.data.closingBalance - (Number(shift.openingBalance) + Number(shift.cashSales));
    const closed = await storage.closeShift(req.params.id, parsed.data.closingBalance, variance);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "shift_close",
      details: `Closing balance ${parsed.data.closingBalance}, variance ${variance.toFixed(2)}`,
    });
    res.json(closed);
  });

  // ---------- Rooms ----------
  app.get("/api/rooms", requireAuth, async (_req, res) => {
    res.json(await storage.getRooms());
  });

  app.post("/api/rooms", requireAuth, async (req, res) => {
    const parsed = insertRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const room = await storage.createRoom(parsed.data);
    res.status(201).json(room);
  });

  app.patch("/api/rooms/:id", requireAuth, async (req, res) => {
    const parsed = updateRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const room = await storage.updateRoom(req.params.id, parsed.data);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  });

  // ---------- Bookings / Reservations ----------
  app.post("/api/bookings", requireAuth, async (req, res) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid booking data" });
    const { guest, roomId, checkInDate, checkOutDate, numGuests, specialRequests, source } = parsed.data;

    const room = await storage.getRoomById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.status !== "available") return res.status(409).json({ message: "Room is not available" });

    const guestRecord = await storage.createGuest({
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email || undefined,
      nationality: guest.nationality,
      idType: guest.idType,
      idNumber: guest.idNumber,
      address: guest.address,
      emergencyContact: guest.emergencyContact,
    });

    const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    const status = source === "walk_in" ? "checked_in" : "pending";

    const reservation = await storage.createReservation({
      guestId: guestRecord.id,
      roomId,
      checkInDate,
      checkOutDate,
      numGuests,
      specialRequests,
      status,
      source,
      receptionistId: req.session.receptionistId!,
      shiftId: shift?.id,
    });

    await storage.setRoomStatus(roomId, source === "walk_in" ? "occupied" : "reserved");

    if (shift) {
      await storage.incrementShiftStats(shift.id, { guestsServed: 1, roomsBooked: 1 });
    }

    await storage.createNotification({
      type: source === "walk_in" ? "guest_arrival" : "new_reservation",
      message: `${source === "walk_in" ? "Walk-in guest" : "New reservation"}: ${guest.fullName} — Room ${room.roomNumber}`,
    });

    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: source === "walk_in" ? "walk_in_booking" : "reservation_created",
      details: `${guest.fullName} booked room ${room.roomNumber}`,
    });

    res.status(201).json({ reservation, guest: guestRecord, room });
  });

  app.get("/api/reservations", requireAuth, async (_req, res) => {
    const list = await storage.getReservations();
    const enriched = await Promise.all(
      list.map(async (r) => ({
        ...r,
        guest: await storage.getGuestById(r.guestId),
        room: await storage.getRoomById(r.roomId),
      }))
    );
    res.json(enriched);
  });

  app.patch("/api/reservations/:id", requireAuth, async (req, res) => {
    const parsed = updateReservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const existing = await storage.getReservationById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Reservation not found" });

    const updated = await storage.updateReservation(req.params.id, parsed.data);

    if (parsed.data.status && parsed.data.status !== existing.status) {
      const room = await storage.getRoomById(existing.roomId);
      if (parsed.data.status === "checked_in" && room) await storage.setRoomStatus(room.id, "occupied");
      if (parsed.data.status === "checked_out" && room) await storage.setRoomStatus(room.id, "available");
      if (parsed.data.status === "cancelled" && room) await storage.setRoomStatus(room.id, "available");
      if (parsed.data.status === "confirmed" && room) await storage.setRoomStatus(room.id, "reserved");

      const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
      if (shift) await storage.incrementShiftStats(shift.id, { reservationsProcessed: 1 });

      await storage.createNotification({
        type: parsed.data.status,
        message: `Reservation ${parsed.data.status.replace("_", " ")}: room ${room?.roomNumber ?? ""}`,
      });

      await storage.logAction({
        receptionistId: req.session.receptionistId,
        receptionistName: req.session.receptionistName,
        action: "reservation_status_change",
        details: `Reservation ${req.params.id} -> ${parsed.data.status}`,
      });
    }

    res.json(updated);
  });

  // ---------- Payments ----------
  app.post("/api/payments", requireAuth, async (req, res) => {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const reservation = await storage.getReservationById(parsed.data.reservationId);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    const payment = await storage.createPayment({
      ...parsed.data,
      receptionistId: req.session.receptionistId!,
      receptionistName: req.session.receptionistName!,
      shiftId: shift?.id,
    });

    if (shift) {
      const signedAmount = parsed.data.type === "refund" ? -parsed.data.amount : parsed.data.amount;
      const statsUpdate: any = {};
      if (parsed.data.type === "payment") {
        statsUpdate.totalSales = parsed.data.amount;
        if (parsed.data.method === "cash") statsUpdate.cashSales = parsed.data.amount;
        else if (parsed.data.method === "card" || parsed.data.method === "pos") statsUpdate.cardSales = parsed.data.amount;
        else statsUpdate.transferSales = parsed.data.amount;
      } else if (parsed.data.type === "refund") {
        statsUpdate.refundsIssued = parsed.data.amount;
      } else if (parsed.data.type === "discount") {
        statsUpdate.discountsGiven = parsed.data.amount;
      }
      await storage.incrementShiftStats(shift.id, statsUpdate);
      void signedAmount;
    }

    await storage.createNotification({
      type: "payment_received",
      message: `${parsed.data.type === "payment" ? "Payment" : parsed.data.type} of ${parsed.data.amount} via ${parsed.data.method}`,
    });

    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: `payment_${parsed.data.type}`,
      details: `${parsed.data.amount} via ${parsed.data.method} for reservation ${parsed.data.reservationId}`,
    });

    res.status(201).json(payment);
  });

  app.get("/api/payments", requireAuth, async (_req, res) => {
    res.json(await storage.getPayments());
  });

  app.get("/api/payments/reservation/:id", requireAuth, async (req, res) => {
    res.json(await storage.getPaymentsByReservation(req.params.id));
  });

  // ---------- Dashboard ----------
  app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
    const [reservationsList, roomsStatus, paymentsList, shift] = await Promise.all([
      storage.getReservations(),
      storage.countRoomsByStatus(),
      storage.getPayments(),
      storage.getActiveShiftForReceptionist(req.session.receptionistId!),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = (d: Date | string) => {
      const date = new Date(d);
      return date >= today;
    };

    const todaysReservations = reservationsList.filter((r) => isToday(r.createdAt));
    const todaysPayments = paymentsList.filter((p) => isToday(p.createdAt) && p.type === "payment");

    res.json({
      shiftActive: !!shift,
      shift,
      todaysCheckIns: reservationsList.filter((r) => r.status === "checked_in" && isToday(r.updatedAt)).length,
      todaysCheckOuts: reservationsList.filter((r) => r.status === "checked_out" && isToday(r.updatedAt)).length,
      walkInGuests: todaysReservations.filter((r) => r.source === "walk_in").length,
      pendingReservations: reservationsList.filter((r) => r.status === "pending").length,
      occupiedRooms: roomsStatus.occupied || 0,
      availableRooms: roomsStatus.available || 0,
      reservedRooms: roomsStatus.reserved || 0,
      totalSalesToday: todaysPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      paymentsReceived: todaysPayments.length,
      outstandingPayments: reservationsList.filter((r) => ["pending", "confirmed"].includes(r.status)).length,
    });
  });

  // ---------- Notifications ----------
  app.get("/api/notifications", requireAuth, async (_req, res) => {
    res.json(await storage.getNotifications());
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationRead(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Audit log ----------
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    if (req.session.role === "receptionist") {
      return res.status(403).json({ message: "Supervisors and admins only" });
    }
    res.json(await storage.getAuditLogs());
  });

  // ---------- Reports ----------
  app.get("/api/reports/summary", requireAuth, async (_req, res) => {
    const [reservationsList, paymentsList, roomsList] = await Promise.all([
      storage.getReservations(),
      storage.getPayments(),
      storage.getRooms(),
    ]);
    const totalRevenue = paymentsList.filter((p) => p.type === "payment").reduce((s, p) => s + Number(p.amount), 0);
    const occupied = roomsList.filter((r) => r.status === "occupied").length;
    res.json({
      totalBookings: reservationsList.length,
      totalReservations: reservationsList.filter((r) => r.source === "reservation").length,
      checkIns: reservationsList.filter((r) => r.status === "checked_in").length,
      checkOuts: reservationsList.filter((r) => r.status === "checked_out").length,
      occupancyRate: roomsList.length ? Math.round((occupied / roomsList.length) * 100) : 0,
      totalRevenue,
    });
  });

  app.get("/api/reports/export.csv", requireAuth, async (_req, res) => {
    const paymentsList = await storage.getPayments();
    const header = "Date,Receptionist,Method,Type,Amount,TransactionId\n";
    const rows = paymentsList
      .map(
        (p) =>
          `${p.createdAt.toISOString()},${p.receptionistName},${p.method},${p.type},${p.amount},${p.transactionId || ""}`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=report.csv");
    res.send(header + rows);
  });

  void nightsBetween;
}
