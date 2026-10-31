/**
 * EDIT THIS FILE for spoken words, voice, and keypad actions.
 * A number selects a flow by its flowId in phone-numbers.ts.
 * {businessName}, {helpContact}, and {consentKey} are filled in automatically.
 */
export type KeypadOption =
  | { action: "consent-and-text" }
  | { action: "say-and-hang-up"; message: string };

export type VoiceFlow = {
  version: string;
  voice: "man" | "woman";
  language: "en-US";
  voiceSpeed: number;
  greeting: string;
  options: Record<string, KeypadOption>;
  introText: string;
  noInputMessage: string;
  invalidOptionMessage: string;
  consentSavedMessage: string;
  optedOutMessage: string;
};

export const voiceFlows: Record<string, VoiceFlow> = {
  "tysm-get-started": {
    version: "2",
    voice: "woman",
    language: "en-US",
    voiceSpeed: 1,
    greeting: 'Ready to turn missed calls into new customers? Press {consentKey} to take the first step toward setting up automatic responses for your business and have your customers saying "Thank you so much".',
    options: {
      "1": { action: "consent-and-text" },
    },
    introText: "{businessName}: We've saved your number and will call during regular business hours. What's your name and business? We look forward to helping your business grow.",
    noInputMessage: "No text-message consent was recorded. Thank you for calling.",
    invalidOptionMessage: "That option was not selected. No text-message consent was recorded. Please call again.",
    consentSavedMessage: "Your text-message consent has been saved. Our team will follow up when messaging is available. Thank you for calling.",
    optedOutMessage: "Your choice was saved, but texts remain stopped. Text START to this number to opt back in.",
  },
  // Reuse this flow for a business's own incoming inquiries, or copy it and
  // assign your new flow ID to that business in phone-numbers.ts.
  "business-inquiry": {
    version: "1",
    voice: "woman",
    language: "en-US",
    voiceSpeed: 1,
    greeting: "Thanks for calling {businessName}. Press {consentKey} to receive a text about your inquiry so our team can help.",
    options: {
      "1": { action: "consent-and-text" },
    },
    introText: "{businessName}: Thanks for calling! How can we help with your inquiry?",
    noInputMessage: "No text-message consent was recorded. Thank you for calling.",
    invalidOptionMessage: "That option was not selected. No text-message consent was recorded. Please call again.",
    consentSavedMessage: "Your text-message consent has been saved. Our team will follow up when messaging is available. Thank you for calling.",
    optedOutMessage: "Your choice was saved, but texts remain stopped. Text START to this number to opt back in.",
  },
};
