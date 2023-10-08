import {
  SMA as technicalIndicatorSMA,
  RSI as technicalIndicatorRSI,
  MACD as technicalIndicatorMACD,
  BollingerBands as technicalIndicatorBollingerBands,
  CCI as technicalIndicatorCCI,
  Stochastic as technicalIndicatorStochastic,
  PSAR as technicalIndicatorPSAR,
  SuperTrend as technicalIndicatorSuperTrend,
} from "@debut/indicators";
import { IndicatorsNormalized } from "@ixjb94/indicators/dist";

const IXJIndicators = new IndicatorsNormalized();

const trendEnum = {
  up: "up",
  down: "down",
  range: "range",
};
const signalEnum = {
  buy: "buy",
  sell: "sell",
  hold: "hold",
};
const signalWeight = {
  [signalEnum.sell]: -1,
  [signalEnum.hold]: 0,
  [signalEnum.buy]: 1,
};
export const indicatorsWeightEnum = {
  bollingerBand: 3,
  sr: 2,
  movingAvg: 1.5,
  br: 1.5,
  macd: 1.5,
  rsi: 1,
  cci: 1,
  trend: 1,
  stochastic: 1,
  psar: 1,
  superTrend: 1,
  obv: 1,
  vwap: 1,
  williamR: 1,
  mfi: 1,
  vPs: 1,
  sma: 2,
};
const timeFrame = 5;
const getDxForPrice = (price, time = timeFrame) => {
  const dxPercentForTimeFrames = {
    5: 0.17 / 100,
    15: 0.8 / 100,
    60: 1.9 / 100,
  };

  return dxPercentForTimeFrames[time] * price;
};

const timesPricesCrossedRange = (prices = [], rangeMin, rangeMax) => {
  let count = 0,
    currPos = 0;

  prices.forEach((p) => {
    if (p < rangeMin) {
      if (currPos == 1) count++;

      currPos = -1;
    }
    if (p > rangeMax) {
      if (currPos == -1) count++;

      currPos = 1;
    }
  });

  return count;
};

// made to replace vPoint and range calculation but it takes same or more time than previous
export class Range {
  prices = [];
  vPointOffset = 10;
  vPoints = [];
  ranges = [];

  constructor({ vPointOffset }) {
    if (!isNaN(vPointOffset)) this.vPointOffset = vPointOffset;
  }

  nextRangeValue({ price }) {
    this.prices.push(price);
    const pricesLength = this.prices.length;
    const oldVpsLength = this.vPoints.length;

    // vPoint calculation
    const pointIndex = pricesLength - this.vPointOffset;
    if (pointIndex < this.vPointOffset * 2) return { vPoints: [], ranges: [] };

    const pointPrice = this.prices[pointIndex];
    let max = 0,
      min = 9999999;
    for (let i = pointIndex - this.vPointOffset; i < pricesLength; ++i) {
      const p = this.prices[i];
      if (p < min) min = p;
      if (p > max) max = p;
    }

    const upAllClear = pointPrice >= max;
    const downAllClear = pointPrice <= min;
    if (upAllClear || downAllClear) {
      const previousVPoint = this.vPoints.length
        ? this.vPoints[this.vPoints.length - 1]
        : {};

      if (previousVPoint.value !== pointPrice)
        this.vPoints.push({
          index: pointIndex,
          value: pointPrice,
        });
    }

    // ranges calculation
    const getFormattedRanges = () => {
      const goodRanges = this.ranges.filter((item) => item.points.length > 2);
      const finalRanges = [];
      // neglecting sub ranges
      for (let i = 0; i < goodRanges.length; ++i) {
        const currR = goodRanges[i];
        const subRanges = [];

        for (let j = 0; j < goodRanges.length; ++j) {
          const r = goodRanges[j];

          const isSubRange =
            currR.start.index >= r.start.index &&
            currR.end.index <= r.end.index &&
            currR.min >= r.min &&
            currR.max <= r.max;

          if (isSubRange) subRanges.push(currR);
        }

        if (subRanges.length < 2) finalRanges.push(currR);
      }

      return finalRanges;
    };

    if (oldVpsLength == this.vPoints.length)
      return { vPoints: this.vPoints, ranges: getFormattedRanges() };

    const lastVPoint = this.vPoints[this.vPoints.length - 1];

    let pointAddedInARange = false;
    for (let i = 0; i < this.ranges.length; ++i) {
      const currRange = this.ranges[i];

      if (!currRange.stillStrong) continue;

      const lastRangePoint = currRange.points[currRange.points.length - 1];

      const allowedDx = getDxForPrice(lastVPoint.value);
      let isNearlyEqual = false;

      currRange.points.forEach((p) => {
        if (isNearlyEqual) return;
        const isEq = nearlyEquateNums(p.value, lastVPoint.value, allowedDx);

        isNearlyEqual = isEq;
      });
      // console.log(
      //   lastRangePoint.value,
      //   lastVPoint.value,
      //   isNearlyEqual,
      //   allowedDx
      // );
      if (!isNearlyEqual) continue;

      const rangePrices = this.prices.slice(
        lastRangePoint.index,
        lastVPoint.index
      );

      const crossedTimes = timesPricesCrossedRange(
        rangePrices,
        currRange.min,
        currRange.max
      );
      if (crossedTimes > 3) {
        currRange.stillStrong = false;
        continue;
      }

      let min, max;
      if (lastRangePoint.value < lastVPoint.value) {
        min = lastRangePoint.value;
        max = lastVPoint.value;
      } else {
        min = lastVPoint.value;
        max = lastRangePoint.value;
      }

      if (min < currRange.min) currRange.min = min;
      if (max > currRange.max) currRange.max = max;

      currRange.end = lastVPoint;
      currRange.points.push(lastVPoint);

      pointAddedInARange = true;
    }
    for (let i = 0; i < this.ranges; ++i) {
      const range = this.ranges[i];
      if (!range.end) {
        const tempEnd = range.points[range.points.length - 1];
        range.end = tempEnd;

        const crossedTillEnd = timesPricesCrossedRange(
          this.prices.slice(tempEnd.index),
          range.min,
          range.max
        );

        if (crossedTillEnd > 3) range.stillStrong = false;
      }
    }
    if (!pointAddedInARange) {
      this.ranges.push({
        min: lastVPoint.value,
        max: lastVPoint.value,
        start: lastVPoint,
        end: lastVPoint,
        points: [lastVPoint],
        stillStrong: true,
      });
    }

    return { vPoints: this.vPoints, ranges: getFormattedRanges() };
  }
}

