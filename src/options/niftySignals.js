/**
 * Nifty 50 Weekly Options — Signal Generator
 *
 * Strategy:
 *  - Detect Supply & Demand zones on Nifty 15-min chart
 *  - Confirm with daily 50-EMA trend (same as equity strategy)
 *  - Price entering a DEMAND zone → buy slightly ITM CALL (CE)
 *  - Price entering a SUPPLY zone → buy slightly ITM PUT (PE)
 *  - SL  = option premium drops slDropPct % (default 50%)
 *  - TP  = option premium × tpMultiplier (default 2×)
 *  - Uses relaxed thresholds (minPassCount = 5/10)
 */

const detector    = require('../strategy/zoneDetector');
const conditions  = require('../strategy/conditions');
const optionChain = require('./optionChain');
const broker      = require('../broker/upstox');
const config      = require('../../config');
const logger      = require('../utils/logger');

const OPT = config.options;

class NiftyOptionsSignals {

  // ─────────────────────────────────────────────
  // Find nearest opposing zone as TP reference on the underlying
  // ─────────────────────────────────────────────
  _findTPLevel(zones, spotPrice, zoneType) {
    const opposing = zones
      .filter(z => {
        if (zoneType === 'demand') return z.type === 'supply' && z.low  > spotPrice;
        return                            z.type === 'demand' && z.high < spotPrice;
      })
      .sort((a, b) =>
        zoneType === 'demand' ? a.low - b.low : b.high - a.high
      );

    return opposing.length
      ? (zoneType === 'demand' ? opposing[0].low : opposing[0].high)
      : null;
  }

  // ─────────────────────────────────────────────
  // C8 extension: expiry must be far enough away
  // ─────────────────────────────────────────────
  _checkExpiry(expiryDate) {
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry   = new Date(expiryDate);
    const daysLeft = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
    const pass     = daysLeft >= OPT.minDaysToExpiry;
    return {
      pass,
      reason: pass
        ? `✅ C8b PASS: ${daysLeft} day(s) to expiry (min ${OPT.minDaysToExpiry})`
        : `❌ C8b FAIL: Only ${daysLeft} day(s) to expiry — theta risk too high`,
    };
  }

  // ─────────────────────────────────────────────
  // C9 (options): daily P&L vs options capital
  // ─────────────────────────────────────────────
  _checkDailyLoss(dailyPnL) {
    const maxLoss = OPT.capital * 0.03;  // 3% of options capital
    const pass    = dailyPnL > -maxLoss;
    return {
      pass,
      reason: pass
        ? `✅ C9 PASS: Options P&L ₹${dailyPnL.toFixed(0)} (limit -₹${maxLoss.toFixed(0)})`
        : `❌ C9 FAIL: Daily options loss limit hit (₹${dailyPnL.toFixed(0)})`,
    };
  }

  // ─────────────────────────────────────────────
  // C10 (options): can we buy at least 1 lot?
  // Budget = maxPremiumPct % of capital
  // ─────────────────────────────────────────────
  _checkLotAffordability(premiumLTP) {
    const budget  = OPT.capital * (OPT.maxPremiumPct / 100);
    const lotCost = premiumLTP * OPT.lotSize;
    const lots    = Math.floor(budget / lotCost);
    const pass    = lots >= 1;
    return {
      pass,
      lots:    Math.max(lots, 0),
      lotCost: parseFloat(lotCost.toFixed(2)),
      budget:  parseFloat(budget.toFixed(2)),
      reason:  pass
        ? `✅ C10 PASS: ${lots} lot(s) | ₹${lotCost.toFixed(0)}/lot | Budget ₹${budget.toFixed(0)}`
        : `❌ C10 FAIL: Premium ₹${premiumLTP}/unit → ₹${lotCost.toFixed(0)}/lot > budget ₹${budget.toFixed(0)}`,
    };
  }

