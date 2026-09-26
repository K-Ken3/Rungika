import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "rungika_session";

export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: [
    "/business",
    "/business/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/super-admin",
    "/super-admin/:path*",
  ],
};
