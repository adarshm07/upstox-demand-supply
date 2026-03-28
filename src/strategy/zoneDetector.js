const { ATR } = require('technicalindicators');
const config = require('../../config');

class ZoneDetector {

  // Calculate ATR for all candles
  computeATR(candles) {
    const atrValues = ATR.calculate({
      high:   candles.map(c => c.high),
      low:    candles.map(c => c.low),
      close:  candles.map(c => c.close),
      period: config.strategy.atrPeriod,
    });

    // Pad the front with nulls to match candle array length
    const pad = candles.length - atrValues.length;
    return [...Array(pad).fill(null), ...atrValues];
  }

  // Average volume over N candles
  avgVolume(candles, period = 20) {
    return candles
      .slice(-period)
      .reduce((sum, c) => sum + c.volume, 0) / period;
  }

  // Check if a window of candles forms a tight "base"
  isBase(window, atr) {
    if (!atr) return false;
    const high  = Math.max(...window.map(c => c.high));
    const low   = Math.min(...window.map(c => c.low));
    const range = high - low;
    return range < atr * config.strategy.baseRangeRatio;
  }

  // Check if candle is a big impulse move
  isImpulse(candle, atr) {
    if (!atr || !candle) return { bull: false, bear: false };
    const body = Math.abs(candle.close - candle.open);
    return {
      bull: body > atr * config.strategy.atrMultiplier && candle.close > candle.open,
      bear: body > atr * config.strategy.atrMultiplier && candle.open > candle.close,
    };
  }

  // Main zone detection
  detectZones(candles) {
    const atrArr  = this.computeATR(candles);
    const avgVol  = this.avgVolume(candles);
    const zones   = [];
    const baseSize = config.strategy.baseCandleCount;

    for (let i = baseSize; i < candles.length - 1; i++) {
      const window     = candles.slice(i - baseSize, i);
      const atr        = atrArr[i];
      const nextCandle = candles[i];

      if (!this.isBase(window, atr)) continue;

      const impulse = this.isImpulse(nextCandle, atr);

      const zoneHigh = Math.max(...window.map(c => c.high));
      const zoneLow  = Math.min(...window.map(c => c.low));

      if (impulse.bull) {
        zones.push({
          type:        'demand',
          high:        zoneHigh,
          low:         zoneLow,
          mid:         (zoneHigh + zoneLow) / 2,
          formedAt:    candles[i].time,
          formedIndex: i,
          impulseSize: nextCandle.close - nextCandle.open,
          atr,
          testCount:   0,        // Track how many times price returned
          volume:      nextCandle.volume,
          avgVolume:   avgVol,
        });
      }

      if (impulse.bear) {
        zones.push({
          type:        'supply',
          high:        zoneHigh,
          low:         zoneLow,
          mid:         (zoneHigh + zoneLow) / 2,
          formedAt:    candles[i].time,
          formedIndex: i,
          impulseSize: nextCandle.open - nextCandle.close,
          atr,
          testCount:   0,
          volume:      nextCandle.volume,
          avgVolume:   avgVol,
        });
      }
    }

    // Count how many times price has returned to each zone
    return this.tagZoneTests(zones, candles);
  }

  // Tag each zone with how many times it has been tested
  tagZoneTests(zones, candles) {
    return zones.map(zone => {
      let testCount = 0;
      for (let i = zone.formedIndex + 2; i < candles.length; i++) {
        const c = candles[i];
        const touched = c.low <= zone.high && c.high >= zone.low;
        if (touched) testCount++;
      }
      return { ...zone, testCount };
    });
  }
}

module.exports = new ZoneDetector();