'use client';
import { useState, useCallback } from 'react';

const API =
  'https://toolkit-demo-host-production-ac14.up.railway.app';

export interface CreditsState {
  email: string | null;
  balance: number;
  isLoading: boolean;
  error: string | null;
}

export function useCredits() {
  const [email, setEmailState] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('soren_email');
    },
  );
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveEmail = useCallback((e: string) => {
    setEmailState(e);
    localStorage.setItem('soren_email', e);
  }, []);

  const fetchBalance = useCallback(async (
    userEmail: string,
  ) => {
    try {
      const res = await fetch(
        `${API}/api/credits/balance?email=${encodeURIComponent(userEmail)}`,
      );
      const data = await res.json();
      setBalance(data.balance ?? 0);
      return data.balance ?? 0;
    } catch {
      return 0;
    }
  }, []);

  const startCheckout = useCallback(async (
    userEmail: string,
    credits: 5 | 25 | 100,
    siteUrl: string,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const successUrl =
        `${window.location.origin}?credits_success=true` +
        `&email=${encodeURIComponent(userEmail)}`;
      const cancelUrl = window.location.href;

      const res = await fetch(
        `${API}/api/credits/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            credits,
            siteUrl,
            successUrl,
            cancelUrl,
          }),
        },
      );
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError('Could not start checkout. Try again.');
      }
    } catch {
      setError('Checkout failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deductCredits = useCallback(async (
    userEmail: string,
    amount: number,
    description: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(
        `${API}/api/credits/deduct`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            amount,
            description,
          }),
        },
      );
      if (res.status === 402) {
        return false;
      }
      const data = await res.json();
      setBalance(data.balance ?? 0);
      return data.success === true;
    } catch {
      return false;
    }
  }, []);

  return {
    email,
    balance,
    isLoading,
    error,
    saveEmail,
    fetchBalance,
    startCheckout,
    deductCredits,
  };
}
