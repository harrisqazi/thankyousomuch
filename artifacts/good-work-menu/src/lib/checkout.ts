import { useEffect, useState } from 'react';

export type CheckoutConfig = {
  enabled: boolean;
  prices: { serviceId: string; monthlyCents: number; setupCents: number }[];
};

export type CheckoutRequest = {
  serviceId: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

export type CheckoutResult = {
  accepted: true;
  referenceId: string;
  checkoutUrl: string | null;
  reason?: 'unavailable' | 'error';
};

export function useCheckoutConfig(active: boolean) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  useEffect(() => {
    if (!active || config) return;
    let cancelled = false;
    fetch('/api/checkout-config', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CheckoutConfig | null) => {
        if (!cancelled) setConfig(data ?? { enabled: false, prices: [] });
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false, prices: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [active, config]);
  return config;
}

export async function startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<CheckoutResult> & { error?: string };
  if (!response.ok || !data.accepted) {
    throw new Error(data.error || 'Something interrupted the request. Please try again.');
  }
  return data as CheckoutResult;
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
