export type ServiceProduct = {
  id: string;
  number: string;
  name: string;
  description: string;
  monthlyPrice: number;
  setupPrice: number;
  icon: "phone" | "reply" | "quote" | "reception";
};

export const PRODUCTS = [
  {
    id: "missed-call-rescue",
    number: "01",
    name: "Missed Call Rescue",
    description: "Text back customers when you can't answer.",
    monthlyPrice: 199,
    setupPrice: 199,
    icon: "phone",
  },
  {
    id: "instant-lead-reply",
    number: "02",
    name: "Instant Lead Reply",
    description: "Respond to new inquiries while you're busy.",
    monthlyPrice: 249,
    setupPrice: 299,
    icon: "reply",
  },
  {
    id: "quote-follow-up",
    number: "03",
    name: "Quote Follow-Up",
    description: "Turn unanswered estimates into new conversations.",
    monthlyPrice: 299,
    setupPrice: 299,
    icon: "quote",
  },
  {
    id: "ai-receptionist",
    number: "04",
    name: "24/7 AI Receptionist",
    description: "Answer calls, collect details, and book appointments.",
    monthlyPrice: 449,
    setupPrice: 499,
    icon: "reception",
  },
] as const satisfies readonly ServiceProduct[];

export type ProductId = (typeof PRODUCTS)[number]["id"] | "custom-ai-integration";

export const CUSTOM_PRODUCT = {
  id: "custom-ai-integration",
  name: "Custom AI Integration",
} as const;

export function getProduct(id: ProductId) {
  if (id === CUSTOM_PRODUCT.id) return CUSTOM_PRODUCT;
  return PRODUCTS.find((product) => product.id === id);
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
