/**
 * Upstox Data Downloader
 * - Downloads historical OHLCV candles
 * - Caches in memory to avoid repeated API calls
 * - Handles both intraday and daily timeframes
 * - Can be run standalone: node src/data/dataDownloader.js
 */

const axios      = require('axios');
const axiosRetry = require('axios-retry').default;
const NodeCache  = require('node-cache');
const config     = require('../../config');
const logger     = require('../utils/logger');

// Cache candles for 5 minutes (300s) to avoid redundant API calls
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Retry failed requests up to 3 times with exponential backoff
axiosRetry(axios, {
  retries:           3,
  retryDelay:        axiosRetry.exponentialDelay,
  retryCondition:    err => err.response?.status >= 500 || err.code === 'ECONNABORTED',
  onRetry:           (count, err) => logger.warn(`Retry #${count} — ${err.message}`),
});

// ── Upstox interval map ───────────────────────────
// key   = what we use internally in config
// value = what Upstox API expects
const INTERVAL_MAP = {
  '1minute':   '1minute',
  '3minute':   '3minute',
  '5minute':   '5minute',
  '10minute':  '10minute',
  '15minute':  '15minute',
  '30minute':  '30minute',
  '1hour':     '60minute',
  'day':       'day',
  'week':      'week',
  'month':     'month',
};

// Intraday intervals (only current day data available)
const INTRADAY_INTERVALS = new Set([
  '1minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute',
]);

