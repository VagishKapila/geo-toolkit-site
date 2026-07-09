'use client';

import {
  SessionProvider,
  RoomAudioRenderer,
  useSession,
} from '@livekit/components-react';
import { Room, TokenSource } from 'livekit-client';
import GeoHud from '@/components/GeoHud';

const tokenSource = TokenSource.custom(async () => {
  const res = await fetch(
    'https://varshyl-voice-engine-production.up.railway.app/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'soren-fixes-it', persona: 'soren' }),
    },
  );
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
  const json = await res.json();
  return {
    serverUrl: json.data.liveKitUrl,
    participantToken: json.data.token,
  };
});

const room = new Room({
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
});

export default function Page() {
  const session = useSession(tokenSource, { room });
  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer />
      <GeoHud session={session} room={room} />
    </SessionProvider>
  );
}
