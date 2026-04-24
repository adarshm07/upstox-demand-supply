# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

This is a Node.js algorithmic trading bot for Indian markets (NSE) with two independent trading modes selectable via `.env`:

- **Equity mode** (default) — scans 23 large-cap NSE stocks on 30-minute candles using a Supply & Demand zone strategy
- **Options mode** — trades Nifty 50 weekly options using the same S&D strategy on 15-minute Nifty index candles; buys slightly ITM CE/PE depending on zone direction

Both modes support **paper trading** (simulated, stored in MongoDB) and send signals via Telegram with inline YES/NO confirmation buttons. Live trading is also supported for equity (real Upstox orders + GTT SL/TP).

## Running the Bot

```bash
npm install
node src/index.js
```

There are no test scripts configured. To test individual modules standalone:

```bash
# Test data downloading for a symbol
node src/data/dataDownloader.js NSE_EQ|INE002A01018 day 60

# Test data for a different interval
node src/data/dataDownloader.js NSE_EQ|INE002A01018 30minute 10
```

## Environment Variables (`.env`)

### Core (both modes)
```
TRADE_MODE=paper              # 'paper' | 'live'
TRADE_INSTRUMENT=equity       # 'equity' | 'options'
UPSTOX_API_KEY=
UPSTOX_API_SECRET=
UPSTOX_REDIRECT_URI=
UPSTOX_ACCESS_TOKEN=          # short-lived daily token from Upstox OAuth
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
MONGO_URI=mongodb://localhost:27017/sd_bot
```

### Equity mode
```
CAPITAL=100000
CAPITAL_MODE=risk             # 'fixed' | 'percent' | 'risk'
CAPITAL_PER_TRADE=10000       # used when CAPITAL_MODE=fixed
CAPITAL_PCT_PER_TRADE=10      # used when CAPITAL_MODE=percent
MAX_RISK_PER_TRADE_PCT=2      # used when CAPITAL_MODE=risk
MAX_DAILY_LOSS_PCT=6
```

### Options mode
```
OPTIONS_CAPITAL=20000         # total capital for options
OPTIONS_RISK_PCT=1            # max loss per trade as % of capital (1% = ₹200)
OPTIONS_MAX_PREMIUM_PCT=10    # % of capital to spend on premium per trade (₹2,000)
OPTIONS_MAX_TRADES=10         # max paper trades per day
```

The Upstox `UPSTOX_ACCESS_TOKEN` must be refreshed daily via Upstox OAuth flow — it is not long-lived.

## Architecture

### Mode Selection

`config.tradeInstrument` (`TRADE_INSTRUMENT` env) switches the entire scan loop in `src/index.js`:
- `equity` → runs `signals.scanAll()` across 23 NSE stocks every 60s
- `options` → runs `niftySignals.generate()` on Nifty 50 every 60s

Both modes share the same MongoDB `trades` collection (distinguished by `mode` field), the same Telegram bot instance, and the same broker/data modules.

### Equity Request/Data Flow

```
src/index.js (runBot)
  └─ dataDownloader.warmup()        — preload candle cache for all symbols
  └─ setInterval(runScan, 60s)
       └─ signals.scanAll()
            └─ for each symbol:
                 broker.getCandles()        — from in-memory cache (5 min TTL)
                 broker.getLTP()            — live price from Upstox API
                 zoneDetector.detectZones() — find S&D zones in candle data
                 conditions.runAllConditions() — evaluate all 10 entry conditions
                 → returns signal object if approved
       └─ orderManager.process(signal)
            └─ capitalManager.calculate()  — determine qty based on mode
            └─ telegram.requestTradeConfirmation() — wait up to 60s for YES/NO
            └─ paperTrader.openTrade() OR broker.placeOrder() + placeGTTOrders()
            └─ Trade.create() → MongoDB
```

### Options Request/Data Flow

```
src/index.js (runBot, IS_OPTIONS=true)
  └─ broker.getCandles(Nifty, 15min + daily)  — warmup Nifty candles
  └─ setInterval(runOptionsScan, 60s)
       └─ niftySignals.generate()
            └─ broker.getCandles(Nifty, 15min)  — from cache
            └─ optionChain.getWeeklyExpiry()     — next valid Thursday
            └─ optionChain.fetchChain()          — Upstox option chain API
            └─ zoneDetector.detectZones()        — S&D zones on Nifty
            └─ conditions.*()                    — 10 conditions, need 5/10
            └─ optionChain.findITMStrike()       — 1 strike ITM (CE or PE)
            → returns signal with option instrument key + premium
       └─ optionsOrderManager.process(signal)
            └─ telegram.requestTradeConfirmation()
            └─ Trade.create({ mode: 'options-paper', optionType, strike, ... })
  └─ setInterval(optionsOrderManager.checkOpenTrades, 60s)
       └─ broker.getLTP(option instrument key)  — current option premium
       └─ close if premium ≤ SL or ≥ TP or expiry reached
```

### Module Responsibilities

