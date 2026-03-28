const axios        = require('axios');
const downloader   = require('../data/dataDownloader');
const config       = require('../../config');
const logger       = require('../utils/logger');

const BASE_URL = 'https://api.upstox.com/v2';

class UpstoxBroker {
  constructor() {
    this.accessToken = config.broker.accessToken;
    this.headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    };
  }

  // ─────────────────────────────────────────────
  // Delegate candle fetching to dataDownloader
  // ─────────────────────────────────────────────
  async getCandles(instrumentKey, interval, days = 60) {
    return downloader.getCandles(instrumentKey, interval, days);
  }

  // ─────────────────────────────────────────────
  // Live price (LTP)
  // ─────────────────────────────────────────────
  async getLTP(instrumentKey) {
    try {
      const encoded = encodeURIComponent(instrumentKey);
      const resp    = await axios.get(
        `${BASE_URL}/market-quote/ltp?instrument_key=${encoded}`,
        { headers: this.headers, timeout: 5000 }
      );
      const data = resp.data?.data || {};
      const key  = Object.keys(data)[0];
      return data[key]?.last_price || null;
    } catch (err) {
      logger.error(`[Upstox] getLTP error [${instrumentKey}]: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Place limit entry order
  // ─────────────────────────────────────────────
  async placeOrder({ instrumentKey, type, qty, price, tag = 'SD_Strategy' }) {
    try {
      const resp = await axios.post(
        `${BASE_URL}/order/place`,
        {
          quantity:         qty,
          product:          'I',
          validity:         'DAY',
          price,
          tag,
          instrument_token: instrumentKey,
          order_type:       'LIMIT',
          transaction_type: type,
          disclosed_quantity: 0,
          trigger_price:    0,
          is_amo:           false,
        },
        { headers: this.headers }
      );
      const orderId = resp.data?.data?.order_id;
      logger.info(`[Upstox] Order placed ✅ | ${type} ${qty}qty @ ₹${price} | ID: ${orderId}`);
      return orderId;
    } catch (err) {
      logger.error(`[Upstox] placeOrder failed: ${err.response?.data?.message || err.message}`);
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // GTT orders for SL and TP
  // ─────────────────────────────────────────────
  async placeGTTOrders({ instrumentKey, type, qty, sl, tp }) {
    const exitSide = type === 'BUY' ? 'SELL' : 'BUY';

    const [slResp, tpResp] = await Promise.all([
      axios.post(`${BASE_URL}/order/gtt`, {
        instrument_token: instrumentKey,
        transaction_type: exitSide,
        quantity:         qty,
        product:          'I',
        order_type:       'SL-M',
        trigger_price:    sl,
        tag:              'SD_SL',
      }, { headers: this.headers }),

      axios.post(`${BASE_URL}/order/gtt`, {
        instrument_token: instrumentKey,
        transaction_type: exitSide,
        quantity:         qty,
        product:          'I',
        order_type:       'LIMIT',
        price:            tp,
        trigger_price:    tp,
        tag:              'SD_TP',
      }, { headers: this.headers }),
    ]);

    return {
      slOrderId: slResp.data?.data?.order_id,
      tpOrderId: tpResp.data?.data?.order_id,
    };
  }

  // ─────────────────────────────────────────────
  // Get positions + daily P&L
  // ─────────────────────────────────────────────
  async getPositions() {
    const resp = await axios.get(
      `${BASE_URL}/portfolio/short-term-positions`,
      { headers: this.headers }
    );
    return resp.data?.data || [];
  }

  async getDailyPnL() {
    const positions = await this.getPositions();
    return positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  }
}

module.exports = new UpstoxBroker();