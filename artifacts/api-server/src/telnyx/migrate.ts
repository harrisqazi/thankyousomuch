import { pool } from "@workspace/db";

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS telnyx_demo_state (
    business_id text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  console.log("Telnyx demo storage is ready. No messages were sent.");
} finally { await pool.end(); }
