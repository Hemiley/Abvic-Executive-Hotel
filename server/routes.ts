import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import {
  loginSchema,
  startShiftSchema,
  closeShiftSchema,
  insertBranchSchema,
  updateBranchSchema,
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
    branchId?: string | null;
  }
}

/** Admins are branch-agnostic (see everything); everyone else is scoped to their assigned branch. */
function scopeBranchId(req: Request): string | undefined {
  if (req.session.role === "admin") return undefined;
  return req.session.branchId || undefined;
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
    const { username, password, branchId } = parsed.data;
    const receptionist = await storage.getReceptionistByUsername(username);
    if (!receptionist || !receptionist.active) return res.status(401).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, receptionist.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    // Non-admin staff must confirm the branch they're signing in to; it must match their assignment.
    if (receptionist.role !== "admin") {
      if (!branchId) return res.status(400).json({ message: "Please select your branch." });
      if (branchId !== receptionist.branchId) {
        return res.status(401).json({ message: "This account is not assigned to the selected branch." });
      }
    }

    req.session.receptionistId = receptionist.id;
    req.session.receptionistName = receptionist.fullName;
    req.session.role = receptionist.role;
    req.session.branchId = receptionist.branchId;

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
      branchId: receptionist.branchId,
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
    // Keep the session's branch in sync in case an admin reassigned this user since login.
    req.session.branchId = receptionist.branchId;
    const shift = await storage.getActiveShiftForReceptionist(receptionist.id);
    res.json({
      id: receptionist.id,
      username: receptionist.username,
      fullName: receptionist.fullName,
      role: receptionist.role,
      avatarUrl: receptionist.avatarUrl,
      branchId: receptionist.branchId,
      shift: shift || null,
    });
  });

  // ---------- Staff (admin only) ----------
  app.get("/api/staff", requireAdmin, async (req, res) => {
    const branchFilter = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const staff = await storage.getReceptionists(branchFilter);
    res.json(
      staff.map((s) => ({
        id: s.id,
        username: s.username,
        fullName: s.fullName,
        email: s.email,
        role: s.role,
        avatarUrl: s.avatarUrl,
        branchId: s.branchId,
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

    // Every receptionist/supervisor must be assigned to a branch; admins are branch-agnostic.
    if (parsed.data.role !== "admin") {
      if (!parsed.data.branchId) {
        return res.status(400).json({ message: "Please select a branch for this staff member." });
      }
      const branch = await storage.getBranchById(parsed.data.branchId);
      if (!branch) return res.status(400).json({ message: "Selected branch does not exist." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const created = await storage.createReceptionist({
      username: parsed.data.username,
      passwordHash,
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      role: parsed.data.role,
      avatarUrl: parsed.data.avatarUrl,
      branchId: parsed.data.role === "admin" ? null : parsed.data.branchId,
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
      branchId: created.branchId,
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

    const nextRole = parsed.data.role ?? target.role;
    if (parsed.data.branchId !== undefined) {
      if (nextRole !== "admin" && !parsed.data.branchId) {
        return res.status(400).json({ message: "Please select a branch for this staff member." });
      }
      if (parsed.data.branchId) {
        const branch = await storage.getBranchById(parsed.data.branchId);
        if (!branch) return res.status(400).json({ message: "Selected branch does not exist." });
      }
      payload.branchId = nextRole === "admin" ? null : parsed.data.branchId;
    } else if (nextRole === "admin") {
      payload.branchId = null;
    } else if (parsed.data.role !== undefined && !target.branchId) {
      return res.status(400).json({ message: "Please select a branch for this staff member." });
    }

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
      branchId: updated.branchId,
      active: updated.active,
      createdAt: updated.createdAt,
    });
  });

  // ---------- Branches (admin only manages; any authenticated user can list for dropdowns) ----------
  // Public, minimal listing (id/name only, active branches) for the pre-login branch picker.
  app.get("/api/branches/public", async (_req, res) => {
    const branches = await storage.getBranches();
    res.json(
      branches
        .filter((b) => b.active)
        .map((b) => ({ id: b.id, name: b.name }))
    );
  });

  app.get("/api/branches", requireAuth, async (_req, res) => {
    res.json(await storage.getBranches());
  });

  app.post("/api/branches", requireAdmin, async (req, res) => {
    const parsed = insertBranchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const branch = await storage.createBranch(parsed.data);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "branch_created",
      details: `Branch created: ${branch.name}`,
    });
    res.status(201).json(branch);
  });

  app.patch("/api/branches/:id", requireAdmin, async (req, res) => {
    const parsed = updateBranchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    let branch: Awaited<ReturnType<typeof storage.updateBranch>>;
    try {
      branch = await storage.updateBranch(req.params.id, parsed.data);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "A branch with that name already exists." });
      throw err;
    }
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "branch_updated",
      details: `Branch updated: ${branch.name}`,
    });
    res.json(branch);
  });

  app.delete("/api/branches/:id", requireAdmin, async (req, res) => {
    const branch = await storage.getBranchById(req.params.id);
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    const [roomCount, staffCount] = await Promise.all([
      storage.countRoomsInBranch(req.params.id),
      storage.countReceptionistsInBranch(req.params.id),
    ]);
    if (roomCount > 0 || staffCount > 0) {
      return res.status(409).json({
        message: `Cannot delete "${branch.name}" — it still has ${roomCount} room(s) and ${staffCount} staff member(s) assigned. Reassign or remove them first.`,
      });
    }
    await storage.deleteBranch(req.params.id);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "branch_deleted",
      details: `Branch deleted: ${branch.name}`,
    });
    res.json({ ok: true });
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

  // Shift report — returns everything needed to render a printable end-of-shift report
  app.get("/api/shifts/:id/report", requireAuth, async (req, res) => {
    const shift = await storage.getShiftById(req.params.id);
    if (!shift) return res.status(404).json({ message: "Shift not found" });
    // Receptionists can only see their own shift reports
    if (req.session.role === "receptionist" && shift.receptionistId !== req.session.receptionistId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [shiftPayments, shiftReservations, settings] = await Promise.all([
      storage.getPaymentsByShift(shift.id),
      storage.getReservationsByShift(shift.id),
      storage.getHotelSettings(),
    ]);

    // Enrich reservations with guest + room data
    const enriched = await Promise.all(
      shiftReservations.map(async (r) => ({
        ...r,
        guest: await storage.getGuestById(r.guestId),
        room: await storage.getRoomById(r.roomId),
      }))
    );

    res.json({ shift, payments: shiftPayments, reservations: enriched, settings });
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
  app.get("/api/rooms", requireAuth, async (req, res) => {
    // Admins may optionally filter by a specific branch via ?branchId=; everyone
    // else is hard-scoped server-side to their own branch regardless of query params.
    const branchId = req.session.role === "admin"
      ? (typeof req.query.branchId === "string" ? req.query.branchId : undefined)
      : scopeBranchId(req);
    res.json(await storage.getRooms(branchId));
  });

  app.post("/api/rooms", requireAdmin, async (req, res) => {
    const parsed = insertRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    const branch = await storage.getBranchById(parsed.data.branchId);
    if (!branch) return res.status(400).json({ message: "Selected branch does not exist." });
    const room = await storage.createRoom(parsed.data);
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "room_created",
      details: `Room ${room.roomNumber} (${room.roomType}) in ${branch.name}`,
    });
    res.status(201).json(room);
  });

  app.patch("/api/rooms/:id", requireAuth, async (req, res) => {
    const parsed = updateRoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

    const existingRoom = await storage.getRoomById(req.params.id);
    if (!existingRoom) return res.status(404).json({ message: "Room not found" });

    // Non-admins are confined to their own branch and may only change room
    // status (e.g. marking a room for maintenance). Editing name/type/price/
    // capacity/amenities/branch is restricted to admins.
    if (req.session.role !== "admin") {
      if (existingRoom.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "This room belongs to a different branch." });
      }
      const allowedKeys = Object.keys(parsed.data).every((k) => k === "status");
      if (!allowedKeys) {
        return res.status(403).json({ message: "Only an admin can edit room details" });
      }
    } else if (parsed.data.branchId) {
      const branch = await storage.getBranchById(parsed.data.branchId);
      if (!branch) return res.status(400).json({ message: "Selected branch does not exist." });
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

  app.delete("/api/rooms/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteRoom(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Room not found" });
    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "room_deleted",
      details: `Room ID ${req.params.id} deleted`,
    });
    res.json({ ok: true });
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

    // Non-admins can only book rooms within their own branch.
    if (req.session.role !== "admin") {
      const inBranch = await storage.roomBelongsToBranch(roomId, req.session.branchId || "");
      if (!inBranch) return res.status(403).json({ message: "This room belongs to a different branch." });
    }

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

    // Non-admins can only book rooms within their own branch.
    if (req.session.role !== "admin") {
      const checks = await Promise.all(roomIds.map((id) => storage.roomBelongsToBranch(id, req.session.branchId || "")));
      if (checks.some((ok) => !ok)) {
        return res.status(403).json({ message: "One or more rooms belong to a different branch." });
      }
    }

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

  app.get("/api/reservations", requireAuth, async (req, res) => {
    const list = await storage.getReservations(scopeBranchId(req));
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
    const branchId = scopeBranchId(req);
    const [reservationsList, roomsStatus, paymentsList, shift] = await Promise.all([
      storage.getReservations(branchId),
      storage.countRoomsByStatus(branchId),
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
  app.get("/api/reports/summary", requireAuth, async (req, res) => {
    const branchId = scopeBranchId(req);
    const [reservationsList, paymentsList, roomsList] = await Promise.all([
      storage.getReservations(branchId),
      storage.getPayments(),
      storage.getRooms(branchId),
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
