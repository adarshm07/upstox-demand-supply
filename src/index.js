const config        = require('../config');
const signals       = require('./strategy/signals');
const broker        = require('./broker/upstox');
const orderManager  = require('./orders/orderManager');
const paperTrader   = require('./paper/paperTrader');
const downloader    = require('./data/dataDownloader');
const telegram      = require('./telegram/telegramBot');
const { connectDB } = require('./db/database');
const logger        = require('./utils/logger');

const IS_PAPER   = config.tradeMode === 'paper';
const IS_OPTIONS = config.tradeInstrument === 'options';

// Options modules — loaded only when needed to avoid unnecessary init
const niftySignals    = IS_OPTIONS ? require('./options/niftySignals')         : null;
const optionsManager  = IS_OPTIONS ? require('./options/optionsOrderManager')  : null;

// ─────────────────────────────────────────────
// EQUITY SCAN
// ─────────────────────────────────────────────
async function runScan() {
  logger.info('[Bot] Starting equity scan...');

  const dailyPnL   = IS_PAPER
    ? (await paperTrader.getPnLSummary({ period: 'today' })).totalPnL
    : await broker.getDailyPnL();
  const allSignals = await signals.scanAll(dailyPnL);

  if (!allSignals.length) {
    logger.info('[Bot] No signals this scan');
    return;
  }

  if (IS_PAPER) await paperTrader.checkOpenTrades();

  for (const signal of allSignals) {
    if (!signal.approved && signal.passCount >= 8) {
      await telegram.sendMessage(
        `⚠️ *Near Signal — ${signal.symbolName}*\n` +
        `${signal.passCount}/10 conditions met\n\n` +
        signals.formatConditionLog(signal.conditionResults)
      );
      continue;
    }
    if (!signal.approved) continue;

    const result = await orderManager.process(signal);
    logger.info(
      `[Bot] ${signal.symbolName}: ` +
      `${result.success ? '✅' : '❌'} ${result.reason || result.mode || ''}`
    );
  }
}

// ─────────────────────────────────────────────
// OPTIONS SCAN (Nifty 50 weekly options)
// ─────────────────────────────────────────────
async function runOptionsScan() {
  logger.info('[Bot] Starting Nifty options scan...');

  const dailyPnL = await optionsManager.getDailyPnL();
  const signal   = await niftySignals.generate(dailyPnL);

  if (!signal) {
    logger.info('[Bot] No options signal this scan');
    return;
  }

  // Alert for near-misses (≥ 7 conditions)
  if (!signal.approved && signal.passCount >= 7) {
    await telegram.sendMessage(
      `⚠️ *Near Options Signal — ${signal.symbolName}*\n` +
      `${signal.passCount}/10 conditions met\n\n` +
      niftySignals.formatConditionLog(signal.conditionResults)
    );
    return;
  }

  if (!signal.approved) return;

  const result = await optionsManager.process(signal);
  logger.info(
    `[Bot] ${signal.symbolName}: ` +
    `${result.success ? '✅' : '❌'} ${result.reason || result.mode || ''}`
  );
}