#### Shared
- **`config.js`** — single source of truth; exports `strategy`, `capital`, `paper`, `options`, `timing`, `tradeMode`, `tradeInstrument`
- **`src/broker/upstox.js`** — thin wrapper over Upstox REST API (`/v2`); delegates candle fetching to `dataDownloader`; handles LTP, order placement, GTT orders
- **`src/data/dataDownloader.js`** — fetches OHLCV candles; merges intraday + historical; caches 5 min; chunks requests to respect Upstox's 1-year limit; retries on 5xx with exponential backoff
- **`src/db/models/Trade.js`** — single Mongoose model for all trades; `mode` field distinguishes `paper`/`live`/`options-paper`/`options-live`; `closeTrade(exitPrice, status, chargeCalc)` instance method; optional fields `optionType`, `strike`, `lots`, `lotSize`, `expiryDate` for options trades

#### Equity
- **`src/strategy/zoneDetector.js`** — detects demand/supply zones: base candles (tight range < 1.5× ATR) followed by impulse candle (body > 2× ATR); tags `testCount` per zone
- **`src/strategy/conditions.js`** — evaluates 10 conditions (C1–C10); individual methods accept override params (e.g. `atrMultiplier`, `minRiskReward`) so they can be reused by the options module
- **`src/strategy/signals.js`** — orchestrates zone detection + condition checking per symbol; finds nearest opposing zone as TP; returns signal with `passCount` and `approved`
- **`src/orders/orderManager.js`** — guards duplicates (5 min) and max open trades (6); routes to paper or live; syncs count from DB on startup
- **`src/paper/paperTrader.js`** — simulates equity trades; `checkOpenTrades()` polls LTP every minute; `getPnLSummary()` uses MongoDB aggregation for period/symbol breakdowns
- **`src/risk/capitalManager.js`** — three sizing modes: `fixed`, `percent`, `risk` (default 2% rule)
- **`src/charges/brokerageCalculator.js`** — calculates NSE charges (brokerage, STT, exchange, SEBI, stamp duty, GST) for intraday or delivery

#### Options
- **`src/options/optionChain.js`** — calculates next valid Thursday expiry (skips if < `minDaysToExpiry` away); fetches Upstox option chain; finds ITM strike (`ATM ± strikesITM × strikeStep`); extracts option LTP and greeks from chain response
- **`src/options/niftySignals.js`** — zone detection on Nifty 15-min candles; reuses `conditions.*` methods with options-specific thresholds; C8 combines trading time + expiry distance check; C10 checks lot affordability; needs 5/10 conditions; returns signal with option instrument key, premium, lots, SL/TP in premium terms
- **`src/options/optionsOrderManager.js`** — paper order management for options; enforces daily trade limit; stores trades as `mode: 'options-paper'`; SL = 50% premium drop, TP = 2× premium; `checkOpenTrades()` polls live option LTP; auto-closes on expiry day; EOD reset

#### Telegram
- **`src/telegram/telegramBot.js`** — single bot instance for both modes; handles YES/NO inline keyboard confirmation (60s timeout); callback data: `YES:<msgId>` / `NO:<msgId>` / `CLOSE:<tradeId>`

### Paper vs. Live Mode (Equity)

Paper mode uses relaxed thresholds (configured in `config.paper`):
- Impulse threshold: 1.5× ATR (vs. 2.0× live)
- Min R:R: 1:2 (vs. 1:3 live)
- Allows zones tested up to 5× (vs. fresh only live)
- Volume spike: 1.2× avg (vs. 1.5×)
- Only 2/10 conditions required (vs. all 10)
- Applies 1% proximity buffer when checking if price is inside a zone

In paper mode, end-of-day (3:25 PM IST) auto-closes all open trades at current LTP.

### Options Mode Thresholds

Options always runs with relaxed thresholds (paper-equivalent):
- Impulse: 1.5× ATR, Volume: 1.3× avg, Min R:R: 1:2, Min pass: 5/10
- Only fresh zones (testCount = 0) are considered
- 0.5% proximity buffer for zone entry

### Instrument Key Format

Equity: `NSE_EQ|<ISIN>` (e.g. `NSE_EQ|INE002A01018` for RELIANCE) — mapping in `config.strategy.symbolNames`.
Options underlying: `NSE_INDEX|Nifty 50`. Option contracts: `NSE_FO|<id>` — fetched dynamically from the option chain API.

### Trade `mode` Field Values

| Value | Description |
|---|---|
| `paper` | Equity paper trade |
| `live` | Equity live trade |
| `options-paper` | Nifty options paper trade |
| `options-live` | Nifty options live trade (not yet wired) |

### Telegram Commands

| Command | Description |
|---|---|
| `/pnl [SYMBOL]` | Today's equity P&L (optionally filtered by symbol) |
| `/pnlweek` `/pnlmonth` `/pnlall` | Equity P&L by period |
| `/trades` | Open equity paper trades |
| `/capital` | Equity capital config |
| `/optionpnl` | Today's options P&L |
| `/optionpnlweek` `/optionpnlmonth` `/optionpnlall` | Options P&L by period |
| `/optiontrades` | Open options paper positions |
| `/status` | Bot health |
| `/close <tradeId>` | Manually close any trade (equity or options) |
| `/help` | Full command list |

### Scheduling

- Main scan (equity or options): every 60 seconds
- Paper SL/TP check: every 1 minute
- End-of-day reset: checked every 60 seconds, triggers once at 15:25 IST
- Cache TTL: 5 minutes per candle series
