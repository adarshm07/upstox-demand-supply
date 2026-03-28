/**
 * Indian Stock Market Charges Calculator
 * Covers: Intraday (MIS) and Delivery (CNC)
 *
 * Charges included:
 *  1. Brokerage        — flat ₹20 or 0.03% per order (whichever is lower)
 *  2. STT              — Securities Transaction Tax
 *  3. Exchange charges — NSE transaction charges
 *  4. SEBI charges     — regulatory fee
 *  5. Stamp duty       — state govt levy (buy side only)
 *  6. GST              — 18% on brokerage + exchange charges
 *
 * All rates as per NSE/SEBI guidelines (2024–25)
 */

const CHARGES = {
  intraday: {
    // Flat ₹20 per executed order OR 0.03% of turnover — whichever is lower
    brokeragePct:     0.0003,       // 0.03%
    brokerageFlat:    20,           // ₹20 per order cap

    // STT: 0.025% on SELL side turnover only (intraday)
    sttPct:           0.00025,
    sttSide:          'sell',

    // NSE Exchange transaction charge: 0.00322% on total turnover
    exchangePct:      0.0000322,

    // SEBI charges: ₹10 per crore = 0.000001 of turnover
    sebiPct:          0.000001,

    // Stamp duty: 0.003% on BUY side only
    stampPct:         0.00003,
    stampSide:        'buy',

    // GST: 18% on (brokerage + exchange charges)
    gstPct:           0.18,
  },

  delivery: {
    brokeragePct:     0,            // Zero brokerage on delivery (Upstox/Zerodha)
    brokerageFlat:    0,

    // STT: 0.1% on BOTH buy and sell for delivery
    sttPct:           0.001,
    sttSide:          'both',

    // NSE Exchange: 0.00322%
    exchangePct:      0.0000322,

    // SEBI: ₹10 per crore
    sebiPct:          0.000001,

    // Stamp duty: 0.015% on BUY side only
    stampPct:         0.00015,
    stampSide:        'buy',

    gstPct:           0.18,
  },
};

class BrokerageCalculator {

