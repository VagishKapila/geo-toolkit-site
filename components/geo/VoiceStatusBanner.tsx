'use client';

interface Props {
  message: string;
  failed?: boolean;
  onRetry?: () => void;
}

export function VoiceStatusBanner({ message, failed = false, onRetry }: Props) {
  const className = failed
    ? 'voiceStatusBanner voiceStatusBanner--failed'
    : 'voiceStatusBanner';

  if (failed && onRetry) {
    return (
      <button
        type="button"
        className={className}
        role="status"
        aria-live="polite"
        onClick={onRetry}
      >
        <span>{message}</span>
      </button>
    );
  }

  return (
    <div className={className} role="status" aria-live="polite">
      {!failed && <span className="voiceStatusSpinner" aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}