export const nearlyEquateNums = (a, b, dx = 1) => Math.abs(a - b) <= dx;

export const getVPoints = ({
  prices = [],
  offset = 10,
  startFrom = 0,
  previousOutput = [],
}) => {
  if (!prices.length) return [];

  let output = [...previousOutput];
  if (startFrom < offset) startFrom = offset;

  let nearby = [];
  for (let i = startFrom; i < prices.length; ++i) {
    const price = prices[i];

    if (!nearby.length) nearby = prices.slice(i - offset, i + offset);
    else nearby = [...nearby.slice(1), prices[i + offset - 1]];

    const upAllClear = nearby.every((item) => item <= price);
    const downAllClear = nearby.every((item) => item >= price);

    if (upAllClear || downAllClear)
      output.push({
        index: i,
        value: price,
      });
  }

  const filteredPoints = [output[0]];

  for (let i = 1; i < output.length; ++i) {
    const prevPoint = output[i - 1];
    const point = output[i];
    if (prevPoint.value == point.value) continue;
    else filteredPoints.push(point);
  }

  return filteredPoints;
};

export const getSupportResistanceRangesFromVPoints = (
  vPoints = [],
  prices = []
) => {
  if (!vPoints.length || !prices.length) return [];

  const allRanges = [];

  for (let i = 0; i < vPoints.length - 1; ++i) {
    const startPoint = vPoints[i];

    let range = {
      min: Number.MAX_SAFE_INTEGER,
      max: 0,
      start: startPoint,
      points: [startPoint],
      stillStrong: false,
    };

    for (let j = i + 1; j < vPoints.length; ++j) {
      const currPoint = vPoints[j];

      const allowedDx = getDxForPrice(currPoint.value);

      const isNearlyEqual = nearlyEquateNums(
        startPoint.value,
        currPoint.value,
        allowedDx
      );
      if (!isNearlyEqual) continue;

      const rangePrices = prices.slice(startPoint.index, currPoint.index);

      let rangeMin, rangeMax;
      if (startPoint.value < currPoint.value) {
        rangeMin = startPoint.value;
        rangeMax = currPoint.value;
      } else {
        rangeMin = currPoint.value;
        rangeMax = startPoint.value;
      }

      if (rangeMin < range.min) range.min = rangeMin;
      if (rangeMax > range.max) range.max = rangeMax;

      const crossedTimes = timesPricesCrossedRange(
        rangePrices,
        range.min,
        range.max
      );

      if (crossedTimes > 3) {
        range.end = range.points[range.points.length - 1];
        break;
      }

      range.points.push(currPoint);
    }

    if (!range.end) {
      const end = range.points[range.points.length - 1];
      range.end = end;

      const crossedTillEnd = timesPricesCrossedRange(
        prices.slice(end.index),
        range.min,
        range.max
      );

      if (crossedTillEnd < 3) range.stillStrong = true;
    }

    allRanges.push(range);
  }

  const goodRanges = allRanges.filter((item) => item.points.length > 2);

  const finalRanges = [];

  // neglecting sub ranges
  for (let i = 0; i < goodRanges.length; ++i) {
    const currR = goodRanges[i];
    const subRanges = [];

    for (let j = 0; j < goodRanges.length; ++j) {
      const r = goodRanges[j];

      const isSubRange =
        currR.start.index >= r.start.index &&
        currR.end.index <= r.end.index &&
        currR.min >= r.min &&
        currR.max <= r.max;

      if (isSubRange) subRanges.push(currR);
    }

    if (subRanges.length < 2) finalRanges.push(currR);
  }

  return finalRanges;
};

