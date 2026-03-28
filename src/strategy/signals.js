const detector    = require('./zoneDetector');
const conditions  = require('./conditions');
const broker      = require('../broker/upstox');
const config      = require('../../config');
const logger      = require('../utils/logger');

class SignalGenerator {

  // ─────────────────────────────────────────────
  // Find the nearest opposing zone to use as TP
  // ─────────────────────────────────────────────
  findNextResistance(zones, currentPrice, zoneType) {
    const opposing = zones
      .filter(z => {
        if (zoneType === 'demand') return z.type === 'supply' && z.low > currentPrice;
        return z.type === 'demand' && z.high < currentPrice;
      })
      .sort((a, b) =>
        zoneType === 'demand' ? a.low - b.low : b.high - a.high
      );

    return opposing.length
      ? (zoneType === 'demand' ? opposing[0].low : opposing[0].high)
      : null;
  }

  // ─────────────────────────────────────────────
  // MAIN: Generate signal for one symbol
  // Returns signal object or null
  // ─────────────────────────────────────────────
  async generate(instrumentKey, dailyPnL = 0) {
    const symbolName = config.strategy.symbolNames[instrumentKey] || instrumentKey;

    try {
      // 1. Fetch candles on both timeframes
      const [candles, htfCandles] = await Promise.all([
        broker.getCandles(instrumentKey, config.strategy.timeframe, 60),
        broker.getCandles(instrumentKey, config.strategy.htfTimeframe, 100),
      ]);

      if (candles.length < 30) {
        logger.warn(`[${symbolName}] Not enough candle data`);
        return null;
      }

      // 2. Get live price
      const currentPrice = await broker.getLTP(instrumentKey);
      if (!currentPrice) {
        logger.warn(`[${symbolName}] Could not fetch LTP`);
        return null;
      }

      // 3. Detect all zones and filter fresh ones
      const allZones   = detector.detectZones(candles);
      const freshZones = allZones.filter(z => z.testCount === 0);

      logger.info(`[${symbolName}] ₹${currentPrice} | Zones: ${allZones.length} total, ${freshZones.length} fresh`);

      // 4. Check if price is inside any fresh zone
      const activeZone = freshZones.find(z =>
        currentPrice >= z.low && currentPrice <= z.high
      );

      if (!activeZone) {
        logger.info(`[${symbolName}] Price not in any zone — no signal`);
        return null;
      }

      logger.info(`[${symbolName}] 🎯 Price inside ${activeZone.type.toUpperCase()} zone [${activeZone.low} – ${activeZone.high}]`);

      // 5. Find TP (nearest opposing zone)
      const nextResistance = this.findNextResistance(allZones, currentPrice, activeZone.type);
      if (!nextResistance) {
        logger.warn(`[${symbolName}] No opposing zone found for TP — skip`);
        return null;
      }

      // 6. Run all 10 conditions
      const check = conditions.runAllConditions({
        zone:           activeZone,
        candles,
        htfCandles,
        currentPrice,
        nextResistance,
        allZones,
        dailyPnL,
      });

      const passCount = check.results.filter(r => r.pass).length;

      // 7. Log each condition result
      logger.info(`[${symbolName}] Condition Results (${passCount}/10):`);
      check.results.forEach((r, i) =>
        logger.info(`  ${i + 1}. ${r.reason}`)
      );

      // 8. Build and return signal object
      const confirmCandle = check.results[4]; // C5 = confirmation candle

      return {
        instrumentKey,
        symbolName,
        type:         activeZone.type === 'demand' ? 'BUY' : 'SELL',
        entry:        currentPrice,
        sl:           check.sl,
        tp:           check.tp,
        qty:          check.qty,
        rr:           check.rr,
        zone:         activeZone,
        pattern:      confirmCandle?.pattern || null,
        passCount,
        totalCount:   10,
        approved:     check.approved,
        conditionResults: check.results,
        timestamp:    new Date(),
      };

    } catch (err) {
      logger.error(`[${symbolName}] Signal generation error: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Scan ALL configured symbols
  // Returns array of signals (approved + near-miss)
  // ─────────────────────────────────────────────
  async scanAll(dailyPnL = 0) {
    const signals = [];

    for (const key of config.strategy.symbols) {
      const signal = await this.generate(key, dailyPnL);

      if (signal) signals.push(signal);

      // Small delay between symbols to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }

    // Sort: fully approved first, then by passCount descending
    return signals.sort((a, b) => {
      if (a.approved && !b.approved) return -1;
      if (!a.approved && b.approved) return 1;
      return b.passCount - a.passCount;
    });
  }

  // ─────────────────────────────────────────────
  // Format condition results as Telegram string
  // ─────────────────────────────────────────────
  formatConditionLog(results) {
    const icons = results.map(r => r.pass ? '✅' : '❌');
    return (
      `*Conditions:* ${icons.join(' ')}\n` +
      `_C1-Fresh  C2-Impulse  C3-HTF  C4-RR  C5-Pattern_\n` +
      `_C6-Volume  C7-Path  C8-Time  C9-Loss  C10-Size_`
    );
  }
}

module.exports = new SignalGenerator();