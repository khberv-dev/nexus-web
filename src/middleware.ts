import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevAuthBypass, shouldUseSecureAuthCookies } from "@/lib/dev-auth-flag";

const ROUTE_GUARDS = [
  { pattern: /^\/admin/, allowedRoles: ["ADMIN"] },
  { pattern: /^\/work/, allowedRoles: ["SPECIALIST"] },
  { pattern: /^\/orders/, allowedRoles: ["CLIENT", "ADMIN"] },
  { pattern: /^\/dashboard/, allowedRoles: ["CLIENT", "SPECIALIST", "ADMIN"] },
];

/** Роль для dev bypass (должна совпадать с сессией из БД и с DEV_MOCK_ROLE в .env). */
function devBypassEffectiveRole(): "ADMIN" | "SPECIALIST" | "CLIENT" {
  const r =
    process.env.DEV_MOCK_ROLE?.trim().toUpperCase() ??
    process.env.NEXT_PUBLIC_DEV_MOCK_ROLE?.trim().toUpperCase() ??
    "";
  if (r === "ADMIN" || r === "SPECIALIST" || r === "CLIENT") return r;
  return "CLIENT";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const guard = ROUTE_GUARDS.find((g) => g.pattern.test(pathname));
  if (!guard) return NextResponse.next();

  if (isDevAuthBypass()) {
    const mock = devBypassEffectiveRole();
    if (!guard.allowedRoles.includes(mock)) {
      return NextResponse.redirect(new URL("/403", request.url));
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    // Must match authConfig.useSecureCookies exactly, or the cookie this looks for
    // (__Secure-next-auth.session-token vs next-auth.session-token) won't match what
    // was actually set at sign-in, and every protected route silently bounces to /login.
    secureCookie: shouldUseSecureAuthCookies(),
  });
  if (!token?.sub) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = token.role as string | undefined;
  if (!role || !guard.allowedRoles.includes(role)) {
    return NextResponse.redirect(new URL("/403", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/work/:path*", "/orders/:path*", "/dashboard/:path*", "/api/auth/:path*"],
};