export const getTrendEstimates = (prices = [], startCheckFrom = 12) => {
  if (!prices?.length) return [];

  const getHighestAndLowestOfLastRange = (prices = [], a, b) => {
    const arrLength = b - a;
    if (arrLength < 6) return;

    const sortedPrices = prices.slice(a, b).sort();

    const lowestAvg = (sortedPrices[0] + sortedPrices[1]) / 2;
    const highestAvg =
      (sortedPrices[arrLength - 1] + sortedPrices[arrLength - 2]) / 2;

    return {
      lowest: lowestAvg,
      highest: highestAvg,
    };
  };

  const trends = [];

  const range = 12;
  if (startCheckFrom < range) startCheckFrom = range;

  for (let i = 0; i < startCheckFrom; ++i) {
    trends.push({
      index: i,
      trend: trendEnum.range,
    });
  }

  for (let i = startCheckFrom; i < prices.length; ++i) {
    const price = prices[i];
    const { highest, lowest } = getHighestAndLowestOfLastRange(
      prices,
      i - range,
      i
    );
    const difference = highest - lowest;
    const differencePercent = (difference / price) * 100;

    if (differencePercent < 0.7) {
      trends.push({
        index: i,
        trend: trendEnum.range,
      });
      continue;
    }

    trends.push({
      index: i,
      trend: price > highest ? trendEnum.up : trendEnum.down,
    });
  }

  return trends;
};

const getMacdSignal = (macd) => {
  if (
    !macd?.length ||
    macd.length > 5 ||
    macd.some((item) => item.macd == undefined || item.signal == undefined)
  )
    return signalEnum.hold;

  if (macd[0].macd < 0.015 && macd[0].macd > -0.015) return signalEnum.hold;

  let signal = signalEnum.hold,
    s = 0;
  for (let i = 0; i < macd.length; ++i) {
    const d = macd[i].macd - macd[i].signal;

    if (d > 0) {
      if (s == -1) signal = signalEnum.buy;

      s = 1;
    } else if (d < 0) {
      if (s == 1) signal = signalEnum.sell;

      s = -1;
    }
  }

  return signal;
};

const getSmaCrossedSignal = ({ smaLow = [], smaHigh = [] }) => {
  if (
    !smaLow?.length ||
    !smaHigh?.length ||
    smaLow.length > 3 ||
    smaHigh.length > 3
  )
    return signalEnum.hold;

  let signal = signalEnum.hold,
    s = 0;
  for (let i = 0; i < smaLow.length; ++i) {
    const d = smaLow[i] - smaHigh[i];

    if (d > 0) {
      if (s == -1) signal = signalEnum.buy;

      s = 1;
    } else if (d < 0) {
      if (s == 1) signal = signalEnum.sell;

      s = -1;
    }
  }

  return signal;
};