  // ─────────────────────────────────────────────
  // MAIN: Generate a Nifty options signal
  // Returns signal object or null
  // ─────────────────────────────────────────────
  async generate(dailyPnL = 0) {
    try {
      // 1. Fetch Nifty candles on both timeframes
      const [candles, htfCandles] = await Promise.all([
        broker.getCandles(OPT.underlying, OPT.timeframe,    60),
        broker.getCandles(OPT.underlying, OPT.htfTimeframe, 100),
      ]);

      if (candles.length < 30) {
        logger.warn(`[NiftyOpts] Only ${candles.length} candles — need 30+`);
        return null;
      }

      // 2. Get weekly expiry
      const expiryDate = optionChain.getWeeklyExpiry();
      if (!expiryDate) {
        logger.warn('[NiftyOpts] No valid weekly expiry found');
        return null;
      }

      // 3. Fetch option chain (also gives spot price)
      const chain = await optionChain.fetchChain(OPT.underlying, expiryDate);
      if (!chain.length) {
        logger.warn(`[NiftyOpts] Empty option chain for expiry ${expiryDate}`);
        return null;
      }

      const spotPrice = optionChain.getSpotPrice(chain) || await broker.getLTP(OPT.underlying);
      if (!spotPrice) {
        logger.warn('[NiftyOpts] Could not get Nifty spot price');
        return null;
      }

      // 4. Detect S&D zones — fresh only (testCount === 0)
      const allZones       = detector.detectZones(candles);
      const freshZones     = allZones.filter(z => z.testCount === 0);

      logger.info(
        `[NiftyOpts] ₹${spotPrice} | Zones: ${allZones.length} total, ` +
        `${freshZones.length} fresh | Expiry: ${expiryDate}`
      );

      // 5. Is spot inside any fresh zone? (0.5% proximity buffer)
      const activeZone = freshZones.find(z =>
        spotPrice >= z.low  * (1 - 0.005) &&
        spotPrice <= z.high * (1 + 0.005)
      );

      if (!activeZone) {
        logger.info('[NiftyOpts] Nifty not inside any fresh zone — no signal');
        return null;
      }

      const optionType = activeZone.type === 'demand' ? 'CE' : 'PE';
      logger.info(
        `[NiftyOpts] In ${activeZone.type.toUpperCase()} zone ` +
        `[${activeZone.low}–${activeZone.high}] → buy ${optionType}`
      );

      // 6. Find TP level on underlying (next opposing zone)
      const tpUnderlying = this._findTPLevel(allZones, spotPrice, activeZone.type);
      if (!tpUnderlying) {
        logger.warn('[NiftyOpts] No opposing zone found for TP — skip');
        return null;
      }

      // 7. Find ITM strike and get option LTP from chain
      const itmStrike  = optionChain.findITMStrike(spotPrice, optionType);
      const optionData = optionChain.getOptionData(chain, itmStrike, optionType);

      if (!optionData || optionData.ltp <= 0) {
        logger.warn(`[NiftyOpts] No market data for ${optionType} @ ${itmStrike}`);
        return null;
      }

      logger.info(
        `[NiftyOpts] Selected: NIFTY ${expiryDate} ${itmStrike}${optionType} | ` +
        `LTP ₹${optionData.ltp} | Delta ${optionData.delta?.toFixed(2)}`
      );

      // 8. Run all 10 conditions
      // C1–C7 reuse existing equity condition methods with options-specific thresholds
      const c1 = conditions.isFreshZone(activeZone);
      const c2 = conditions.isStrongImpulse(activeZone, OPT.atrMultiplier);
      const c3 = conditions.isHTFAligned(activeZone, htfCandles);
      const c4 = conditions.isRRSufficient(activeZone, spotPrice, tpUnderlying, OPT.minRiskReward);
      const c5 = conditions.hasConfirmationCandle(candles, activeZone);
      const c6 = conditions.hasVolumeSpike(candles, OPT.volumeSpikeRatio);
      const c7 = conditions.isClearPathToTP(activeZone, spotPrice, allZones, c4.tp);

      // C8: trading time AND expiry check (both must pass)
      const c8time   = conditions.isGoodTradingTime();
      const c8expiry = this._checkExpiry(expiryDate);
      const c8 = {
        pass:   c8time.pass && c8expiry.pass,
        reason: !c8time.pass ? c8time.reason : c8expiry.reason,
      };

      // C9: daily P&L vs options capital
      const c9  = this._checkDailyLoss(dailyPnL);

      // C10: can afford at least 1 lot?
      const c10 = this._checkLotAffordability(optionData.ltp);

      const results   = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
      const passCount = results.filter(r => r.pass).length;
      // C4 (valid R:R) and C10 (can afford lots) are hard requirements
      const approved  = passCount >= OPT.minPassCount && c4.pass && c10.pass;

      logger.info(`[NiftyOpts] Conditions: ${passCount}/10 | ${approved ? 'APPROVED' : 'REJECTED'}`);
      results.forEach((r, i) => logger.info(`  ${i + 1}. ${r.reason}`));

      // 9. Build position & risk numbers
      const lots        = c10.lots || 0;
      const totalUnits  = lots * OPT.lotSize;
      const premium     = optionData.ltp;
      const slPremium   = parseFloat((premium * (1 - OPT.slDropPct / 100)).toFixed(2));
      const tpPremium   = parseFloat((premium * OPT.tpMultiplier).toFixed(2));
      const riskAmount  = parseFloat(((premium - slPremium) * totalUnits).toFixed(2));
      const rewardAmount = parseFloat(((tpPremium - premium) * totalUnits).toFixed(2));

      return {
        // Underlying context
        underlying:      OPT.underlying,
        symbolName:      `NIFTY ${expiryDate} ${itmStrike}${optionType}`,
        underlyingPrice: spotPrice,
        zone:            activeZone,

        // Option contract
        instrumentKey:   optionData.instrumentKey,
        optionType,
        strike:          itmStrike,
        expiryDate,
        lots,
        lotSize:         OPT.lotSize,
        totalUnits,

        // Pricing (all in ₹ per unit of premium)
        entry:           premium,
        sl:              slPremium,
        tp:              tpPremium,
        riskAmount,
        rewardAmount,
        rr:              c4.rr,

        // Signal metadata
        pattern:          results[4]?.pattern || null,
        passCount,
        totalCount:       10,
        approved,
        conditionResults: results,
        timestamp:        new Date(),
      };

    } catch (err) {
      logger.error(`[NiftyOpts] Signal error: ${err.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Format condition results as Telegram string
  // ─────────────────────────────────────────────
  formatConditionLog(results) {
    const icons = results.map(r => r.pass ? '✅' : '❌');
    return (
      `*Conditions:* ${icons.join(' ')}\n` +
      `_C1-Fresh  C2-Impulse  C3-HTF  C4-RR  C5-Pattern_\n` +
      `_C6-Volume  C7-Path  C8-Time/Expiry  C9-Loss  C10-Lots_`
    );
  }
}

module.exports = new NiftyOptionsSignals();
