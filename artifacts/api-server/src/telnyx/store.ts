import type { DemoState, StateStore } from "./state";
import { emptyState } from "./state";

/** Lazy import keeps an unconfigured demo from taking down the existing website. */
export const postgresStore: StateStore = {
  async transaction<T>(businessId: string, change: (state: DemoState) => T): Promise<T> {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO telnyx_demo_state (business_id, state) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING",
        [businessId, JSON.stringify(emptyState())],
      );
      const result = await client.query("SELECT state FROM telnyx_demo_state WHERE business_id=$1 FOR UPDATE", [businessId]);
      const state = result.rows[0].state as DemoState;
      const value = change(state);
      // Keep the demo bounded; fail closed instead of dropping consent/opt-outs.
      if (Buffer.byteLength(JSON.stringify(state)) > 8_000_000) throw new Error("Demo storage needs archival");
      await client.query("UPDATE telnyx_demo_state SET state=$2::jsonb, updated_at=now() WHERE business_id=$1",
        [businessId, JSON.stringify(state)]);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  },
  async health() {
    try {
      const { pool } = await import("@workspace/db");
      await pool.query("SELECT business_id FROM telnyx_demo_state LIMIT 0");
      return true;
    } catch { return false; }
  },
};
