'use client';

import { useCallback, useState } from 'react';

export function useHudLog() {
  const [lines, setLines] = useState<string[]>([
    'Ready. Type a website or talk to Soren.',
  ]);

  const append = useCallback((msg: string) => {
    setLines((prev) => [...prev, msg]);
  }, []);

  return { lines, append };
}
