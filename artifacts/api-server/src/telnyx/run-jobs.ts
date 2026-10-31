import { businesses } from "./config";
import { storage } from "./storage";
import { processJobs, sendSms } from "./worker";
import { notify } from "./runtime";

try {
  for (const business of businesses()) {
    await processJobs(storage(), business, { sendSms, notify });
    const counts = await storage().transaction(business.id, state => {
      const result: Record<string, number> = {};
      for (const job of Object.values(state.jobs)) {
        const key = `${job.kind}:${job.status}`;
        result[key] = (result[key] || 0) + 1;
      }
      return result;
    });
    console.log(JSON.stringify({ businessId: business.id, counts }));
  }
  console.log("Processing/uncertain jobs require provider reconciliation; they were NOT retried.");
} finally {
  if ((process.env.TELNYX_STORAGE_BACKEND || "postgres") === "postgres") {
    const { pool } = await import("@workspace/db");
    await pool.end();
  }
}
