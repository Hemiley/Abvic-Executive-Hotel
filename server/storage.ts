import { db, pool } from "./db";
import {
  receptionists,
  shifts,
  rooms,
  guests,
  reservations,
  payments,
  auditLogs,
  notifications,
  hotelSettings,
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
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export const storage = {
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
  }): Promise<Receptionist> {
    const [r] = await db.insert(receptionists).values(data).returning();
    return r;
  },
  async getReceptionists(): Promise<Receptionist[]> {
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
  async getRooms(): Promise<Room[]> {
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
  async countRoomsByStatus(): Promise<Record<string, number>> {
    const all = await db.select().from(rooms);
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
  async getReservations(): Promise<Reservation[]> {
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
  async getPayments(): Promise<Payment[]> {
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
