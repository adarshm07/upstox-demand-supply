import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = req.cookies.get("upstox_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "not_authenticated", positions: [] }, { status: 401 });
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  try {
    const res = await fetch("https://api.upstox.com/v2/portfolio/short-term-positions", {
      headers,
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: "upstox_error", positions: [], detail: j }, { status: res.status });
    }
    const raw = (j.data) || [];
    const positions = raw.map((p) => ({
      sym: p.tradingsymbol || p.instrument_token || "—",
      buy: p.quantity > 0,
      qty: String(Math.abs(p.quantity)),
      avg: p.average_price ?? 0,
      ltp: p.last_price ?? p.close_price ?? 0,
      open: p.quantity !== 0,
      pnl: p.pnl ?? 0,
    }));
    return NextResponse.json({ positions });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed", positions: [] }, { status: 502 });
  }
}
