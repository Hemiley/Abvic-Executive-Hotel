import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
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
  insertBarDrinkSchema,
  updateBarDrinkSchema,
  insertBarWaiterSchema,
  createBarSaleSchema,
  insertKitchenInventorySchema,
  updateKitchenInventorySchema,
  createKitchenOrderSchema,
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

function requireBarAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session.receptionistId) return res.status(401).json({ message: "Not authenticated" });
  storage.getReceptionistById(req.session.receptionistId).then((user) => {
    if (!user || !user.active) { req.session.destroy(() => {}); return res.status(401).json({ message: "Session invalid" }); }
    if (user.role !== "bar_attendant" && user.role !== "admin" && user.role !== "supervisor") return res.status(403).json({ message: "Bar access required" });
    next();
  }).catch(next);
}

function requireBarManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session.receptionistId) return res.status(401).json({ message: "Not authenticated" });
  storage.getReceptionistById(req.session.receptionistId).then((user) => {
    if (!user || !user.active) { req.session.destroy(() => {}); return res.status(401).json({ message: "Session invalid" }); }
    if (user.role !== "admin" && user.role !== "supervisor") return res.status(403).json({ message: "Admin or supervisor access required" });
    next();
  }).catch(next);
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
  function parseReportDateRange(req: Request): { from?: Date; to?: Date; error?: string } {
    const { from, to } = req.query as { from?: string; to?: string };
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (from) {
      dateFrom = new Date(from);
      if (isNaN(dateFrom.getTime())) return { error: "Invalid 'from' date." };
    }
    if (to) {
      dateTo = new Date(to);
      if (isNaN(dateTo.getTime())) return { error: "Invalid 'to' date." };
      // Treat the "to" date as inclusive of the whole day.
      dateTo.setHours(23, 59, 59, 999);
    }
    if (dateFrom && dateTo && dateFrom > dateTo) return { error: "'from' date must be before 'to' date." };
    return { from: dateFrom, to: dateTo };
  }

  app.get("/api/reports/summary", requireAuth, async (req, res) => {
    const branchId = scopeBranchId(req);
    const range = parseReportDateRange(req);
    if (range.error) return res.status(400).json({ message: range.error });
    const [reservationsList, paymentsList, roomsList] = await Promise.all([
      storage.getReservations(branchId, range.from, range.to),
      storage.getPayments(branchId, range.from, range.to),
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

  app.get("/api/reports/export.csv", requireAuth, async (req, res) => {
    const branchId = scopeBranchId(req);
    const range = parseReportDateRange(req);
    if (range.error) return res.status(400).json({ message: range.error });
    const paymentsList = await storage.getPayments(branchId, range.from, range.to);
    const header = "Date,Receptionist,Method,Type,Amount,TransactionId\n";
    const rows = paymentsList
      .map(
        (p) =>
          `${p.createdAt.toISOString()},${p.receptionistName},${p.method},${p.type},${p.amount},${p.transactionId || ""}`
      )
      .join("\n");
    const suffix =
      range.from || range.to
        ? `_${(req.query.from as string) || "start"}_to_${(req.query.to as string) || "now"}`
        : "";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=report${suffix}.csv`);
    res.send(header + rows);
  });

  void nightsBetween;

  // ── Bar Management Routes ──────────────────────────────────────────────────

  // Bar Drinks — list (bar attendants + admin)
  app.get("/api/bar/drinks", requireBarAccess, async (req, res) => {
    // Admin may pass ?branchId= to filter; others are scoped to their own branch
    const branchId = req.session.role === "admin"
      ? (typeof req.query.branchId === "string" && req.query.branchId ? req.query.branchId : undefined)
      : scopeBranchId(req);
    res.json(await storage.getBarDrinks(branchId));
  });

  app.post("/api/bar/drinks", requireBarManager, async (req, res) => {
    const body = { ...req.body };
    // Supervisors are scoped to their own branch
    if (req.session.role !== "admin") body.branchId = req.session.branchId;
    const parsed = insertBarDrinkSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const drink = await storage.createBarDrink(parsed.data);
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_drink_created", details: `${drink.name} added to bar inventory` });
    res.status(201).json(drink);
  });

  app.patch("/api/bar/drinks/:id", requireBarManager, async (req, res) => {
    const parsed = updateBarDrinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const updated = await storage.updateBarDrink(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Drink not found" });
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_drink_updated", details: `${updated.name} updated` });
    res.json(updated);
  });

  app.delete("/api/bar/drinks/:id", requireBarManager, async (req, res) => {
    const deleted = await storage.deleteBarDrink(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Drink not found" });
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_drink_deleted", details: `Drink ID ${req.params.id} removed` });
    res.json({ ok: true });
  });

  // Bar Waiters
  app.get("/api/bar/waiters", requireBarAccess, async (req, res) => {
    const branchId = scopeBranchId(req);
    res.json(await storage.getBarWaiters(branchId));
  });

  app.post("/api/bar/waiters", requireBarAccess, async (req, res) => {
    const parsed = insertBarWaiterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const waiter = await storage.createBarWaiter(parsed.data);
    res.status(201).json(waiter);
  });

  app.patch("/api/bar/waiters/:id", requireBarAccess, async (req, res) => {
    const { name, active } = req.body;
    const updated = await storage.updateBarWaiter(req.params.id, { name, active });
    if (!updated) return res.status(404).json({ message: "Waiter not found" });
    res.json(updated);
  });

  app.delete("/api/bar/waiters/:id", requireBarManager, async (req, res) => {
    await storage.updateBarWaiter(req.params.id, { active: false });
    res.json({ ok: true });
  });

  // Bar Shifts
  app.post("/api/bar/shifts/start", requireBarAccess, async (req, res) => {
    const existing = await storage.getActiveBarShiftForAttendant(req.session.receptionistId!);
    if (existing) return res.status(409).json({ message: "Bar shift already active" });
    const branchId = req.session.branchId;
    if (!branchId) return res.status(400).json({ message: "Branch not set on session" });
    const drinks = await storage.getBarDrinks(branchId);
    const snapshot = drinks.map(d => ({ id: d.id, name: d.name, quantity: d.quantityAvailable }));
    const shift = await storage.createBarShift({
      barAttendantId: req.session.receptionistId!,
      barAttendantName: req.session.receptionistName!,
      branchId,
      openingStockSnapshot: snapshot,
    });
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_shift_start", details: `Bar shift started` });
    res.status(201).json(shift);
  });

  app.get("/api/bar/shifts/current", requireBarAccess, async (req, res) => {
    const shift = await storage.getActiveBarShiftForAttendant(req.session.receptionistId!);
    res.json(shift || null);
  });

  app.get("/api/bar/shifts", requireBarAccess, async (req, res) => {
    const branchId = scopeBranchId(req);
    const all = await storage.getAllBarShifts(branchId);
    if (req.session.role === "bar_attendant") {
      return res.json(all.filter(s => s.barAttendantId === req.session.receptionistId));
    }
    res.json(all);
  });

  app.post("/api/bar/shifts/:id/close", requireBarAccess, async (req, res) => {
    const shift = await storage.getBarShiftById(req.params.id);
    if (!shift || shift.barAttendantId !== req.session.receptionistId) return res.status(404).json({ message: "Bar shift not found" });
    if (shift.status !== "active") return res.status(409).json({ message: "Shift already closed" });
    const drinks = await storage.getBarDrinks(shift.branchId);
    const snapshot = drinks.map(d => ({ id: d.id, name: d.name, quantity: d.quantityAvailable }));
    const closed = await storage.closeBarShift(shift.id, snapshot);
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_shift_close", details: `Bar shift closed. Revenue: ${shift.totalRevenue}` });
    await storage.createNotification({ type: "bar_shift_closed", message: `Bar shift closed by ${req.session.receptionistName}. Total revenue: ₦${Number(shift.totalRevenue).toLocaleString()}` });
    res.json(closed);
  });

  // Bar Sales
  app.post("/api/bar/sales", requireBarAccess, async (req, res) => {
    const parsed = createBarSaleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const branchId = req.session.branchId;
    if (!branchId) return res.status(400).json({ message: "Branch not set on session" });
    const shift = await storage.getActiveBarShiftForAttendant(req.session.receptionistId!);
    const invoiceNumber = `BAR-${nanoid(8).toUpperCase()}`;
    let result;
    try {
      result = await storage.createBarSaleTransactional({
        barShiftId: shift?.id,
        barAttendantId: req.session.receptionistId!,
        barAttendantName: req.session.receptionistName!,
        branchId,
        invoiceNumber,
        waiterName: parsed.data.waiterName,
        paymentMethod: parsed.data.paymentMethod,
        items: parsed.data.items,
      });
    } catch (err: any) {
      if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
      throw err;
    }
    if (shift) {
      const bottlesSold = parsed.data.items.reduce((s, i) => s + i.quantity, 0);
      await storage.incrementBarShiftStats(shift.id, {
        totalRevenue: Number(result.sale.totalAmount),
        totalBottlesSold: bottlesSold,
        totalTransactions: 1,
      });
    }
    // Low stock notifications
    const branchDrinks = await storage.getBarDrinks(branchId);
    for (const item of parsed.data.items) {
      const drink = branchDrinks.find(d => d.id === item.drinkId);
      if (drink && drink.quantityAvailable <= drink.lowStockThreshold) {
        await storage.createNotification({ type: "bar_low_stock", message: `Low stock alert: ${drink.name} has ${drink.quantityAvailable} bottles remaining` });
      }
    }
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "bar_sale", details: `Invoice ${invoiceNumber}, ₦${result.sale.totalAmount}` });
    res.status(201).json({ sale: result.sale, items: result.items });
  });

  app.get("/api/bar/sales", requireBarAccess, async (req, res) => {
    const branchId = scopeBranchId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    const dateFrom = from ? new Date(from) : undefined;
    const dateTo = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : undefined;
    const sales = await storage.getBarSales(branchId, dateFrom, dateTo);
    if (req.session.role === "bar_attendant") {
      return res.json(sales.filter(s => s.barAttendantId === req.session.receptionistId));
    }
    res.json(sales);
  });

  app.get("/api/bar/sales/:id", requireBarAccess, async (req, res) => {
    const sale = await storage.getBarSaleById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    const items = await storage.getBarSaleItems(sale.id);
    res.json({ sale, items });
  });

  // Bar Dashboard summary
  app.get("/api/bar/dashboard", requireBarAccess, async (req, res) => {
    const branchId = scopeBranchId(req) || req.session.branchId || undefined;
    const shift = await storage.getActiveBarShiftForAttendant(req.session.receptionistId!);
    const drinks = await storage.getBarDrinks(branchId);
    const lowStock = drinks.filter(d => d.quantityAvailable <= d.lowStockThreshold);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sales = await storage.getBarSales(branchId, today);
    const attendantSales = req.session.role === "bar_attendant"
      ? sales.filter(s => s.barAttendantId === req.session.receptionistId)
      : sales;
    const recentSales = await storage.getBarSales(branchId);
    const recentAttendantSales = (req.session.role === "bar_attendant"
      ? recentSales.filter(s => s.barAttendantId === req.session.receptionistId)
      : recentSales).slice(0, 10);
    res.json({
      shift: shift || null,
      totalDrinksInStock: drinks.reduce((s, d) => s + d.quantityAvailable, 0),
      totalDrinkTypes: drinks.length,
      lowStockCount: lowStock.length,
      lowStockDrinks: lowStock.slice(0, 5),
      todaySalesCount: attendantSales.length,
      todayBottlesSold: 0, // computed from sales items in client
      todayRevenue: attendantSales.reduce((s, sale) => s + Number(sale.totalAmount), 0),
      recentTransactions: recentAttendantSales,
    });
  });

  // Bar Reports (admin + bar_attendant)
  app.get("/api/bar/reports", requireBarAccess, async (req, res) => {
    const branchId = scopeBranchId(req) || req.session.branchId || undefined;
    const { from, to } = req.query as { from?: string; to?: string };
    const dateFrom = from ? new Date(from) : undefined;
    const dateTo = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : undefined;
    const [sales, drinks] = await Promise.all([
      storage.getBarSales(branchId, dateFrom, dateTo),
      storage.getBarDrinks(branchId),
    ]);
    const attendantSales = req.session.role === "bar_attendant"
      ? sales.filter(s => s.barAttendantId === req.session.receptionistId)
      : sales;
    // Enrich with items
    const enriched = await Promise.all(attendantSales.map(async sale => ({
      ...sale,
      items: await storage.getBarSaleItems(sale.id),
    })));
    const totalRevenue = enriched.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalBottlesSold = enriched.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity, 0), 0);
    // Top selling drinks
    const drinkMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    for (const sale of enriched) {
      for (const item of sale.items) {
        const existing = drinkMap.get(item.drinkId) || { name: item.drinkName, category: item.category, qty: 0, revenue: 0 };
        drinkMap.set(item.drinkId, { ...existing, qty: existing.qty + item.quantity, revenue: existing.revenue + Number(item.subtotal) });
      }
    }
    const topSelling = Array.from(drinkMap.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    // Sales by waiter
    const waiterMap = new Map<string, { name: string; sales: number; revenue: number }>();
    for (const sale of enriched) {
      const key = sale.waiterName || "Direct";
      const existing = waiterMap.get(key) || { name: key, sales: 0, revenue: 0 };
      waiterMap.set(key, { ...existing, sales: existing.sales + 1, revenue: existing.revenue + Number(sale.totalAmount) });
    }
    const salesByWaiter = Array.from(waiterMap.values()).sort((a, b) => b.revenue - a.revenue);
    const lowStockDrinks = drinks.filter(d => d.quantityAvailable <= d.lowStockThreshold);
    res.json({
      totalRevenue, totalBottlesSold, totalTransactions: enriched.length,
      topSelling, salesByWaiter, lowStockDrinks,
      sales: enriched,
    });
  });

  // ── Kitchen Management ────────────────────────────────────────────────────────

  function requireKitchenAccess(req: Request, res: Response, next: NextFunction) {
    if (!req.session.receptionistId) return res.status(401).json({ message: "Not authenticated" });
    storage.getReceptionistById(req.session.receptionistId).then((user) => {
      if (!user || !user.active) { req.session.destroy(() => {}); return res.status(401).json({ message: "Session invalid" }); }
      if (!["chef", "admin", "supervisor"].includes(user.role)) return res.status(403).json({ message: "Kitchen access required" });
      next();
    }).catch(next);
  }

  // Public read-only menu endpoint — any authenticated user can view available kitchen items + prices
  app.get("/api/kitchen/menu", requireAuth, async (req, res) => {
    const branchId = req.session.role === "admin"
      ? (typeof req.query.branchId === "string" && req.query.branchId ? req.query.branchId : undefined)
      : scopeBranchId(req);
    const items = await storage.getKitchenInventory(branchId);
    res.json(items.filter((i: any) => i.status !== "out_of_stock"));
  });

  // Kitchen Inventory
  app.get("/api/kitchen/inventory", requireKitchenAccess, async (req, res) => {
    const branchId = req.session.role === "admin"
      ? (typeof req.query.branchId === "string" && req.query.branchId ? req.query.branchId : undefined)
      : scopeBranchId(req);
    res.json(await storage.getKitchenInventory(branchId));
  });

  app.post("/api/kitchen/inventory", requireKitchenAccess, async (req, res) => {
    const body = { ...req.body };
    if (req.session.role !== "admin") body.branchId = req.session.branchId;
    const parsed = insertKitchenInventorySchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const item = await storage.createKitchenInventoryItem(parsed.data as any);
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "kitchen_item_created", details: `${item.name} added to kitchen inventory` });
    res.status(201).json(item);
  });

  app.patch("/api/kitchen/inventory/:id", requireKitchenAccess, async (req, res) => {
    const parsed = updateKitchenInventorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const updated = await storage.updateKitchenInventoryItem(req.params.id, parsed.data as any);
    if (!updated) return res.status(404).json({ message: "Item not found" });
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "kitchen_item_updated", details: `${updated.name} updated` });
    res.json(updated);
  });

  // Kitchen Stock Movements
  app.post("/api/kitchen/stock-movements", requireKitchenAccess, async (req, res) => {
    const { itemId, type, quantity, note } = req.body;
    if (!itemId || !type || !quantity) return res.status(400).json({ message: "itemId, type, and quantity required" });
    await storage.recordKitchenStockMovement({
      itemId, type, quantity: Number(quantity), note,
      staffId: req.session.receptionistId,
      staffName: req.session.receptionistName,
    });
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "kitchen_stock_movement", details: `Stock ${type}: ${quantity} units for item ${itemId}` });
    res.json({ ok: true });
  });

  app.get("/api/kitchen/stock-movements", requireKitchenAccess, async (req, res) => {
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    const itemId = typeof req.query.itemId === "string" ? req.query.itemId : undefined;
    res.json(await storage.getKitchenStockMovements(branchId, itemId));
  });

  // Kitchen Shifts
  app.get("/api/kitchen/shifts/active", requireKitchenAccess, async (req, res) => {
    const shift = await storage.getActiveKitchenShift(req.session.receptionistId);
    res.json(shift ?? null);
  });

  app.post("/api/kitchen/shifts/start", requireKitchenAccess, async (req, res) => {
    if (!req.session.receptionistId || !req.session.receptionistName || !req.session.branchId) {
      return res.status(400).json({ message: "Session missing required fields" });
    }
    try {
      const shift = await storage.startKitchenShift(req.session.receptionistId, req.session.receptionistName, req.session.branchId);
      await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "kitchen_shift_started", details: "Kitchen shift started" });
      res.status(201).json(shift);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/kitchen/shifts/:id/close", requireKitchenAccess, async (req, res) => {
    const { notes } = req.body;
    const shift = await storage.closeKitchenShift(req.params.id, notes);
    await storage.logAction({ receptionistId: req.session.receptionistId, receptionistName: req.session.receptionistName, action: "kitchen_shift_closed", details: "Kitchen shift closed" });
    res.json(shift);
  });

  app.get("/api/kitchen/shifts", requireKitchenAccess, async (req, res) => {
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    res.json(await storage.getKitchenShifts(branchId));
  });

  // Kitchen Orders
  app.get("/api/kitchen/orders", requireAuth, async (req, res) => {
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(await storage.getKitchenOrders(branchId, status));
  });

  // Food sales by source + date range — used by receptionist & bar to download shift food orders
  app.get("/api/kitchen/orders/food-sales", requireAuth, async (req, res) => {
    const source = typeof req.query.source === "string" ? req.query.source : undefined;
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    if (!source || !from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ message: "source, from, and to are required" });
    }
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    const orders = await storage.getKitchenOrdersBySourceAndRange(source, from, to, branchId);
    res.json(orders);
  });

  app.post("/api/kitchen/orders", requireAuth, async (req, res) => {
    const parsed = createKitchenOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid data" });
    const branchId = req.session.branchId || req.body.branchId;
    if (!branchId) return res.status(400).json({ message: "Branch required" });
    const activeShift = await storage.getActiveKitchenShift();
    const order = await storage.createKitchenOrder({
      ...parsed.data,
      branchId,
      staffId: req.session.receptionistId,
      shiftId: activeShift?.id,
    });
    res.status(201).json(order);
  });

  app.patch("/api/kitchen/orders/:id/status", requireKitchenAccess, async (req, res) => {
    const { status, estimatedMinutes } = req.body;
    if (!status) return res.status(400).json({ message: "status required" });

    // Transitioning to "preparing" must go through the ingredient-deduction endpoint
    // so that the status guard and stock deduction are always atomic.
    if (status === "preparing") {
      return res.status(400).json({
        message: "Use POST /api/kitchen/orders/:id/start-preparing to begin preparation.",
      });
    }

    // Branch scope — non-admins may only update orders within their own branch
    const order = await storage.getKitchenOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.session.role !== "admin" && req.session.branchId && order.branchId !== req.session.branchId) {
      return res.status(403).json({ message: "This order belongs to a different branch" });
    }

    const updated = await storage.updateKitchenOrderStatus(req.params.id, status, estimatedMinutes);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  /**
   * Atomically selects ingredients, deducts them from inventory, and
   * transitions the order to "preparing" in a single DB transaction.
   *
   * - ingredients may be an empty array (chef skips deduction but still
   *   starts preparing).
   * - Order must currently be "accepted"; duplicate calls are rejected.
   * - Every inventory item must belong to the same branch as the order.
   */
  app.post("/api/kitchen/orders/:id/start-preparing", requireKitchenAccess, async (req, res) => {
    const rawIngredients = req.body?.ingredients;
    const ingredients: { itemId: string; quantity: number }[] = Array.isArray(rawIngredients)
      ? rawIngredients
      : [];

    const isAdmin = req.session.role === "admin";
    const callerBranchId = req.session.branchId;

    let updated;
    try {
      updated = await storage.startPreparingWithIngredients(
        req.params.id,
        ingredients,
        callerBranchId,
        isAdmin,
        req.session.receptionistId,
        req.session.receptionistName,
      );
    } catch (err: any) {
      if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
      throw err;
    }

    await storage.logAction({
      receptionistId: req.session.receptionistId,
      receptionistName: req.session.receptionistName,
      action: "kitchen_start_preparing",
      details: `Order ${updated.orderNumber} → preparing; ${ingredients.length} ingredient(s) deducted`,
    });

    res.json(updated);
  });

  // Kitchen Dashboard
  app.get("/api/kitchen/dashboard", requireKitchenAccess, async (req, res) => {
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    res.json(await storage.getKitchenDashboard(branchId));
  });

  // Kitchen Reports
  app.get("/api/kitchen/reports", requireKitchenAccess, async (req, res) => {
    const branchId = req.session.role === "admin" ? undefined : scopeBranchId(req);
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    res.json(await storage.getKitchenReports(branchId, from, to));
  });
}
