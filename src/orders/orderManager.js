const config       = require('../../config');
const broker       = require('../broker/upstox');
const paperTrader  = require('../paper/paperTrader');
const capitalMgr   = require('../risk/capitalManager');
const calculator   = require('../charges/brokerageCalculator');
const Trade        = require('../db/models/Trade');
const telegram     = require('../telegram/telegramBot');
const signals      = require('../strategy/signals');
const logger       = require('../utils/logger');

const IS_PAPER = config.tradeMode === 'paper';

class OrderManager {
  constructor() {
    // Track open trade count in memory to avoid repeated DB calls
    this.openTradeCount = 0;

    // Prevent duplicate signals firing for same symbol in same scan
    this.recentSignals = new Map(); // symbolName → timestamp
  }

  // ─────────────────────────────────────────────
  // ENTRY POINT — called from index.js per signal
  // ─────────────────────────────────────────────
  async process(signal) {
    const { symbolName, entry, sl, tp, type, instrumentKey, productType = 'intraday' } = signal;

    logger.info(`[OrderManager] Processing signal | ${symbolName} ${type} @ ₹${entry}`);

    // ── Guard: duplicate signal within 5 min ────
    if (this._isDuplicate(symbolName)) {
      logger.warn(`[OrderManager] Duplicate signal for ${symbolName} — skipping`);
      return { success: false, reason: 'duplicate' };
    }

    // ── Guard: max open trades ───────────────────
    if (this.openTradeCount >= config.capital.maxOpenTrades) {
      logger.warn(`[OrderManager] Max open trades (${config.capital.maxOpenTrades}) reached`);
      await telegram.sendMessage(
        `⚠️ *Signal skipped — ${symbolName}*\n` +
        `Max open trades (${config.capital.maxOpenTrades}) already reached`
      );
      return { success: false, reason: 'max_trades' };
    }

    // ── Step 1: Calculate position size ─────────
    const capitalInfo = capitalMgr.calculate({ entryPrice: entry, sl, productType });
    if (!capitalInfo) {
      logger.warn(`[OrderManager] Capital calculation failed for ${symbolName}`);
      await telegram.sendMessage(`⚠️ *${symbolName}* — Capital calc failed, trade skipped`);
      return { success: false, reason: 'capital_calc_failed' };
    }

    // Attach calculated values to signal for Telegram display
    signal.qty         = capitalInfo.qty;
    signal.capitalInfo = capitalInfo;

    // ── Step 2: Estimate charges at entry ────────
    const estimate = calculator.estimateAtEntry({
      entryPrice: entry,
      qty:        capitalInfo.qty,
      productType,
    });

    logger.info(
      `[OrderManager] ${symbolName} | Qty: ${capitalInfo.qty} | ` +
      `Capital: ₹${capitalInfo.capitalUsed} | ` +
      `Est. charges: ₹${estimate.estimatedCharges} | ` +
      `Breakeven move: ₹${estimate.breakevenPts}/share`
    );

    // ── Step 3: Telegram confirmation ───────────
    const confirmed = await telegram.requestTradeConfirmation({
      ...signal,
      conditionLog:    signals.formatConditionLog(signal.conditionResults),
      capitalSummary:  capitalMgr.summary(capitalInfo),
      estimatedCharges: estimate.estimatedCharges,
      breakevenPts:    estimate.breakevenPts,
    });

    if (!confirmed) {
      logger.info(`[OrderManager] User rejected trade for ${symbolName}`);
      return { success: false, reason: 'user_rejected' };
    }

    // ── Step 4: Route to paper or live ──────────
    const result = IS_PAPER
      ? await this._placePaperOrder(signal, capitalInfo, estimate, productType)
      : await this._placeLiveOrder(signal, capitalInfo, productType);

    if (result.success) {
      this.openTradeCount++;
      this._markRecentSignal(symbolName);
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // PAPER ORDER
  // ─────────────────────────────────────────────
  async _placePaperOrder(signal, capitalInfo, estimate, productType) {
    const { symbolName, type, entry, sl, tp } = signal;

    try {
      const trade = await paperTrader.openTrade(
        { ...signal, productType },
        capitalInfo
      );

      logger.info(`[OrderManager][Paper] Trade opened | ID: ${trade._id}`);

      await telegram.sendMessage(
        `📝 *Paper Trade Opened*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 ${symbolName} ${type}\n` +
        `💰 Entry:    ₹${entry}\n` +
        `📦 Qty:      ${capitalInfo.qty} shares\n` +
        `🛑 SL:       ₹${sl}\n` +
        `🎯 TP:       ₹${tp}\n` +
        `⚠️  Risk:     ₹${capitalInfo.riskAmount}\n` +
        `💸 Est. fees: ₹${estimate.estimatedCharges}\n` +
        `📐 Breakeven: ₹${estimate.breakevenPts}/share\n` +
        `🆔 ID: \`${trade._id.toString().slice(0, 8)}\`\n\n` +
        `_/pnl to check performance_`
      );

      return { success: true, mode: 'paper', tradeId: trade._id };

    } catch (err) {
      logger.error(`[OrderManager][Paper] Failed: ${err.message}`);
      await telegram.sendMessage(`❗ *Paper order failed — ${symbolName}*\n${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // LIVE ORDER
  // 1. Place limit entry order
  // 2. Place GTT orders for SL and TP
  // 3. Store trade in DB for tracking
  // ─────────────────────────────────────────────
  async _placeLiveOrder(signal, capitalInfo, productType) {
    const {
      instrumentKey, symbolName, type,
      entry, sl, tp, rr, zone, pattern, passCount,
    } = signal;
    const { qty, capitalUsed, riskAmount } = capitalInfo;

    try {
      // Place entry order
      const orderId = await broker.placeOrder({
        instrumentKey,
        type,
        qty,
        price: entry,
        tag:   'SD_Strategy',
      });

      logger.info(`[OrderManager][Live] Entry order placed | OrderID: ${orderId}`);

      // Place GTT for SL and TP
      const { slOrderId, tpOrderId } = await broker.placeGTTOrders({
        instrumentKey,
        type,
        qty,
        sl,
        tp,
        entryPrice: entry,
      });

      logger.info(`[OrderManager][Live] GTT orders set | SL: ${slOrderId} | TP: ${tpOrderId}`);

      // Store in DB for record keeping
      const trade = await Trade.create({
        mode:             'live',
        symbolName,
        instrumentKey,
        type,
        productType,
        entryPrice:       entry,
        sl, tp,
        qty,
        capitalUsed,
        riskAmount,
        rrRatio:          rr,
        zoneType:         zone.type,
        zoneHigh:         zone.high,
        zoneLow:          zone.low,
        pattern:          pattern || null,
        conditionsPassed: passCount,
        status:           'open',
        orderId,
        slOrderId,
        tpOrderId,
      });

      await telegram.notifyOrderResult({
        symbol:  symbolName,
        success: true,
        orderId,
      });

      return { success: true, mode: 'live', orderId, tradeId: trade._id };

    } catch (err) {
      logger.error(`[OrderManager][Live] Failed: ${err.message}`);
      await telegram.notifyOrderResult({
        symbol:  symbolName,
        success: false,
        error:   err.message,
      });
      return { success: false, reason: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // MANUAL CLOSE — close a paper trade by ID
  // Called via /close <id> Telegram command
  // ─────────────────────────────────────────────
  async manualClose(tradeId) {
    try {
      const trade = await Trade.findById(tradeId);

      if (!trade) {
        return { success: false, reason: 'Trade not found' };
      }
      if (trade.status !== 'open') {
        return { success: false, reason: `Trade already ${trade.status}` };
      }

      const ltp = await broker.getLTP(trade.instrumentKey);
      if (!ltp) {
        return { success: false, reason: 'Could not fetch live price' };
      }

      const chargeCalc = calculator.calculate({
        entryPrice:  trade.entryPrice,
        exitPrice:   ltp,
        qty:         trade.qty,
        tradeType:   trade.type,
        productType: trade.productType || 'intraday',
      });

      await trade.closeTrade(ltp, 'closed_manual', chargeCalc);

      logger.info(
        `[OrderManager] Manual close | ${trade.symbolName} | ` +
        `Exit: ₹${ltp} | Net P&L: ₹${chargeCalc.netPnL}`
      );

      await telegram.sendMessage(
        `🔒 *Trade Manually Closed*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 ${trade.symbolName} ${trade.type}\n` +
        `💰 Entry:  ₹${trade.entryPrice}\n` +
        `💰 Exit:   ₹${ltp}\n` +
        `📦 Qty:    ${trade.qty}\n` +
        `\n` +
        calculator.formatForTelegram(chargeCalc)
      );

      if (this.openTradeCount > 0) this.openTradeCount--;

      return { success: true, netPnL: chargeCalc.netPnL };

    } catch (err) {
      logger.error(`[OrderManager] manualClose error: ${err.message}`);
      return { success: false, reason: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // SYNC — reload open trade count from DB
  // Called on bot startup to restore state
  // ─────────────────────────────────────────────
  async syncOpenTradeCount() {
    const count = await Trade.countDocuments({
      mode:   IS_PAPER ? 'paper' : 'live',
      status: 'open',
    });
    this.openTradeCount = count;
    logger.info(`[OrderManager] Synced open trades: ${count}`);
    return count;
  }

  // ─────────────────────────────────────────────
  // DAILY RESET — called at end of trading day
  // ─────────────────────────────────────────────
  async endOfDay() {
    // Paper mode: auto-close any remaining open trades at last LTP
    if (IS_PAPER) {
      const openTrades = await Trade.find({ status: 'open', mode: 'paper' });

      for (const trade of openTrades) {
        const ltp = await broker.getLTP(trade.instrumentKey);
        if (!ltp) continue;

        const chargeCalc = calculator.calculate({
          entryPrice:  trade.entryPrice,
          exitPrice:   ltp,
          qty:         trade.qty,
          tradeType:   trade.type,
          productType: trade.productType || 'intraday',
        });

        await trade.closeTrade(ltp, 'closed_manual', chargeCalc);
        logger.info(`[OrderManager] EOD close | ${trade.symbolName} | Net P&L: ₹${chargeCalc.netPnL}`);
      }
    }

    this.openTradeCount = 0;
    this.recentSignals.clear();
    logger.info('[OrderManager] End of day reset complete');
  }

  // ─────────────────────────────────────────────
  // HELPERS: duplicate signal guard
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

module.exports = new OrderManager();