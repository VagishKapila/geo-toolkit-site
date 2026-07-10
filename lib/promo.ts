export const VALIDATE_ENDPOINT = '/api/promo/redeem';

export type PromoEntitlement =
  | 'DIY_PACKAGE'
  | 'AI_ASSIST'
  | 'DONE_WITH_YOU'
  | 'FULL_SPONSORED_ACCESS';

export interface PromoValidationResult {
  ok: boolean;
  message: string;
  entitlement?: PromoEntitlement;
}

const LOCAL_VALID_CODES = new Set(['SORVIP', 'VARSHYL100']);

async function validatePromoOnServer(
  code: string,
  email: string,
): Promise<PromoValidationResult | null> {
  try {
    const res = await fetch(VALIDATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), email: email.trim() }),
    });
    if (res.status === 404) return null;
    return (await res.json()) as PromoValidationResult;
  } catch {
    return null;
  }
}

function validatePromoLocally(code: string, email: string): PromoValidationResult {
  const normalized = code.trim().toUpperCase();
  if (!email.trim()) {
    return { ok: false, message: 'Enter your email to redeem this code.' };
  }
  if (!normalized) {
    return {
      ok: false,
      message: 'Enter a partner, invitation, or promotion code.',
    };
  }
  if (LOCAL_VALID_CODES.has(normalized)) {
    return {
      ok: true,
      message: 'Access verified. Sponsored full-plan access is unlocked.',
      entitlement: 'FULL_SPONSORED_ACCESS',
    };
  }
  return {
    ok: false,
    message: 'That code is invalid, expired, or not eligible for this plan.',
  };
}

/** Step 1.5 will point server validation at VALIDATE_ENDPOINT; falls back locally until then. */
export async function validatePromoCode(
  code: string,
  email: string,
): Promise<PromoValidationResult> {
  const server = await validatePromoOnServer(code, email);
  if (server) return server;
  return validatePromoLocally(code, email);
}
