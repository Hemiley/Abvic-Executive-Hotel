import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { storage } from "./storage";

export async function seedAdmin() {
  const ADMIN_USERNAME = "superadmin";
  const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || nanoid(12);
  const RECEPTIONIST_PASSWORD = process.env.RECEPTIONIST_INITIAL_PASSWORD || nanoid(12);

  // ── Admin account ──────────────────────────────────────────────────────────
  // If ADMIN_INITIAL_PASSWORD is set we always sync the admin's credentials so
  // the same env var works across every deployment (Replit, Railway, etc.).
  const existingAdmin = await storage.getReceptionistByUsername(ADMIN_USERNAME);

  if (!existingAdmin) {
    // First boot — create the admin account.
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await storage.createReceptionist({
      username: ADMIN_USERNAME,
      passwordHash,
      fullName: "Super Admin",
      role: "admin",
    });
    console.log("============================================");
    console.log(" Super Admin account created");
    console.log(` Username: ${ADMIN_USERNAME}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(` Password: ${ADMIN_PASSWORD}`);
    } else {
      console.log(" Password: (set via ADMIN_INITIAL_PASSWORD env var)");
    }
    console.log(" Login at: /admin-login");
    console.log(" Please save these credentials now.");
    console.log("============================================");
  } else if (process.env.ADMIN_INITIAL_PASSWORD) {
    // ADMIN_INITIAL_PASSWORD is explicitly set — sync the password so it
    // matches on every deployment without needing a manual DB update.
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await storage.updateReceptionist(existingAdmin.id, { passwordHash });
    console.log(`Super Admin password synced from ADMIN_INITIAL_PASSWORD (username: ${ADMIN_USERNAME}).`);
  }

  // Also sync username to "superadmin" if an old "admin" account exists.
  const legacyAdmin = await storage.getReceptionistByUsername("admin");
  if (legacyAdmin && legacyAdmin.role === "admin") {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await storage.updateReceptionist(legacyAdmin.id, {
      passwordHash,
      ...(legacyAdmin.username !== ADMIN_USERNAME ? { username: ADMIN_USERNAME } : {}),
    } as any);
    console.log(`Legacy admin account migrated to username: ${ADMIN_USERNAME}`);
  }

  // ── Receptionist account ──────────────────────────────────────────────────
  const existingReceptionist = await storage.getReceptionistByUsername("receptionist");
  if (!existingReceptionist) {
    const passwordHash = await bcrypt.hash(RECEPTIONIST_PASSWORD, 10);
    await storage.createReceptionist({
      username: "receptionist",
      passwordHash,
      fullName: "Front Desk Receptionist",
      role: "receptionist",
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("============================================");
      console.log(" Receptionist account created");
      console.log(" Username: receptionist");
      console.log(` Password: ${RECEPTIONIST_PASSWORD}`);
      console.log("============================================");
    }
  }

  // ── Sample rooms ──────────────────────────────────────────────────────────
  const rooms = await storage.getRooms();
  if (rooms.length === 0) {
    const sampleRooms = [
      { roomNumber: "101", roomType: "Standard Room",      pricePerNight: 80,  capacity: 2, amenities: ["Wi-Fi", "TV", "AC"] },
      { roomNumber: "102", roomType: "Standard Room",      pricePerNight: 80,  capacity: 2, amenities: ["Wi-Fi", "TV", "AC"] },
      { roomNumber: "201", roomType: "Deluxe Room",        pricePerNight: 140, capacity: 3, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar"] },
      { roomNumber: "202", roomType: "Deluxe Room",        pricePerNight: 140, capacity: 3, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar"] },
      { roomNumber: "301", roomType: "Executive Suite",    pricePerNight: 260, capacity: 4, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar", "Jacuzzi"] },
      { roomNumber: "302", roomType: "Executive Suite",    pricePerNight: 260, capacity: 4, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar", "Jacuzzi"] },
      { roomNumber: "401", roomType: "Presidential Suite", pricePerNight: 450, capacity: 6, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar", "Jacuzzi", "Butler Service"] },
    ];
    for (const room of sampleRooms) {
      await storage.createRoom(room as any);
    }
  }

  await storage.getHotelSettings();
}

const isMainModule = process.argv[1] && process.argv[1].endsWith("seed.ts");
if (isMainModule) {
  seedAdmin()
    .then(() => { console.log("Seed complete."); process.exit(0); })
    .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
}
