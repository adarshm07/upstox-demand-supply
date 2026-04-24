const axios  = require('axios');
const config = require('../../config');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.upstox.com/v2';
const OPT      = config.options;

class OptionChain {
  constructor() {
    this.headers = {
      'Authorization': `Bearer ${config.broker.accessToken}`,
      'Accept':        'application/json',
    };
  }

  // ─────────────────────────────────────────────
  // Weekly expiry = next Thursday that is at least
  // minDaysToExpiry calendar days away.
  // Falls back to the Thursday after if current is too close.
  // ─────────────────────────────────────────────
  getWeeklyExpiry(minDays = OPT.minDaysToExpiry) {
    const now         = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    for (let offset = 0; offset <= 14; offset++) {
      const candidate = new Date(todayMidnight);
      candidate.setDate(todayMidnight.getDate() + offset);

      if (candidate.getDay() !== 4) continue;  // Thursdays only

      const daysAway = Math.round((candidate - todayMidnight) / (1000 * 60 * 60 * 24));
      if (daysAway >= minDays) {
        return candidate.toISOString().split('T')[0];  // YYYY-MM-DD
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // Fetch option chain for a given expiry date
  // Returns array of strike rows from Upstox API
  // ─────────────────────────────────────────────
  async fetchChain(instrumentKey, expiryDate) {
    try {
      const encoded = encodeURIComponent(instrumentKey);
      const resp    = await axios.get(
        `${BASE_URL}/option/chain?instrument_key=${encoded}&expiry_date=${expiryDate}`,
        { headers: this.headers, timeout: 10000 }
      );
      return resp.data?.data || [];
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      logger.error(`[OptionChain] fetchChain error (${expiryDate}): ${msg}`);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // Extract underlying spot price embedded in chain
  // ─────────────────────────────────────────────
  getSpotPrice(chain) {
    return chain[0]?.underlying_spot_price || null;
  }

  // ─────────────────────────────────────────────
  // Round to nearest Nifty strike interval
  // ─────────────────────────────────────────────
  roundToStrike(price, step = OPT.strikeStep) {
    return Math.round(price / step) * step;
  }

  // ─────────────────────────────────────────────
  // Find ITM strike
  //   CE (bullish demand zone): ITM = strike BELOW spot
  //   PE (bearish supply zone): ITM = strike ABOVE spot
  // strikesITM = 1 means 1 strike interval away from ATM
  // ─────────────────────────────────────────────
  findITMStrike(spotPrice, optionType, strikesITM = OPT.strikesITM) {
    const atm  = this.roundToStrike(spotPrice);
    const step = OPT.strikeStep;
    return optionType === 'CE'
      ? atm - strikesITM * step   // below spot → ITM for call
      : atm + strikesITM * step;  // above spot → ITM for put
  }

  // ─────────────────────────────────────────────
  // Pull option data (instrument key + market data)
  // from a chain row for a specific strike + type
  // ─────────────────────────────────────────────
  getOptionData(chain, strike, optionType) {
    const row = chain.find(c => c.strike_price === strike);
    if (!row) return null;

    const leg = optionType === 'CE' ? row.call_options : row.put_options;
    if (!leg?.instrument_key) return null;

    return {
      instrumentKey: leg.instrument_key,
      ltp:           leg.market_data?.ltp   || 0,
      delta:         leg.option_greeks?.delta || 0,
      iv:            leg.option_greeks?.iv    || 0,
      strike,
      optionType,
      expiryDate:    row.expiry,
    };
  }
}

module.exports = new OptionChain();
