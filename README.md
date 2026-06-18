# Meridian — SMC Trading Desk

A full-stack Indian-market analysis app for **Nifty 50, Bank Nifty and equities**. It renders a candlestick + volume chart and **automatically detects and marks Smart Money Concepts** — Order Blocks, Fair Value Gaps, BOS / CHoCH structure breaks, liquidity pools and support/resistance — then recommends a strategy (bias, conviction, entry, stop, two targets, R:R, and an options idea for indices).

Built with **Next.js**: the frontend is served from `/public/desk.html`, and the `/api/upstox/*` routes act as a secure backend proxy to **Upstox** — handling OAuth and keeping your access token server-side (the browser never sees it, and Upstox's CORS restriction is bypassed).

## Architecture

```
Browser (desk.html)  ──►  /api/upstox/login      → redirects to Upstox OAuth
                          /api/upstox/callback   → exchanges code, sets httpOnly cookie
                          /api/upstox/candles     → proxies live candles with the token
```

| Path | Purpose |
|------|---------|
| `app/page.js` | Redirects `/` → `/desk.html` |
| `app/api/upstox/login/route.js` | Starts Upstox OAuth |
| `app/api/upstox/callback/route.js` | Token exchange → secure cookie |
| `app/api/upstox/candles/route.js` | Authenticated candle proxy |
| `public/desk.html` | The trading-desk UI (bundled, no build step) |
| `Meridian Desk.dc.html` + `support.js` | Editable source for `desk.html` |

The detection + strategy engine is **fully live** regardless of feed. Without login the app runs on realistic demo candles; after login it streams real Upstox data.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Upstox credentials
npm run dev                  # http://localhost:3000
```

## Deploy to Render

1. Push this repo to GitHub.
2. [Render dashboard](https://dashboard.render.com) → **New → Web Service** → connect the repo. Render reads `render.yaml`:
   - **Runtime:** Node · **Build:** `npm install && npm run build` · **Start:** `npm start`
3. Add the three environment variables (marked `sync: false` so they stay secret):
   - `UPSTOX_API_KEY`
   - `UPSTOX_API_SECRET`
   - `UPSTOX_REDIRECT_URI` → `https://<your-app>.onrender.com/api/upstox/callback`
4. Create an Upstox app at <https://account.upstox.com/developer/apps> and register that **exact** redirect URI.
5. Deploy. Open the site → **Connect → Login with Upstox**.

## Upstox notes

- Instrument keys are pre-mapped (`NSE_INDEX|Nifty 50`, `NSE_EQ|INE002A01018`, …).
- Live feed uses the intraday endpoint (`1minute` / `30minute`); tokens expire daily, so re-login each trading day.

> ⚠️ Educational analysis tool, not investment advice. Trade at your own risk.
