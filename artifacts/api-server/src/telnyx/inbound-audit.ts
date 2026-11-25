import { get, put, BlobPreconditionFailedError } from "@vercel/blob";

export type InboundAudit = {
  at: string;
  eventType?: string;
  from?: string;
  to?: string;
  textPrefix?: string;
  bodyKind: string;
  signatureOk: boolean;
  signatureReason: string;
  greetingMatched?: boolean;
  jobQueued?: boolean;
  sendStatus?: string;
  sendError?: string;
  httpStatus?: number;
};

const maxEntries = 20;

export function maskPhone(value: unknown): string | undefined {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return `***${digits.slice(-4)}`;
}

export function textPrefix(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, 32);
}

function namespace() {
  const env = process.env.VERCEL_ENV;
  return env === "production" || env === "preview" ? env : "development";
}
const auditPath = () => `telnyx-demo/v1/${namespace()}/inbound-audit.json`;

export async function appendInboundAudit(entry: InboundAudit): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const path = auditPath();
  for (let attempt = 0; attempt < 8; attempt++) {
    let etag: string | undefined;
    let entries: InboundAudit[] = [];
    const existing = await get(path, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(8000) });
    if (existing?.statusCode === 200) {
      etag = existing.blob.etag;
      try {
        const parsed = await new Response(existing.stream).json() as { entries?: InboundAudit[] };
        entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      } catch {
        entries = [];
      }
    }
    const next = { entries: [entry, ...entries].slice(0, maxEntries) };
    try {
      await put(path, JSON.stringify(next), {
        access: "private", addRandomSuffix: false, contentType: "application/json",
        // Audit is observational. Prefer recording a 503 over losing it to CAS.
        ...(attempt < 6 && etag ? { ifMatch: etag } : { allowOverwrite: true }),
        abortSignal: AbortSignal.timeout(8000),
      });
      return;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError
        || (!etag && error instanceof Error && /already exists/i.test(error.message))) {
        continue;
      }
      if (attempt === 7) return;
    }
  }
}

export async function listInboundAudit(): Promise<InboundAudit[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const existing = await get(auditPath(), { access: "private", useCache: false, abortSignal: AbortSignal.timeout(8000) });
  if (!existing || existing.statusCode !== 200) return [];
  try {
    const parsed = await new Response(existing.stream).json() as { entries?: InboundAudit[] };
    return Array.isArray(parsed.entries) ? parsed.entries.slice(0, maxEntries) : [];
  } catch {
    return [];
  }
}
