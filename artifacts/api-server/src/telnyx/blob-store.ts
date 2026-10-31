import { get, put, list, BlobPreconditionFailedError } from "@vercel/blob";
import { setTimeout as delay } from "node:timers/promises";
import { emptyState, type DemoState, type StateStore } from "./state";

export type Snapshot = { state: DemoState; etag: string };
export type BlobBackend = {
  read(path: string): Promise<Snapshot | null>;
  write(path: string, state: DemoState, etag?: string): Promise<void>;
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
    const result = await get(path, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(8000) });
    if (!result) return null;
    if (result.statusCode !== 200 || result.blob.size > 8_000_000) throw new Error("Invalid demo snapshot");
    const state = await new Response(result.stream).json() as DemoState;
    if (!state.calls || !state.consents || !state.messages || !state.jobs || !state.optOuts || !state.events) {
      throw new Error("Invalid demo state");
    }
    return { state, etag: result.blob.etag };
  },
  async write(path, state, etag) {
    try {
      await put(path, JSON.stringify(state), {
        access: "private", addRandomSuffix: false, contentType: "application/json",
        // Never use an unconditional overwrite: this is a cross-instance CAS lock.
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
        abortSignal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError
        || (!etag && error instanceof Error && /already exists/i.test(error.message))) {
        throw new StateConflict();
      }
      // An ambiguous write may have committed. Do not automatically replay it.
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

export function createBlobStore(io: BlobBackend = backend): StateStore {
  return {
    async transaction<T>(businessId: string, change: (state: DemoState) => T): Promise<T> {
      if (!/^[a-z0-9-]{1,60}$/.test(businessId)) throw new Error("Invalid business ID");
      const path = `${prefix()}${businessId}.json`;
      for (let attempt = 0; attempt < 12; attempt++) {
        const snapshot = await io.read(path);
        const state = snapshot?.state || emptyState();
        const value = change(state); // Must be synchronous and free of external side effects.
        if (Buffer.byteLength(JSON.stringify(state)) > 8_000_000) throw new Error("Demo storage needs archival");
        try {
          await io.write(path, state, snapshot?.etag);
          return value;
        } catch (error) {
          if (!(error instanceof StateConflict)) throw error;
          await delay(Math.min(20 * (attempt + 1), 150));
        }
      }
      throw new Error("Demo storage busy; webhook must retry");
    },
    health: () => io.health(),
  };
}
