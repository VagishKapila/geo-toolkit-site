'use client';

import GeoHud from '@/components/GeoHud';
import { SorenVoiceProvider } from '@/lib/soren-voice/soren-voice-provider';

export default function Page() {
  return (
    <SorenVoiceProvider>
      <GeoHud />
    </SorenVoiceProvider>
  );
}
