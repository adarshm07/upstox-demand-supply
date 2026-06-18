import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The data proxy. The frontend calls:
//   /api/upstox/candles?instrument=NSE_INDEX|Nifty%2050&interval=30minute
// We attach the server-side token and forward to Upstox's intraday endpoint.
export async function GET(req) {
  const token = req.cookies.get("upstox_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const instrument = sp.get("instrument");
  const interval = sp.get("interval") || "30minute"; // intraday: 1minute | 30minute
  if (!instrument) {
    return NextResponse.json({ error: "missing_instrument" }, { status: 400 });
  }

  const url =
    "https://api.upstox.com/v2/historical-candle/intraday/" +
    `${encodeURIComponent(instrument)}/${encodeURIComponent(interval)}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    return NextResponse.json({ error: "upstox_error", detail: j }, { status: r.status });
  }

  return NextResponse.json({ candles: (j.data && j.data.candles) || [] });
}
