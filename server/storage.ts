import { db, pool } from "./db";
import {
  branches,
  receptionists,
  shifts,
  rooms,
  guests,
  reservations,
  payments,
  auditLogs,
  notifications,
  hotelSettings,
  barDrinks,
  barWaiters,
  barShifts,
  barSales,
  barSaleItems,
  type Branch,
  type InsertBranch,
  type UpdateBranch,
  type Receptionist,
  type Shift,
  type Room,
  type Guest,
  type Reservation,
  type Payment,
  type AuditLog,
  type Notification,
  type HotelSettings,
  type InsertRoom,
  type UpdateRoom,
  type CreateReceptionist,
  type UpdateReceptionist,
  type UpdateHotelSettings,
  type BarDrink,
  type BarWaiter,
  type BarShift,
  type BarSale,
  type BarSaleItem,
} from "@shared/schema";
import { eq, desc, and, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export const storage = {
  // Branches
  async getBranches(): Promise<Branch[]> {
    return db.select().from(branches).orderBy(branches.name);
  },
  async getBranchById(id: string): Promise<Branch | undefined> {
    const [b] = await db.select().from(branches).where(eq(branches.id, id));
    return b;
  },
  async createBranch(data: InsertBranch): Promise<Branch> {
    const [b] = await db.insert(branches).values(data).returning();
    return b;
  },
  async updateBranch(id: string, data: UpdateBranch): Promise<Branch | undefined> {
    const [b] = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
    return b;
  },
  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id)).returning();
    return result.length > 0;
  },
  async countRoomsInBranch(branchId: string): Promise<number> {
    const rows = await db.select().from(rooms).where(eq(rooms.branchId, branchId));
    return rows.length;
  },
  async countReceptionistsInBranch(branchId: string): Promise<number> {
    const rows = await db.select().from(receptionists).where(eq(receptionists.branchId, branchId));
    return rows.length;
  },

  // Receptionists
  async getReceptionistByUsername(username: string): Promise<Receptionist | undefined> {
    const [r] = await db.select().from(receptionists).where(eq(receptionists.username, username));
    return r;
  },
  async getReceptionistById(id: string): Promise<Receptionist | undefined> {
    const [r] = await db.select().from(receptionists).where(eq(receptionists.id, id));
    return r;
  },
  async countReceptionists(): Promise<number> {
    const rows = await db.select().from(receptionists);
    return rows.length;
  },
  async createReceptionist(data: {
    username: string;
    passwordHash: string;
    fullName: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
    branchId?: string | null;
  }): Promise<Receptionist> {
    const [r] = await db.insert(receptionists).values(data).returning();
    return r;
  },
  async getReceptionists(branchId?: string): Promise<Receptionist[]> {
    if (branchId) {
      return db.select().from(receptionists).where(eq(receptionists.branchId, branchId)).orderBy(receptionists.fullName);
    }
    return db.select().from(receptionists).orderBy(receptionists.fullName);
  },
  async updateReceptionist(
    id: string,
    data: Partial<UpdateReceptionist> & { passwordHash?: string }
  ): Promise<Receptionist | undefined> {
    const payload: any = { ...data };
    delete payload.password;
    const [r] = await db.update(receptionists).set(payload).where(eq(receptionists.id, id)).returning();
    return r;
  },
  async deleteReceptionist(id: string): Promise<boolean> {
    const result = await db.delete(receptionists).where(eq(receptionists.id, id)).returning();
    return result.length > 0;
  },

  // Shifts
  async getActiveShiftForReceptionist(receptionistId: string): Promise<Shift | undefined> {
    const [s] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.receptionistId, receptionistId), eq(shifts.status, "active")));
    return s;
  },
  async createShift(data: { receptionistId: string; receptionistName: string; openingBalance: number }): Promise<Shift> {
    const [s] = await db
      .insert(shifts)
      .values({ ...data, openingBalance: String(data.openingBalance) })
      .returning();
    return s;
  },
  async getShiftById(id: string): Promise<Shift | undefined> {
    const [s] = await db.select().from(shifts).where(eq(shifts.id, id));
    return s;
  },
  async closeShift(id: string, closingBalance: number, cashVariance: number): Promise<Shift | undefined> {
    const [s] = await db
      .update(shifts)
      .set({
        status: "closed",
        logoutTime: new Date(),
        closingBalance: String(closingBalance),
        cashVariance: String(cashVariance),
      })
      .where(eq(shifts.id, id))
      .returning();
    return s;
  },
  async incrementShiftStats(
    id: string,
    delta: Partial<{
      guestsServed: number;
      roomsBooked: number;
      reservationsProcessed: number;
      totalSales: number;
      cashSales: number;
      cardSales: number;
      transferSales: number;
      discountsGiven: number;
      refundsIssued: number;
    }>
  ) {
    const shift = await this.getShiftById(id);
    if (!shift) return;
    const next: any = {};
    if (delta.guestsServed) next.guestsServed = shift.guestsServed + delta.guestsServed;
    if (delta.roomsBooked) next.roomsBooked = shift.roomsBooked + delta.roomsBooked;
    if (delta.reservationsProcessed)
      next.reservationsProcessed = shift.reservationsProcessed + delta.reservationsProcessed;
    if (delta.totalSales) next.totalSales = String(Number(shift.totalSales) + delta.totalSales);
    if (delta.cashSales) next.cashSales = String(Number(shift.cashSales) + delta.cashSales);
    if (delta.cardSales) next.cardSales = String(Number(shift.cardSales) + delta.cardSales);
    if (delta.transferSales) next.transferSales = String(Number(shift.transferSales) + delta.transferSales);
    if (delta.discountsGiven) next.discountsGiven = String(Number(shift.discountsGiven) + delta.discountsGiven);
    if (delta.refundsIssued) next.refundsIssued = String(Number(shift.refundsIssued) + delta.refundsIssued);
    await db.update(shifts).set(next).where(eq(shifts.id, id));
  },
  async getAllShifts(): Promise<Shift[]> {
    return db.select().from(shifts).orderBy(desc(shifts.loginTime));
  },

  // Rooms
  async getRooms(branchId?: string): Promise<Room[]> {
    if (branchId) {
      return db.select().from(rooms).where(eq(rooms.branchId, branchId)).orderBy(rooms.roomNumber);
    }
    return db.select().from(rooms).orderBy(rooms.roomNumber);
  },
  async getRoomById(id: string): Promise<Room | undefined> {
    const [r] = await db.select().from(rooms).where(eq(rooms.id, id));
    return r;
  },
  async createRoom(data: InsertRoom): Promise<Room> {
    const [r] = await db
      .insert(rooms)
      .values({ ...data, pricePerNight: String(data.pricePerNight) })
      .returning();
    return r;
  },
  async updateRoom(id: string, data: UpdateRoom): Promise<Room | undefined> {
    const payload: any = { ...data };
    if (payload.pricePerNight !== undefined) payload.pricePerNight = String(payload.pricePerNight);
    const [r] = await db.update(rooms).set(payload).where(eq(rooms.id, id)).returning();
    return r;
  },
  async deleteRoom(id: string): Promise<boolean> {
    const result = await db.delete(rooms).where(eq(rooms.id, id)).returning();
    return result.length > 0;
  },
  async setRoomStatus(id: string, status: string) {
    await db.update(rooms).set({ status }).where(eq(rooms.id, id));
  },
  async countRoomsByStatus(branchId?: string): Promise<Record<string, number>> {
    const all = branchId
      ? await db.select().from(rooms).where(eq(rooms.branchId, branchId))
      : await db.select().from(rooms);
    return all.reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
  },

  // Guests
  async createGuest(data: {
    fullName: string;
    phone: string;
    email?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    emergencyContact?: string;
  }): Promise<Guest> {
    const [g] = await db.insert(guests).values(data).returning();
    return g;
  },
  async getGuestById(id: string): Promise<Guest | undefined> {
    const [g] = await db.select().from(guests).where(eq(guests.id, id));
    return g;
  },

  // Reservations

  /**
   * Atomically checks room availability and creates a reservation within a
   * single transaction using SELECT … FOR UPDATE to prevent double-booking.
   * Throws if the room is not available.
   */
  async createBookingTransactional(data: {
    guestData: {
      fullName: string;
      phone: string;
      email?: string;
      nationality?: string;
      idType?: string;
      idNumber?: string;
      address?: string;
      emergencyContact?: string;
    };
    /** When set, reuse an existing guest record instead of creating a new one. */
    existingGuestId?: string;
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    numGuests: number;
    specialRequests?: string;
    status: string;
    source: string;
    stayType?: string;
    durationHours?: number;
    receptionistId: string;
    shiftId?: string;
  }): Promise<{ reservation: Reservation; guest: Guest; room: Room }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = drizzle(client, { schema });

      // Lock the room row to prevent concurrent bookings
      const roomRows = await txDb
        .select()
        .from(rooms)
        .where(eq(rooms.id, data.roomId))
        .for("update");
      const room = roomRows[0];
      if (!room) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      }
      if (room.status !== "available") {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Room is not available"), { statusCode: 409 });
      }

      // Reuse existing guest or create a new one
      let guest: Guest;
      if (data.existingGuestId) {
        const rows = await txDb.select().from(guests).where(eq(guests.id, data.existingGuestId));
        if (!rows[0]) {
          await client.query("ROLLBACK");
          throw Object.assign(new Error("Existing guest not found"), { statusCode: 404 });
        }
        guest = rows[0];
      } else {
        const [created] = await txDb.insert(guests).values(data.guestData).returning();
        guest = created;
      }

      // Create reservation
      const [reservation] = await txDb
        .insert(reservations)
        .values({
          guestId: guest.id,
          roomId: data.roomId,
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          numGuests: data.numGuests,
          specialRequests: data.specialRequests,
          status: data.status,
          source: data.source,
          stayType: data.stayType ?? "lodge",
          durationHours: data.durationHours ?? null,
          receptionistId: data.receptionistId,
          shiftId: data.shiftId,
        })
        .returning();

      // Update room status atomically
      const newRoomStatus = data.source === "walk_in" ? "occupied" : "reserved";
      const [updatedRoom] = await txDb
        .update(rooms)
        .set({ status: newRoomStatus })
        .where(eq(rooms.id, data.roomId))
        .returning();

      await client.query("COMMIT");
      return { reservation, guest, room: updatedRoom };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Books multiple rooms for a single guest in one atomic transaction.
   * Rooms are locked in sorted-ID order to prevent deadlocks when two
   * concurrent requests try to book overlapping room sets.
   */
  async createMultiRoomBookingTransactional(data: {
    guestData: {
      fullName: string;
      phone: string;
      email?: string;
      nationality?: string;
      idType?: string;
      idNumber?: string;
      address?: string;
      emergencyContact?: string;
    };
    roomIds: string[];
    checkInDate: string;
    checkOutDate: string;
    numGuests: number;
    specialRequests?: string;
    status: string;
    source: string;
    stayType?: string;
    durationHours?: number;
    receptionistId: string;
    shiftId?: string;
  }): Promise<{ reservations: Reservation[]; guest: Guest; rooms: Room[] }> {
    const sortedIds = [...data.roomIds].sort(); // consistent lock order → no deadlocks
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = drizzle(client, { schema });

      // Lock all rooms in sorted order and validate availability
      const lockedRooms: Room[] = [];
      for (const roomId of sortedIds) {
        const rows = await txDb.select().from(rooms).where(eq(rooms.id, roomId)).for("update");
        if (!rows[0]) {
          await client.query("ROLLBACK");
          throw Object.assign(new Error(`Room not found: ${roomId}`), { statusCode: 404 });
        }
        if (rows[0].status !== "available") {
          await client.query("ROLLBACK");
          throw Object.assign(
            new Error(`Room ${rows[0].roomNumber} is not available`),
            { statusCode: 409 }
          );
        }
        lockedRooms.push(rows[0]);
      }

      // Create guest once
      const [guest] = await txDb.insert(guests).values(data.guestData).returning();

      // Create one reservation per room + update room status
      const newRoomStatus = data.source === "walk_in" ? "occupied" : "reserved";
      const createdReservations: Reservation[] = [];
      const updatedRooms: Room[] = [];

      for (const room of lockedRooms) {
        const [reservation] = await txDb
          .insert(reservations)
          .values({
            guestId: guest.id,
            roomId: room.id,
            checkInDate: data.checkInDate,
            checkOutDate: data.checkOutDate,
            numGuests: data.numGuests,
            specialRequests: data.specialRequests,
            status: data.status,
            source: data.source,
            stayType: data.stayType ?? "lodge",
            durationHours: data.durationHours ?? null,
            receptionistId: data.receptionistId,
            shiftId: data.shiftId,
          })
          .returning();
        createdReservations.push(reservation);

        const [updatedRoom] = await txDb
          .update(rooms)
          .set({ status: newRoomStatus })
          .where(eq(rooms.id, room.id))
          .returning();
        updatedRooms.push(updatedRoom);
      }

      await client.query("COMMIT");
      return { reservations: createdReservations, guest, rooms: updatedRooms };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async createReservation(data: {
    guestId: string;
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    numGuests: number;
    specialRequests?: string;
    status: string;
    source: string;
    receptionistId: string;
    shiftId?: string;
  }): Promise<Reservation> {
    const [r] = await db.insert(reservations).values(data).returning();
    return r;
  },
  async getReservations(branchId?: string, dateFrom?: Date, dateTo?: Date): Promise<Reservation[]> {
    const dateConditions = [];
    if (dateFrom) dateConditions.push(gte(reservations.createdAt, dateFrom));
    if (dateTo) dateConditions.push(lte(reservations.createdAt, dateTo));

    if (branchId) {
      const rows = await db
        .select({ reservation: reservations })
        .from(reservations)
        .innerJoin(rooms, eq(rooms.id, reservations.roomId))
        .where(and(eq(rooms.branchId, branchId), ...dateConditions))
        .orderBy(desc(reservations.createdAt));
      return rows.map((r) => r.reservation);
    }
    if (dateConditions.length) {
      return db
        .select()
        .from(reservations)
        .where(and(...dateConditions))
        .orderBy(desc(reservations.createdAt));
    }
    return db.select().from(reservations).orderBy(desc(reservations.createdAt));
  },
  async getReservationById(id: string): Promise<Reservation | undefined> {
    const [r] = await db.select().from(reservations).where(eq(reservations.id, id));
    return r;
  },
  async updateReservation(id: string, data: Record<string, any>): Promise<Reservation | undefined> {
    const [r] = await db
      .update(reservations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return r;
  },

  // Payments
  async createPayment(data: {
    reservationId: string;
    amount: number;
    method: string;
    type: string;
    transactionId?: string;
    receptionistId: string;
    receptionistName: string;
    shiftId?: string;
  }): Promise<Payment> {
    const [p] = await db
      .insert(payments)
      .values({ ...data, amount: String(data.amount) })
      .returning();
    return p;
  },
  async getPayments(branchId?: string, dateFrom?: Date, dateTo?: Date): Promise<Payment[]> {
    const dateConditions = [];
    if (dateFrom) dateConditions.push(gte(payments.createdAt, dateFrom));
    if (dateTo) dateConditions.push(lte(payments.createdAt, dateTo));

    if (branchId) {
      const rows = await db
        .select({ payment: payments })
        .from(payments)
        .innerJoin(reservations, eq(reservations.id, payments.reservationId))
        .innerJoin(rooms, eq(rooms.id, reservations.roomId))
        .where(and(eq(rooms.branchId, branchId), ...dateConditions))
        .orderBy(desc(payments.createdAt));
      return rows.map((r) => r.payment);
    }
    if (dateConditions.length) {
      return db
        .select()
        .from(payments)
        .where(and(...dateConditions))
        .orderBy(desc(payments.createdAt));
    }
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  },
  async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.reservationId, reservationId));
  },
  async getPaymentsByShift(shiftId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.shiftId, shiftId)).orderBy(desc(payments.createdAt));
  },
  async getReservationsByShift(shiftId: string): Promise<Reservation[]> {
    return db.select().from(reservations).where(eq(reservations.shiftId, shiftId)).orderBy(desc(reservations.createdAt));
  },

  // Audit log
  async logAction(data: { receptionistId?: string; receptionistName?: string; action: string; details?: string }) {
    await db.insert(auditLogs).values(data);
  },
  async getAuditLogs(): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(500);
  },

  // Notifications
  async createNotification(data: { type: string; message: string }): Promise<Notification> {
    const [n] = await db.insert(notifications).values(data).returning();
    return n;
  },
  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
  },
  async markNotificationRead(id: string) {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  },

  // Cross-branch access guard — used before creating/updating bookings so a
  // receptionist can never touch a room outside their assigned branch.
  async roomBelongsToBranch(roomId: string, branchId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    return !!room && room.branchId === branchId;
  },

  // ── Bar Management ────────────────────────────────────────────────────────────

  // Bar Drinks
  async getBarDrinks(branchId?: string): Promise<BarDrink[]> {
    if (branchId) return db.select().from(barDrinks).where(eq(barDrinks.branchId, branchId)).orderBy(barDrinks.name);
    return db.select().from(barDrinks).orderBy(barDrinks.name);
  },
  async getBarDrinkById(id: string): Promise<BarDrink | undefined> {
    const [d] = await db.select().from(barDrinks).where(eq(barDrinks.id, id));
    return d;
  },
  async createBarDrink(data: {
    branchId: string; name: string; category: string; brand?: string;
    sellingPrice: number; quantityAvailable: number; lowStockThreshold: number;
    barcode?: string; imageUrl?: string; status?: string;
  }): Promise<BarDrink> {
    const [d] = await db.insert(barDrinks).values({
      ...data,
      sellingPrice: String(data.sellingPrice),
      status: data.status ?? (data.quantityAvailable > 0 ? "available" : "out_of_stock"),
    }).returning();
    return d;
  },
  async updateBarDrink(id: string, data: Partial<{
    name: string; category: string; brand: string; sellingPrice: number;
    quantityAvailable: number; lowStockThreshold: number; barcode: string;
    imageUrl: string; status: string;
  }>): Promise<BarDrink | undefined> {
    const payload: any = { ...data, updatedAt: new Date() };
    if (payload.sellingPrice !== undefined) payload.sellingPrice = String(payload.sellingPrice);
    if (payload.quantityAvailable !== undefined) {
      payload.status = payload.quantityAvailable > 0 ? "available" : "out_of_stock";
    }
    const [d] = await db.update(barDrinks).set(payload).where(eq(barDrinks.id, id)).returning();
    return d;
  },
  async deleteBarDrink(id: string): Promise<boolean> {
    const result = await db.delete(barDrinks).where(eq(barDrinks.id, id)).returning();
    return result.length > 0;
  },
  async getLowStockDrinks(branchId?: string): Promise<BarDrink[]> {
    const all = await this.getBarDrinks(branchId);
    return all.filter(d => d.quantityAvailable <= d.lowStockThreshold);
  },

  // Bar Waiters
  async getBarWaiters(branchId?: string): Promise<BarWaiter[]> {
    if (branchId) return db.select().from(barWaiters).where(and(eq(barWaiters.branchId, branchId), eq(barWaiters.active, true))).orderBy(barWaiters.name);
    return db.select().from(barWaiters).where(eq(barWaiters.active, true)).orderBy(barWaiters.name);
  },
  async createBarWaiter(data: { branchId: string; name: string }): Promise<BarWaiter> {
    const [w] = await db.insert(barWaiters).values(data).returning();
    return w;
  },
  async updateBarWaiter(id: string, data: { name?: string; active?: boolean }): Promise<BarWaiter | undefined> {
    const [w] = await db.update(barWaiters).set(data).where(eq(barWaiters.id, id)).returning();
    return w;
  },
  async deleteBarWaiter(id: string): Promise<boolean> {
    const result = await db.delete(barWaiters).where(eq(barWaiters.id, id)).returning();
    return result.length > 0;
  },

  // Bar Shifts
  async getActiveBarShiftForAttendant(attendantId: string): Promise<BarShift | undefined> {
    const [s] = await db.select().from(barShifts).where(and(eq(barShifts.barAttendantId, attendantId), eq(barShifts.status, "active")));
    return s;
  },
  async createBarShift(data: { barAttendantId: string; barAttendantName: string; branchId: string; openingStockSnapshot: any[] }): Promise<BarShift> {
    const [s] = await db.insert(barShifts).values({
      ...data,
      openingStockSnapshot: data.openingStockSnapshot,
    }).returning();
    return s;
  },
  async getBarShiftById(id: string): Promise<BarShift | undefined> {
    const [s] = await db.select().from(barShifts).where(eq(barShifts.id, id));
    return s;
  },
  async closeBarShift(id: string, closingStockSnapshot: any[]): Promise<BarShift | undefined> {
    const [s] = await db.update(barShifts).set({
      status: "closed",
      closeTime: new Date(),
      closingStockSnapshot,
    }).where(eq(barShifts.id, id)).returning();
    return s;
  },
  async incrementBarShiftStats(id: string, delta: { totalRevenue?: number; totalBottlesSold?: number; totalTransactions?: number }) {
    const shift = await this.getBarShiftById(id);
    if (!shift) return;
    const next: any = {};
    if (delta.totalRevenue) next.totalRevenue = String(Number(shift.totalRevenue) + delta.totalRevenue);
    if (delta.totalBottlesSold) next.totalBottlesSold = shift.totalBottlesSold + delta.totalBottlesSold;
    if (delta.totalTransactions) next.totalTransactions = shift.totalTransactions + delta.totalTransactions;
    await db.update(barShifts).set(next).where(eq(barShifts.id, id));
  },
  async getAllBarShifts(branchId?: string): Promise<BarShift[]> {
    if (branchId) return db.select().from(barShifts).where(eq(barShifts.branchId, branchId)).orderBy(desc(barShifts.openTime));
    return db.select().from(barShifts).orderBy(desc(barShifts.openTime));
  },

  // Bar Sales
  async createBarSaleTransactional(data: {
    barShiftId?: string; barAttendantId: string; barAttendantName: string; branchId: string;
    invoiceNumber: string; waiterName?: string; paymentMethod: string;
    items: { drinkId: string; quantity: number }[];
  }): Promise<{ sale: BarSale; items: BarSaleItem[] }> {
    // Fetch all drink prices and validate stock
    const drinkIds = data.items.map(i => i.drinkId);
    const drinks = await db.select().from(barDrinks).where(inArray(barDrinks.id, drinkIds));
    const drinkMap = new Map(drinks.map(d => [d.id, d]));

    let totalAmount = 0;
    const enrichedItems: { drinkId: string; drinkName: string; category: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
    for (const item of data.items) {
      const drink = drinkMap.get(item.drinkId);
      if (!drink) throw Object.assign(new Error(`Drink not found: ${item.drinkId}`), { statusCode: 404 });
      if (drink.quantityAvailable < item.quantity) throw Object.assign(new Error(`Insufficient stock for ${drink.name}`), { statusCode: 409 });
      const unitPrice = Number(drink.sellingPrice);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;
      enrichedItems.push({ drinkId: item.drinkId, drinkName: drink.name, category: drink.category, quantity: item.quantity, unitPrice, subtotal });
    }

    // Insert sale
    const [sale] = await db.insert(barSales).values({
      barShiftId: data.barShiftId,
      barAttendantId: data.barAttendantId,
      barAttendantName: data.barAttendantName,
      branchId: data.branchId,
      invoiceNumber: data.invoiceNumber,
      waiterName: data.waiterName,
      paymentMethod: data.paymentMethod,
      totalAmount: String(totalAmount),
    }).returning();

    // Insert sale items
    const saleItems: BarSaleItem[] = [];
    for (const item of enrichedItems) {
      const [si] = await db.insert(barSaleItems).values({
        barSaleId: sale.id,
        drinkId: item.drinkId,
        drinkName: item.drinkName,
        category: item.category,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      }).returning();
      saleItems.push(si);

      // Deduct stock
      const drink = drinkMap.get(item.drinkId)!;
      const newQty = drink.quantityAvailable - item.quantity;
      await db.update(barDrinks).set({
        quantityAvailable: newQty,
        status: newQty > 0 ? "available" : "out_of_stock",
        updatedAt: new Date(),
      }).where(eq(barDrinks.id, item.drinkId));
    }

    return { sale, items: saleItems };
  },
  async getBarSales(branchId?: string, dateFrom?: Date, dateTo?: Date): Promise<BarSale[]> {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(barSales.branchId, branchId));
    if (dateFrom) conditions.push(gte(barSales.createdAt, dateFrom));
    if (dateTo) conditions.push(lte(barSales.createdAt, dateTo));
    if (conditions.length) {
      return db.select().from(barSales).where(and(...conditions)).orderBy(desc(barSales.createdAt));
    }
    return db.select().from(barSales).orderBy(desc(barSales.createdAt));
  },
  async getBarSaleById(id: string): Promise<BarSale | undefined> {
    const [s] = await db.select().from(barSales).where(eq(barSales.id, id));
    return s;
  },
  async getBarSaleItems(barSaleId: string): Promise<BarSaleItem[]> {
    return db.select().from(barSaleItems).where(eq(barSaleItems.barSaleId, barSaleId));
  },

  // Hotel settings
  async getHotelSettings(): Promise<HotelSettings> {
    const [row] = await db.select().from(hotelSettings).limit(1);
    if (row) return row;
    const [created] = await db.insert(hotelSettings).values({}).returning();
    return created;
  },
  async updateHotelSettings(data: UpdateHotelSettings): Promise<HotelSettings> {
    const existing = await this.getHotelSettings();
    // Drizzle's `numeric` columns require string values; coerce JS numbers before .set()
    const payload: any = { ...data, updatedAt: new Date() };
    if (payload.bgOpacity !== undefined) payload.bgOpacity = String(payload.bgOpacity);
    if (payload.shortRestHourlyRate !== undefined) payload.shortRestHourlyRate = String(payload.shortRestHourlyRate);
    const [updated] = await db
      .update(hotelSettings)
      .set(payload)
      .where(eq(hotelSettings.id, existing.id))
      .returning();
    return updated;
  },
};
