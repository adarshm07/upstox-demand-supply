const config = require('../../config');
const logger = require('../utils/logger');

class CapitalManager {

  // ─────────────────────────────────────────────
  // Calculate qty and capital based on mode
  //
  // modes:
  //   'fixed'   → spend exactly CAPITAL_PER_TRADE ₹
  //   'percent' → spend X% of total capital
  //   'risk'    → size based on 2% risk rule
  // ─────────────────────────────────────────────
  calculate({ entryPrice, sl, mode = null }) {
    const cfg         = config.capital;
    const activeMode  = mode || cfg.mode;
    const riskPerShare = Math.abs(entryPrice - sl);

    if (riskPerShare <= 0) {
      logger.warn('capitalManager: riskPerShare is 0 — check SL');
      return null;
    }

    let qty, capitalUsed, riskAmount;

    switch (activeMode) {

      // ── Fixed ₹ amount per trade ─────────────
      case 'fixed': {
        const budget = cfg.perTrade;
        qty          = Math.floor(budget / entryPrice);
        capitalUsed  = qty * entryPrice;
        riskAmount   = qty * riskPerShare;
        logger.info(`[Capital] Mode=fixed | Budget=₹${budget} | Qty=${qty}`);
        break;
      }

      // ── % of total capital ───────────────────
      case 'percent': {
        const budget = cfg.total * (cfg.pctPerTrade / 100);
        qty          = Math.floor(budget / entryPrice);
        capitalUsed  = qty * entryPrice;
        riskAmount   = qty * riskPerShare;
        logger.info(`[Capital] Mode=percent | ${cfg.pctPerTrade}% of ₹${cfg.total} = ₹${budget.toFixed(0)} | Qty=${qty}`);
        break;
      }

      // ── Risk-based (default 2% rule) ─────────
      case 'risk':
      default: {
        const maxRisk = cfg.total * (cfg.maxRiskPct / 100);
        const riskQty = Math.floor(maxRisk / riskPerShare);
        // Cap qty so cost never exceeds available capital
        const maxQty  = Math.floor(cfg.total / entryPrice);
        qty           = Math.min(riskQty, maxQty);
        capitalUsed   = qty * entryPrice;
        riskAmount    = qty * riskPerShare;
        logger.info(`[Capital] Mode=risk | MaxRisk=₹${maxRisk.toFixed(0)} | RiskPerShare=₹${riskPerShare.toFixed(2)} | Qty=${qty} (capped at ${maxQty})`);
        break;
      }
    }

    if (qty < 1) {
      logger.warn(`[Capital] Qty < 1 — trade not viable`);
      return null;
    }

    return {
      qty,
      capitalUsed:  parseFloat(capitalUsed.toFixed(2)),
      riskAmount:   parseFloat(riskAmount.toFixed(2)),
      riskPct:      parseFloat(((riskAmount / cfg.total) * 100).toFixed(2)),
      mode:         activeMode,
    };
  }

  // Summary string for Telegram
  summary({ qty, capitalUsed, riskAmount, riskPct, mode }) {
    return (
      `💰 *Capital Allocation*\n` +
      `   Mode: \`${mode}\`\n` +
      `   Qty: ${qty} shares\n` +
      `   Capital Used: ₹${capitalUsed.toLocaleString('en-IN')}\n` +
      `   Risk: ₹${riskAmount.toLocaleString('en-IN')} (${riskPct}%)`
    );
  }
}

module.exports = new CapitalManager();