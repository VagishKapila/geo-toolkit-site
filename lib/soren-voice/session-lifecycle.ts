import {
  ConnectionState,
  Room,
  TokenSource,
  decodeTokenPayload,
  type TokenSourceResponseObject,
} from 'livekit-client';
import { mintVoiceToken } from './mint-voice-token';
import { PERSONA, PRODUCT_ID, TOKEN_URL, USER_NAME_KEY } from './constants';

let sharedRoom: Room | null = null;
let sharedTokenSource: ReturnType<typeof TokenSource.custom> | null = null;

let cachedToken: TokenSourceResponseObject | null = null;
let tokenFetchInFlight: Promise<TokenSourceResponseObject> | null = null;

let fetchGate: Promise<void> | null = null;
let openFetchGate: (() => void) | null = null;
let tokenArmed = false;

let connectInFlight = false;

let voiceLogFn: ((line: string) => void) | null = null;

export function setVoiceSessionLog(fn: ((line: string) => void) | null): void {
  voiceLogFn = fn;
}

export function voiceSessionLog(line: string): void {
  voiceLogFn?.(line);
}

function ensureFetchGate(): Promise<void> {
  if (!fetchGate) {
    fetchGate = new Promise<void>((resolve) => {
      openFetchGate = resolve;
    });
  }
  return fetchGate;
}

async function waitUntilArmed(): Promise<void> {
  if (tokenArmed) return;
  await ensureFetchGate();
}

function tokenRoomName(token: string): string {
  try {
    const payload = decodeTokenPayload(token);
    return payload.video?.room ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Unblocks token HTTP — must run synchronously on user click before session.start(). */
export function armTokenFetch(): void {
  console.log('[voice] armed');
  tokenArmed = true;
  if (openFetchGate) {
    openFetchGate();
    openFetchGate = null;
  } else {
    fetchGate = Promise.resolve();
  }
}

export function resetFetchGate(): void {
  fetchGate = null;
  openFetchGate = null;
}

export function clearSessionTokenCache(): void {
  cachedToken = null;
  tokenFetchInFlight = null;
}

export function resetForNewSession(): void {
  clearSessionTokenCache();
  tokenArmed = false;
  resetFetchGate();
}

async function fetchSessionToken(): Promise<TokenSourceResponseObject> {
  if (cachedToken) {
    console.log('[voice] token cache hit');
    return cachedToken;
  }
  if (tokenFetchInFlight) return tokenFetchInFlight;

  tokenFetchInFlight = (async () => {
    if (!tokenArmed) {
      await waitUntilArmed();
    }
    if (!tokenArmed) {
      console.error('[voice] token fetch while unarmed');
      armTokenFetch();
    }

    const userVoiceToken = await mintVoiceToken();
    const storedName = localStorage.getItem(USER_NAME_KEY);

    const body: Record<string, unknown> = {
      persona: PERSONA,
      productId: PRODUCT_ID,
    };
    if (userVoiceToken) body.userVoiceToken = userVoiceToken;
    if (storedName) body.userName = storedName;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Token fetch failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    if (json.error) throw new Error(`Token error: ${json.message}`);

    const result: TokenSourceResponseObject = {
      serverUrl: json.data.liveKitUrl,
      participantToken: json.data.token,
    };
    cachedToken = result;
    console.log(`[voice] token fetched room=${tokenRoomName(result.participantToken)}`);
    return result;
  })().finally(() => {
    tokenFetchInFlight = null;
  });

  return tokenFetchInFlight;
}

export function getSharedTokenSource() {
  if (!sharedTokenSource) {
    sharedTokenSource = TokenSource.custom(async () => fetchSessionToken());
  }
  return sharedTokenSource;
}

export function getSharedRoom(): Room {
  if (!sharedRoom) {
    sharedRoom = new Room({
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }
  return sharedRoom;
}

export function isRoomSessionLive(room: Room): boolean {
  const { state } = room;
  return (
    state === ConnectionState.Connecting
    || state === ConnectionState.Connected
    || state === ConnectionState.Reconnecting
    || state === ConnectionState.SignalReconnecting
  );
}

export function tryAcquireConnect(): boolean {
  if (connectInFlight) return false;
  connectInFlight = true;
  return true;
}

export function releaseConnect(): void {
  connectInFlight = false;
}

export async function teardownSession(room: Room): Promise<void> {
  resetForNewSession();
  releaseConnect();
  if (room.state !== ConnectionState.Disconnected) {
    await room.disconnect();
  }
}
