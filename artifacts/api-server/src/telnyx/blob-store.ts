import { get, put, list, BlobPreconditionFailedError } from "@vercel/blob";
import { setTimeout as delay } from "node:timers/promises";
import { emptyState, normalizeDemoState, type DemoState, type StateStore } from "./state";

export function mergeDemoState(base: DemoState, overlay: DemoState): DemoState {
  return {
    calls: { ...base.calls, ...overlay.calls },
    consents: { ...base.consents, ...overlay.consents },
    optOuts: { ...base.optOuts, ...overlay.optOuts },
    events: { ...base.events, ...overlay.events },
    messages: { ...base.messages, ...overlay.messages },
    jobs: { ...base.jobs, ...overlay.jobs },
    leads: { ...base.leads, ...overlay.leads },
  };
}

export type Snapshot = { state: DemoState; etag?: string };
export type BlobBackend = {
  read(path: string): Promise<Snapshot | null>;
  write(path: string, state: DemoState, etag?: string, overwrite?: boolean): Promise<void>;
  health(): Promise<boolean>;
};
export class StateConflict extends Error {}
const prefix = () => {
  const env = process.env.VERCEL_ENV;
  const namespace = env === "production" || env === "preview" ? env : "development";
  return `telnyx-demo/v1/${namespace}/`;
};

const backend: BlobBackend = {
  async read(path) {
    try {
      const result = await get(path, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(8000) });
      if (!result) return null;
      const etag = result.blob?.etag;
      if (result.statusCode !== 200 || result.blob.size > 8_000_000) {
        return { state: emptyState(), etag };
      }
      let parsed: unknown;
      try {
        parsed = await new Response(result.stream).json();
      } catch {
        parsed = emptyState();
      }
      return { state: normalizeDemoState(parsed), etag };
    } catch {
      return null;
    }
  },
  async write(path, state, etag, overwrite = false) {
    try {
      await put(path, JSON.stringify(state), {
        access: "private", addRandomSuffix: false, contentType: "application/json",
        ...(overwrite ? { allowOverwrite: true } : etag ? { ifMatch: etag } : { allowOverwrite: false }),
        abortSignal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      if (!overwrite && (error instanceof BlobPreconditionFailedError
        || (!etag && error instanceof Error && /already exists/i.test(error.message)))) {
        throw new StateConflict();
      }
      if (overwrite) throw error;
      throw error;
    }
  },
  async health() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
    try {
      await list({ prefix: prefix(), limit: 1, abortSignal: AbortSignal.timeout(5000) });
      return true;
    } catch { return false; }
  },
};

function fingerprint(state: DemoState) {
  return JSON.stringify(state);
}

export function createBlobStore(io: BlobBackend = backend): StateStore {
  return {
    async transaction<T>(businessId: string, change: (state: DemoState) => T): Promise<T> {
      if (!/^[a-z0-9-]{1,60}$/.test(businessId)) throw new Error("Invalid business ID");
      const path = `${prefix()}${businessId}.json`;
      const run = (snapshot: Snapshot | null) => {
        const state = normalizeDemoState(snapshot?.state || emptyState());
        const before = fingerprint(state);
        const value = change(state);
        if (Buffer.byteLength(JSON.stringify(state)) > 8_000_000) throw new Error("Demo storage needs archival");
        return { state, value, unchanged: fingerprint(state) === before };
      };
      const read = async () => {
        try { return await io.read(path); } catch { return null; }
      };
      for (let attempt = 0; attempt < 8; attempt++) {
        const snapshot = await read();
        const next = run(snapshot);
        if (next.unchanged) return next.value;
        try {
          await io.write(path, next.state, snapshot?.etag, false);
          return next.value;
        } catch (error) {
          if (!(error instanceof StateConflict)) throw error;
          await delay(Math.min(20 * (attempt + 1), 80));
        }
      }
      const snapshot = await read();
      const next = run(snapshot);
      if (next.unchanged) return next.value;
      const latest = await read();
      const merged = mergeDemoState(normalizeDemoState(latest?.state || emptyState()), next.state);
      await io.write(path, merged, latest?.etag, true);
      return next.value;
    },
    health: () => io.health(),
  };
}
