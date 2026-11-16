/**
 * EDIT THIS FILE to add a business. Copy the example in README.md.
 * IDs must stay stable: private lead records are stored under the business ID.
 * Never put passwords, API keys, or customer messages here.
 */
export type PhoneNumber = {
  id: string;
  name: string;
  number: string;
  profileId: string;
  recipient: string;
  helpContact: string;
  providerManagedHelp: boolean;
  flowId: string;
  outboundSmsApproved: boolean;
};

export const phoneNumbers: PhoneNumber[] = [
  {
    id: "tysm-demo",
    name: "Thank You So Much",
    number: "+18597158052",
    profileId: "4001a187-12aa-4fc5-88e5-54ec1d310c50",
    recipient: "admin@thankyousomuch.ai",
    helpContact: "admin@thankyousomuch.ai",
    providerManagedHelp: true,
    flowId: "tysm-get-started",
    // Number is assigned to campaign 4b3001a1-a4f0-f950-3e1d-07cba9b7024a (ASSIGNED).
    // Global Vercel switches must also be true for press-1 texts to send.
    outboundSmsApproved: true,
  },
];
