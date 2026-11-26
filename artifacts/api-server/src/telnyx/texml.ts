const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** Amazon Polly neural; Telnyx TeXML documents Polly.VoiceId-Neural. Override with TELNYX_TEXML_VOICE. */
export const defaultTexmlVoice = "Polly.Joanna-Neural";

export function texmlVoice(env = process.env): string {
  const value = env.TELNYX_TEXML_VOICE?.trim();
  if (value && /^[\w.+-]{3,80}$/.test(value)) return value;
  return defaultTexmlVoice;
}

export function texmlLanguage(env = process.env): string {
  const value = env.TELNYX_TEXML_LANGUAGE?.trim();
  return value && /^[a-z]{2}-[A-Z]{2}$/.test(value) ? value : "en-US";
}

export function texmlBaseUrl(env = process.env): string {
  const value = (env.TELNYX_TEXML_BASE_URL || "https://www.thankyousomuch.ai").trim().replace(/\/$/, "");
  return /^https:\/\/[a-z0-9.-]+$/i.test(value) ? value : "https://www.thankyousomuch.ai";
}

export function greetingPlayUrl(env = process.env): string | undefined {
  const value = env.TYSM_VOICE_GREETING_URL?.trim();
  if (!value || value.length > 400) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function sayXml(text: string, env = process.env): string {
  return `<Say voice="${escape(texmlVoice(env))}" language="${escape(texmlLanguage(env))}">${escape(text)}</Say>`;
}

export function sayAndHangupXml(text: string, env = process.env): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${sayXml(text, env)}<Hangup/></Response>`;
}

export function openingPrompt(disclosure: string, env = process.env): string {
  const play = greetingPlayUrl(env);
  return play ? `<Play>${escape(play)}</Play>` : sayXml(disclosure, env);
}

export function continueJobs(work: Promise<unknown>) {
  void import("@vercel/functions").then(mod => {
    try { if (typeof mod.waitUntil === "function") mod.waitUntil(work); } catch { /* no request context */ }
  }).catch(() => undefined);
  void work;
}
