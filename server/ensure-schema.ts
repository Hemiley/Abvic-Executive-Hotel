import { pool } from "./db";

/**
 * Creates all application tables if they don't already exist.
 * Safe to run on every startup (fully idempotent).
 * This removes the dependency on `drizzle-kit push` being run manually,
 * so the app works on any deployment (Railway, Render, Replit, etc.)
 * as long as DATABASE_URL is set.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS branches (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT NOT NULL UNIQUE,
        code       TEXT,
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS receptionists (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name     TEXT NOT NULL,
        email         TEXT,
        role          TEXT NOT NULL DEFAULT 'receptionist',
        avatar_url    TEXT,
        branch_id     UUID,
        two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
        active        BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS branch_id UUID;

      CREATE TABLE IF NOT EXISTS shifts (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receptionist_id          UUID NOT NULL,
        receptionist_name        TEXT NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'active',
        opening_balance          NUMERIC NOT NULL DEFAULT 0,
        closing_balance          NUMERIC,
        cash_variance            NUMERIC,
        login_time               TIMESTAMP NOT NULL DEFAULT NOW(),
        logout_time              TIMESTAMP,
        guests_served            INTEGER NOT NULL DEFAULT 0,
        rooms_booked             INTEGER NOT NULL DEFAULT 0,
        reservations_processed   INTEGER NOT NULL DEFAULT 0,
        total_sales              NUMERIC NOT NULL DEFAULT 0,
        cash_sales               NUMERIC NOT NULL DEFAULT 0,
        card_sales               NUMERIC NOT NULL DEFAULT 0,
        transfer_sales           NUMERIC NOT NULL DEFAULT 0,
        discounts_given          NUMERIC NOT NULL DEFAULT 0,
        refunds_issued           NUMERIC NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id       UUID,
        room_number     TEXT NOT NULL UNIQUE,
        room_type       TEXT NOT NULL,
        price_per_night NUMERIC NOT NULL,
        capacity        INTEGER NOT NULL DEFAULT 2,
        amenities       JSONB NOT NULL DEFAULT '[]',
        image_url       TEXT,
        image_urls      JSONB NOT NULL DEFAULT '[]',
        status          TEXT NOT NULL DEFAULT 'available',
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch_id UUID;

      CREATE TABLE IF NOT EXISTS guests (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name         TEXT NOT NULL,
        phone             TEXT NOT NULL,
        email             TEXT,
        nationality       TEXT,
        id_type           TEXT,
        id_number         TEXT,
        address           TEXT,
        emergency_contact TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guest_id         UUID NOT NULL,
        room_id          UUID NOT NULL,
        check_in_date    TEXT NOT NULL,
        check_out_date   TEXT NOT NULL,
        num_guests       INTEGER NOT NULL DEFAULT 1,
        special_requests TEXT,
        status           TEXT NOT NULL DEFAULT 'pending',
        source           TEXT NOT NULL DEFAULT 'walk_in',
        stay_type        TEXT NOT NULL DEFAULT 'lodge',
        duration_hours   INTEGER,
        receptionist_id  UUID NOT NULL,
        shift_id         UUID,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id   UUID NOT NULL,
        amount           NUMERIC NOT NULL,
        method           TEXT NOT NULL,
        type             TEXT NOT NULL DEFAULT 'payment',
        transaction_id   TEXT,
        receptionist_id  UUID NOT NULL,
        receptionist_name TEXT NOT NULL,
        shift_id         UUID,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receptionist_id   UUID,
        receptionist_name TEXT,
        action            TEXT NOT NULL,
        details           TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type       TEXT NOT NULL,
        message    TEXT NOT NULL,
        read       BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hotel_settings (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_name            TEXT NOT NULL DEFAULT 'AEH',
        logo_url              TEXT,
        background_style      TEXT,
        bg_opacity            NUMERIC NOT NULL DEFAULT 1,
        bg_blur               INTEGER NOT NULL DEFAULT 0,
        font_color            TEXT,
        font_size             INTEGER,
        short_rest_hourly_rate NUMERIC NOT NULL DEFAULT 3000,
        updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ── Bar Management ──────────────────────────────────────────────────────

      CREATE TABLE IF NOT EXISTS bar_drinks (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id           UUID NOT NULL,
        name                TEXT NOT NULL,
        category            TEXT NOT NULL DEFAULT 'Beer',
        brand               TEXT,
        selling_price       NUMERIC NOT NULL,
        quantity_available  INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        barcode             TEXT,
        image_url           TEXT,
        status              TEXT NOT NULL DEFAULT 'available',
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bar_waiters (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id  UUID NOT NULL,
        name       TEXT NOT NULL,
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bar_shifts (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bar_attendant_id        UUID NOT NULL,
        bar_attendant_name      TEXT NOT NULL,
        branch_id               UUID NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'active',
        open_time               TIMESTAMP NOT NULL DEFAULT NOW(),
        close_time              TIMESTAMP,
        opening_stock_snapshot  JSONB NOT NULL DEFAULT '[]',
        closing_stock_snapshot  JSONB NOT NULL DEFAULT '[]',
        total_revenue           NUMERIC NOT NULL DEFAULT '0',
        total_bottles_sold      INTEGER NOT NULL DEFAULT 0,
        total_transactions      INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bar_sales (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bar_shift_id        UUID,
        bar_attendant_id    UUID NOT NULL,
        bar_attendant_name  TEXT NOT NULL,
        branch_id           UUID NOT NULL,
        invoice_number      TEXT NOT NULL UNIQUE,
        waiter_name         TEXT,
        payment_method      TEXT NOT NULL DEFAULT 'cash',
        total_amount        NUMERIC NOT NULL,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bar_sale_items (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bar_sale_id UUID NOT NULL,
        drink_id    UUID NOT NULL,
        drink_name  TEXT NOT NULL,
        category    TEXT NOT NULL,
        quantity    INTEGER NOT NULL,
        unit_price  NUMERIC NOT NULL,
        subtotal    NUMERIC NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session (
        sid    VARCHAR NOT NULL PRIMARY KEY,
        sess   JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );

      -- ── Kitchen Management ───────────────────────────────────────────────────

      CREATE TABLE IF NOT EXISTS kitchen_inventory (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id      UUID NOT NULL,
        name           TEXT NOT NULL,
        category       TEXT NOT NULL,
        unit           TEXT NOT NULL DEFAULT 'kg',
        price_per_unit NUMERIC NOT NULL DEFAULT '0',
        opening_stock  NUMERIC NOT NULL DEFAULT '0',
        stock_received NUMERIC NOT NULL DEFAULT '0',
        current_stock  NUMERIC NOT NULL DEFAULT '0',
        minimum_stock  NUMERIC NOT NULL DEFAULT '0',
        supplier       TEXT,
        purchase_cost  NUMERIC,
        expiry_date    TEXT,
        status         TEXT NOT NULL DEFAULT 'available',
        last_updated   TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_stock_movements (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id    UUID NOT NULL,
        item_name  TEXT NOT NULL,
        branch_id  UUID NOT NULL,
        type       TEXT NOT NULL,
        quantity   NUMERIC NOT NULL,
        note       TEXT,
        staff_id   TEXT,
        staff_name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_shifts (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chef_id                 UUID NOT NULL,
        chef_name               TEXT NOT NULL,
        branch_id               UUID NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'active',
        start_time              TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time                TIMESTAMP,
        opening_stock_snapshot  JSONB,
        closing_stock_snapshot  JSONB,
        notes                   TEXT,
        orders_completed        INTEGER NOT NULL DEFAULT 0,
        meals_cooked            INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS kitchen_orders (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number         TEXT NOT NULL UNIQUE,
        branch_id            UUID NOT NULL,
        table_or_room        TEXT,
        customer_name        TEXT,
        source               TEXT NOT NULL DEFAULT 'restaurant',
        staff_id             TEXT,
        staff_name           TEXT NOT NULL,
        status               TEXT NOT NULL DEFAULT 'new',
        priority             TEXT NOT NULL DEFAULT 'normal',
        special_instructions TEXT,
        estimated_minutes    INTEGER,
        shift_id             UUID,
        created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kitchen_order_items (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        meal_name TEXT NOT NULL,
        quantity  INTEGER NOT NULL DEFAULT 1,
        notes     TEXT
      );

      -- ── Security Attendance ──────────────────────────────────────────────────

      CREATE TABLE IF NOT EXISTS attendance_records (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date             TEXT NOT NULL,
        staff_name       TEXT NOT NULL,
        position         TEXT NOT NULL,
        branch_id        UUID NOT NULL,
        sign_in_time     TIMESTAMP NOT NULL DEFAULT NOW(),
        sign_out_time    TIMESTAMP,
        status           TEXT NOT NULL DEFAULT 'signed_in',
        total_hours      NUMERIC,
        recorded_by_id   UUID NOT NULL,
        recorded_by_name TEXT NOT NULL,
        notes            TEXT,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ---------- Branch backfill (idempotent) ----------
    // Rooms must always have a branch. If any rooms predate the branches
    // table, assign them (and any branch-less receptionists) to a default
    // branch so the NOT NULL constraint below can be applied safely.
    const { rows: branchCountRows } = await client.query(`SELECT COUNT(*)::int AS count FROM branches`);
    if (branchCountRows[0].count === 0) {
      await client.query(
        `INSERT INTO branches (name, code) VALUES ('Annex 1', 'ANNEX-1') ON CONFLICT (name) DO NOTHING`
      );
    }
    const { rows: defaultBranchRows } = await client.query(`SELECT id FROM branches ORDER BY created_at LIMIT 1`);
    const defaultBranchId = defaultBranchRows[0]?.id;
    if (defaultBranchId) {
      await client.query(`UPDATE rooms SET branch_id = $1 WHERE branch_id IS NULL`, [defaultBranchId]);
      await client.query(
        `UPDATE receptionists SET branch_id = $1 WHERE branch_id IS NULL AND role <> 'admin'`,
        [defaultBranchId]
      );
    }
    await client.query(`ALTER TABLE rooms ALTER COLUMN branch_id SET NOT NULL`);

    console.log("Database schema ready.");
  } finally {
    client.release();
  }
}
