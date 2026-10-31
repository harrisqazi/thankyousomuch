import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Each business is an independently locked aggregate for this bounded demo.
// Row locking serializes consent, opt-out, deduplication, and rate reservations.
export const telnyxDemoState = pgTable("telnyx_demo_state", {
  businessId: text("business_id").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
