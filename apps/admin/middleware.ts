import { type NextRequest, NextResponse } from "next/server";

// Cheap edge-only check: presence of the Better Auth session cookie. The full
// session validation happens server-side in the (dashboard) layout via
// auth.api.getSession(), which is the source of truth. The middleware is just
// a fast redirect so unauthenticated visitors never see a flash of dashboard
// chrome before the layout redirects them.
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function middleware(request: NextRequest) {
  const hasSession = SESSION_COOKIE_NAMES.some((name) =>
    request.cookies.has(name),
  );
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Gate everything except /login, /set-password, /api/auth/*, Next
  // internals, and static assets. Negative lookahead keeps the matcher cheap
  // at the edge. /set-password is reached via an invite-email link before
  // the user has a session. The `(?:$|[/?])` boundary on path-based
  // exclusions prevents prefix-bypass via paths like `/login-evil` or
  // `/set-password-anything` slipping through unauthenticated.
  matcher: [
    "/((?!login(?:$|[/?])|set-password(?:$|[/?])|api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