// ─────────────────────────────────────────────
// SEND TEST MESSAGE TO TELEGRAM
// ─────────────────────────────────────────────
async function sendStartupMessage(warmupResults) {
  const modeEmoji = IS_PAPER ? '📝' : '⚡';
  const now       = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Symbol readiness table
  const symbolLines = warmupResults.map(r =>
    `  ${r.ready ? '✅' : '❌'} ${r.symbol}: ${r.entryCandles} candles`
  ).join('\n');

  // Capital mode description
  const capitalModes = {
    fixed:   `Fixed ₹${config.capital.perTrade.toLocaleString('en-IN')} per trade`,
    percent: `${config.capital.pctPerTrade}% of capital per trade`,
    risk:    `${config.capital.maxRiskPct}% max risk per trade`,
  };

  const testMessage =
    `🤖 *S&D Algo Bot — ONLINE*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${modeEmoji} Mode:     *${config.tradeMode.toUpperCase()}*\n` +
    `🕐 Started:  ${now}\n` +
    `💰 Capital:  ₹${config.capital.total.toLocaleString('en-IN')}\n` +
    `📐 Sizing:   ${capitalModes[config.capital.mode]}\n` +
    `⏱ Interval: Every ${config.scanIntervalMs / 1000}s\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Symbol Readiness:*\n${symbolLines}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Commands:*\n` +
    `  /pnl /pnlweek /pnlmonth /pnlall\n` +
    `  /trades /capital /status /help\n` +
    `  /close <tradeId>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ This is a test message — bot is working!`;

  await telegram.sendMessage(testMessage);
  logger.info('[Bot] Startup test message sent to Telegram ✅');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
async function runBot() {
  await connectDB();

  const modeLabel = IS_OPTIONS
    ? `OPTIONS (${config.tradeMode.toUpperCase()})`
    : config.tradeMode.toUpperCase();
  logger.info(`[Bot] Started | instrument: ${config.tradeInstrument} | mode: ${modeLabel}`);

  // ── Warmup candle data ────────────────────────
  logger.info('[Bot] Warming up candle data...');
  let warmupResults;

  if (IS_OPTIONS) {
    await optionsManager.syncOpenTradeCount();

    // Warm up Nifty index candles
    const [candles, htfCandles] = await Promise.all([
      broker.getCandles(config.options.underlying, config.options.timeframe,    60),
      broker.getCandles(config.options.underlying, config.options.htfTimeframe, 100),
    ]);
    const ready = candles.length >= 30;
    if (!ready) logger.error('[Bot] Not enough Nifty candles — check API key');
    warmupResults = [{ symbol: 'NIFTY', entryCandles: candles.length, ready }];

  } else {
    await orderManager.syncOpenTradeCount();
    warmupResults = await downloader.warmup();
    const readyCount = warmupResults.filter(r => r.ready).length;
    if (readyCount === 0) {
      logger.error('[Bot] No equity symbols have enough data — check API key');
    }
  }

  // ── Send startup message ──────────────────────
  await sendStartupMessage(warmupResults);

  // ── Register /close command ───────────────────
  telegram.bot.onText(/\/close (.+)/, async (msg, match) => {
    const tradeId = match[1].trim();
    await telegram.sendMessage(`🔄 Closing trade \`${tradeId}\`...`);
    const mgr    = IS_OPTIONS ? optionsManager : orderManager;
    const result = await mgr.manualClose(tradeId);
    if (!result.success) {
      await telegram.sendMessage(`❗ Close failed: ${result.reason.replace(/_/g, '\\_')}`);
    }
  });

  // ── Scan + checker intervals ──────────────────
  if (IS_OPTIONS) {
    await runOptionsScan();
    setInterval(runOptionsScan, config.options.scanIntervalMs);
    // Check open options paper trades every minute
    setInterval(() => optionsManager.checkOpenTrades(), 60 * 1000);
  } else {
    await runScan();
    setInterval(runScan, config.scanIntervalMs);
    if (IS_PAPER) {
      setInterval(() => paperTrader.checkOpenTrades(), 1 * 60 * 1000);
    }
  }

  // ── End of day at 3:25 PM IST ─────────────────
  let eodDoneDateStr = '';
  setInterval(async () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = ist.toDateString();
    if (ist.getHours() === 15 && ist.getMinutes() >= 25 && eodDoneDateStr !== dateStr) {
      eodDoneDateStr = dateStr;

      if (IS_OPTIONS) {
        await optionsManager.endOfDay();
        const s = await optionsManager.getPnLSummary({ period: 'today' });
        await telegram.sendDailySummary({
          trades: s.closed, wins: s.wins, losses: s.losses, pnl: s.totalPnL,
        });
      } else {
        await orderManager.endOfDay();
        const s = await paperTrader.getPnLSummary({ period: 'today' });
        await telegram.sendDailySummary({
          trades: s.closed, wins: s.wins, losses: s.losses, pnl: s.totalPnL,
        });
      }

      downloader.clearCache();
    }
  }, 60000);
}

runBot().catch(async err => {
  logger.error(`[Bot] Crash: ${err.message}`);
  await telegram.sendMessage(`🚨 *Bot Crashed*\n\`${err.message}\``);
  process.exit(1);
});