  /**
   * Calculate all charges for a trade
   *
   * @param {Object} params
   * @param {number} params.entryPrice   - Entry price per share
   * @param {number} params.exitPrice    - Exit price per share
   * @param {number} params.qty          - Number of shares
   * @param {string} params.tradeType    - 'BUY' or 'SELL' (direction)
   * @param {string} params.productType  - 'intraday' or 'delivery'
   * @returns {Object}                   - Full charges breakdown + net P&L
   */
  calculate({ entryPrice, exitPrice, qty, tradeType = 'BUY', productType = 'intraday' }) {
    const rates = CHARGES[productType] || CHARGES.intraday;

    const buyPrice  = tradeType === 'BUY' ? entryPrice : exitPrice;
    const sellPrice = tradeType === 'BUY' ? exitPrice  : entryPrice;

    const buyTurnover  = buyPrice  * qty;
    const sellTurnover = sellPrice * qty;
    const totalTurnover = buyTurnover + sellTurnover;

    // ── 1. Brokerage ─────────────────────────────
    // Charged on BOTH buy and sell legs
    const brokeragePerLeg = Math.min(
      rates.brokerageFlat,
      buyTurnover * rates.brokeragePct
    );
    const brokerage = productType === 'delivery'
      ? 0    // zero brokerage delivery
      : parseFloat((brokeragePerLeg * 2).toFixed(2));

    // ── 2. STT ───────────────────────────────────
    let stt = 0;
    if (rates.sttSide === 'sell') {
      stt = sellTurnover * rates.sttPct;
    } else if (rates.sttSide === 'both') {
      stt = totalTurnover * rates.sttPct;
    }
    stt = parseFloat(stt.toFixed(2));

    // ── 3. Exchange Transaction Charges ──────────
    const exchangeCharges = parseFloat(
      (totalTurnover * rates.exchangePct).toFixed(2)
    );

    // ── 4. SEBI Charges ──────────────────────────
    const sebiCharges = parseFloat(
      (totalTurnover * rates.sebiPct).toFixed(2)
    );

    // ── 5. Stamp Duty ─────────────────────────────
    // Only on buy side
    const stampDuty = parseFloat(
      (buyTurnover * rates.stampPct).toFixed(2)
    );

    // ── 6. GST ───────────────────────────────────
    // 18% on brokerage + exchange charges
    const gst = parseFloat(
      ((brokerage + exchangeCharges) * rates.gstPct).toFixed(2)
    );

    // ── Total Charges ─────────────────────────────
    const totalCharges = parseFloat(
      (brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst).toFixed(2)
    );

    // ── Gross P&L ─────────────────────────────────
    const grossPnL = parseFloat(
      (tradeType === 'BUY'
        ? (exitPrice - entryPrice) * qty
        : (entryPrice - exitPrice) * qty
      ).toFixed(2)
    );

    // ── Net P&L (after all charges) ───────────────
    const netPnL = parseFloat((grossPnL - totalCharges).toFixed(2));

    // ── Breakeven move needed to cover charges ────
    const breakevenPts = parseFloat(
      (totalCharges / qty).toFixed(2)
    );

    return {
      // Inputs
      entryPrice,
      exitPrice,
      qty,
      productType,
      buyTurnover:   parseFloat(buyTurnover.toFixed(2)),
      sellTurnover:  parseFloat(sellTurnover.toFixed(2)),
      totalTurnover: parseFloat(totalTurnover.toFixed(2)),

      // Charge breakdown
      charges: {
        brokerage,
        stt,
        exchangeCharges,
        sebiCharges,
        stampDuty,
        gst,
        total: totalCharges,
      },

      // P&L
      grossPnL,
      totalCharges,
      netPnL,
      netPnLPct:    parseFloat(((netPnL / (entryPrice * qty)) * 100).toFixed(4)),
      breakevenPts,  // price must move this many ₹ per share just to break even
    };
  }

  /**
   * Estimate charges at trade ENTRY (before exit price is known)
   * Useful to show estimated cost before opening trade
   */
  estimateAtEntry({ entryPrice, qty, productType = 'intraday' }) {
    // Estimate assuming trade closes at breakeven (exit = entry)
    const estimate = this.calculate({
      entryPrice,
      exitPrice:   entryPrice,
      qty,
      tradeType:   'BUY',
      productType,
    });

    return {
      estimatedCharges: estimate.charges.total,
      breakevenPts:     estimate.breakevenPts,
      // Price must move at least this much to be profitable
      minMoveForProfit: parseFloat((estimate.charges.total / qty).toFixed(2)),
    };
  }

  /**
   * Format charges breakdown as a Telegram-friendly string
   */
  formatForTelegram(calc) {
    const { charges, grossPnL, netPnL, breakevenPts } = calc;
    const netEmoji = netPnL >= 0 ? '🟢' : '🔴';

    return (
      `💸 *Charges Breakdown*\n` +
      `   Brokerage:  ₹${charges.brokerage}\n` +
      `   STT:        ₹${charges.stt}\n` +
      `   Exch Chrg:  ₹${charges.exchangeCharges}\n` +
      `   SEBI:       ₹${charges.sebiCharges}\n` +
      `   Stamp Duty: ₹${charges.stampDuty}\n` +
      `   GST:        ₹${charges.gst}\n` +
      `   ─────────────────\n` +
      `   Total:      ₹${charges.total}\n` +
      `\n` +
      `📊 *P&L Summary*\n` +
      `   Gross P&L:  ₹${grossPnL}\n` +
      `   Charges:   -₹${charges.total}\n` +
      `   ${netEmoji} Net P&L:   ₹${netPnL}\n` +
      `   Breakeven:  ₹${breakevenPts}/share`
    );
  }
}

module.exports = new BrokerageCalculator();