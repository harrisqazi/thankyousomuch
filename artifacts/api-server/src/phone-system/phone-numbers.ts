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
    // Change only AFTER this business's carrier approval and keyword checks.
    // Global sending switches must also be enabled separately.
    outboundSmsApproved: false,
  },
];
