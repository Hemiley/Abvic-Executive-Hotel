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
  createMultiRoomBookingSchema,
  updateReservationSchema,
  createPaymentSchema,
  createReceptionistSchema,
  updateReceptionistSchema,
  updateHotelSettingsSchema,
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
  // Verify the account still exists and is active (guards against deleted/deactivated users)
  storage.getReceptionistById(req.session.receptionistId).then((user) => {
    if (!user || !user.active) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session invalid — account deleted or disabled" });
    }
    next();
  }).catch(next);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.receptionistId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  storage.getReceptionistById(req.session.receptionistId).then((user) => {
    if (!user || !user.active) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session invalid — account deleted or disabled" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }).catch(next);
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

  // Password reset — admin only, verified by current password (no session required)
  app.post("/api/auth/reset-password", async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword)
      return res.status(400).json({ message: "All fields are required." });
    if (typeof newPassword !== "string" || newPassword.length < 8)
      return res.status(400).json({ message: "New password must be at least 8 characters." });

    const user = await storage.getReceptionistByUsername(username);
    if (!user || !user.active)
      return res.status(401).json({ message: "Invalid credentials." });
    if (user.role !== "admin")
      return res.status(403).json({ message: "Password reset is only available for administrator accounts." });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid)
      return res.status(401).json({ message: "Current password is incorrect." });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateReceptionist(user.id, { passwordHash });
    await storage.logAction({
      receptionistId: user.id,
      receptionistName: user.fullName,
      action: "password_reset",
      details: `${user.fullName} reset their password`,
    });

    res.json({ ok: true });
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
      avatarUrl: receptionist.avatarUrl,
      shift: shift || null,
    });
  });

  // ---------- Staff (admin only) ----------
  app.get("/api/staff", requireAdmin, async (_req, res) => {
    const staff = await storage.getReceptionists();
    res.json(
      staff.map((s) => ({
        id: s.id,
        username: s.username,
        fullName: s.fullName,
        email: s.email,
        role: s.role,
        avatarUrl: s.avatarUrl,
        active: s.active,
        createdAt: s.createdAt,
      }))
    );
  });

  app.post("/api/staff", requireAdmin, async (req, res) => {
    const parsed = createReceptionistSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const existing = await storage.getReceptionistByUsername(parsed.data.username);
    if (existing) return res.status(409).json({ message: "Username already taken" });
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const created = await storage.createReceptionist({
      username: parsed.data.username,
      passwordHash,
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      role: parsed.data.role,
      avatarUrl: parsed.data.avatarUrl,
    });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "staff_created",
      details: `Created ${created.role} account for ${created.fullName} (${created.username})`,
    });
    res.status(201).json({
      id: created.id,
      username: created.username,
      fullName: created.fullName,
      email: created.email,
      role: created.role,
      avatarUrl: created.avatarUrl,
      active: created.active,
      createdAt: created.createdAt,
    });
  });

  app.delete("/api/staff/:id", requireAdmin, async (req, res) => {
    const targetId = req.params.id;
    // Prevent self-deletion
    if (targetId === req.session.receptionistId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    const target = await storage.getReceptionistById(targetId);
    if (!target) return res.status(404).json({ message: "Staff member not found" });
    await storage.deleteReceptionist(targetId);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "staff_deleted",
      details: `Deleted ${target.role} account for ${target.fullName} (${target.username})`,
    });
    res.status(204).end();
  });

  app.patch("/api/staff/:id", requireAdmin, async (req, res) => {
    const parsed = updateReceptionistSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const target = await storage.getReceptionistById(req.params.id);
    if (!target) return res.status(404).json({ message: "Staff member not found" });

    const payload: Record<string, any> = {};
    if (parsed.data.fullName !== undefined) payload.fullName = parsed.data.fullName;
    if (parsed.data.email !== undefined) payload.email = parsed.data.email || null;
    if (parsed.data.role !== undefined) payload.role = parsed.data.role;
    if (parsed.data.avatarUrl !== undefined) payload.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.active !== undefined) payload.active = parsed.data.active;
    if (parsed.data.password) payload.passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const updated = await storage.updateReceptionist(req.params.id, payload);
    if (!updated) return res.status(404).json({ message: "Staff member not found" });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "staff_updated",
      details: `Updated ${updated.fullName} (${updated.username}): ${Object.keys(payload).join(", ")}`,
    });
    res.json({
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
      active: updated.active,
      createdAt: updated.createdAt,
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

  app.post("/api/rooms", requireAdmin, async (req, res) => {
    const parsed = insertRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const room = await storage.createRoom(parsed.data);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "room_created",
      details: `Room ${room.roomNumber} (${room.roomType})`,
    });
    res.status(201).json(room);
  });

  app.patch("/api/rooms/:id", requireAuth, async (req, res) => {
    const parsed = updateRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

    // Non-admins may only change room status (e.g. marking a room for maintenance).
    // Editing name/type/price/capacity/amenities is restricted to admins.
    if (req.session.role !== "admin") {
      const allowedKeys = Object.keys(parsed.data).every((k) => k === "status");
      if (!allowedKeys) {
        return res.status(403).json({ message: "Only an admin can edit room details" });
      }
    }

    let room: Awaited<ReturnType<typeof storage.updateRoom>>;
    try {
      room = await storage.updateRoom(req.params.id, parsed.data);
    } catch (err: any) {
      // Unique constraint on room_number
      if (err?.code === "23505" && err?.constraint === "rooms_room_number_unique") {
        return res.status(409).json({ message: `Room number "${parsed.data.roomNumber}" is already used by another room.` });
      }
      throw err;
    }
    if (!room) return res.status(404).json({ message: "Room not found" });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "room_updated",
      details: `Room ${room.roomNumber} updated: ${Object.keys(parsed.data).join(", ")}`,
    });
    res.json(room);
  });

  // ---------- Bookings / Reservations ----------
  app.post("/api/bookings", requireAuth, async (req, res, next) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid booking data" });
    const { guest, roomId, checkInDate, numGuests, specialRequests, source, stayType, durationHours, existingGuestId } = parsed.data;

    // For short_rest, checkout = same day; for lodge use provided date
    const checkOutDate = stayType === "short_rest"
      ? checkInDate
      : (parsed.data.checkOutDate ?? checkInDate);

    const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    const status = source === "walk_in" ? "checked_in" : "pending";

    let result: { reservation: any; guest: any; room: any };
    try {
      result = await storage.createBookingTransactional({
        guestData: {
          fullName: guest.fullName,
          phone: guest.phone,
          email: guest.email || undefined,
          nationality: guest.nationality,
          idType: guest.idType,
          idNumber: guest.idNumber,
          address: guest.address,
          emergencyContact: guest.emergencyContact,
        },
        existingGuestId,
        roomId,
        checkInDate,
        checkOutDate,
        numGuests,
        specialRequests,
        status,
        source,
        stayType,
        durationHours,
        receptionistId: req.session.receptionistId!,
        shiftId: shift?.id,
      });
    } catch (err: any) {
      if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
      return next(err);
    }

    const { reservation, guest: guestRecord, room } = result;

    if (shift) {
      await storage.incrementShiftStats(shift.id, { guestsServed: 1, roomsBooked: 1 });
    }

    const stayLabel = stayType === "short_rest"
      ? `Short Rest (${durationHours ?? 1}h)`
      : "Lodge";
    await storage.createNotification({
      type: source === "walk_in" ? "guest_arrival" : "new_reservation",
      message: `${source === "walk_in" ? "Walk-in guest" : "New reservation"} [${stayLabel}]: ${guest.fullName} — Room ${room.roomNumber}`,
    });

    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: source === "walk_in" ? "walk_in_booking" : "reservation_created",
      details: `${guest.fullName} booked room ${room.roomNumber} — ${stayLabel}`,
    });

    res.status(201).json({ reservation, guest: guestRecord, room });
  });

  // ---------- Multi-room atomic booking ----------
  app.post("/api/bookings/multi", requireAuth, async (req, res, next) => {
    const parsed = createMultiRoomBookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid booking data" });

    const { guest, roomIds, checkInDate, numGuests, specialRequests, source, stayType, durationHours } = parsed.data;
    const checkOutDate = stayType === "short_rest"
      ? checkInDate
      : (parsed.data.checkOutDate ?? checkInDate);

    const shift = await storage.getActiveShiftForReceptionist(req.session.receptionistId!);
    const status = source === "walk_in" ? "checked_in" : "pending";

    let result: { reservations: any[]; guest: any; rooms: any[] };
    try {
      result = await storage.createMultiRoomBookingTransactional({
        guestData: {
          fullName: guest.fullName,
          phone: guest.phone,
          email: guest.email || undefined,
          nationality: guest.nationality,
          idType: guest.idType,
          idNumber: guest.idNumber,
          address: guest.address,
          emergencyContact: guest.emergencyContact,
        },
        roomIds,
        checkInDate,
        checkOutDate,
        numGuests,
        specialRequests,
        status,
        source,
        stayType,
        durationHours,
        receptionistId: req.session.receptionistId!,
        shiftId: shift?.id,
      });
    } catch (err: any) {
      if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
      return next(err);
    }

    if (shift) {
      await storage.incrementShiftStats(shift.id, { guestsServed: 1, roomsBooked: result.rooms.length });
    }

    const stayLabel = stayType === "short_rest" ? `Short Rest (${durationHours ?? 1}h)` : "Lodge";
    const roomNumbers = result.rooms.map((r: any) => `Room ${r.roomNumber}`).join(", ");

    await storage.createNotification({
      type: source === "walk_in" ? "guest_arrival" : "new_reservation",
      message: `${source === "walk_in" ? "Walk-in guest" : "New reservation"} [${stayLabel}]: ${guest.fullName} — ${roomNumbers}`,
    });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: source === "walk_in" ? "walk_in_booking" : "reservation_created",
      details: `${guest.fullName} booked ${roomNumbers} — ${stayLabel}`,
    });

    res.status(201).json(result);
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

    // Transactional stats are scoped strictly to the active shift window.
    // When no shift is active every counter shows 0 — they only accumulate
    // once a shift is started, and reset to 0 when a new shift begins.
    const shiftStart: Date | null = shift ? new Date(shift.loginTime) : null;
    const isInShift = (d: Date | string) => shiftStart !== null && new Date(d) >= shiftStart;

    const shiftReservations = shiftStart
      ? reservationsList.filter((r) => isInShift(r.createdAt))
      : [];
    const shiftPayments = shiftStart
      ? paymentsList.filter((p) => isInShift(p.createdAt) && p.type === "payment")
      : [];

    res.json({
      shiftActive: !!shift,
      shift,
      todaysCheckIns: shiftStart
        ? reservationsList.filter((r) => r.status === "checked_in" && isInShift(r.updatedAt)).length
        : 0,
      todaysCheckOuts: shiftStart
        ? reservationsList.filter((r) => r.status === "checked_out" && isInShift(r.updatedAt)).length
        : 0,
      walkInGuests: shiftReservations.filter((r) => r.source === "walk_in" && r.stayType !== "short_rest").length,
      shortRestGuests: shiftReservations.filter((r) => r.stayType === "short_rest").length,
      pendingReservations: reservationsList.filter((r) => r.status === "pending").length,
      occupiedRooms: roomsStatus.occupied || 0,
      availableRooms: roomsStatus.available || 0,
      reservedRooms: roomsStatus.reserved || 0,
      totalSalesToday: shiftPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      paymentsReceived: shiftPayments.length,
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

  // Allow any authenticated user to push a system notification (e.g. short-rest timer expiry)
  app.post("/api/notifications", requireAuth, async (req, res) => {
    const { type = "system", message } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });
    const notif = await storage.createNotification({ type, message });
    res.status(201).json(notif);
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

  // ---------- Hotel Settings ----------
  app.get("/api/settings", async (_req, res) => {
    res.json(await storage.getHotelSettings());
  });

  app.patch("/api/settings", requireAdmin, async (req, res) => {
    const parsed = updateHotelSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const updated = await storage.updateHotelSettings(parsed.data);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "hotel_settings_updated",
      details: `Updated: ${Object.keys(parsed.data).join(", ")}`,
    });
    res.json(updated);
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
