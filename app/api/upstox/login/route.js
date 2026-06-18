import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Step 1 of OAuth: send the user to Upstox's authorization dialog.
// Requires UPSTOX_API_KEY and UPSTOX_REDIRECT_URI env vars.
//
// .trim() guards against the #1 cause of UDAPI100068: a stray space or
// newline accidentally pasted into the env var on Render.
export async function GET(req) {
  const clientId = (process.env.UPSTOX_API_KEY || "").trim();
  const redirectUri = (process.env.UPSTOX_REDIRECT_URI || "").trim();

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "missing_env",
        detail: "Set UPSTOX_API_KEY and UPSTOX_REDIRECT_URI in your Render environment.",
        haveApiKey: !!clientId,
        haveRedirectUri: !!redirectUri,
      },
      { status: 500 }
    );
  }

  // Proper, predictable encoding of every parameter.
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;

  // Diagnostic mode: /api/upstox/login?debug=1 shows EXACTLY what we send to
  // Upstox so you can compare it char-for-char with your registered app.
  // The api_key is masked; the secret is never read here.
  if (new URL(req.url).searchParams.get("debug") === "1") {
    return NextResponse.json({
      note: "Compare redirect_uri below with the EXACT value registered in your Upstox app (https://account.upstox.com/developer/apps). They must match identically — including https vs http and any trailing slash.",
      client_id_masked: clientId.length > 8 ? clientId.slice(0, 4) + "…" + clientId.slice(-4) : "(too short — is this really the API Key?)",
      client_id_length: clientId.length,
      redirect_uri: redirectUri,
      authorize_url: authUrl,
    });
  }

  return NextResponse.redirect(authUrl);
}
