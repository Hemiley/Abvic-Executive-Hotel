import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { storage } from "./storage";

export async function seedAdmin() {
  const count = await storage.countReceptionists();
  if (count === 0) {
    const username = "admin";
    const password = process.env.ADMIN_INITIAL_PASSWORD || nanoid(12);
    const passwordHash = await bcrypt.hash(password, 10);
    await storage.createReceptionist({
      username,
      passwordHash,
      fullName: "Super Admin",
      role: "admin",
    });

    console.log("============================================");
    console.log(" Super Admin account created");
    console.log(` Username: ${username}`);
    console.log(` Password: ${password}`);
    console.log(" Login at: /login");
    console.log(" Please save these credentials now.");
    console.log("============================================");

    const receptionistPassword = process.env.RECEPTIONIST_INITIAL_PASSWORD || nanoid(12);
    const receptionistHash = await bcrypt.hash(receptionistPassword, 10);
    await storage.createReceptionist({
      username: "receptionist",
      passwordHash: receptionistHash,
      fullName: "Front Desk Receptionist",
      role: "receptionist",
    });
    console.log("============================================");
    console.log(" Receptionist account created");
    console.log(" Username: receptionist");
    console.log(` Password: ${receptionistPassword}`);
    console.log("============================================");
  }

  const rooms = await storage.getRooms();
  if (rooms.length === 0) {
    const sampleRooms = [
      { roomNumber: "101", roomType: "Standard Room", pricePerNight: 80, capacity: 2, amenities: ["Wi-Fi", "TV", "AC"] },
      { roomNumber: "102", roomType: "Standard Room", pricePerNight: 80, capacity: 2, amenities: ["Wi-Fi", "TV", "AC"] },
      { roomNumber: "201", roomType: "Deluxe Room", pricePerNight: 140, capacity: 3, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar"] },
      { roomNumber: "202", roomType: "Deluxe Room", pricePerNight: 140, capacity: 3, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar"] },
      { roomNumber: "301", roomType: "Executive Suite", pricePerNight: 260, capacity: 4, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar", "Jacuzzi"] },
      { roomNumber: "302", roomType: "Executive Suite", pricePerNight: 260, capacity: 4, amenities: ["Wi-Fi", "TV", "AC", "Mini Bar", "Jacuzzi"] },
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
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
