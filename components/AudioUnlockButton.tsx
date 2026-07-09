'use client';

import { useStartAudio } from '@livekit/components-react';

export function AudioUnlockButton() {
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });
  if (canPlayAudio) return null;
  return (
    <button
      type="button"
      {...mergedProps}
      className="geo-hud-audio-unlock"
    >
      🔊 Tap to enable audio
    </button>
  );
}
