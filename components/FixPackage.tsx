'use client';

import { useCallback } from 'react';
import type { FixPackage as FixPackageType } from '../hooks/useSorenChat';

const C = {
  surface: '#0F0520',
  raised: '#160830',
  border: '#2A1545',
  white: '#F0E8FF',
  gray: '#8B6DB8',
  text: '#D4B8F0',
  purple: '#a855f7',
  indigo: '#6366f1',
  pink: '#ec4899',
};

interface FixPackageProps {
  pkg: FixPackageType;
  onClose: () => void;
  onApplyFix: () => Promise<void>;
  isApplying: boolean;
  applyError: string | null;
  creditsBalance: number;
  downloadsUnlocked: boolean;
}

function SmallSorenOrb(): JSX.Element {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: "'Space Grotesk',sans-serif",
        fontWeight: 700,
        fontSize: 14,
        boxShadow: '0 0 12px rgba(168,85,247,0.45)',
      }}
    >
      S
    </div>
  );
}

export function FixPackage({
  pkg,
  onClose,
  onApplyFix,
  isApplying,
  applyError,
  creditsBalance,
  downloadsUnlocked,
}: FixPackageProps): JSX.Element {
  const downloadFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, []);

  return (
    <div
      style={{
        background: C.surface,
        border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: 16,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${C.indigo}, ${C.purple}, ${C.pink})`,
        }}
      />

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'transparent',
          border: 'none',
          color: C.gray,
          fontSize: 18,
          cursor: 'pointer',
          lineHeight: 1,
        }}
        aria-label="Close fix package"
      >
        ×
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <SmallSorenOrb />
        <div>
          <div
            style={{
              color: C.white,
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Fix Package Ready
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 5,
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.45)',
              borderRadius: 999,
              padding: '3px 10px',
              color: '#c7c9ff',
              fontSize: 11,
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            {pkg.platform}
          </div>
        </div>
      </div>

      <p
        style={{
          color: C.gray,
          fontFamily: "'Inter',sans-serif",
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        {pkg.summary}
      </p>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: C.white,
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Files to download
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {pkg.files.map((file) => (
            <div
              key={file.filename}
              style={{
                background: C.raised,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    color: C.text,
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  {file.filename}
                </div>
                <div
                  style={{
                    color: C.gray,
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {file.description}
                </div>
              </div>
              <button
                onClick={() => downloadFile(file.filename, file.content)}
                disabled={!downloadsUnlocked}
                style={{
                  alignSelf: 'flex-start',
                  background: downloadsUnlocked ? 'rgba(168,85,247,0.2)' : 'rgba(42,21,69,0.5)',
                  border: `1px solid ${downloadsUnlocked ? 'rgba(168,85,247,0.4)' : 'rgba(42,21,69,0.8)'}`,
                  color: downloadsUnlocked ? '#e9d7ff' : '#6B5B8A',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: downloadsUnlocked ? 'pointer' : 'not-allowed',
                }}
              >
                {downloadsUnlocked ? 'Download' : 'Apply fix to unlock'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: C.white,
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Step-by-step instructions
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {pkg.instructions.map((step, index) => (
            <div key={`${step.title}-${index}`} style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(168,85,247,0.25)',
                  border: '1px solid rgba(168,85,247,0.5)',
                  color: '#ecd9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono',monospace",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {index + 1}
              </div>
              <div>
                <div
                  style={{
                    color: C.white,
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    color: C.gray,
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 10,
          padding: 12,
          display: 'flex',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <SmallSorenOrb />
        <p
          style={{
            margin: 0,
            color: C.gray,
            fontFamily: "'Inter',sans-serif",
            fontSize: 13,
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}
        >
          {pkg.sorenSays}
        </p>
      </div>

      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {creditsBalance > 0 ? (
          <div
            style={{
              color: '#4ADE80',
              fontFamily: "'Inter',sans-serif",
              fontSize: 12,
            }}
          >
            Your balance: {creditsBalance} credits
          </div>
        ) : (
          <div
            style={{
              color: C.gray,
              fontFamily: "'Inter',sans-serif",
              fontSize: 12,
            }}
          >
            Your first fix: $1
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => void onApplyFix()}
            disabled={isApplying}
            style={{
              background: creditsBalance >= 5
                ? `linear-gradient(135deg, ${C.indigo}, ${C.purple}, ${C.pink})`
                : C.indigo,
              border: 'none',
              color: '#fff',
              borderRadius: 9,
              padding: '9px 14px',
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: isApplying ? 'wait' : 'pointer',
              opacity: isApplying ? 0.8 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isApplying && (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
            {isApplying
              ? 'Applying...'
              : creditsBalance >= 5
                ? 'Apply Fix — 5 Credits'
                : 'Buy 5 Credits — $1'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.gray,
              borderRadius: 9,
              padding: '9px 14px',
              fontFamily: "'Inter',sans-serif",
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            I&apos;ll do it myself
          </button>
        </div>
        {applyError && (
          <div
            style={{
              color: '#F87171',
              fontFamily: "'Inter',sans-serif",
              fontSize: 12,
            }}
          >
            {applyError}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
