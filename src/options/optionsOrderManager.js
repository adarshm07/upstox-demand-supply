const config       = require('../../config');
const broker       = require('../broker/upstox');
const Trade        = require('../db/models/Trade');
const telegram     = require('../telegram/telegramBot');
const niftySignals = require('./niftySignals');
const logger       = require('../utils/logger');

const OPT      = config.options;
const TRADE_MODE = 'options-paper';  // live options trading not yet wired

class OptionsOrderManager {
  constructor() {
    this.openTradeCount  = 0;
    this.dailyTradeCount = 0;
    this.recentSignals   = new Map();
  }

  // ─────────────────────────────────────────────
  // ENTRY POINT — called per scan from index.js
  // ─────────────────────────────────────────────
  async process(signal) {
    const { symbolName, entry: premium, optionType, strike, lots } = signal;

    // Guard: daily trade limit
    if (this.dailyTradeCount >= OPT.maxTradesPerDay) {
      logger.warn(`[OptsManager] Daily trade limit (${OPT.maxTradesPerDay}) reached`);
      await telegram.sendMessage(
        `⚠️ *Options signal skipped — ${symbolName}*\n` +
        `Max daily trades (${OPT.maxTradesPerDay}) reached`
      );
      return { success: false, reason: 'max_daily_trades' };
    }

    // Guard: duplicate signal within 5 min
    if (this._isDuplicate(symbolName)) {
      logger.warn(`[OptsManager] Duplicate signal for ${symbolName} — skipping`);
      return { success: false, reason: 'duplicate' };
    }

    // Telegram confirmation
    const confirmed = await telegram.requestTradeConfirmation({
      ...signal,
      type:            optionType,        // 'CE' or 'PE' shown as direction
      qty:             signal.totalUnits, // displayed as number of units
      conditionLog:    niftySignals.formatConditionLog(signal.conditionResults),
      capitalSummary:
        `💰 *Options Position*\n` +
        `   Type:       ${optionType} (${optionType === 'CE' ? 'Bullish' : 'Bearish'})\n` +
        `   Strike:     ₹${strike}\n` +
        `   Expiry:     ${signal.expiryDate}\n` +
        `   Lots:       ${lots} × ${OPT.lotSize} units\n` +
        `   Premium:    ₹${premium}/unit\n` +
        `   Total Cost: ₹${(premium * signal.totalUnits).toFixed(0)}\n` +
        `   Max Risk:   ₹${signal.riskAmount} (${OPT.maxRiskPct}% of capital)`,
      estimatedCharges: 0,
      breakevenPts:     0,
    });

    if (!confirmed) {
      logger.info(`[OptsManager] User rejected ${symbolName}`);
      return { success: false, reason: 'user_rejected' };
    }

    // Open paper trade
    try {
      const trade = await Trade.create({
        mode:             TRADE_MODE,
        symbolName:       signal.symbolName,
        instrumentKey:    signal.instrumentKey,
        type:             'BUY',           // options are always bought (long)
        productType:      'intraday',
        entryPrice:       signal.entry,    // premium per unit
        sl:               signal.sl,       // premium at SL level
        tp:               signal.tp,       // premium at TP level
        qty:              signal.totalUnits,
        capitalUsed:      parseFloat((signal.entry * signal.totalUnits).toFixed(2)),
        riskAmount:       signal.riskAmount,
        rrRatio:          parseFloat(signal.rr) || 0,
        zoneType:         signal.zone.type,
        zoneHigh:         signal.zone.high,
        zoneLow:          signal.zone.low,
        pattern:          signal.pattern || null,
        conditionsPassed: signal.passCount,
        status:           'open',
        entryTime:        new Date(),
        // Options-specific
        optionType:       signal.optionType,
        strike:           signal.strike,
        lots:             signal.lots,
        lotSize:          signal.lotSize,
        expiryDate:       signal.expiryDate,
      });

      this.openTradeCount++;
      this.dailyTradeCount++;
      this._markRecentSignal(symbolName);

      logger.info(`[OptsManager] Paper trade opened | ${symbolName} | ID: ${trade._id}`);

      await telegram.sendMessage(
        `📝 *Options Paper Trade Opened*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 ${signal.symbolName}\n` +
        `📊 ${optionType} Strike ₹${strike} | Expiry ${signal.expiryDate}\n` +
        `💰 Premium: ₹${signal.entry}/unit\n` +
        `📦 Lots: ${lots} × ${OPT.lotSize} = ${signal.totalUnits} units\n` +
        `💵 Total Cost: ₹${(signal.entry * signal.totalUnits).toFixed(0)}\n` +
        `🛑 SL: ₹${signal.sl}/unit (${OPT.slDropPct}% drop)\n` +
        `🎯 TP: ₹${signal.tp}/unit (${OPT.tpMultiplier}×)\n` +
        `⚠️  Max Risk: ₹${signal.riskAmount}\n` +
        `🆔 ID: \`${trade._id.toString().slice(0, 8)}\`\n\n` +
        `_/optionpnl to check performance_`
      );

      return { success: true, mode: TRADE_MODE, tradeId: trade._id };

    } catch (err) {
      logger.error(`[OptsManager] Failed to open trade: ${err.message}`);
      await telegram.sendMessage(`❗ *Options order failed — ${symbolName}*\n${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // CHECK open options trades vs live option LTP
  // SL: premium ≤ slLevel
  // TP: premium ≥ tpLevel
  // Auto-close: option expiry date reached
  // ─────────────────────────────────────────────
  async checkOpenTrades() {
    const openTrades = await Trade.find({ status: 'open', mode: TRADE_MODE });

    for (const trade of openTrades) {
      try {
        const ltp = await broker.getLTP(trade.instrumentKey);
        if (!ltp) continue;

        let shouldClose  = false;
        let exitPremium, closeStatus;

        if (ltp <= trade.sl) {
          exitPremium  = trade.sl;
          closeStatus  = 'closed_sl';
          shouldClose  = true;
        } else if (ltp >= trade.tp) {
          exitPremium  = trade.tp;
          closeStatus  = 'closed_tp';
          shouldClose  = true;
        } else if (trade.expiryDate) {
          // Auto-close on expiry day at whatever LTP is available
          const today = new Date().toISOString().split('T')[0];
          if (trade.expiryDate <= today) {
            exitPremium = ltp;
            closeStatus  = 'closed_manual';
            shouldClose  = true;
            logger.info(`[OptsManager] Auto-close on expiry: ${trade.symbolName}`);
          }
        }

        if (shouldClose) {
          const grossPnL = parseFloat(
            ((exitPremium - trade.entryPrice) * trade.qty).toFixed(2)
          );
          await trade.closeTrade(exitPremium, closeStatus, { netPnL: grossPnL });
          if (this.openTradeCount > 0) this.openTradeCount--;

          logger.info(
            `[OptsManager] ${trade.symbolName} ${closeStatus} | ` +
            `Exit: ₹${exitPremium}/unit | P&L: ₹${grossPnL}`
          );

          const emoji = grossPnL >= 0 ? '🟢' : '🔴';
          const label = closeStatus === 'closed_tp' ? 'TARGET HIT'
                      : closeStatus === 'closed_sl' ? 'STOP HIT'
                      : 'CLOSED';
          await telegram.sendMessage(
            `${emoji} *Options Trade — ${label}*\n` +
            `📌 ${trade.symbolName}\n` +
            `Entry: ₹${trade.entryPrice} → Exit: ₹${exitPremium}\n` +
            `Units: ${trade.qty} | P&L: ₹${grossPnL}`
          );
        }

      } catch (err) {
        logger.error(`[OptsManager] checkOpenTrades [${trade.symbolName}]: ${err.message}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // MANUAL CLOSE — via /close <tradeId> in Telegram
  // ─────────────────────────────────────────────
  async manualClose(tradeId) {
    try {
      const trade = await Trade.findById(tradeId);
      if (!trade || trade.mode !== TRADE_MODE) {
        return { success: false, reason: 'Options trade not found' };
      }
      if (trade.status !== 'open') {
        return { success: false, reason: `Trade already ${trade.status}` };
      }

      const ltp = await broker.getLTP(trade.instrumentKey);
      if (!ltp) return { success: false, reason: 'Could not fetch option LTP' };

      const grossPnL = parseFloat(((ltp - trade.entryPrice) * trade.qty).toFixed(2));
      await trade.closeTrade(ltp, 'closed_manual', { netPnL: grossPnL });
      if (this.openTradeCount > 0) this.openTradeCount--;

      await telegram.sendMessage(
        `🔒 *Options Trade Manually Closed*\n` +
        `📌 ${trade.symbolName}\n` +
        `Entry: ₹${trade.entryPrice} | Exit: ₹${ltp}\n` +
        `Units: ${trade.qty} | Net P&L: ₹${grossPnL}`
      );

      return { success: true, netPnL: grossPnL };
    } catch (err) {
      logger.error(`[OptsManager] manualClose: ${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // SYNC — reload open trade count from DB on startup
  // ─────────────────────────────────────────────
  async syncOpenTradeCount() {
    const count = await Trade.countDocuments({ mode: TRADE_MODE, status: 'open' });
    this.openTradeCount = count;
    logger.info(`[OptsManager] Synced open options trades: ${count}`);
    return count;
  }

  // ─────────────────────────────────────────────
  // DAILY P&L — today's closed options P&L
  // ─────────────────────────────────────────────
  async getDailyPnL() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const trades = await Trade.find({
      mode:      TRADE_MODE,
      status:    { $ne: 'open' },
      entryTime: { $gte: start },
    }).lean();
    return trades.reduce((s, t) => s + (t.pnl || 0), 0);
  }

  // ─────────────────────────────────────────────
  // P&L SUMMARY — queried from MongoDB
  // period: 'today' | 'week' | 'month' | 'all'
  // ─────────────────────────────────────────────
  async getPnLSummary({ period = 'today' } = {}) {
    const filter = { mode: TRADE_MODE };

    if (period !== 'all') {
      const start = new Date();
      if (period === 'today') start.setHours(0, 0, 0, 0);
      else if (period === 'week')  start.setDate(start.getDate() - 7);
      else if (period === 'month') start.setDate(start.getDate() - 30);
      filter.entryTime = { $gte: start };
    }

    const trades   = await Trade.find(filter).lean();
    const closed   = trades.filter(t => t.status !== 'open');
    const wins     = closed.filter(t => t.status === 'closed_tp');
    const losses   = closed.filter(t => t.status === 'closed_sl');
    const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate  = closed.length ? (wins.length / closed.length) * 100 : 0;

    return {
      period,
      total:    trades.length,
      closed:   closed.length,
      open:     trades.filter(t => t.status === 'open').length,
      wins:     wins.length,
      losses:   losses.length,
      winRate:  winRate.toFixed(1),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
    };
  }

  // ─────────────────────────────────────────────
  // EOD — close all open positions, reset counters
  // ─────────────────────────────────────────────
  async endOfDay() {
    const openTrades = await Trade.find({ status: 'open', mode: TRADE_MODE });

    for (const trade of openTrades) {
      const ltp         = await broker.getLTP(trade.instrumentKey);
      const exitPremium = ltp || 0;  // expired worthless if no market
      const grossPnL    = parseFloat(((exitPremium - trade.entryPrice) * trade.qty).toFixed(2));
      await trade.closeTrade(exitPremium, 'closed_manual', { netPnL: grossPnL });
      logger.info(`[OptsManager] EOD close | ${trade.symbolName} | P&L: ₹${grossPnL}`);
    }

    this.openTradeCount  = 0;
    this.dailyTradeCount = 0;
    this.recentSignals.clear();
    logger.info('[OptsManager] EOD reset complete');
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  _isDuplicate(symbolName) {
    const last    = this.recentSignals.get(symbolName);
    const fiveMin = 5 * 60 * 1000;
    return last && (Date.now() - last) < fiveMin;
  }

  _markRecentSignal(symbolName) {
    this.recentSignals.set(symbolName, Date.now());
  }
}

module.exports = new OptionsOrderManager();
