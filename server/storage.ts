import { db } from "./db";
import {
  receptionists,
  shifts,
  rooms,
  guests,
  reservations,
  payments,
  auditLogs,
  notifications,
  type Receptionist,
  type Shift,
  type Room,
  type Guest,
  type Reservation,
  type Payment,
  type AuditLog,
  type Notification,
  type InsertRoom,
  type UpdateRoom,
  type CreateReceptionist,
  type UpdateReceptionist,
} from "@shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

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
};
