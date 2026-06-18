import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Step 2 of OAuth: Upstox redirects back here with ?code=...
// We exchange it for an access token and store it in an httpOnly cookie,
// so the browser never has direct access to the token.
export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/desk.html?auth=error", req.url));
  }

  const body = new URLSearchParams({
    code,
    client_id: process.env.UPSTOX_API_KEY || "",
    client_secret: process.env.UPSTOX_API_SECRET || "",
    redirect_uri: process.env.UPSTOX_REDIRECT_URI || "",
    grant_type: "authorization_code",
  });

  const res = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    return NextResponse.redirect(new URL("/desk.html?auth=error", req.url));
  }

  const resp = NextResponse.redirect(new URL("/desk.html?auth=ok", req.url));
  resp.cookies.set("upstox_token", j.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h — Upstox tokens expire daily
  });
  return resp;
}
