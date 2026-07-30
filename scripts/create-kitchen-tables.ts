import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS kitchen_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        price_per_unit NUMERIC NOT NULL DEFAULT '0',
        opening_stock NUMERIC NOT NULL DEFAULT '0',
        stock_received NUMERIC NOT NULL DEFAULT '0',
        current_stock NUMERIC NOT NULL DEFAULT '0',
        minimum_stock NUMERIC NOT NULL DEFAULT '0',
        supplier TEXT,
        purchase_cost NUMERIC,
        expiry_date TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL,
        item_name TEXT NOT NULL,
        branch_id UUID NOT NULL,
        type TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        note TEXT,
        staff_id TEXT,
        staff_name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chef_id UUID NOT NULL,
        chef_name TEXT NOT NULL,
        branch_id UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP,
        opening_stock_snapshot JSONB,
        closing_stock_snapshot JSONB,
        notes TEXT,
        orders_completed INTEGER NOT NULL DEFAULT 0,
        meals_cooked INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS kitchen_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number TEXT NOT NULL UNIQUE,
        branch_id UUID NOT NULL,
        table_or_room TEXT,
        customer_name TEXT,
        source TEXT NOT NULL DEFAULT 'restaurant',
        staff_id TEXT,
        staff_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        priority TEXT NOT NULL DEFAULT 'normal',
        special_instructions TEXT,
        estimated_minutes INTEGER,
        shift_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        meal_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      );
    `);
    console.log("✅ All kitchen tables created successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
