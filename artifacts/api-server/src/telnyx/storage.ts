import { createBlobStore } from "./blob-store";
import { postgresStore } from "./store";
import type { StateStore } from "./state";

const blobStore = createBlobStore();
export function storage(): StateStore {
  const selected = process.env.TELNYX_STORAGE_BACKEND || "postgres";
  if (selected === "blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Private Blob credentials are missing");
    return blobStore;
  }
  if (selected === "postgres") return postgresStore;
  throw new Error("Unsupported Telnyx storage backend");
}
