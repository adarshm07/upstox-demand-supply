import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Step 2 of OAuth: Upstox redirects back here with ?code=...
// We exchange it for an access token and store it in an httpOnly cookie,
// so the browser never has direct access to the token.
//
// The redirect_uri sent here MUST be byte-identical to the one used in step 1,
// hence the same .trim() treatment.
// Behind Render's proxy, req.url shows the INTERNAL host (localhost:10000).
// Build redirects against the PUBLIC origin instead, using the forwarded
// headers Render sets, falling back to the registered redirect URI's origin.
function publicBase(req) {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (proto && host && !host.startsWith("localhost")) return `${proto}://${host}`;
  try {
    return new URL((process.env.UPSTOX_REDIRECT_URI || "").trim()).origin;
  } catch (e) {
    return new URL(req.url).origin;
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const base = publicBase(req);

  // Surface Upstox's own error if the dialog bounced back with one.
  const upstoxErr = url.searchParams.get("error") || url.searchParams.get("errorCode");
  if (upstoxErr) {
    return NextResponse.redirect(`${base}/desk.html?auth=error&reason=${encodeURIComponent(upstoxErr)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/desk.html?auth=error&reason=no_code`);
  }

  const body = new URLSearchParams({
    code,
    client_id: (process.env.UPSTOX_API_KEY || "").trim(),
    client_secret: (process.env.UPSTOX_API_SECRET || "").trim(),
    redirect_uri: (process.env.UPSTOX_REDIRECT_URI || "").trim(),
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
    const reason = (j && j.errors && j.errors[0] && j.errors[0].errorCode) || "token_exchange_failed";
    return NextResponse.redirect(`${base}/desk.html?auth=error&reason=${encodeURIComponent(reason)}`);
  }

  const resp = NextResponse.redirect(`${base}/desk.html?auth=ok`);
  resp.cookies.set("upstox_token", j.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h — Upstox tokens expire daily
  });
  return resp;
}
