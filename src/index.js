const config        = require('../config');
const signals       = require('./strategy/signals');
const broker        = require('./broker/upstox');
const orderManager  = require('./orders/orderManager');
const paperTrader   = require('./paper/paperTrader');
const downloader    = require('./data/dataDownloader');
const telegram      = require('./telegram/telegramBot');
const { connectDB } = require('./db/database');
const logger        = require('./utils/logger');

const IS_PAPER = config.tradeMode === 'paper';

// ─────────────────────────────────────────────
// SCAN
// ─────────────────────────────────────────────
async function runScan() {
  logger.info('[Bot] Starting scan...');

  const dailyPnL   = IS_PAPER ? 0 : await broker.getDailyPnL();
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
  await orderManager.syncOpenTradeCount();

  logger.info(`[Bot] Started in ${config.tradeMode.toUpperCase()} mode`);

  // ── Warmup: preload candle data before first scan ──
  logger.info('[Bot] Warming up candle data...');
  const warmupResults = await downloader.warmup();

  const readyCount = warmupResults.filter(r => r.ready).length;
  if (readyCount === 0) {
    logger.error('[Bot] No symbols have enough data — check API key and instrument keys');
  }

  // ── Send test/startup message to Telegram ─────
  await sendStartupMessage(warmupResults);

  // ── Register /close command ───────────────────
  telegram.bot.onText(/\/close (.+)/, async (msg, match) => {
    const tradeId = match[1].trim();
    await telegram.sendMessage(`🔄 Closing trade \`${tradeId}\`...`);
    const result = await orderManager.manualClose(tradeId);
    if (!result.success) {
      await telegram.sendMessage(`❗ Close failed: ${result.reason}`);
    }
  });

  // ── First scan ────────────────────────────────
  await runScan();

  // ── Recurring scan ────────────────────────────
  setInterval(runScan, config.scanIntervalMs);

  // ── Paper trade SL/TP checker every 5 min ────
  if (IS_PAPER) {
    setInterval(() => paperTrader.checkOpenTrades(), 5 * 60 * 1000);
  }

  // ── End of day at 3:25 PM IST ─────────────────
  setInterval(async () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    if (ist.getHours() === 15 && ist.getMinutes() === 25) {
      await orderManager.endOfDay();
      const s = await paperTrader.getPnLSummary({ period: 'today' });
      await telegram.sendDailySummary({
        trades: s.closed, wins: s.wins,
        losses: s.losses, pnl: s.totalNetPnL,
      });
      downloader.clearCache();  // clear cache at EOD
    }
  }, 60000);
}

runBot().catch(async err => {
  logger.error(`[Bot] Crash: ${err.message}`);
  await telegram.sendMessage(`🚨 *Bot Crashed*\n\`${err.message}\``);
  process.exit(1);
});