class DataDownloader {
  constructor() {
    this.baseURL     = 'https://api.upstox.com/v2';
    this.accessToken = config.broker.accessToken;
    this.headers     = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept':        'application/json',
    };
  }

  // ─────────────────────────────────────────────
  // FORMAT date to YYYY-MM-DD
  // ─────────────────────────────────────────────
  _fmt(date) {
    return date.toISOString().split('T')[0];
  }

  // ─────────────────────────────────────────────
  // PARSE raw Upstox candle array to OHLCV object
  // Upstox format: [timestamp, open, high, low, close, volume, oi]
  // ─────────────────────────────────────────────
  _parseCandles(raw = []) {
    return raw
      .map(c => ({
        time:   new Date(c[0]),
        open:   parseFloat(c[1]),
        high:   parseFloat(c[2]),
        low:    parseFloat(c[3]),
        close:  parseFloat(c[4]),
        volume: parseInt(c[5], 10),
        oi:     parseInt(c[6] || 0, 10),
      }))
      .sort((a, b) => a.time - b.time);  // oldest first
  }

  // ─────────────────────────────────────────────
  // FETCH intraday candles (current day only)
  // ─────────────────────────────────────────────
  async _fetchIntraday(instrumentKey, interval) {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${this.baseURL}/historical-candle/intraday/${encodedKey}/${interval}`;

    logger.info(`[DataDownloader] Intraday fetch | ${instrumentKey} | ${interval}`);
    logger.info(`[DataDownloader] URL: ${url}`);

    const resp = await axios.get(url, { headers: this.headers, timeout: 10000 });
    return this._parseCandles(resp.data?.data?.candles || []);
  }

  // ─────────────────────────────────────────────
  // FETCH historical candles (multi-day)
  // Max range: 1 year per request
  // ─────────────────────────────────────────────
  async _fetchHistorical(instrumentKey, interval, fromDate, toDate) {
    const encodedKey = encodeURIComponent(instrumentKey);
    const from       = this._fmt(fromDate);
    const to         = this._fmt(toDate);

    // Upstox endpoint: /historical-candle/{key}/{interval}/{to}/{from}
    const url = `${this.baseURL}/historical-candle/${encodedKey}/${interval}/${to}/${from}`;

    logger.info(`[DataDownloader] Historical fetch | ${instrumentKey} | ${interval} | ${from} → ${to}`);
    logger.info(`[DataDownloader] URL: ${url}`);

    const resp = await axios.get(url, { headers: this.headers, timeout: 15000 });
    return this._parseCandles(resp.data?.data?.candles || []);
  }

  // ─────────────────────────────────────────────
  // MAIN: Get candles with caching
  //
  // @param {string} instrumentKey  e.g. 'NSE_EQ|INE002A01018'
  // @param {string} interval       e.g. '30minute', 'day'
  // @param {number} days           how many days back to fetch
  // @param {boolean} forceRefresh  bypass cache
  // ─────────────────────────────────────────────
  async getCandles(instrumentKey, interval, days = 60, forceRefresh = false) {
    const upstoxInterval = INTERVAL_MAP[interval] || interval;
    const cacheKey       = `${instrumentKey}:${upstoxInterval}:${days}`;

    // Return cached data if available
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.info(`[DataDownloader] Cache hit | ${instrumentKey} | ${upstoxInterval} | ${cached.length} candles`);
        return cached;
      }
    }

    try {
      let candles = [];

      if (INTRADAY_INTERVALS.has(upstoxInterval)) {
        // ── Intraday: fetch historical + today's candles on the same timeframe ─────
        const [todayCandles, historicalCandles] = await Promise.all([
          this._fetchIntraday(instrumentKey, upstoxInterval),
          this._fetchHistoricalChunked(instrumentKey, upstoxInterval, days),
        ]);

        // Merge historical + today, deduplicate by timestamp
        const merged = [...historicalCandles, ...todayCandles];
        const seen   = new Set();
        candles = merged.filter(c => {
          const k = c.time.toISOString();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).sort((a, b) => a.time - b.time);

        logger.info(`[DataDownloader] Merged ${historicalCandles.length} historical + ${todayCandles.length} today = ${candles.length} candles`);

      } else {
        // ── Daily/Weekly: fetch full history ─────
        candles = await this._fetchHistoricalChunked(instrumentKey, upstoxInterval, days);
      }

      logger.info(`[DataDownloader] ✅ ${instrumentKey} | ${upstoxInterval} | ${candles.length} candles fetched`);

      if (candles.length > 0) {
        cache.set(cacheKey, candles);
      }

      return candles;

    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || err.message;
      logger.error(`[DataDownloader] ❌ Failed | ${instrumentKey} | ${upstoxInterval} | ${msg}`);

      // Return cached data as fallback even if expired
      const stale = cache.get(cacheKey);
      if (stale) {
        logger.warn(`[DataDownloader] Using stale cache for ${instrumentKey}`);
        return stale;
      }

      return [];
    }
  }

  // ─────────────────────────────────────────────
  // CHUNKED fetch — splits into 1-year chunks
  // because Upstox max range = 1 year per request
  // ─────────────────────────────────────────────
  async _fetchHistoricalChunked(instrumentKey, interval, days) {
    const upstoxInterval = INTERVAL_MAP[interval] || interval;
    const allCandles     = [];

    const toDate   = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Split into 365-day chunks
    const chunkDays = 365;
    let chunkTo     = new Date(toDate);

    while (chunkTo > fromDate) {
      const chunkFrom = new Date(chunkTo);
      chunkFrom.setDate(chunkFrom.getDate() - chunkDays);

      const effectiveFrom = chunkFrom < fromDate ? fromDate : chunkFrom;

      const chunk = await this._fetchHistorical(
        instrumentKey, upstoxInterval, effectiveFrom, chunkTo
      );

      allCandles.unshift(...chunk);   // prepend (older data first)

      chunkTo = new Date(effectiveFrom);
      chunkTo.setDate(chunkTo.getDate() - 1);

      // Rate limit: 200ms between requests
      await new Promise(r => setTimeout(r, 200));
    }

    // Remove duplicates by timestamp
    const seen = new Set();
    return allCandles.filter(c => {
      const key = c.time.toISOString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ─────────────────────────────────────────────
  // WARMUP — preload all symbols on bot startup
  // Ensures enough data before first scan
  // ─────────────────────────────────────────────
  async warmup(symbols = config.strategy.symbols) {
    const symbolNames = config.strategy.symbolNames;
    logger.info(`[DataDownloader] Warming up data for ${symbols.length} symbols...`);

    const results = [];

    for (const key of symbols) {
      const name = symbolNames[key] || key;
      logger.info(`[DataDownloader] Warming up: ${name}`);

      const [entryCandles, htfCandles] = await Promise.all([
        this.getCandles(key, config.strategy.timeframe,    60),
        this.getCandles(key, config.strategy.htfTimeframe, 100),
      ]);

      const ok = entryCandles.length >= 30;

      results.push({
        symbol:        name,
        entryCandles:  entryCandles.length,
        htfCandles:    htfCandles.length,
        ready:         ok,
      });

      logger.info(
        `[DataDownloader] ${name}: ` +
        `${entryCandles.length} entry candles, ` +
        `${htfCandles.length} HTF candles | ` +
        `${ok ? '✅ Ready' : '❌ Not enough data'}`
      );

      // Rate limit between symbols
      await new Promise(r => setTimeout(r, 500));
    }

    const readyCount = results.filter(r => r.ready).length;
    logger.info(`[DataDownloader] Warmup complete: ${readyCount}/${symbols.length} symbols ready`);
    return results;
  }

  // ─────────────────────────────────────────────
  // CLEAR cache for one or all symbols
  // ─────────────────────────────────────────────
  clearCache(instrumentKey = null) {
    if (instrumentKey) {
      const keys = cache.keys().filter(k => k.startsWith(instrumentKey));
      keys.forEach(k => cache.del(k));
      logger.info(`[DataDownloader] Cache cleared for ${instrumentKey}`);
    } else {
      cache.flushAll();
      logger.info('[DataDownloader] Full cache cleared');
    }
  }

  // ─────────────────────────────────────────────
  // STANDALONE TEST — run directly to verify
  // node src/data/dataDownloader.js
  // ─────────────────────────────────────────────
  async test(instrumentKey, interval = 'day', days = 60) {
    logger.info(`\n${'═'.repeat(50)}`);
    logger.info(`Testing data download for: ${instrumentKey}`);
    logger.info(`Interval: ${interval} | Days: ${days}`);
    logger.info('═'.repeat(50));

    const candles = await this.getCandles(instrumentKey, interval, days, true);

    if (!candles.length) {
      logger.error('❌ No candles returned — check API key and instrument key');
      return;
    }

    logger.info(`✅ ${candles.length} candles received`);
    logger.info(`   First: ${candles[0].time.toISOString().split('T')[0]} O:${candles[0].open}`);
    logger.info(`   Last:  ${candles.at(-1).time.toISOString().split('T')[0]} C:${candles.at(-1).close}`);
    logger.info(`   Sample candle: ${JSON.stringify(candles.at(-1), null, 2)}`);
  }
}

const downloader = new DataDownloader();

// ── Run standalone test ───────────────────────
if (require.main === module) {
  const [,, key, interval, days] = process.argv;
  downloader
    .test(
      key      || 'NSE_EQ|INE002A01018',
      interval || 'day',
      days     ? parseInt(days) : 60
    )
    .catch(console.error)
    .finally(() => process.exit(0));
}

module.exports = downloader;