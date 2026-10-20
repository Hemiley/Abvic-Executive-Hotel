import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import session from "express-session";
import { and, eq } from "drizzle-orm";
import {
  barDrinks,
  barShifts,
  branches,
  kitchenInventory,
  kitchenShifts,
  kitchenStockMovements,
  receptionists,
  stockSubmissions,
} from "@shared/schema";
import { db, pool } from "../server/db";
import { ensureSchema } from "../server/ensure-schema";
import { registerRoutes } from "../server/routes";

const password = "stock-workflow-test-password";
const isMainModule = process.argv[1]?.endsWith("test-stock-workflow.ts");

export async function runStockWorkflowTest() {
  const branchName = `Stock workflow test ${randomUUID().slice(0, 8)}`;
  const branchId = randomUUID();
  const ids = {
    admin: randomUUID(),
    supervisor: randomUUID(),
    bar: randomUUID(),
    chef: randomUUID(),
  };
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;

  try {
    await ensureSchema();
    await db.insert(branches).values({ id: branchId, name: branchName, code: "STOCK-TEST" });
    await db.insert(receptionists).values([
      { id: ids.admin, username: `test-admin-${ids.admin.slice(0, 8)}`, passwordHash: "unused", fullName: "Test Admin", role: "admin", branchId: null },
      { id: ids.supervisor, username: `test-supervisor-${ids.supervisor.slice(0, 8)}`, passwordHash: "unused", fullName: "Test Supervisor", role: "supervisor", branchId },
      { id: ids.bar, username: `test-bar-${ids.bar.slice(0, 8)}`, passwordHash: "unused", fullName: "Test Bar Attendant", role: "bar_attendant", branchId },
      { id: ids.chef, username: `test-chef-${ids.chef.slice(0, 8)}`, passwordHash: "unused", fullName: "Test Chef", role: "chef", branchId },
    ]);

    const passwordHash = await bcrypt.hash(password, 4);
    await db.update(receptionists).set({ passwordHash }).where(
      eq(receptionists.branchId, branchId),
    );
    await db.update(receptionists).set({ passwordHash }).where(eq(receptionists.id, ids.admin));

    const [barItem] = await db.insert(barDrinks).values({
      branchId,
      name: "Test Beverage",
      category: "Other",
      sellingPrice: "100",
      quantityAvailable: 0,
      lowStockThreshold: 5,
      status: "out_of_stock",
    }).returning();
    const [kitchenItem] = await db.insert(kitchenInventory).values({
      branchId,
      name: "Test Ingredient",
      category: "Other",
      unit: "kg",
      pricePerUnit: "0",
      openingStock: "0",
      stockReceived: "0",
      currentStock: "0",
      minimumStock: "0",
      status: "out_of_stock",
    }).returning();

    const app = express();
    app.use(express.json());
    app.use(session({ secret: "stock-workflow-test-session", resave: false, saveUninitialized: false }));
    registerRoutes(app);
    app.use((error: any, _request: any, response: any, _next: any) => {
      response.status(error.statusCode ?? error.status ?? 500).json({ message: error.message ?? "Internal server error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", resolve);
      server!.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function login(role: keyof typeof ids) {
      const username = role === "admin"
        ? `test-admin-${ids.admin.slice(0, 8)}`
        : role === "supervisor"
        ? `test-supervisor-${ids.supervisor.slice(0, 8)}`
        : role === "bar"
        ? `test-bar-${ids.bar.slice(0, 8)}`
        : `test-chef-${ids.chef.slice(0, 8)}`;
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...(role === "admin" ? {} : { branchId }) }),
      });
      assert.equal(response.status, 200, `Login failed for ${role}: ${await response.text()}`);
      const cookie = response.headers.get("set-cookie");
      assert.ok(cookie, `Missing session cookie for ${role}`);
      return cookie.split(";")[0];
    }

    async function apiRequest(path: string, cookie: string, method = "GET", body?: unknown) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: cookie,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return { status: response.status, data: text ? JSON.parse(text) : null };
    }

    const adminCookie = await login("admin");
    const supervisorCookie = await login("supervisor");
    const barCookie = await login("bar");
    const chefCookie = await login("chef");

    assert.equal((await apiRequest("/api/bar/drinks", supervisorCookie)).status, 200);
    assert.equal((await apiRequest("/api/kitchen/inventory", supervisorCookie)).status, 200);
    assert.equal((await apiRequest("/api/bar/drinks", supervisorCookie, "POST", {
      name: "Should Not Start In Stock",
      category: "Other",
      sellingPrice: 100,
      quantityAvailable: 3,
      lowStockThreshold: 0,
    })).status, 400);
    const managedDrink = await apiRequest("/api/bar/drinks", supervisorCookie, "POST", {
      name: "Supervisor Managed Drink",
      category: "Other",
      sellingPrice: 100,
      quantityAvailable: 0,
      lowStockThreshold: 0,
    });
    assert.equal(managedDrink.status, 201);
    assert.equal((await apiRequest(`/api/bar/drinks/${managedDrink.data.id}`, supervisorCookie, "PATCH", { name: "Edited Supervisor Drink" })).status, 200);
    assert.equal((await apiRequest(`/api/bar/drinks/${managedDrink.data.id}`, supervisorCookie, "DELETE")).status, 200);

    assert.equal((await apiRequest("/api/kitchen/inventory", supervisorCookie, "POST", {
      branchId,
      name: "Should Not Start In Stock",
      category: "Other",
      unit: "kg",
      pricePerUnit: 0,
      openingStock: 3,
      stockReceived: 0,
      minimumStock: 0,
    })).status, 400);
    const managedKitchenItem = await apiRequest("/api/kitchen/inventory", supervisorCookie, "POST", {
      branchId,
      name: "Supervisor Managed Ingredient",
      category: "Other",
      unit: "kg",
      pricePerUnit: 0,
      openingStock: 0,
      stockReceived: 0,
      minimumStock: 0,
    });
    assert.equal(managedKitchenItem.status, 201);
    assert.equal((await apiRequest(`/api/kitchen/inventory/${managedKitchenItem.data.id}`, supervisorCookie, "PATCH", { name: "Edited Supervisor Ingredient" })).status, 200);
    assert.equal((await apiRequest(`/api/kitchen/inventory/${managedKitchenItem.data.id}`, supervisorCookie, "DELETE")).status, 200);

    const barSubmissionBody = {
      department: "bar",
      itemId: barItem.id,
      branchId,
      quantity: 8,
      requestKey: randomUUID(),
      note: "Test delivery",
    };
    const barSubmissionResponse = await apiRequest("/api/stock-submissions", supervisorCookie, "POST", barSubmissionBody);
    assert.equal(barSubmissionResponse.status, 201);
    const barSubmission = barSubmissionResponse.data;
    assert.equal((await apiRequest(`/api/stock-submissions/${barSubmission.id}/accept`, barCookie, "POST", {})).status, 409);
    assert.equal((await apiRequest("/api/stock-submissions", supervisorCookie, "POST", {
      ...barSubmissionBody,
      requestKey: randomUUID(),
    })).status, 409, "Identical pending stock should not create a duplicate submission.");
    assert.equal((await apiRequest(`/api/bar/drinks/${barItem.id}`, supervisorCookie, "PATCH", { quantityAvailable: 99 })).status, 400);
    assert.equal((await db.select().from(barDrinks).where(eq(barDrinks.id, barItem.id)))[0].quantityAvailable, 0);

    const barShiftResponse = await apiRequest("/api/bar/shifts/start", barCookie, "POST", {});
    assert.equal(barShiftResponse.status, 201);
    const barShift = barShiftResponse.data;
    assert.equal((await apiRequest(`/api/stock-submissions/${barSubmission.id}/accept`, supervisorCookie, "POST", {})).status, 403);
    const acceptedBar = await apiRequest(`/api/stock-submissions/${barSubmission.id}/accept`, barCookie, "POST", {});
    assert.equal(acceptedBar.status, 200);
    assert.equal(acceptedBar.data.acceptedByName, "Test Bar Attendant");
    assert.equal(acceptedBar.data.status, "accepted");
    assert.equal(acceptedBar.data.acceptedShiftId, barShift.id);
    assert.equal((await apiRequest(`/api/stock-submissions/${barSubmission.id}/accept`, barCookie, "POST", {})).status, 409);
    assert.equal((await db.select().from(barDrinks).where(eq(barDrinks.id, barItem.id)))[0].quantityAvailable, 8);

    const kitchenSubmissionBody = {
      department: "kitchen",
      itemId: kitchenItem.id,
      branchId,
      quantity: 4.5,
      requestKey: randomUUID(),
      note: "Test ingredients",
    };
    const kitchenSubmissionResponse = await apiRequest("/api/stock-submissions", supervisorCookie, "POST", kitchenSubmissionBody);
    assert.equal(kitchenSubmissionResponse.status, 201);
    const kitchenSubmission = kitchenSubmissionResponse.data;
    assert.equal((await apiRequest("/api/kitchen/stock-movements", chefCookie, "POST", {
      itemId: kitchenItem.id, type: "received", quantity: 4.5,
    })).status, 400, "Direct kitchen receipts must be rejected.");
    assert.equal((await apiRequest("/api/kitchen/shifts/start", chefCookie, "POST", {})).status, 201);
    const kitchenShiftsResponse = await apiRequest("/api/kitchen/shifts/active", chefCookie);
    const kitchenShift = kitchenShiftsResponse.data;
    assert.ok(kitchenShift);
    const acceptedKitchen = await apiRequest(`/api/stock-submissions/${kitchenSubmission.id}/accept`, chefCookie, "POST", {});
    assert.equal(acceptedKitchen.status, 200);
    assert.equal(acceptedKitchen.data.acceptedByName, "Test Chef");
    assert.equal(acceptedKitchen.data.acceptedShiftId, kitchenShift.id);
    const updatedKitchen = (await db.select().from(kitchenInventory).where(eq(kitchenInventory.id, kitchenItem.id)))[0];
    assert.equal(Number(updatedKitchen.currentStock), 4.5);
    assert.equal(Number(updatedKitchen.stockReceived), 4.5);
    const receivedMovement = (await db.select().from(kitchenStockMovements).where(
      and(eq(kitchenStockMovements.itemId, kitchenItem.id), eq(kitchenStockMovements.type, "received")),
    ))[0];
    assert.equal(Number(receivedMovement.quantity), 4.5);

    const reportResponse = await apiRequest("/api/stock-submissions", adminCookie);
    assert.equal(reportResponse.status, 200);
    assert.ok(reportResponse.data.some((row: any) => row.id === barSubmission.id && row.acceptedByName === "Test Bar Attendant"));
    assert.ok(reportResponse.data.some((row: any) => row.id === kitchenSubmission.id && row.acceptedByName === "Test Chef"));
    const barShiftReport = await apiRequest(`/api/bar/shifts/${barShift.id}/report`, barCookie);
    assert.equal(barShiftReport.data.acceptedStock[0].id, barSubmission.id);
    const kitchenShiftReport = await apiRequest(`/api/kitchen/shifts/${kitchenShift.id}/report`, chefCookie);
    assert.equal(kitchenShiftReport.data.acceptedStock[0].id, kitchenSubmission.id);

    assert.equal((await apiRequest(`/api/bar/shifts/${barShift.id}/close`, barCookie, "POST", {})).status, 200);
    assert.equal((await apiRequest(`/api/kitchen/shifts/${kitchenShift.id}/close`, chefCookie, "POST", { notes: "Test complete" })).status, 200);
    console.log("Stock workflow API test passed: branch access, pending receipt, duplicate prevention, on-duty acceptance, atomic inventory updates, and staff/admin reports.");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await db.delete(stockSubmissions).where(eq(stockSubmissions.branchId, branchId));
    await db.delete(kitchenStockMovements).where(eq(kitchenStockMovements.branchId, branchId));
    await db.delete(barShifts).where(eq(barShifts.branchId, branchId));
    await db.delete(kitchenShifts).where(eq(kitchenShifts.branchId, branchId));
    await db.delete(barDrinks).where(eq(barDrinks.branchId, branchId));
    await db.delete(kitchenInventory).where(eq(kitchenInventory.branchId, branchId));
    await db.delete(receptionists).where(eq(receptionists.branchId, branchId));
    await db.delete(receptionists).where(eq(receptionists.id, ids.admin));
    await db.delete(branches).where(eq(branches.id, branchId));
    await pool.end();
  }
}

if (isMainModule) {
  runStockWorkflowTest().catch(error => {
    console.error("Stock workflow API test failed:", error);
    process.exitCode = 1;
  });
}
