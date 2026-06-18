import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Step 1 of OAuth: send the user to Upstox's authorization dialog.
// Requires UPSTOX_API_KEY and UPSTOX_REDIRECT_URI env vars.
export async function GET() {
  const clientId = process.env.UPSTOX_API_KEY;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "missing_env", detail: "Set UPSTOX_API_KEY and UPSTOX_REDIRECT_URI." },
      { status: 500 }
    );
  }

  const url =
    "https://api.upstox.com/v2/login/authorization/dialog" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code";

  return NextResponse.redirect(url);
}
