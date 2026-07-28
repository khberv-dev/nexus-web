/** Только проверка env — без Prisma (безопасно для Edge middleware). */
export function isDevAuthBypass(): boolean {
  // Guard: никогда не работает в production, даже если флаг выставлен явно.
  if (process.env.NODE_ENV === "production") return false;

  const raw =
    process.env.DEV_AUTH_BYPASS?.trim().toLowerCase() ??
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS?.trim().toLowerCase() ??
    "";

  // Требуем явного включения — без флага bypass выключен.
  return raw === "true" || raw === "1" || raw === "yes";
}
