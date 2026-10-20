import type { Transporter, SendMailOptions, SentMessageInfo } from "nodemailer";

export type SentCopyResult = {
  status: "saved" | "already_present" | "failed";
  folder?: string;
  uid?: number | null;
};
export type SentArchive = {
  append(copy: { raw: Buffer; messageId: string; date?: Date }): Promise<SentCopyResult>;
  close(): Promise<void>;
};
export function composeMail(mail: SendMailOptions): Promise<{ raw: Buffer; messageId: string }>;
export function createSentArchive(options?: { user?: string; password?: string }): SentArchive;
export function sendMailAndArchive(
  transport: Transporter,
  mail: SendMailOptions,
  options: { archive: SentArchive; onArchiveError?: () => void },
): Promise<SentMessageInfo & { sentCopy?: SentCopyResult }>;
