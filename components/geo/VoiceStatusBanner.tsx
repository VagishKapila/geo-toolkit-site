'use client';

interface Props {
  message: string;
}

export function VoiceStatusBanner({ message }: Props) {
  return (
    <div className="voiceStatusBanner" role="status" aria-live="polite">
      <span className="voiceStatusSpinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
