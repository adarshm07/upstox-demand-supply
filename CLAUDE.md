# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

This is a Node.js algorithmic trading bot for Indian equities (NSE) using a Supply & Demand zone strategy. It connects to the Upstox broker API, scans 23 large-cap NSE stocks on 30-minute candles, detects S&D zones, and sends trade signals via Telegram with inline YES/NO confirmation buttons. It supports both **paper trading** (simulated, stored in MongoDB) and **live trading** (real orders via Upstox API + GTT stop-loss/target orders).

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

```
TRADE_MODE=paper              # 'paper' | 'live'
UPSTOX_API_KEY=
UPSTOX_API_SECRET=
UPSTOX_REDIRECT_URI=
UPSTOX_ACCESS_TOKEN=          # short-lived daily token from Upstox OAuth
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CAPITAL=100000
CAPITAL_MODE=risk             # 'fixed' | 'percent' | 'risk'
CAPITAL_PER_TRADE=10000       # used when CAPITAL_MODE=fixed
CAPITAL_PCT_PER_TRADE=10      # used when CAPITAL_MODE=percent
MAX_RISK_PER_TRADE_PCT=2      # used when CAPITAL_MODE=risk
MAX_DAILY_LOSS_PCT=6
MONGO_URI=mongodb://localhost:27017/sd_bot
```

The Upstox `UPSTOX_ACCESS_TOKEN` must be refreshed daily via Upstox OAuth flow — it is not long-lived.

## Architecture

### Request/Data Flow

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

### Module Responsibilities

- **`config.js`** — single source of truth for all parameters; reads `.env` and exports strategy, capital, timing, and paper-mode thresholds
- **`src/broker/upstox.js`** — thin wrapper over Upstox REST API (`/v2`); delegates candle fetching to `dataDownloader`, handles LTP, order placement, GTT orders, and positions
- **`src/data/dataDownloader.js`** — fetches OHLCV candles from Upstox; merges intraday + historical data; caches results for 5 minutes using `node-cache`; handles Upstox's 1-year-per-request limit via chunked fetching; retries on 5xx errors with exponential backoff
- **`src/strategy/zoneDetector.js`** — detects demand/supply zones: finds "base" candles (tight range < 1.5× ATR) followed by an impulse candle (body > 2× ATR), then counts how many times price returned to each zone (`testCount`)
- **`src/strategy/conditions.js`** — evaluates 10 entry conditions (C1–C10): fresh zone, strong impulse, HTF trend alignment via 50 EMA on daily chart, risk-reward ≥ 1:3, confirmation candle pattern, volume spike, clear path to TP, trading time window, daily loss limit, position size validity
- **`src/strategy/signals.js`** — orchestrates zone detection + condition checking per symbol; finds nearest opposing zone as take-profit target; returns full signal object including `passCount` and `approved` flag
- **`src/orders/orderManager.js`** — entry point from `index.js`; guards against duplicates (5 min cooldown) and max open trades (6); routes to paper or live; syncs open trade count from DB on startup
- **`src/paper/paperTrader.js`** — simulates trades in MongoDB; `checkOpenTrades()` polls LTP every minute to trigger SL/TP; `getPnLSummary()` uses MongoDB aggregation for period/symbol breakdowns
- **`src/risk/capitalManager.js`** — three sizing modes: `fixed` (flat ₹ amount), `percent` (% of total capital), `risk` (risk % rule — default 2%)
- **`src/charges/brokerageCalculator.js`** — calculates all NSE charges (brokerage, STT, exchange, SEBI, stamp duty, GST) for intraday or delivery; used to show net P&L and breakeven move before placing orders
- **`src/telegram/telegramBot.js`** — manages the Telegram bot; handles trade confirmation via inline keyboard buttons (YES/NO with 60s timeout); supports commands: `/pnl`, `/pnlweek`, `/pnlmonth`, `/pnlall`, `/trades`, `/capital`, `/status`, `/help`, `/close <tradeId>`
- **`src/db/database.js`** — Mongoose connection with event logging
- **`src/db/models/Trade.js`** — single Mongoose model for all trades; `closeTrade(exitPrice, status, chargeCalc)` instance method handles closing; `status` values: `open`, `closed_tp`, `closed_sl`, `closed_manual`

### Paper vs. Live Mode

Paper mode uses relaxed thresholds (configured in `config.paper`):
- Impulse threshold: 1.5× ATR (vs. 2.0× live)
- Min R:R: 1:2 (vs. 1:3 live)
- Allows zones tested up to 5× (vs. fresh only live)
- Volume spike: 1.2× avg (vs. 1.5×)
- Only 2/10 conditions required (vs. all 10)
- Also applies a 1% proximity buffer when checking if price is inside a zone

In paper mode, end-of-day (3:25 PM IST) auto-closes all open trades at current LTP.

### Instrument Key Format

Symbols use Upstox's format: `NSE_EQ|<ISIN>` (e.g., `NSE_EQ|INE002A01018` for RELIANCE). The mapping between instrument keys and human-readable names lives in `config.strategy.symbolNames`.

### Trade Confirmation Flow

When a signal passes conditions, `telegram.requestTradeConfirmation()` sends an alert with inline YES/NO buttons and blocks for up to 60 seconds. If no response, the trade is auto-skipped. The callback data format is `YES:<messageId>` / `NO:<messageId>`. A `CLOSE:<tradeId>` callback data pattern handles manual close buttons on open trade messages.

### Scheduling

- Main scan: every 60 seconds (`config.scanIntervalMs`)
- Paper SL/TP check: every 1 minute
- End-of-day reset: checked every 60 seconds, triggers once at 15:25 IST
- Cache TTL: 5 minutes per candle series
