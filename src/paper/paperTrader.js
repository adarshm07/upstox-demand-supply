const Trade      = require('../db/models/Trade');
const broker     = require('../broker/upstox');
const calculator = require('../charges/brokerageCalculator');
const logger     = require('../utils/logger');

class PaperTrader {

  // ─────────────────────────────────────────────
  // Open a new paper trade — insert into MongoDB
  // ─────────────────────────────────────────────
  async openTrade(signal, capitalInfo) {
    const {
      instrumentKey, symbolName, type, entry,
      sl, tp, rr, zone, pattern, conditionResults,
    } = signal;
    const { qty, capitalUsed, riskAmount } = capitalInfo;

    const trade = await Trade.create({
      mode:             'paper',
      symbolName,
      instrumentKey,
      type,
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
      conditionsPassed: conditionResults.filter(r => r.pass).length,
      status:           'open',
      entryTime:        new Date(),
    });

    logger.info(`[Paper] Trade opened | ${symbolName} ${type} @ ₹${entry} | ID: ${trade._id}`);
    return trade;
  }

  // ─────────────────────────────────────────────
  // Check all open paper trades against live LTP
  // Uses instance method closeTrade() on the model
  // ─────────────────────────────────────────────
  async checkOpenTrades() {
    const openTrades = await Trade.find({ status: 'open', mode: 'paper' });

    for (const trade of openTrades) {
      try {
        const ltp = await broker.getLTP(trade.instrumentKey);
        if (!ltp) continue;

        const sl = trade.sl;
        const tp = trade.tp;

        let shouldClose = false;
        let exitPrice, closeStatus;

        if (trade.type === 'BUY') {
          if (ltp <= sl) { exitPrice = sl; closeStatus = 'closed_sl'; shouldClose = true; }
          else if (ltp >= tp) { exitPrice = tp; closeStatus = 'closed_tp'; shouldClose = true; }
        } else {
          if (ltp >= sl) { exitPrice = sl; closeStatus = 'closed_sl'; shouldClose = true; }
          else if (ltp <= tp) { exitPrice = tp; closeStatus = 'closed_tp'; shouldClose = true; }
        }

        if (shouldClose) {
          const chargeCalc = calculator.calculate({
            entryPrice:  trade.entryPrice,
            exitPrice,
            qty:         trade.qty,
            tradeType:   trade.type,
            productType: trade.productType || 'intraday',
          });
          await trade.closeTrade(exitPrice, closeStatus, chargeCalc);
          logger.info(`[Paper] ${trade.symbolName} closed | ${closeStatus} | Net P&L: ₹${chargeCalc.netPnL}`);
        }

      } catch (err) {
        logger.error(`[Paper] checkOpenTrades error [${trade.symbolName}]: ${err.message}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // P&L SUMMARY — queried from MongoDB
  // period: 'today' | 'week' | 'month' | 'all'
  // ─────────────────────────────────────────────
  async getPnLSummary({ period = 'all', symbolName = null } = {}) {
    const filter = { mode: 'paper' };

    // Period filter
    if (period !== 'all') {
      const start = new Date();
      if (period === 'today') start.setHours(0, 0, 0, 0);
      else if (period === 'week')  start.setDate(start.getDate() - 7);
      else if (period === 'month') start.setDate(start.getDate() - 30);
      filter.entryTime = { $gte: start };
    }

    if (symbolName) filter.symbolName = symbolName;

    const trades = await Trade.find(filter).lean();

    const closed  = trades.filter(t => t.status !== 'open');
    const open    = trades.filter(t => t.status === 'open');
    const wins    = closed.filter(t => t.status === 'closed_tp');
    const losses  = closed.filter(t => t.status === 'closed_sl');

    const totalPnL     = closed.reduce((s, t) => s + t.pnl, 0);
    const totalCapital = closed.reduce((s, t) => s + t.capitalUsed, 0);
    const avgRR        = closed.length
      ? closed.reduce((s, t) => s + (t.rrRatio || 0), 0) / closed.length
      : 0;
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;

    // Best and worst trade
    const sorted = [...closed].sort((a, b) => b.pnl - a.pnl);
    const best   = sorted[0]  || null;
    const worst  = sorted[sorted.length - 1] || null;

    // Per-symbol breakdown using MongoDB aggregation
    const symbolAgg = await Trade.aggregate([
      { $match: { ...filter, status: { $ne: 'open' } } },
      {
        $group: {
          _id:    '$symbolName',
          pnl:    { $sum: '$pnl' },
          trades: { $sum: 1 },
          wins:   {
            $sum: { $cond: [{ $eq: ['$status', 'closed_tp'] }, 1, 0] },
          },
        },
      },
      { $sort: { pnl: -1 } },
    ]);

    const bySymbol = {};
    symbolAgg.forEach(s => {
      bySymbol[s._id] = {
        pnl:    parseFloat(s.pnl.toFixed(2)),
        trades: s.trades,
        wins:   s.wins,
      };
    });

    return {
      period,
      total:        trades.length,
      closed:       closed.length,
      open:         open.length,
      wins:         wins.length,
      losses:       losses.length,
      winRate:      winRate.toFixed(1),
      totalPnL:     parseFloat(totalPnL.toFixed(2)),
      totalCapital: parseFloat(totalCapital.toFixed(2)),
      pnlPct:       totalCapital > 0
                    ? ((totalPnL / totalCapital) * 100).toFixed(2)
                    : '0.00',
      avgRR:        avgRR.toFixed(2),
      best:  best  ? { symbol: best.symbolName,  pnl: best.pnl.toFixed(2)  } : null,
      worst: worst ? { symbol: worst.symbolName, pnl: worst.pnl.toFixed(2) } : null,
      bySymbol,
    };
  }
}

module.exports = new PaperTrader();