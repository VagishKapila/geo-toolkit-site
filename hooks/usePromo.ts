'use client';

import { useCallback, useState } from 'react';
import { validatePromoCode } from '@/lib/promo';

export function usePromo() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = useCallback(async () => {
    setVerifying(true);
    try {
      const result = await validatePromoCode(code, email);
      setMessage({
        type: result.ok ? 'success' : 'error',
        text: result.message,
      });
      setUnlocked(result.ok);
      return result.ok;
    } finally {
      setVerifying(false);
    }
  }, [code, email]);

  const reset = useCallback(() => {
    setUnlocked(false);
    setCode('');
    setEmail('');
    setMessage(null);
  }, []);

  return {
    unlocked,
    code,
    setCode,
    email,
    setEmail,
    message,
    verifying,
    verify,
    reset,
  };
}
