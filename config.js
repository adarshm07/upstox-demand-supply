require('dotenv').config();

module.exports = {
  tradeMode: process.env.TRADE_MODE || 'paper',  // 'paper' | 'live'

  broker: {
    apiKey:      process.env.UPSTOX_API_KEY,
    apiSecret:   process.env.UPSTOX_API_SECRET,
    redirectUri: process.env.UPSTOX_REDIRECT_URI,
    accessToken: process.env.UPSTOX_ACCESS_TOKEN,
  },

  telegram: {
    token:          process.env.TELEGRAM_BOT_TOKEN,
    chatId:         process.env.TELEGRAM_CHAT_ID,
    confirmTimeout: 60,
  },

  strategy: {
    symbols: [
      'NSE_EQ|INE002A01018',
      'NSE_EQ|INE009A01021',
      'NSE_EQ|INE467B01029',
      'NSE_EQ|INE040A01034',
      'NSE_EQ|INE090A01021',
      'NSE_EQ|INE062A01020',
      'NSE_EQ|INE296A01032',
      'NSE_EQ|INE237A01036',
      'NSE_EQ|INE238A01034',
      'NSE_EQ|INE075A01022',
      'NSE_EQ|INE860A01027',
      'NSE_EQ|INE585B01010',
      'NSE_EQ|INE018A01030',
      'NSE_EQ|INE021A01026',
      'NSE_EQ|INE280A01028',
      'NSE_EQ|INE669C01036',
      'NSE_EQ|INE044A01036',
      'NSE_EQ|INE089A01031',
      'NSE_EQ|INE213A01029',
      'NSE_EQ|INE752E01010',
      'NSE_EQ|INE733E01010',
      'NSE_EQ|INE397D01024',
      'NSE_EQ|INE154A01025',
    ],
    symbolNames: {
      'NSE_EQ|INE002A01018': 'RELIANCE',
      'NSE_EQ|INE009A01021': 'INFY',
      'NSE_EQ|INE467B01029': 'TCS',
      'NSE_EQ|INE040A01034': 'HDFCBANK',
      'NSE_EQ|INE090A01021': 'ICICIBANK',
      'NSE_EQ|INE062A01020': 'SBIN',
      'NSE_EQ|INE296A01032': 'BAJFINANCE',
      'NSE_EQ|INE237A01036': 'KOTAKBANK',
      'NSE_EQ|INE238A01034': 'AXISBANK',
      'NSE_EQ|INE075A01022': 'WIPRO',
      'NSE_EQ|INE860A01027': 'HCLTECH',
      'NSE_EQ|INE585B01010': 'MARUTI',
      'NSE_EQ|INE018A01030': 'LT',
      'NSE_EQ|INE021A01026': 'ASIANPAINT',
      'NSE_EQ|INE280A01028': 'TITAN',
      'NSE_EQ|INE669C01036': 'TECHM',
      'NSE_EQ|INE044A01036': 'SUNPHARMA',
      'NSE_EQ|INE089A01031': 'DRREDDY',
      'NSE_EQ|INE213A01029': 'ONGC',
      'NSE_EQ|INE752E01010': 'POWERGRID',
      'NSE_EQ|INE733E01010': 'NTPC',
      'NSE_EQ|INE397D01024': 'BHARTIARTL',
      'NSE_EQ|INE154A01025': 'ITC',
    },
    timeframe:        '30minute',
    htfTimeframe:     'day',
    atrPeriod:        14,
    atrMultiplier:    2.0,
    baseCandleCount:  5,
    baseRangeRatio:   1.5,
    minRiskReward:    3,
    zoneBuffer:       0.002,
    maxFreshTests:    1,
    volumeSpikeRatio: 1.5,
  },

  // ── Capital allocation ───────────────────────
  capital: {
    total:           Number(process.env.CAPITAL) || 100000,

    // 'fixed' | 'percent' | 'risk'
    mode:            process.env.CAPITAL_MODE || 'risk',

    // Used when mode = 'fixed'
    perTrade:        Number(process.env.CAPITAL_PER_TRADE) || 10000,

    // Used when mode = 'percent' (% of total capital)
    pctPerTrade:     Number(process.env.CAPITAL_PCT_PER_TRADE) || 10,

    // Used when mode = 'risk' (risk % per trade)
    maxRiskPct:      Number(process.env.MAX_RISK_PER_TRADE_PCT) || 2,
    maxDailyLossPct: Number(process.env.MAX_DAILY_LOSS_PCT) || 6,
    maxOpenTrades:   6,
  },

  db: {
   uri: process.env.MONGO_URI || 'mongodb://localhost:27017/sd_bot',
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },

  timing: {
    avoidOpenMinutes:  15,   // skip first 15 min after market open
    avoidCloseMinutes: 15,   // skip last 15 min before market close
  },

  // ── Paper-mode relaxed thresholds ────────────
  // These override strategy values only in paper mode
  paper: {
    atrMultiplier:    1.5,   // impulse ≥ 1.5× ATR  (live: 2.0×)
    minRiskReward:    2,     // R:R ≥ 1:2            (live: 1:3)
    maxZoneTests:     5,     // allow zones tested up to 5× (live: 0)
    volumeSpikeRatio: 1.2,   // volume ≥ 1.2× avg    (live: 1.5×)
    minPassCount:     2,     // need 2/10 conditions  (live: 10/10)
  },

  scanIntervalMs: 1000 * 60,  // 1 minute

  // ── Trading instrument mode ──────────────────
  // 'equity'  → scan the 23 NSE stocks (default)
  // 'options' → scan Nifty 50 weekly options
  tradeInstrument: process.env.TRADE_INSTRUMENT || 'equity',

  // ── Nifty 50 weekly options ──────────────────
  options: {
    underlying:     'NSE_INDEX|Nifty 50',
    underlyingName: 'NIFTY',
    lotSize:        25,      // NSE lot size for Nifty
    strikeStep:     50,      // Nifty strike intervals (50 pts)
    strikesITM:     1,       // go 1 strike ITM

    timeframe:    '15minute',
    htfTimeframe: 'day',

    // Capital & risk
    capital:         Number(process.env.OPTIONS_CAPITAL)          || 20000,
    maxPremiumPct:   Number(process.env.OPTIONS_MAX_PREMIUM_PCT)  || 10,   // % of capital to spend per trade
    maxRiskPct:      Number(process.env.OPTIONS_RISK_PCT)         || 1,    // % of capital = max loss per trade
    maxTradesPerDay: Number(process.env.OPTIONS_MAX_TRADES)       || 10,

    // Exit rules
    slDropPct:       50,     // exit if option premium drops this %
    tpMultiplier:    2.0,    // target = entry premium × multiplier
    minDaysToExpiry: 2,      // skip if expiry is within N days

    // Entry thresholds (relaxed for paper)
    minRiskReward:    2.0,
    atrMultiplier:    1.5,
    volumeSpikeRatio: 1.3,
    minPassCount:     5,     // need 5/10 conditions for paper

    // Zone detection params (same logic as equity)
    atrPeriod:       14,
    baseCandleCount: 5,
    baseRangeRatio:  1.5,
    zoneBuffer:      0.002,

    scanIntervalMs:  60 * 1000,
  },
};