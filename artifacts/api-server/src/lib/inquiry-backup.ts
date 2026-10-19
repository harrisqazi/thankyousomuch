import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { put } from "@vercel/blob";
import type { InquiryEmail } from "./inquiry-email";

export const inquiryRecipient = () =>
  process.env.INQUIRY_TO_EMAIL?.trim() || "admin@thankyousomuch.ai";

export type InquiryBackup = InquiryEmail & {
  schemaVersion: 1;
  id: string;
  submittedAt: string;
  serviceId: string;
  emailNotification: {
    status: "pending" | "accepted" | "failed";
    to: string;
    updatedAt: string;
  };
};

export function createInquiryBackup(
  inquiry: InquiryEmail,
  serviceId: string,
): InquiryBackup {
  const submittedAt = new Date().toISOString();
  return {
    ...inquiry,
    schemaVersion: 1,
    id: randomUUID(),
    submittedAt,
    serviceId,
    emailNotification: {
      status: "pending",
      to: inquiryRecipient(),
      updatedAt: submittedAt,
    },
  };
}

export async function saveInquiryBackup(
  inquiry: InquiryBackup,
  overwrite = false,
): Promise<void> {
  const pathname = `inquiries/${inquiry.submittedAt.slice(0, 10)}/${inquiry.id}.json`;
  // Local previews use private workspace files. Production must always use
  // durable remote storage; never fall back to Vercel's temporary filesystem.
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    const directory = resolve(".local", "inquiries", inquiry.submittedAt.slice(0, 10));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, `${inquiry.id}.json`), JSON.stringify(inquiry, null, 2), {
      mode: 0o600,
      flag: overwrite ? "w" : "wx",
    });
    return;
  }
  await put(pathname, JSON.stringify(inquiry, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    cacheControlMaxAge: 60,
  });
}
