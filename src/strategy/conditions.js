const moment = require('moment');
const config = require('../../config');

class Conditions {

  // ─────────────────────────────────────────────
  // CONDITION 1: Zone must be FRESH (0 prior tests)
  // ─────────────────────────────────────────────
  isFreshZone(zone) {
    const pass = zone.testCount <= config.strategy.maxFreshTests - 1;
    return {
      pass,
      reason: pass
        ? `✅ C1 PASS: Zone is fresh (tested ${zone.testCount} times)`
        : `❌ C1 FAIL: Zone already tested ${zone.testCount} times — stale`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 2: Impulse move ≥ 2× ATR
  // ─────────────────────────────────────────────
  isStrongImpulse(zone, atrMultiplier = config.strategy.atrMultiplier) {
    const ratio = zone.impulseSize / zone.atr;
    const pass  = ratio >= atrMultiplier;
    return {
      pass,
      reason: pass
        ? `✅ C2 PASS: Impulse = ${ratio.toFixed(2)}× ATR (≥ ${atrMultiplier}×)`
        : `❌ C2 FAIL: Impulse too weak = ${ratio.toFixed(2)}× ATR`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 3: Higher timeframe trend alignment
  // HTF bullish → only take demand zones (BUY)
  // HTF bearish → only take supply zones (SELL)
  // ─────────────────────────────────────────────
  isHTFAligned(zone, htfCandles) {
    if (!htfCandles || htfCandles.length < 50) {
      return { pass: false, reason: '❌ C3 FAIL: Not enough HTF data' };
    }

    // Use 50 EMA as trend filter on daily chart
    const closes  = htfCandles.map(c => c.close);
    const ema50   = this.calcEMA(closes, 50);
    const lastEMA = ema50[ema50.length - 1];
    const lastClose = closes[closes.length - 1];

    const htfBullish = lastClose > lastEMA;
    const htfBearish = lastClose < lastEMA;

    const pass = (zone.type === 'demand' && htfBullish) ||
                 (zone.type === 'supply' && htfBearish);

    return {
      pass,
      reason: pass
        ? `✅ C3 PASS: HTF trend aligns (${htfBullish ? 'Bullish' : 'Bearish'}) with ${zone.type} zone`
        : `❌ C3 FAIL: HTF trend DOES NOT align — price ${htfBullish ? '>' : '<'} EMA50, zone is ${zone.type}`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 4: Risk-to-Reward ≥ 1:3
  // ─────────────────────────────────────────────
  isRRSufficient(zone, currentPrice, nextResistance, minRiskReward = config.strategy.minRiskReward) {
    let sl, tp, risk, reward;

    if (zone.type === 'demand') {
      sl     = Math.min(zone.low, currentPrice) * (1 - config.strategy.zoneBuffer);
      tp     = nextResistance;
      risk   = currentPrice - sl;
      reward = tp - currentPrice;
    } else {
      sl     = Math.max(zone.high, currentPrice) * (1 + config.strategy.zoneBuffer);
      tp     = nextResistance;        // next support for short
      risk   = sl - currentPrice;
      reward = currentPrice - tp;
    }

    if (risk <= 0) return { pass: false, reason: '❌ C4 FAIL: Invalid risk (≤ 0)', sl, tp };

    const rr   = reward / risk;
    const pass = rr >= minRiskReward;

    return {
      pass,
      rr: rr.toFixed(2),
      sl: parseFloat(sl.toFixed(2)),
      tp: parseFloat(tp.toFixed(2)),
      reason: pass
        ? `✅ C4 PASS: R:R = 1:${rr.toFixed(2)} (≥ 1:${minRiskReward})`
        : `❌ C4 FAIL: R:R = 1:${rr.toFixed(2)} — too low`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 5: Confirmation candle at zone
  // (Bullish Engulfing / Hammer / Pin Bar for demand)
  // (Bearish Engulfing / Shooting Star for supply)
  // ─────────────────────────────────────────────
  hasConfirmationCandle(candles, zone) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const body    = Math.abs(last.close - last.open);
    const range   = last.high - last.low;
    const upWick  = last.high - Math.max(last.close, last.open);
    const downWick = Math.min(last.close, last.open) - last.low;

    let pattern = null;

    if (zone.type === 'demand') {
      const isBullEngulf  = last.close > prev.open && last.open < prev.close && last.close > last.open;
      const isHammer      = downWick > body * 2 && upWick < body * 0.5;
      const isPinBar      = downWick > range * 0.6;
      const isDoji        = body < range * 0.1 && range > zone.atr * 0.3;

      if (isBullEngulf)  pattern = 'Bullish Engulfing';
      else if (isHammer) pattern = 'Hammer';
      else if (isPinBar) pattern = 'Pin Bar';
      else if (isDoji)   pattern = 'Doji (weak)';
    }

    if (zone.type === 'supply') {
      const isBearEngulf  = last.close < prev.open && last.open > prev.close && last.open > last.close;
      const isShootingStar = upWick > body * 2 && downWick < body * 0.5;
      const isPinBar      = upWick > range * 0.6;

      if (isBearEngulf)    pattern = 'Bearish Engulfing';
      else if (isShootingStar) pattern = 'Shooting Star';
      else if (isPinBar)   pattern = 'Pin Bar';
    }

    const pass = pattern !== null;
    return {
      pass,
      pattern,
      reason: pass
        ? `✅ C5 PASS: Confirmation candle = ${pattern}`
        : `❌ C5 FAIL: No confirmation candle pattern found`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 6: Volume spike on confirmation candle
  // Volume must be ≥ 1.5× average
  // ─────────────────────────────────────────────
  hasVolumeSpike(candles, volumeSpikeRatio = config.strategy.volumeSpikeRatio) {
    const last    = candles[candles.length - 1];
    const avgVol  = candles.slice(-21, -1)
                           .reduce((s, c) => s + c.volume, 0) / 20;
    const ratio   = last.volume / avgVol;
    const pass    = ratio >= volumeSpikeRatio;

    return {
      pass,
      ratio: ratio.toFixed(2),
      reason: pass
        ? `✅ C6 PASS: Volume spike = ${ratio.toFixed(2)}× avg (≥ ${volumeSpikeRatio}×)`
        : `❌ C6 FAIL: Volume = ${ratio.toFixed(2)}× avg — no institutional interest`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 7: No major S/R level blocking TP path
  // ─────────────────────────────────────────────
  isClearPathToTP(zone, currentPrice, allZones, nextResistance) {
    const blockingZones = allZones.filter(z => {
      if (z === zone) return false;

      if (zone.type === 'demand') {
        // For a BUY, any supply zone between entry and TP blocks it
        return z.type === 'supply' &&
               z.low > currentPrice &&
               z.low < nextResistance;
      } else {
        // For a SELL, any demand zone between entry and TP blocks it
        return z.type === 'demand' &&
               z.high < currentPrice &&
               z.high > nextResistance;
      }
    });

    const pass = blockingZones.length === 0;
    return {
      pass,
      reason: pass
        ? `✅ C7 PASS: No blocking S/R levels between entry and TP`
        : `❌ C7 FAIL: ${blockingZones.length} blocking zone(s) found before TP`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 8: Not near market open/close
  // ─────────────────────────────────────────────
  isGoodTradingTime() {
    const now         = moment();
    const marketOpen  = moment().set({ h: 9,  m: 15, s: 0 });
    const marketClose = moment().set({ h: 15, m: 30, s: 0 });
    const avoidAfterOpen  = moment(marketOpen).add(config.timing.avoidOpenMinutes, 'm');
    const avoidBeforeClose = moment(marketClose).subtract(config.timing.avoidCloseMinutes, 'm');

    const tooEarly = now.isBefore(avoidAfterOpen);
    const tooLate  = now.isAfter(avoidBeforeClose);
    const pass     = !tooEarly && !tooLate;

    return {
      pass,
      reason: pass
        ? `✅ C8 PASS: Good trading time (${now.format('HH:mm')})`
        : `❌ C8 FAIL: Avoid trading near open/close (${now.format('HH:mm')})`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 9: Daily loss limit not breached
  // ─────────────────────────────────────────────
  isDailyLossOk(dailyPnL) {
    const maxLoss = config.capital.total * (config.capital.maxDailyLossPct / 100);
    const pass    = dailyPnL > -maxLoss;

    return {
      pass,
      reason: pass
        ? `✅ C9 PASS: Daily P&L = ₹${dailyPnL} (limit: -₹${maxLoss})`
        : `❌ C9 FAIL: Daily loss limit hit! P&L = ₹${dailyPnL}`,
    };
  }

  // ─────────────────────────────────────────────
  // CONDITION 10: Position size valid (2% risk rule)
  // ─────────────────────────────────────────────
  isPositionSizeValid(currentPrice, sl) {
    const riskAmt      = config.capital.total * (config.capital.maxRiskPct / 100);
    const riskPerShare = Math.abs(currentPrice - sl);

    // Reject if SL is too tight (< 0.1% from entry) — avoids absurd qty
    if (riskPerShare < currentPrice * 0.001) {
      return {
        pass:   false,
        qty:    0,
        cost:   '0',
        reason: `❌ C10 FAIL: SL too tight (₹${riskPerShare.toFixed(2)} risk/share — min 0.1%)`,
      };
    }

    // Cap qty so total cost never exceeds available capital
    const riskQty  = Math.floor(riskAmt / riskPerShare);
    const maxQty   = Math.floor(config.capital.total / currentPrice);
    const qty      = Math.min(riskQty, maxQty);
    const cost     = qty * currentPrice;
    const pass     = qty >= 1;

    return {
      pass,
      qty,
      cost: cost.toFixed(2),
      reason: pass
        ? `✅ C10 PASS: Qty = ${qty} shares | Capital used = ₹${cost.toFixed(2)}`
        : `❌ C10 FAIL: Position size invalid (Qty=${qty}, Cost=₹${cost.toFixed(2)})`,
    };
  }

  // ─────────────────────────────────────────────
  // HELPER: EMA Calculation
  // ─────────────────────────────────────────────
  calcEMA(data, period) {
    const k      = 2 / (period + 1);
    const ema    = [data[0]];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  }

  // ─────────────────────────────────────────────
  // MASTER CHECK — Run ALL 10 conditions
  // Returns: { approved, results, qty, sl, tp }
  // ─────────────────────────────────────────────
  runAllConditions({ zone, candles, htfCandles, currentPrice,
                     nextResistance, allZones, dailyPnL }) {
    const isPaper = config.tradeMode === 'paper';
    const p       = isPaper ? config.paper : null;

    // Use relaxed thresholds in paper mode
    const atrMult   = isPaper ? p.atrMultiplier    : config.strategy.atrMultiplier;
    const minRR     = isPaper ? p.minRiskReward     : config.strategy.minRiskReward;
    const volRatio  = isPaper ? p.volumeSpikeRatio  : config.strategy.volumeSpikeRatio;

    const c1 = this.isFreshZone(zone);
    const c2 = this.isStrongImpulse(zone, atrMult);
    const c3 = this.isHTFAligned(zone, htfCandles);
    const c4 = this.isRRSufficient(zone, currentPrice, nextResistance, minRR);
    const c5 = this.hasConfirmationCandle(candles, zone);
    const c6 = this.hasVolumeSpike(candles, volRatio);
    const c7 = this.isClearPathToTP(zone, currentPrice, allZones, c4.tp);
    const c8 = this.isGoodTradingTime();
    const c9 = this.isDailyLossOk(dailyPnL);
    const c10 = c4.pass
                  ? this.isPositionSizeValid(currentPrice, c4.sl)
                  : { pass: false, reason: '❌ C10 SKIP: C4 failed' };

    const results   = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
    const passCount = results.filter(r => r.pass).length;
    const minPass   = isPaper ? p.minPassCount : 10;
    // C4 (valid RR) and C10 (valid position size) are always required —
    // without them we have no SL/TP or qty to trade with
    const approved  = passCount >= minPass && c4.pass && c10.pass;

    return {
      approved,
      results,
      sl:  c4.sl,
      tp:  c4.tp,
      qty: c10.qty,
      rr:  c4.rr,
    };
  }
}

module.exports = new Conditions();