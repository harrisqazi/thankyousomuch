import { createHash, randomUUID } from "node:crypto";
import type { VoiceFlow } from "../phone-system/text-to-speech";

export const key = (text: string) => createHash("sha256").update(text).digest("hex");
export type Consent = {
  caller: string; called: string; callId: string; consentedAt: string;
  disclosure: string; disclosureVersion: string; revokedAt?: string;
  flowId?: string; key?: string; action?: "consent-and-text" | "inbound-inquiry";
};
export type Job = {
  id: string; kind: "sms" | "email"; caller: string; text: string;
  status: "pending" | "processing" | "accepted" | "failed" | "uncertain" | "dry_run" | "suppressed";
  createdAt: string; claimedAt?: string; finishedAt?: string; providerId?: string; error?: string;
  lead?: LeadDetails;
};
export type LeadDetails = {
  originatingNumber: string;
  customerName?: string;
  businessName?: string;
  preferredCallbackNumber?: string;
};
export type DemoState = {
  leads?: Record<string, LeadDetails>;
  calls: Record<string, {
    caller: string; called: string; callId: string; at: string; disclosure: string;
    flowId?: string; flow?: VoiceFlow; disclosureVersion?: string;
    consentPreamble?: string; greeting?: string;
  }>;
  consents: Record<string, Consent>;
  optOuts: Record<string, string>;
  events: Record<string, string>;
  messages: Record<string, {
    direction: "inbound" | "outbound"; caller: string; text: string;
    at: string; status: string; finalized?: boolean; errors?: string[]; helpResponse?: string;
  }>;
  jobs: Record<string, Job>;
};
export const emptyState = (): DemoState => ({
  calls: {}, consents: {}, optOuts: {}, events: {}, messages: {}, jobs: {},
});
export interface StateStore {
  transaction<T>(businessId: string, change: (state: DemoState) => T): Promise<T>;
  health(): Promise<boolean>;
}
export function enqueue(state: DemoState, kind: Job["kind"], caller: string, text: string, at: string, id: string = randomUUID()) {
  state.jobs[id] = { id, kind, caller, text, status: "pending", createdAt: at };
  return id;
}
