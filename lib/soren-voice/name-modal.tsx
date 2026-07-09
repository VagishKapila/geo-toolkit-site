'use client';

import { useState, useEffect, useRef } from 'react';

interface NameModalProps {
  onSubmit: (name: string) => void;
}

export function NameModal({ onSubmit }: NameModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const name = value.trim();
    if (name.length > 0) onSubmit(name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,8,20,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="flex flex-col items-center gap-6 p-10 rounded-2xl"
        style={{
          background: 'rgba(10,14,26,0.98)',
          border: '1px solid rgba(27,243,165,0.18)',
          boxShadow: '0 0 60px rgba(27,243,165,0.08)',
          maxWidth: 400,
          width: '90%',
        }}
      >
        <div className="font-mono text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(27,243,165,0.5)' }}>
          SOREN — FIRST RUN
        </div>
        <h2
          className="font-display text-xl font-bold text-center"
          style={{ color: '#fff', letterSpacing: '0.05em' }}
        >
          What should I call you?
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Your name"
          maxLength={64}
          className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(27,243,165,0.25)',
            color: '#fff',
            caretColor: '#1bf3a5',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={value.trim().length === 0}
          className="w-full py-3 rounded-full font-display text-sm font-bold tracking-widest uppercase transition-all duration-200 hover:brightness-125 active:scale-95 disabled:opacity-30"
          style={{ background: '#1bf3a5', color: '#000d1a' }}
        >
          Continue \u2192
        </button>
      </div>
    </div>
  );
}
