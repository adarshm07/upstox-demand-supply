const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────
    mode: {
      type:     String,
      enum:     ['paper', 'live'],
      required: true,
      default:  'paper',
      index:    true,
    },
    symbolName: {
      type:     String,
      required: true,
      index:    true,
    },
    instrumentKey: {
      type:     String,
      required: true,
    },

    // ── Direction ─────────────────────────────────
    type: {
      type:     String,
      enum:     ['BUY', 'SELL'],
      required: true,
    },

    // ── Prices ───────────────────────────────────
    entryPrice: { type: Number, required: true },
    exitPrice:  { type: Number, default: null },
    sl:         { type: Number, required: true },
    tp:         { type: Number, required: true },

    // ── Size & Capital ────────────────────────────
    qty:         { type: Number, required: true },
    capitalUsed: { type: Number, required: true },
    riskAmount:  { type: Number, required: true },

    // ── Zone & Signal metadata ────────────────────
    zoneType: {
      type: String,
      enum: ['demand', 'supply'],
    },
    zoneHigh:         { type: Number },
    zoneLow:          { type: Number },
    rrRatio:          { type: Number },
    pattern:          { type: String, default: null },
    conditionsPassed: { type: Number, default: 0 },

    // ── Status ───────────────────────────────────
    status: {
      type:    String,
      enum:    ['open', 'closed_tp', 'closed_sl', 'closed_manual'],
      default: 'open',
      index:   true,
    },

    // ── P&L ──────────────────────────────────────
    pnl:    { type: Number, default: 0 },
    pnlPct: { type: Number, default: 0 },

    // ── Timestamps ───────────────────────────────
    entryTime: { type: Date, default: Date.now, index: true },
    exitTime:  { type: Date, default: null },

    // ── Broker order IDs (live mode only) ────────
    orderId:   { type: String, default: null },
    slOrderId: { type: String, default: null },
    tpOrderId: { type: String, default: null },
    notes:     { type: String, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt automatically
    collection: 'trades',
  }
);

// ── Compound indexes for common queries ──────────
TradeSchema.index({ mode: 1, status: 1 });
TradeSchema.index({ mode: 1, entryTime: -1 });
TradeSchema.index({ mode: 1, symbolName: 1, entryTime: -1 });

// ── Virtual: unrealised P&L (not stored) ─────────
TradeSchema.virtual('isOpen').get(function () {
  return this.status === 'open';
});

// ── Instance method: close the trade ─────────────
TradeSchema.methods.closeTrade = async function (exitPrice, status, chargeCalc = null) {
  const entry = this.entryPrice;
  // Use net P&L (fees deducted) if chargeCalc provided, otherwise gross
  const pnl = chargeCalc
    ? chargeCalc.netPnL
    : (this.type === 'BUY'
        ? (exitPrice - entry) * this.qty
        : (entry - exitPrice) * this.qty);
  const pnlPct = (pnl / this.capitalUsed) * 100;

  this.exitPrice = exitPrice;
  this.exitTime  = new Date();
  this.status    = status;
  this.pnl       = parseFloat(pnl.toFixed(2));
  this.pnlPct    = parseFloat(pnlPct.toFixed(4));

  return this.save();
};

module.exports = mongoose.model('Trade', TradeSchema);