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
    ],
    symbolNames: {
      'NSE_EQ|INE002A01018': 'RELIANCE',
      'NSE_EQ|INE009A01021': 'INFY',
      'NSE_EQ|INE467B01029': 'TCS',
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
    maxOpenTrades:   3,
  },

  db: {
   uri: process.env.MONGO_URI || 'mongodb://localhost:27017/sd_bot',
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },

  scanIntervalMs: 60000,
};