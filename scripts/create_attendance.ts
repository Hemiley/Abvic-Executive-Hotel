import { pool } from "../server/db";

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      position TEXT NOT NULL,
      branch_id UUID NOT NULL,
      sign_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
      sign_out_time TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'signed_in',
      total_hours NUMERIC,
      recorded_by_id UUID NOT NULL,
      recorded_by_name TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("attendance_records table created successfully");
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
