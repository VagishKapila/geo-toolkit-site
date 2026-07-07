'use client';

import { useState } from 'react';

const sorenGradient = 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)';

interface EmailGateProps {
  onSubmit: (email: string) => void;
  isLoading?: boolean;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function EmailGate({ onSubmit, isLoading }: EmailGateProps): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <div
      className="w-full max-w-md mx-auto rounded-2xl border border-purple-500/30 p-5"
      style={{ background: '#0F0520' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{
            background: sorenGradient,
            boxShadow: '0 0 12px rgba(168,85,247,0.45)',
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          S
        </div>
        <p
          className="text-sm leading-snug"
          style={{ color: '#F0E8FF', fontFamily: "'Inter',sans-serif" }}
        >
          What email should I send your fix to?
        </p>
      </div>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
        className="w-full rounded-lg px-3 py-2.5 text-sm mb-2 outline-none focus:ring-2 focus:ring-purple-500/50"
        style={{
          background: '#160830',
          border: '1px solid #2A1545',
          color: '#F0E8FF',
          fontFamily: "'Inter',sans-serif",
        }}
      />

      {error && (
        <p className="text-xs mb-2" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{
          background: sorenGradient,
          fontFamily: "'Space Grotesk',sans-serif",
        }}
      >
        {isLoading ? 'Please wait…' : 'Continue →'}
      </button>

      <p
        className="text-xs text-center mt-3"
        style={{ color: '#8B6DB8', fontFamily: "'Inter',sans-serif" }}
      >
        We&apos;ll use this to track your credits.
      </p>
    </div>
  );
}