export const takeTrades = async (
  priceData = {
    t: [],
    o: [],
    c: [],
    h: [],
    l: [],
    v: [],
  },
  {
    additionalIndicators = {
      willR: false,
      mfi: false,
      // trend: false,
      cci: false,
      stochastic: false,
      vwap: false,
      psar: false,
      br: false,
      rsi: false,
      macd: false,
      bollinger: false,
      sma: false,
    },
    decisionMakingPoints = 3,
    useSupportResistances = true,
    vPointOffset = 8,
    rsiLow = 48,
    rsiHigh = 63,
    smaLowPeriod = 18,
    smaHighPeriod = 150,
    rsiPeriod = 8,
    macdFastPeriod = 14,
    macdSlowPeriod = 24,
    macdSignalPeriod = 8,
    bollingerBandPeriod = 23,
    bollingerBandStdDev = 4,
    cciPeriod = 20,
    stochasticPeriod = 14,
    stochasticMA = 3,
    stochasticLow = 23,
    stochasticHigh = 83,
    willRPeriod = 14,
    willRLow = -90,
    willRHigh = -10,
    psarStart = 0.02,
    psarAcceleration = 0.02,
    psarMaxValue = 0.2,
    superTrendMultiplier = 3,
    mfiPeriod = 14,
    mfiLow = 23,
    mfiHigh = 83,
    vwapPeriod = 14,
    targetProfitPercent = 1.4,
    stopLossPercent = 0.7,
    brTotalTrendLength = 33,
    brLongTrendLength = 21,
    brShortTrendLength = 10,
    avoidingLatestSmallMovePercent = 0.9,
    trendCheckingLastFewCandles = 8,
    lastMoreCandleOffset = 40,
    lastFewCandleOffset = 6,
    lastCandlesMultiplier = 3,
  },
  takeOneRecentTrade = false
) => {
  if (!priceData.c?.length) return { trades: [], analytics: [] };

  if (targetProfitPercent <= 0) targetProfitPercent = 0.1;
  if (stopLossPercent <= 0) stopLossPercent = 0.1;

  const indicatorSmallMA = new technicalIndicatorSMA(smaLowPeriod);
  const indicatorBigMA = new technicalIndicatorSMA(smaHighPeriod);
  const indicatorStochastic = new technicalIndicatorStochastic(
    stochasticPeriod,
    stochasticMA
  );
  const indicatorRsi = new technicalIndicatorRSI(rsiPeriod);
  const indicatorCCI = new technicalIndicatorCCI(cciPeriod);
  const indicatorMacd = new technicalIndicatorMACD(
    macdFastPeriod,
    macdSlowPeriod,
    macdSignalPeriod
  );
  const indicatorBollingerBands = new technicalIndicatorBollingerBands(
    bollingerBandPeriod,
    bollingerBandStdDev
  );
  const indicatorPSAR = new technicalIndicatorPSAR(
    psarStart,
    psarAcceleration,
    psarMaxValue
  );
  const indicatorSuperTrend = new technicalIndicatorSuperTrend(
    smaLowPeriod,
    superTrendMultiplier,
    "SMA"
  );

  const indicators = {
    lastCalculatedIndex: 0,
    smallMA: [],
    bigMA: [],
    rsi: [],
    cci: [],
    macd: [],
    bollingerBand: [],
    stochastic: [],
    psar: [],
    superTrend: [],
    obv: [],
    vwap: [],
    williamR: [],
    mfi: [],
    vPs: [],
    ranges: [],
    trends: [],
  };

  let trades = [],
    analytics = [];

  // allowing the algo to take only one trade for last price
  const startTakingTradeIndex = takeOneRecentTrade
    ? priceData.c.length - 1
    : 200;

  const updateIndicatorValues = (high, low, price) => {
    const smaL = indicatorSmallMA.nextValue(price);
    const smaH = indicatorBigMA.nextValue(price);
    const rsi = indicatorRsi.nextValue(price);
    const cci = indicatorCCI.nextValue(high, low, price);
    const macd = indicatorMacd.nextValue(price);
    const bollingerBand = indicatorBollingerBands.nextValue(price);
    const stochastic = indicatorStochastic.nextValue(high, low, price).k;
    const psar = indicatorPSAR.nextValue(high, low, price);
    const superTrend = indicatorSuperTrend.nextValue(high, low, price);

    indicators.smallMA.push(smaL);
    indicators.bigMA.push(smaH);
    indicators.rsi.push(rsi);
    indicators.cci.push(cci);
    indicators.macd.push(macd || {});
    indicators.bollingerBand.push(bollingerBand || {});
    indicators.stochastic.push(stochastic);
    indicators.psar.push(psar);
    indicators.superTrend.push(superTrend);
  };

  const vps = getVPoints({
    offset: vPointOffset,
    prices: priceData.c.slice(0, startTakingTradeIndex),
  });
  const ranges = getSupportResistanceRangesFromVPoints(
    vps,
    priceData.c.slice(0, startTakingTradeIndex)
  );
  indicators.vPs = vps;
  indicators.ranges = ranges;

  // const obv = await IXJIndicators.obv(
  //   priceData.c.slice(0, startTakingTradeIndex),
  //   priceData.v.slice(0, startTakingTradeIndex)
  // );
  const williamRange = await IXJIndicators.willr(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    willRPeriod
  );
  const moneyFlowIndex = await IXJIndicators.mfi(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    priceData.v.slice(0, startTakingTradeIndex),
    mfiPeriod
  );
  const vwap = await IXJIndicators.vwap(
    priceData.h.slice(0, startTakingTradeIndex),
    priceData.l.slice(0, startTakingTradeIndex),
    priceData.c.slice(0, startTakingTradeIndex),
    priceData.v.slice(0, startTakingTradeIndex),
    mfiPeriod
  );

  // indicators.obv = obv;
  indicators.vwap = vwap;
  indicators.mfi = moneyFlowIndex;
  indicators.williamR = williamRange;

  for (let i = 0; i < startTakingTradeIndex; ++i) {
    const high = priceData.h[i];
    const low = priceData.l[i];
    const price = priceData.c[i];

    updateIndicatorValues(high, low, price);
  }

  const checkTradeCompletion = (
    triggerPrice,
    data = { c: [], l: [], h: [], o: [] },
    target,
    sl,
    isSellTrade = false
  ) => {
    if (
      !triggerPrice ||
      !target ||
      !sl ||
      !Array.isArray(data?.c) ||
      !data?.c?.length
    )
      return 0;

    for (let i = 0; i < data.c.length; ++i) {
      const c = data.c[i];
      const l = data.l[i];
      const h = data.h[i];

      if ((isSellTrade && l < target) || (!isSellTrade && h > target)) return 1;
      if ((isSellTrade && h >= sl) || (!isSellTrade && l <= sl)) return -1;
    }

    return 0;
  };

  const analyzeAllTradesForCompletion = async (currentIndex) => {
    if (!trades.length || !currentIndex) return;

    trades.forEach(async (trade, i) => {
      if (trade.status == "profit" || trade.status == "loss") return;

      const isSellTrade = trade.type == signalEnum.sell;
      const tradeStartIndex = trade.startIndex;

      const statusNumber = checkTradeCompletion(
        trade.startPrice,
        {
          c: priceData.c.slice(tradeStartIndex, currentIndex),
          o: priceData.o.slice(tradeStartIndex, currentIndex),
          h: priceData.h.slice(tradeStartIndex, currentIndex),
          l: priceData.l.slice(tradeStartIndex, currentIndex),
          t: priceData.t.slice(tradeStartIndex, currentIndex),
        },
        trade.target,
        trade.sl,
        isSellTrade
      );

      const status =
        statusNumber == 1 ? "profit" : statusNumber == -1 ? "loss" : "taken";
      if (status == trade.status) return;

      // update the trade status
      trades[i].result = status;
      trades[i].status = status;
    });
  };

  const getBreakOutDownSignal = (index) => {
    const totalTrendLength = brTotalTrendLength;
    const shortTrendLength = brShortTrendLength;
    const longTrendLength = brLongTrendLength;

    const currPrice = priceData.c[index];
    const last3CandleLengths = [1, 1, 1].map(
      (_e, i) => priceData.c[index - i] - priceData.o[index - i]
    );
    const allowedPercent = 0.4;
    if (
      last3CandleLengths.some(
        (l) => (Math.abs(l) / currPrice) * 100 >= allowedPercent
      )
    )
      return signalEnum.hold;

    let recentHighCandleIndex, recentLowCandleIndex;
    for (let i = index; i > index - shortTrendLength; --i) {
      const high = priceData.h[i];
      const low = priceData.l[i];

      if (
        isNaN(recentHighCandleIndex) ||
        high > priceData.h[recentHighCandleIndex]
      )
        recentHighCandleIndex = i;
      else if (
        isNaN(recentLowCandleIndex) ||
        low < priceData.l[recentLowCandleIndex]
      )
        recentLowCandleIndex = i;
    }

    const recentHigh = priceData.h[recentHighCandleIndex] - currPrice;
    const recentLow = priceData.l[recentLowCandleIndex] - currPrice;

    const onePercentOfPrice = (1 / 100) * currPrice;
    const point1PercentOfPrice = (0.11 / 100) * currPrice;
    const trendEstimate =
      currPrice - priceData.c[index - totalTrendLength] > onePercentOfPrice
        ? "up"
        : priceData.c[index - totalTrendLength] - currPrice > onePercentOfPrice
        ? "down"
        : "none";

    if (trendEstimate == "none") return signalEnum.hold;

    if (trendEstimate == "up") {
      if (
        Math.abs(recentHigh) < point1PercentOfPrice ||
        recentHighCandleIndex === index
      )
        return signalEnum.hold;

      let recentUpTrendLength;
      for (let i = recentHighCandleIndex; i > index - longTrendLength; --i) {
        const len = Math.abs(
          priceData.c[i] - priceData.h[recentHighCandleIndex]
        );

        if (isNaN(recentUpTrendLength) || len > recentUpTrendLength)
          recentUpTrendLength = len;
      }

      if (recentUpTrendLength < recentHigh * 2.5) {
        return signalEnum.hold;
      }

      const arr = priceData.c
        .slice(recentHighCandleIndex, index)
        .map((item, i) => ({ index: i + recentHighCandleIndex, value: item }));
      const avgBreakoutPrice =
        arr.reduce((acc, item) => {
          const c = priceData.c[item.index];
          const o = priceData.o[item.index];

          const f = c > o ? c : o;

          return acc + f;
        }, 0) / arr.length;

      if (currPrice > avgBreakoutPrice) return signalEnum.buy;
      else return signalEnum.hold;
    } else {
      if (
        Math.abs(recentLow) < point1PercentOfPrice ||
        recentLowCandleIndex === index
      )
        return signalEnum.hold;

      let recentDownTrendLength;
      for (let i = recentLowCandleIndex; i > index - longTrendLength; --i) {
        const len = Math.abs(
          priceData.c[i] - priceData.l[recentLowCandleIndex]
        );

        if (isNaN(recentDownTrendLength) || len > recentDownTrendLength)
          recentDownTrendLength = len;
      }

      if (recentDownTrendLength < recentLow * 2.1) return signalEnum.hold;

      const arr = priceData.c
        .slice(recentLowCandleIndex, index)
        .map((item, i) => ({ index: i + recentLowCandleIndex, value: item }));
      const avgBreakdownPrice =
        arr.reduce((acc, item) => {
          const c = priceData.c[item.index];
          const o = priceData.o[item.index];

          const f = c < o ? c : o;

          return acc + f;
        }, 0) / arr.length;

      if (currPrice < avgBreakdownPrice) return signalEnum.sell;
      else return signalEnum.hold;
    }
  };

  const getCandleTrendEstimate = (index) => {
    const arr = priceData.c
      .slice(index - trendCheckingLastFewCandles, index + 1)
      .map((_e, i) => {
        const idx = index - trendCheckingLastFewCandles + i;

        return {
          index: idx,
          c: priceData.c[idx],
          o: priceData.o[idx],
          h: priceData.h[idx],
          l: priceData.l[idx],
        };
      });

    const currPrice = priceData.c[index];
    const point3OfPrice = (0.3 / 100) * currPrice;
    const point1OfPrice = (0.18 / 100) * currPrice;
    const avgPrice = arr.reduce((acc, curr) => acc + curr.c, 0) / arr.length;
    let rangeCandles = 0;
    for (let i = 0; i < arr.length; ++i) {
      const isNearlyEq = nearlyEquateNums(avgPrice, arr[i].c, point3OfPrice);

      if (isNearlyEq) rangeCandles++;
    }

    if (arr.length - rangeCandles < 2) return trendEnum.range;

    let redCandlesCount = 0,
      greenCandlesCount = 0;

    for (let i = 0; i < arr.length; ++i) {
      const diff = arr[i].c - arr[i].o;
      if (Math.abs(diff) < point1OfPrice) continue;

      if (diff > 0) greenCandlesCount++;
      else if (diff < 0) redCandlesCount++;
    }

    if (redCandlesCount < 2 && greenCandlesCount < 2) return trendEnum.range;

    const longPeriodArr = priceData.c.slice(
      index - trendCheckingLastFewCandles * 3,
      index + 1
    );
    const longPeriodAvgPrice =
      longPeriodArr.reduce((acc, curr) => acc + curr, 0) / longPeriodArr.length;

    if (redCandlesCount > greenCandlesCount && currPrice < longPeriodAvgPrice)
      return trendEnum.down;
    else if (
      greenCandlesCount > redCandlesCount &&
      currPrice > longPeriodAvgPrice
    )
      return trendEnum.up;
    else return trendEnum.range;
  };

  for (let i = startTakingTradeIndex; i < priceData.c.length; i++) {
    analyzeAllTradesForCompletion(i);

    const prices = priceData.c.slice(0, i + 1);
    const highs = priceData.h.slice(0, i + 1);
    const lows = priceData.l.slice(0, i + 1);
    const vols = priceData.v.slice(0, i + 1);

    const prevPrice = prices[i - 1];
    const price = prices[i];
    const high = priceData.h[i];
    const low = priceData.l[i];

    updateIndicatorValues(high, low, price);

    const ind_vps = getVPoints({
      offset: vPointOffset,
      prices: prices,
      startFrom: i - 40,
      previousOutput: indicators.vPs.filter((item) => item?.index < i - 40),
    });
    if (ind_vps.length !== indicators.vPs.length) {
      const ind_ranges = getSupportResistanceRangesFromVPoints(
        indicators.vPs,
        prices
      );
      indicators.ranges = ind_ranges;
    }
    indicators.vPs = ind_vps;

    // const ind_obv = await IXJIndicators.obv(prices, vols);
    const ind_willR = await IXJIndicators.willr(
      highs,
      lows,
      prices,
      willRPeriod
    );
    const ind_mfi = await IXJIndicators.mfi(
      highs,
      lows,
      prices,
      vols,
      mfiPeriod
    );
    const ind_vwap = await IXJIndicators.vwap(
      highs,
      lows,
      prices,
      vols,
      vwapPeriod
    );

    // indicators.obv = ind_obv;
    indicators.vwap = ind_vwap;
    indicators.mfi = ind_mfi;
    indicators.williamR = ind_willR;

    const smallMA = indicators.smallMA;
    const bigMA = indicators.bigMA;
    const CCI = indicators.cci;
    const RSI = indicators.rsi;
    const MACD = indicators.macd;
    const PSAR = indicators.psar;
    const ST = indicators.superTrend;
    const BB = indicators.bollingerBand;
    const stochastic = indicators.stochastic;

    const strongSupportResistances = indicators.ranges.filter(
      (item) => item?.stillStrong
    );
    // const trend = getCandleTrendEstimate(i);
    const rsi = RSI[i];
    const cci = CCI[i];
    const mfi = indicators.mfi[i];
    const vwap = indicators.vwap[i];
    const willR = indicators.williamR[i];
    const psar = PSAR[i];
    const superTrend = ST[i];

    const targetProfit = (targetProfitPercent / 100) * price;
    const stopLoss = (stopLossPercent / 100) * price;

    const isSRBreakout = strongSupportResistances.some(
      (item) => item.max < price && item.max > prevPrice
    );
    const isSRBreakdown = strongSupportResistances.some(
      (item) => item.min > price && item.min < prevPrice
    );
    const srSignal = isSRBreakout
      ? signalEnum.buy
      : isSRBreakdown
      ? signalEnum.sell
      : signalEnum.hold;
    const stochasticSignal =
      stochastic[i] < stochasticLow
        ? signalEnum.sell
        : stochastic[i] > stochasticHigh
        ? signalEnum.buy
        : signalEnum.hold;
    const rsiSignal =
      rsi < rsiLow
        ? signalEnum.buy
        : rsi > rsiHigh
        ? signalEnum.sell
        : signalEnum.hold;
    const willRSignal =
      willR < willRLow
        ? signalEnum.buy
        : willR > willRHigh
        ? signalEnum.sell
        : signalEnum.hold;
    const mfiSignal =
      mfi < mfiLow
        ? signalEnum.buy
        : mfi > mfiHigh
        ? signalEnum.sell
        : signalEnum.hold;
    const vwapSignal = price > vwap ? signalEnum.buy : signalEnum.sell;
    const cciSignal =
      cci > 100
        ? signalEnum.buy
        : cci < -100
        ? signalEnum.sell
        : signalEnum.hold;
    const macdSignal = getMacdSignal(MACD.slice(i - 2, i + 1));
    const smaSignal = getSmaCrossedSignal({
      smaLow: smallMA.slice(i - 2, i + 1),
      smaHigh: bigMA.slice(i - 2, i + 1),
    });
    // const trendSignal =
    //   trend == trendEnum.down
    //     ? signalEnum.sell
    //     : trend == trendEnum.up
    //     ? signalEnum.buy
    //     : signalEnum.hold;
    const bollingerBandSignal =
      price >= BB[i]?.upper
        ? signalEnum.sell
        : price <= BB[i]?.lower
        ? signalEnum.buy
        : signalEnum.hold;
    const psarSignal =
      price >= psar && superTrend?.direction == 1
        ? signalEnum.buy
        : price <= psar && superTrend?.direction == -1
        ? signalEnum.sell
        : signalEnum.hold;

    let brSignal;

    let analyticDetails = {
      allowedIndicatorSignals: {},
      index: i,
      price,
    };
    // const lastMoreCandleDiff = prices[i] - prices[i - lastMoreCandleOffset];
    // const lastFewCandleDiff = prices[i] - prices[i - lastFewCandleOffset];
    // const lastFewCandlePercent = (lastFewCandleDiff / price) * 100;

    // const breakOutDownSignal =
    //   Math.abs(lastMoreCandleDiff) >=
    //     Math.abs(lastFewCandleDiff) * lastCandlesMultiplier &&
    //   lastFewCandlePercent > 0.15
    //     ? lastMoreCandleDiff > 0 && lastFewCandleDiff < 0
    //       ? signalEnum.buy
    //       : lastMoreCandleDiff < 0 && lastFewCandleDiff > 0
    //       ? signalEnum.sell
    //       : signalEnum.hold
    //     : signalEnum.hold;

    const initialSignalWeight =
      signalWeight[srSignal] * indicatorsWeightEnum.sr;

    analyticDetails.allowedIndicatorSignals.sr = srSignal;

    const furtherIndicatorSignals = [];
    if (additionalIndicators.rsi) {
      furtherIndicatorSignals.push(
        signalWeight[rsiSignal] * indicatorsWeightEnum.rsi
      );

      analyticDetails.allowedIndicatorSignals.rsi = rsiSignal;
    }
    if (additionalIndicators.macd) {
      furtherIndicatorSignals.push(
        signalWeight[macdSignal] * indicatorsWeightEnum.macd
      );

      analyticDetails.allowedIndicatorSignals.macd = macdSignal;
    }
    if (additionalIndicators.sma) {
      furtherIndicatorSignals.push(
        signalWeight[smaSignal] * indicatorsWeightEnum.sma
      );
      analyticDetails.allowedIndicatorSignals.sma = smaSignal;
    }
    if (additionalIndicators.bollinger) {
      furtherIndicatorSignals.push(
        signalWeight[bollingerBandSignal] * indicatorsWeightEnum.bollingerBand
      );
      analyticDetails.allowedIndicatorSignals.bollinger = bollingerBandSignal;
    }
    if (additionalIndicators.br) {
      brSignal = getBreakOutDownSignal(i);

      furtherIndicatorSignals.push(
        signalWeight[brSignal] * indicatorsWeightEnum.br
      );
      analyticDetails.allowedIndicatorSignals.br = brSignal;
    }
    if (additionalIndicators.cci) {
      furtherIndicatorSignals.push(
        signalWeight[cciSignal] * indicatorsWeightEnum.cci
      );
      analyticDetails.allowedIndicatorSignals.cci = cciSignal;
    }
    if (additionalIndicators.mfi) {
      furtherIndicatorSignals.push(
        signalWeight[mfiSignal] * indicatorsWeightEnum.mfi
      );
      analyticDetails.allowedIndicatorSignals.mfi = mfiSignal;
    }
    if (additionalIndicators.stochastic) {
      furtherIndicatorSignals.push(
        signalWeight[stochasticSignal] * indicatorsWeightEnum.stochastic
      );
      analyticDetails.allowedIndicatorSignals.stochastic = stochasticSignal;
    }
    if (additionalIndicators.vwap) {
      furtherIndicatorSignals.push(
        signalWeight[vwapSignal] * indicatorsWeightEnum.vwap
      );
      analyticDetails.allowedIndicatorSignals.vwap = vwapSignal;
    }
    if (additionalIndicators.psar) {
      furtherIndicatorSignals.push(
        signalWeight[psarSignal] * indicatorsWeightEnum.psar
      );
      analyticDetails.allowedIndicatorSignals.psar = psarSignal;
    }
    // if (additionalIndicators.trend) {
    //   furtherIndicatorSignals.push(
    //     signalWeight[trendSignal] * indicatorsWeightEnum.trend
    //   );
    //   analyticDetails.allowedIndicatorSignals.trend = trendSignal;
    // }
    if (additionalIndicators.willR) {
      furtherIndicatorSignals.push(
        signalWeight[willRSignal] * indicatorsWeightEnum.williamR
      );
      analyticDetails.allowedIndicatorSignals.willR = willRSignal;
    }

    const additionalIndicatorsWeight =
      furtherIndicatorSignals.reduce((acc, curr) => curr + acc || 0, 0) || 0;

    const decisionMakingPoint = decisionMakingPoints || 3;

    let isBuySignal =
      initialSignalWeight + additionalIndicatorsWeight >= decisionMakingPoint;
    let isSellSignal =
      initialSignalWeight + additionalIndicatorsWeight <=
      -1 * decisionMakingPoint;

    analyticDetails.totalPoints =
      initialSignalWeight + additionalIndicatorsWeight;
    analyticDetails.netSignal = isBuySignal
      ? signalEnum.buy
      : isSellSignal
      ? signalEnum.sell
      : signalEnum.hold;

    if (!isBuySignal && !isSellSignal)
      analytics.push({
        ...analyticDetails,
      });

    const isAllowedToTakeThisTrade = (trade) => {
      const existingSimilarTrades = trades.filter(
        (item) => item.status == "taken" && item.type == trade.type
      );

      if (existingSimilarTrades.length > 0) return false;

      const timeStr = new Date(trade.time * 1000).toLocaleTimeString("en-in", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      });

      const [hour, min, sec] = timeStr.split(":").map((item) => parseInt(item));

      if (
        hour < 9 ||
        hour >= 15 ||
        (hour == 9 && min < 30) ||
        (hour == 14 && min > 30)
      )
        return false;

      if (avoidingLatestSmallMovePercent > 2)
        avoidingLatestSmallMovePercent = 0.9;
      const smallMoveLength = (avoidingLatestSmallMovePercent / 100) * price;

      const last3CandlesMove = Math.abs(price - priceData.o[i - 3]);
      if (last3CandlesMove > smallMoveLength) return false;

      return true;
    };

    if (isBuySignal) {
      let nearestResistance;
      for (let j = 0; j < strongSupportResistances.length; ++j) {
        const range = strongSupportResistances[j];
        if (range.max < price) continue;

        // if price is in between a range
        if (range.min < price) {
          nearestResistance = range.max;
          break;
        }

        if (!nearestResistance) nearestResistance = range.min;

        if (range.min < nearestResistance) nearestResistance = range.min;
      }

      const possibleProfit = nearestResistance
        ? nearestResistance - price
        : targetProfit;

      // updating analyticDetails
      analyticDetails.nearestResistance = nearestResistance;
      analyticDetails.possibleProfit = possibleProfit;
      analyticDetails.targetProfit = targetProfit;
      analytics.push({
        ...analyticDetails,
      });

      if (possibleProfit < targetProfit && useSupportResistances) continue;

      const trade = {
        time: priceData.t[i],
        startIndex: i,
        startPrice: price,
        type: signalEnum.buy,
        target: price + targetProfit,
        sl: price - stopLoss,
        analytics: analyticDetails,
        nearestResistance,
        status: "taken",
      };

      if (isAllowedToTakeThisTrade(trade)) trades.push(trade);
    } else if (isSellSignal) {
      let nearestSupport;
      for (let j = 0; j < strongSupportResistances.length; ++j) {
        const range = strongSupportResistances[j];
        if (range.min > price) continue;

        // if price is in between a range
        if (range.max > price) {
          nearestSupport = range.min;
          break;
        }

        if (!nearestSupport) nearestSupport = range.max;

        if (range.max < nearestSupport) nearestSupport = range.max;
      }

      const possibleProfit = nearestSupport
        ? price - nearestSupport
        : targetProfit;

      // updating analyticDetails
      analyticDetails.nearestSupport = nearestSupport;
      analyticDetails.possibleProfit = possibleProfit;
      analyticDetails.targetProfit = targetProfit;
      analytics.push({
        ...analyticDetails,
      });

      if (possibleProfit < targetProfit && useSupportResistances) continue;

      const trade = {
        time: priceData.t[i],
        startIndex: i,
        startPrice: price,
        type: signalEnum.sell,
        target: price - targetProfit,
        sl: price + stopLoss,
        analytics: analyticDetails,
        nearestSupport,
        status: "taken",
      };

      if (isAllowedToTakeThisTrade(trade)) trades.push(trade);
    }
  }

  return { trades, analytics, indicators };
};
