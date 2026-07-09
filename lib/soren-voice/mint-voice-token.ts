import {
  CONSTRUCTINV_TOKEN_KEY,
  MINT_URL,
} from './constants';

/**
 * Attempts to mint a per-user voice token from ConstructInv.
 * Returns the voiceToken string if successful, or null if:
 *  - No ConstructInv JWT in localStorage (standalone DEV mode)
 *  - Mint request fails (e.g. expired JWT, network error)
 * In both null cases, the caller uses DEV mode (shared API key).
 */
export async function mintVoiceToken(): Promise<string | null> {
  const constructinvJwt = localStorage.getItem(CONSTRUCTINV_TOKEN_KEY);
  if (!constructinvJwt) {
    console.log('[HUD] No ConstructInv JWT in localStorage — DEV mode');
    return null;
  }

  try {
    const res = await fetch(MINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${constructinvJwt}`,
      },
      body: JSON.stringify({ productContext: 'soren' }),
    });

    if (!res.ok) {
      console.warn(`[HUD] Voice token mint failed: ${res.status} — falling back to DEV mode`);
      // If JWT expired (401), clear it so the next connect doesn't loop
      if (res.status === 401) localStorage.removeItem(CONSTRUCTINV_TOKEN_KEY);
      return null;
    }

    const json = await res.json();
    const voiceToken = json.data?.voiceToken;
    if (!voiceToken) {
      console.warn('[HUD] Mint response missing voiceToken — DEV mode');
      return null;
    }

    console.log('[HUD] Voice token minted — multi-tenant mode active');
    return voiceToken as string;
  } catch (e) {
    console.warn('[HUD] Mint request threw — DEV mode:', e);
    return null;
  }
}
