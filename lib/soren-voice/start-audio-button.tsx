'use client';

/**
 * StartAudioButton
 *
 * Renders an "Enable Audio" button when browser audio playback is blocked.
 * Uses the livekit useStartAudio hook — the button is hidden once audio is
 * permitted (canPlayAudio = true).
 */

import { useStartAudio } from '@livekit/components-react';

interface StartAudioButtonProps {
  label?: string;
}

export function StartAudioButton({ label = 'Enable Audio' }: StartAudioButtonProps) {
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });

  if (canPlayAudio) return null;

  return (
    <button
      {...mergedProps}
      className="geo-hud-audio-unlock"
      type="button"
    >
      {label}
    </button>
  );
}
