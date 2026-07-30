export const FREE_CERTIFICATE_LIMIT = 5;
export const PREMIUM_CERTIFICATE_LIMIT: number | null = null;

export function getCertificateAllowance(isPremium: boolean, currentCount: number) {
  const normalizedCount = Math.max(0, Math.floor(currentCount || 0));
  const limit = isPremium ? PREMIUM_CERTIFICATE_LIMIT : FREE_CERTIFICATE_LIMIT;
  if (limit === null) {
    return { limit, canGenerate: true, remaining: null };
  }

  const remaining = Math.max(0, limit - normalizedCount);
  return { limit, canGenerate: remaining > 0, remaining };
}
