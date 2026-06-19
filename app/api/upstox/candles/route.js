import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The data proxy. The frontend calls:
//   /api/upstox/candles?instrument=NSE_INDEX|Nifty%2050&interval=30minute
// We attach the server-side token (httpOnly cookie) and forward to Upstox.
//
// Strategy: try the INTRADAY endpoint first (works while/just after market
// hours). If it returns no candles (market closed, weekend, holiday), fall
// back to HISTORICAL daily candles so the chart always populates with real data.
export async function GET(req) {
  const token = req.cookies.get("upstox_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "not_authenticated", candles: [] }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const instrument = sp.get("instrument");
  const interval = sp.get("interval") || "30minute"; // 1minute | 30minute
  if (!instrument) {
    return NextResponse.json({ error: "missing_instrument", candles: [] }, { status: 400 });
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const enc = encodeURIComponent(instrument);

  const debug = sp.get("debug") === "1";
  const attempts = [];

  // 1) Intraday
  try {
    const u = `https://api.upstox.com/v2/historical-candle/intraday/${enc}/${encodeURIComponent(interval)}`;
    const r = await fetch(u, { headers, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const candles = (j.data && j.data.candles) || [];
    attempts.push({ kind: "intraday", interval, status: r.status, count: candles.length, error: j.errors });
    if (r.ok && candles.length) {
      return NextResponse.json({ candles, source: "intraday", interval, ...(debug ? { attempts } : {}) });
    }
  } catch (e) {
    attempts.push({ kind: "intraday", error: String(e) });
  }

  // 2) Historical daily fallback (last ~40 calendar days)
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 40 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
    const u = `https://api.upstox.com/v2/historical-candle/${enc}/day/${fmt(to)}/${fmt(from)}`;
    const r = await fetch(u, { headers, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const candles = (j.data && j.data.candles) || [];
    attempts.push({ kind: "historical-day", status: r.status, count: candles.length, error: j.errors });
    if (r.ok && candles.length) {
      return NextResponse.json({ candles, source: "historical-day", interval: "day", ...(debug ? { attempts } : {}) });
    }
    // Surface Upstox's real error so the client can show it.
    return NextResponse.json(
      { error: "no_data", candles: [], attempts },
      { status: r.ok ? 200 : r.status }
    );
  } catch (e) {
    attempts.push({ kind: "historical-day", error: String(e) });
    return NextResponse.json({ error: "fetch_failed", candles: [], attempts }, { status: 502 });
  }
}
