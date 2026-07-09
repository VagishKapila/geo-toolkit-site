/** GEO site token endpoint (HUD uses /api/token proxy). */
export const TOKEN_URL =
  'https://varshyl-voice-engine-production.up.railway.app/token';

/** Only intentional product change from HUD varshyl-standalone. */
export const PRODUCT_ID = 'soren-fixes-it';

export const PERSONA = 'soren' as const;

/** ConstructInv localStorage key where the user's JWT is stored post-login */
export const CONSTRUCTINV_TOKEN_KEY = 'constructinv_token';

/** Key for storing the user's preferred display name */
export const USER_NAME_KEY = 'soren_user_name';

/** URL of the ConstructInv mint endpoint — set via NEXT_PUBLIC_CONSTRUCTINV_MINT_URL env var */
export const MINT_URL =
  process.env.NEXT_PUBLIC_CONSTRUCTINV_MINT_URL ??
  'https://construction-ai-billing-staging.up.railway.app/api/voice/mint-session-token';
