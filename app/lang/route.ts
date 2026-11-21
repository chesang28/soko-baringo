import { NextResponse, type NextRequest } from "next/server";

/** /lang?to=sw — sets language cookie and returns to the previous page (same-origin only). */
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") === "sw" ? "sw" : "en";
  const ref = req.headers.get("referer");
  let back = "/";
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === req.nextUrl.origin) back = u.pathname + u.search;
    } catch { /* ignore malformed referer */ }
  }
  const res = NextResponse.redirect(new URL(back, req.nextUrl.origin));
  res.cookies.set("lang", to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
