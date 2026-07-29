/**
 * Единый источник истины для "Secure" cookie у NextAuth — используется и при выдаче
 * сессии (src/lib/auth/config.ts), и при её проверке в middleware (getToken). Раньше
 * это решалось в двух местах по-разному (NODE_ENV vs NEXTAUTH_URL): если NODE_ENV на
 * хосте не был строго "production" (например, standalone server.js запущен без явного
 * NODE_ENV=production, в отличие от `next start`), сайн-ин ставил cookie без
 * `__Secure-` префикса, а middleware по умолчанию искал именно префиксованную —
 * токен не находился, и после логина всегда редиректило обратно на /login без ошибок.
 */
export function useSecureAuthCookies(): boolean {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

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
