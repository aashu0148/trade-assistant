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
export const defaultTradePreset = {
  decisionMakingPoints: 3,
  additionalIndicators: {
    sr: true,
    tl: true,
    engulf: true,
    bollinger: true,
    sma: true,
    willR: false,
    mfi: false,
    cci: false,
    stochastic: false,
    vwap: false,
    psar: false,
    br: false,
    rsi: false,
    macd: true,
    obv: false,
  },
  useSRsToNeglectTrades: true,
  vPointOffset: 8,
  trendLineVPointOffset: 7,
  rsiLow: 40,
  rsiHigh: 70,
  smaLowPeriod: 18,
  smaHighPeriod: 150,
  rsiPeriod: 8,
  macdFastPeriod: 14,
  macdSlowPeriod: 24,
  macdSignalPeriod: 8,
  bollingerBandPeriod: 23,
  bollingerBandStdDev: 4,
  cciPeriod: 20,
  stochasticPeriod: 14,
  stochasticMA: 3,
  stochasticLow: 23,
  stochasticHigh: 83,
  willRPeriod: 14,
  willRLow: -90,
  willRHigh: -10,
  psarStart: 0.02,
  psarAcceleration: 0.02,
  psarMaxValue: 0.2,
  superTrendMultiplier: 3,
  mfiPeriod: 14,
  mfiLow: 23,
  mfiHigh: 83,
  vwapPeriod: 14,
  targetProfitPercent: 1.4,
  stopLossPercent: 0.7,
  brTotalTrendLength: 44,
  brLongTrendLength: 21,
  brShortTrendLength: 10,
  avoidingLatestSmallMovePercent: 0.9,
  trendCheckingLastFewCandles: 8,
};
export const indicatorsWeightEnum = {
  bollingerBand: 3,
  sr: 2,
  tl: 2,
  engulf: 2,
  sr15min: 2,
  movingAvg: 1.5,
  br: 2,
  macd: 1.5,
  rsi: 1,
  cci: 1,
  trend: 1,
  stochastic: 1,
  psar: 0.5,
  superTrend: 1,
  obv: 1,
  vwap: 1,
  williamR: 1,
  mfi: 1,
  vPs: 1,
  sma: 1.5,
};
const timeFrame = 5;
const getDxForPrice = (price, time = timeFrame) => {
  const dxPercentForTimeFrames = {
    5: 0.11 / 100,
    15: 0.18 / 100,
    60: 0.6 / 100,
  };

  return dxPercentForTimeFrames[time] * price;
};

const timesPricesCrossedRange = (prices = [], rangeMin, rangeMax) => {
  const p0 = prices[0];
  let count = 0,
    currPos = 0;
  const smallPercent =
    p0 < 250 ? (0.25 / 100) * prices[0] : (0.1 / 100) * prices[0];

  // prices.forEach((p) => {
  //   if (p < rangeMin) {
  //     if (currPos == 1) count++;

  //     currPos = -1;
  //   }
  //   if (p > rangeMax) {
  //     if (currPos == -1) count++;

  //     currPos = 1;
  //   }
  // });

  prices.forEach((p) => {
    if (Math.abs(p - rangeMin) > smallPercent && p < rangeMin) {
      if (currPos == 1) count++;

      currPos = -1;
    }
    if (Math.abs(p - rangeMax) > smallPercent && p > rangeMax) {
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
      const avgPoints =
        currRange.points.reduce((acc, curr) => acc + curr.value, 0) /
        currRange.points.length;

      const allowedDx = getDxForPrice(lastVPoint.value);
      const isNearlyEqual = nearlyEquateNums(
        avgPoints,
        lastVPoint.value,
        allowedDx
      );
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
  times = [],
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
        timestamp: times[i],
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
  prices = [],
  is15minTimeFrame = false
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

      const allowedDx = getDxForPrice(
        currPoint.value,
        is15minTimeFrame == true ? 15 : 5
      );

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

const timePricesCrossedTrendLine = ({ line, prices = [] }) => {
  if (!prices.length || line.slope == undefined) return 0;

  const firstPoint = line.points[0];
  const lastPoint = line.points[line.points.length - 1];

  const startIndex = firstPoint.index;
  const endIndex = lastPoint.index;
  if (prices.length < endIndex - startIndex - 1) return 0;

  const { value: y2, index: x2 } = lastPoint;
  const { value: y1, index: x1 } = firstPoint;

  const m = (y2 - y1) / (x2 - x1);
  const c = y1 - m * x1;

  let count = 0,
    pos = 0;
  prices.forEach((p, i) => {
    // const smallPercent = p < 250 ? (0.2 / 100) * p : (0.08 / 100) * p;
    const index = startIndex + i;
    const potentialY = m * index + c;

    if (p > potentialY) {
      if (pos == -1) count++;

      pos = 1;
    } else if (p < potentialY) {
      if (pos == 1) count++;

      pos = -1;
    }
  });

  return count;
};

const getTrendLinesFromVPoints = ({ allPrices, allTimes, vpOffset = 7 }) => {
  const points = getVPoints({
    offset: vpOffset,
    prices: allPrices,
    times: allTimes,
  });
  if (points.length < 3) return [];

  const lineSlopes = [];
  for (let i = 0; i < points.length - 1; i++) {
    const slopePoint = {
      point: points[i],
      slopes: [],
    };
    for (let j = i + 1; j < points.length; j++) {
      const { index: x1, value: y1 } = points[i];
      const { index: x2, value: y2 } = points[j];
      const slope = (y2 - y1) / (x2 - x1);

      if (slope !== 0 && slope !== Infinity)
        slopePoint.slopes.push({
          slope,
          otherPoint: points[j],
          currPoint: points[i],
        });
    }

    lineSlopes.push(slopePoint);
  }

  const tolerance = 0.004;

  const pointLines = [];
  for (let i = 0; i < lineSlopes.length - 1; i++) {
    const slopes = lineSlopes[i].slopes;
    const slopeGroups = [];

    for (let j = 0; j < slopes.length - 1; ++j) {
      const jSlope = slopes[j].slope;
      let currentGroup = [slopes[j]];

      for (let k = j + 1; k < slopes.length; ++k) {
        const kSlope = slopes[k].slope;
        if (
          Math.abs(jSlope - kSlope) <= tolerance &&
          Math.sign(kSlope) == Math.sign(jSlope)
        )
          currentGroup.push(slopes[k]);
      }

      if (currentGroup.length > 1) {
        slopeGroups.push(currentGroup);
      }
    }

    if (slopeGroups.length) {
      const otherPoints = slopeGroups.map((group) => ({
        id: group.map((g) => g.otherPoint?.index).join(","),
        points: group,
      }));

      pointLines.push({
        point: lineSlopes[i].point,
        otherPoints: otherPoints.filter(
          (item, index, self) =>
            !self.some((op) => op.id !== item.id && op.id.includes(item.id))
        ),
      });
    }
  }

  const lines = pointLines
    .map((item) =>
      item.otherPoints.map((op) => ({
        id: item.point?.index + "," + op.id,
        points: [{ point: item.point }, ...op.points],
      }))
    )
    .reduce((acc, curr) => [...acc, ...curr], []);

  const trendLines = lines.map((item) => ({
    id: item.id,
    stillStrong: true,
    slope:
      item.points.reduce((acc, curr) => acc + (curr.slope || 0), 0) /
      (item.points.length - 1), // -1 because 1st point's slope is undefined always
    points: item.points.map((p) => ({
      ...(p.otherPoint || p.point),
      slope: p.slope,
    })),
  }));
  const goodTrendLines = trendLines.filter((item) => {
    const prices = allPrices.slice(
      item.points[0].index,
      item.points[item.points.length - 1].index
    );
    const timesCrossed = timePricesCrossedTrendLine({ line: item, prices });

    // removing the weak trend lines
    if (timesCrossed > 2) return false;

    const bigIntervals = item.points.reduce(
      (acc, curr, i, self) =>
        i == 0 ? acc : curr.index - self[i - 1].index > 60 ? acc + 1 : acc,
      0
    );
    const newPointsLength = item.points.length - bigIntervals;
    if (newPointsLength < 3) return false;

    return true;
  });

  return goodTrendLines.filter(
    (item, index, self) =>
      !self.some((op) => op.id !== item.id && op.id.includes(item.id))
  );
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
  stockData = {},
  preset = defaultTradePreset,
  takeOneRecentTrade = false
) => {
  if (!stockData || !stockData["5"]?.c?.length)
    return { trades: [], analytics: [] };
  let priceData = stockData["5"];
  // let priceData15min = stockData["15"];
  if (!priceData.c?.length) return { trades: [], analytics: [] };

  const {
    additionalIndicators = {
      willR: false,
      mfi: false,
      sr: false,
      cci: false,
      stochastic: false,
      vwap: false,
      engulf: false,
      psar: false,
      tl: false,
      br: false,
      rsi: false,
      macd: false,
      bollinger: false,
      sma: false,
    },
    decisionMakingPoints = 3,
    useSRsToNeglectTrades = true,
    vPointOffset = 8,
    trendLineVPointOffset = 7,
    rsiLow = 40,
    rsiHigh = 70,
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
    brTotalTrendLength = 44,
    brLongTrendLength = 21,
    brShortTrendLength = 10,
    avoidingLatestSmallMovePercent = 0.9,
    trendCheckingLastFewCandles = 8,
  } = preset;

  if (targetProfitPercent <= 0) targetProfitPercent = 0.1;
  if (stopLossPercent <= 0) stopLossPercent = 0.1;

  // variable definitions
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
    trendLines: [],
    trends: [],
    prevDaysStart: [],
    allSignals: [],
    engulf: [],
  };

  let trades = [],
    analytics = [];

  // allowing the algo to take only one trade for last price
  const startTakingTradeIndex = takeOneRecentTrade
    ? priceData.c.length - 1
    : 200;

  // function definitions
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
      return { signal: signalEnum.hold, allowedPercent };

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

    const onePercentOfPrice = (0.9 / 100) * currPrice;
    const point1PercentOfPrice = (0.11 / 100) * currPrice;
    const trendEstimate =
      currPrice - priceData.c[index - totalTrendLength] > onePercentOfPrice
        ? "up"
        : priceData.c[index - totalTrendLength] - currPrice > onePercentOfPrice
        ? "down"
        : "none";

    if (trendEstimate == "none")
      return {
        signal: signalEnum.hold,
        trendEstimate,
        currPrice,
        onePercentOfPrice,
        trendStartIndex: index - totalTrendLength,
        // totalTrendLength,
        // trendStart: priceData.c[index - totalTrendLength],
      };

    if (trendEstimate == "up") {
      if (
        Math.abs(recentHigh) < point1PercentOfPrice ||
        recentHighCandleIndex === index
      )
        return { signal: signalEnum.hold, recentHigh, point1PercentOfPrice };

      let recentUpTrendLength;
      for (let i = recentHighCandleIndex; i > index - longTrendLength; --i) {
        const len = Math.abs(
          priceData.c[i] - priceData.h[recentHighCandleIndex]
        );

        if (isNaN(recentUpTrendLength) || len > recentUpTrendLength)
          recentUpTrendLength = len;
      }

      if (recentUpTrendLength < recentHigh * 1.75) {
        return { signal: signalEnum.hold, recentUpTrendLength, recentHigh };
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

      if (currPrice >= avgBreakoutPrice)
        return { signal: signalEnum.buy, currPrice, avgBreakoutPrice };
      else return { signal: signalEnum.hold, currPrice, avgBreakoutPrice };
    } else {
      if (
        Math.abs(recentLow) < point1PercentOfPrice ||
        recentLowCandleIndex === index
      )
        return { signal: signalEnum.hold, recentLow, point1PercentOfPrice };

      let recentDownTrendLength;
      for (let i = recentLowCandleIndex; i > index - longTrendLength; --i) {
        const len = Math.abs(
          priceData.c[i] - priceData.l[recentLowCandleIndex]
        );

        if (isNaN(recentDownTrendLength) || len > recentDownTrendLength)
          recentDownTrendLength = len;
      }

      if (recentDownTrendLength < recentLow * 1.8)
        return { signal: signalEnum.hold, recentDownTrendLength, recentLow };

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

      if (currPrice <= avgBreakdownPrice)
        return { signal: signalEnum.sell, currPrice, avgBreakdownPrice };
      else return { signal: signalEnum.hold, currPrice, avgBreakdownPrice };
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

  const getSrSignal = (index, srRanges = []) => {
    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];

    const point3OfPrice = ((currClose > 350 ? 0.2 : 0.3) / 100) * currClose;
    const isBigCandle = Math.abs(currClose - currOpen) > point3OfPrice;

    const isBigBreakout = srRanges.some(
      (item) => isBigCandle && item.max < currClose && item.max > currOpen
    );
    if (isBigBreakout) return signalEnum.buy;

    const isBigBreakdown = srRanges.some(
      (item) => isBigCandle && item.min > currClose && item.min < currOpen
    );
    if (isBigBreakdown) return signalEnum.sell;

    const prevOpen = priceData.o[index - 1];

    const isNormalBreakout = srRanges.some(
      (item) =>
        prevOpen < item.max && currClose > item.max && currOpen > item.max
    );
    if (isNormalBreakout) return signalEnum.buy;

    const isNormalBreakdown = srRanges.some(
      (item) =>
        prevOpen > item.min && currClose < item.min && currOpen < item.min
    );
    if (isNormalBreakdown) return signalEnum.sell;

    return signalEnum.hold;
  };

  const getCandleColor = (index) => {
    const open = priceData.o[index];
    const close = priceData.c[index];

    return close - open > 0 ? "green" : "red";
  };

  const getTLBreakOutDownSignal = (index) => {
    const strongTLs = indicators.trendLines.filter((item) => item.stillStrong);

    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];
    const prevOpen = priceData.o[index - 1];

    const point3OfPrice = ((currClose > 350 ? 0.2 : 0.3) / 100) * currClose;
    const point05OfPrice = ((currClose > 350 ? 0.04 : 0.03) / 100) * currClose;
    const isBigCandle = Math.abs(currClose - currOpen) > point3OfPrice;
    const isDoji = Math.abs(currClose - currOpen) <= point05OfPrice;

    if (isDoji)
      return {
        signal: signalEnum.hold,
      };

    for (let i = 0; i < strongTLs.length; ++i) {
      const tl = strongTLs[i];
      const firstPoint = tl.points[0];
      const lastPoint = tl.points[tl.points.length - 1];

      const { value: y2, index: x2 } = lastPoint;
      const { value: y1, index: x1 } = firstPoint;

      const m = (y2 - y1) / (x2 - x1);
      const c = y1 - m * x1;

      const isAboveLine = (p, i) => {
        const potentialY = m * i + c;
        return p > potentialY ? true : false;
      };

      const bigBreakout =
        isAboveLine(currClose, index) &&
        !isAboveLine(currOpen, index) &&
        isBigCandle;
      if (bigBreakout)
        return {
          signal: signalEnum.buy,
          bigBreakout,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          // ccAbove: isAboveLine(currClose, index),
          // coAbove: isAboveLine(currOpen, index),
          // poAbove: isAboveLine(prevOpen, index - 1),
        };

      const bigBreakdown =
        !isAboveLine(currClose, index) &&
        isAboveLine(currOpen, index) &&
        isBigCandle;
      if (bigBreakdown)
        return {
          signal: signalEnum.sell,
          bigBreakdown,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          // ccAbove: isAboveLine(currClose, index),
          // coAbove: isAboveLine(currOpen, index),
          // poAbove: isAboveLine(prevOpen, index - 1),
        };

      const normalBreakout =
        isAboveLine(currClose, index) &&
        isAboveLine(currOpen, index) &&
        !isAboveLine(prevOpen, index - 1) &&
        !isBigCandle;
      if (normalBreakout)
        return {
          signal: signalEnum.buy,
          normalBreakout,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          // ccAbove: isAboveLine(currClose, index),
          // coAbove: isAboveLine(currOpen, index),
          // poAbove: isAboveLine(prevOpen, index - 1),
        };

      const normalBreakdown =
        !isAboveLine(currClose, index) &&
        !isAboveLine(currOpen, index) &&
        isAboveLine(prevOpen, index - 1) &&
        !isBigCandle;
      if (normalBreakdown)
        return {
          signal: signalEnum.sell,
          line: tl,
          normalBreakdown,
          currClose,
          currOpen,
          prevOpen,
          // ccAbove: isAboveLine(currClose, index),
          // coAbove: isAboveLine(currOpen, index),
          // poAbove: isAboveLine(prevOpen, index - 1),
        };
    }

    return { signal: signalEnum.hold };
  };

  const getEngulfSignal = (index) => {
    if (!index) return signalEnum.hold;

    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];
    const currHigh = priceData.h[index];
    const currLow = priceData.l[index];
    const prevClose = priceData.c[index - 1];
    const prevOpen = priceData.o[index - 1];
    const prevLow = priceData.l[index - 1];
    const prevHigh = priceData.h[index - 1];

    const prevCandleColor = getCandleColor(index - 1);
    const currCandleColor = getCandleColor(index);

    const point05OfPrice = ((currClose > 350 ? 0.04 : 0.03) / 100) * currClose;
    const isPrevDoji = Math.abs(prevClose - prevOpen) <= point05OfPrice;
    const isCurrDoji = Math.abs(currClose - currOpen) <= point05OfPrice;

    if (prevCandleColor == currCandleColor || isCurrDoji || isPrevDoji)
      return signalEnum.hold;

    const isEngulfed =
      currCandleColor === "red"
        ? prevLow > currClose && currHigh > prevHigh
        : prevHigh < currClose && currLow < prevLow;

    const lowerWick =
      currCandleColor == "red" ? currClose - currLow : currOpen - currLow;
    const upperWick =
      currCandleColor == "green" ? currHigh - currClose : currHigh - currOpen;
    const candleLen = currHigh - currLow;

    const lowerWickPercent = (lowerWick / candleLen) * 100;
    const upperWickPercent = (upperWick / candleLen) * 100;

    const isValidEngulf =
      currCandleColor == "green"
        ? lowerWickPercent < 28
        : upperWickPercent < 28;

    const signal =
      isEngulfed && isValidEngulf
        ? currCandleColor == "red"
          ? signalEnum.sell
          : signalEnum.buy
        : signalEnum.hold;

    return signal;
  };

  const updateIndicatorValues = (index) => {
    const high = priceData.h[index];
    const low = priceData.l[index];
    const price = priceData.c[index];

    const smaL = indicatorSmallMA.nextValue(price);
    const smaH = indicatorBigMA.nextValue(price);
    const rsi = indicatorRsi.nextValue(price);
    const cci = indicatorCCI.nextValue(high, low, price);
    const macd = indicatorMacd.nextValue(price);
    const bollingerBand = indicatorBollingerBands.nextValue(price);
    const stochastic = indicatorStochastic.nextValue(high, low, price).k;
    const psar = indicatorPSAR.nextValue(high, low, price);
    const superTrend = indicatorSuperTrend.nextValue(high, low, price);
    const engulfSignal = getEngulfSignal(index);

    indicators.engulf.push(engulfSignal);
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

  const calculateIndicatorsBeforeStartingIndex = async () => {
    const vps = getVPoints({
      offset: vPointOffset,
      prices: priceData.c.slice(0, startTakingTradeIndex),
      times: priceData.t.slice(0, startTakingTradeIndex),
    });
    const ranges = getSupportResistanceRangesFromVPoints(
      vps,
      priceData.c.slice(0, startTakingTradeIndex)
    );
    const trendLines = getTrendLinesFromVPoints({
      vpOffset: trendLineVPointOffset,
      index: startTakingTradeIndex,
      allPrices: priceData.c.slice(0, startTakingTradeIndex),
      allTimes: priceData.t.slice(0, startTakingTradeIndex),
    });

    indicators.vPs = vps;
    indicators.ranges = ranges.map((item) => {
      if (item.start.index < startTakingTradeIndex - 300) {
        item.stillStrong = false;
        item.reason = "old SR";
      }

      return item;
    });
    indicators.trendLines = trendLines.map((item) => {
      if (item.points[0].index < startTakingTradeIndex - 300) {
        item.stillStrong = false;
        item.reason = "old SR";
      }

      return item;
    });

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
      indicators.allSignals.push({});
      updateIndicatorValues(i);

      // const day = new Date(time * 1000).getDate();
      // if (
      //   !indicators.prevDaysStart.length ||
      //   indicators.prevDaysStart[indicators.prevDaysStart.length - 1].day !==
      //     day
      // )
      //   indicators.prevDaysStart.push({
      //     index: i,
      //     price,
      //     day,
      //     open: priceData.o[i],
      //   });
    }
  };
  await calculateIndicatorsBeforeStartingIndex();

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

    const currDay = new Date(priceData.t[currentIndex] * 1000).getDate();
    const prevDay = new Date(priceData.t[currentIndex - 1] * 1000).getDate();

    if (currDay !== prevDay) {
      // new day started
      trades.forEach((trade) => {
        if (trade.status == "taken") trade.status = "unfinished";
      });
      return;
    }

    trades.forEach(async (trade, i) => {
      if (
        trade.status == "profit" ||
        trade.status == "loss" ||
        trade.status == "unfinished"
      )
        return;

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
      trades[i].status = status;

      if (status !== "taken") trades[i].endIndex = currentIndex;
    });
  };

  for (let i = startTakingTradeIndex; i < priceData.c.length; i++) {
    const priceIntervalLength = 260;
    const startI = i - priceIntervalLength < 0 ? 0 : i - priceIntervalLength;

    const times = priceData.t.slice(startI, i + 1);
    const prices = priceData.c.slice(startI, i + 1);
    const highs = priceData.h.slice(startI, i + 1);
    const lows = priceData.l.slice(startI, i + 1);
    const vols = priceData.v.slice(startI, i + 1);

    const effectiveI = i - startI;

    const price = prices[effectiveI];
    const time = times[effectiveI];
    const high = highs[effectiveI];
    const low = lows[effectiveI];

    updateIndicatorValues(i);
    analyzeAllTradesForCompletion(i);

    const ind_vps = getVPoints({
      offset: vPointOffset,
      prices: prices,
      times: times,
    });

    // getting effective last vPoint index
    const lastVPointIndex = ind_vps[ind_vps.length - 1].index + startI;
    if (lastVPointIndex !== indicators.vPs[indicators.vPs.length - 1].index) {
      // new V-point found
      indicators.vPs.push({
        ...ind_vps[ind_vps.length - 1],
        index: lastVPointIndex,
      });

      // calculate ranges with effective index
      const ind_ranges = getSupportResistanceRangesFromVPoints(
        ind_vps,
        prices
      ).map((item) => ({
        ...item,
        start: { ...item.start, index: item.start.index + startI },
        end: item.end ? { ...item.end, index: item.end.index + startI } : "",
        points: item.points.map((p) => ({ ...p, index: p.index + startI })),
      }));

      const lastFewRanges = ind_ranges.slice(-5);
      const lastStoredRangesIndex =
        indicators.ranges[indicators.ranges.length - 1]?.start?.index;
      let isNewRangeFound =
        lastFewRanges?.length &&
        (!lastStoredRangesIndex ||
          lastFewRanges[lastFewRanges.length - 1].start.index !==
            lastStoredRangesIndex);

      if (isNewRangeFound) {
        indicators.ranges.push(
          ...lastFewRanges.filter(
            (item) => item.start.index > lastStoredRangesIndex
          )
        );
        indicators.ranges.forEach((item) => {
          if (item.start.index < i - priceIntervalLength) {
            item.stillStrong = false;
            item.reason = "old SR";
          }
        });
      }

      // calculate trend lines with effective index
      const ind_t_lines = getTrendLinesFromVPoints({
        allPrices: prices,
        allTimes: times,
        vpOffset: trendLineVPointOffset,
      }).map((item) => ({
        ...item,
        id: item.id
          .split(",")
          .map((idx) => parseInt(idx) + startI)
          .join(","),
        points: item.points.map((p) => ({ ...p, index: p.index + startI })),
      }));

      const lastFewTLs = ind_t_lines.slice(-7);
      const lastStoredTLStartIndex = indicators.trendLines.length
        ? indicators.trendLines[indicators.trendLines.length - 1]?.points[0]
            ?.index
        : 0;
      let isNewTLFound =
        lastFewTLs?.length &&
        (!lastStoredTLStartIndex ||
          lastFewTLs[lastFewTLs.length - 1].points[0].index !==
            lastStoredTLStartIndex);

      if (isNewTLFound) {
        indicators.trendLines.push(
          ...lastFewTLs.filter(
            (item) => item.points[0].index > lastStoredTLStartIndex
          )
        );
        indicators.trendLines.forEach((item) => {
          if (item.points[0].index < i - priceIntervalLength) {
            item.stillStrong = false;
            item.reason = "old TL";
          }
        });
      }
    }

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

    indicators.vwap.push(ind_vwap[ind_vwap.length - 1]);
    indicators.mfi.push(ind_mfi[ind_mfi.length - 1]);
    indicators.williamR.push(ind_willR[ind_willR.length - 1]);

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
    // const strongSupportResistances15min = indicators.ranges15min.filter(
    //   (item) => item?.stillStrong
    // );
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

    // const isSRBreakout = strongSupportResistances.some(
    //   (item) => item.max < price && item.max > prevPrice
    // );
    // const isSRBreakdown = strongSupportResistances.some(
    //   (item) => item.min > price && item.min < prevPrice
    // );
    // const srSignal = isSRBreakout
    //   ? signalEnum.buy
    //   : isSRBreakdown
    //   ? signalEnum.sell
    //   : signalEnum.hold;

    const srSignal = getSrSignal(i, strongSupportResistances);
    const engulfSignal = indicators.engulf[i];

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

    let brSignal, tlSignal;

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

    const initialSignalWeight = 0;

    analyticDetails.allowedIndicatorSignals.sr = srSignal;

    const furtherIndicatorSignals = [];
    if (additionalIndicators.sr) {
      let finalSrSignal = srSignal;
      if (finalSrSignal == signalEnum.hold) {
        const srMinus1 = indicators.allSignals[i - 1].srSignal;
        const srMinus2 = indicators.allSignals[i - 2].srSignal;

        if (srMinus1 && srMinus1 !== signalEnum.hold) finalSrSignal = srMinus1;
        else if (srMinus2 && srMinus2 !== signalEnum.hold)
          finalSrSignal = srMinus2;
      }

      furtherIndicatorSignals.push(
        signalWeight[finalSrSignal] * indicatorsWeightEnum.sr
      );

      analyticDetails.allowedIndicatorSignals.sr = finalSrSignal;
    }
    if (additionalIndicators.tl) {
      tlSignal = getTLBreakOutDownSignal(i).signal;
      let finalTlSignal = tlSignal;
      if (finalTlSignal == signalEnum.hold) {
        const tlMinus1 = indicators.allSignals[i - 1].tlSignal;
        const tlMinus2 = indicators.allSignals[i - 2].tlSignal;

        if (tlMinus1 && tlMinus1 !== signalEnum.hold) finalTlSignal = tlMinus1;
        else if (tlMinus2 && tlMinus2 !== signalEnum.hold)
          finalTlSignal = tlMinus2;
      }

      furtherIndicatorSignals.push(
        signalWeight[finalTlSignal] * indicatorsWeightEnum.tl
      );
      analyticDetails.allowedIndicatorSignals.tl = finalTlSignal;
    }
    if (additionalIndicators.rsi) {
      furtherIndicatorSignals.push(
        signalWeight[rsiSignal] * indicatorsWeightEnum.rsi
      );

      analyticDetails.allowedIndicatorSignals.rsi = rsiSignal;
    }
    if (additionalIndicators.engulf) {
      let finalEngulfSignal = engulfSignal;
      if (finalEngulfSignal == signalEnum.hold) {
        const engulfMinus1 = indicators.allSignals[i - 1].engulfSignal;
        const engulfMinus2 = indicators.allSignals[i - 2].engulfSignal;

        if (engulfMinus1 && engulfMinus1 !== signalEnum.hold)
          finalEngulfSignal = engulfMinus1;
        else if (engulfMinus2 && engulfMinus2 !== signalEnum.hold)
          finalEngulfSignal = engulfMinus2;
      }

      furtherIndicatorSignals.push(
        signalWeight[finalEngulfSignal] * indicatorsWeightEnum.engulf
      );

      analyticDetails.allowedIndicatorSignals.macd = finalEngulfSignal;
    }
    if (additionalIndicators.macd) {
      let finalMacdSignal = macdSignal;
      if (finalMacdSignal == signalEnum.hold) {
        const macdMinus1 = indicators.allSignals[i - 1].macdSignal;
        const macdMinus2 = indicators.allSignals[i - 2].macdSignal;

        if (macdMinus1 && macdMinus1 !== signalEnum.hold)
          finalMacdSignal = macdMinus1;
        else if (macdMinus2 && macdMinus2 !== signalEnum.hold)
          finalMacdSignal = macdMinus2;
      }

      furtherIndicatorSignals.push(
        signalWeight[finalMacdSignal] * indicatorsWeightEnum.macd
      );

      analyticDetails.allowedIndicatorSignals.macd = finalMacdSignal;
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
      brSignal = getBreakOutDownSignal(i).signal;

      let finalBrSignal = brSignal;
      if (finalBrSignal == signalEnum.hold) {
        const brMinus1 = indicators.allSignals[i - 1].brSignal;
        const brMinus2 = indicators.allSignals[i - 2].brSignal;

        if (brMinus1 && brMinus1 !== signalEnum.hold) finalBrSignal = brMinus1;
        else if (brMinus2 && brMinus2 !== signalEnum.hold)
          finalBrSignal = brMinus2;
      }

      furtherIndicatorSignals.push(
        signalWeight[finalBrSignal] * indicatorsWeightEnum.br
      );
      analyticDetails.allowedIndicatorSignals.br = finalBrSignal;
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

    indicators.allSignals.push({
      srSignal,
      macdSignal,
      rsiSignal,
      tlSignal,
      brSignal,
      engulfSignal,
      // tlFull: getTLBreakOutDownSignal(i),
      // brFull: getBreakOutDownSignal(i),
      cciSignal,
      mfiSignal,
      smaSignal,
      psarSignal,
      vwapSignal,
      willRSignal,
    });

    const additionalIndicatorsWeight =
      furtherIndicatorSignals.reduce((acc, curr) => curr + acc || 0, 0) || 0;

    const decisionMakingPoint = decisionMakingPoints || 3;

    let isBuySignal =
      initialSignalWeight + additionalIndicatorsWeight >= decisionMakingPoint;
    let isSellSignal =
      initialSignalWeight + additionalIndicatorsWeight <=
      -1 * decisionMakingPoint;

    if (!isBuySignal && !isSellSignal)
      analytics.push({
        ...analyticDetails,
      });

    const isAllowedToTakeThisTrade = (trade) => {
      const existingSimilarTrades = trades.filter(
        (item) => item.status == "taken"
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
        (hour == 9 && min < 25) ||
        (hour == 14 && min > 30)
      )
        return false;

      // check if it is not testing the SR

      // const lastFewDaysPrices = indicators.prevDaysStart.slice(-7);
      // const lastFewDaysMoves = [];
      // for (let i = lastFewDaysPrices.length - 1; i > 0; --i) {
      //   const diff =
      //     lastFewDaysPrices[i].price - lastFewDaysPrices[i - 1].price;
      //   lastFewDaysMoves.push(Math.abs(diff));
      // }
      // const avgMove =
      //   lastFewDaysMoves.reduce((acc, curr) => acc + curr, 0) /
      //   lastFewDaysMoves.length;
      // const todaysOpen =
      //   indicators.prevDaysStart[indicators.prevDaysStart.length - 1].open;
      // const tradeAndOpenDiff = Math.abs(todaysOpen - trade.target);
      // if (tradeAndOpenDiff > avgMove + avgMove / 5) return false;

      const lastCandleColors = {
        color: "",
        allEqual: true,
      };
      for (let c = 0; c < 4; ++c) {
        const color = getCandleColor(i - c);

        if (!lastCandleColors.color) lastCandleColors.color = color;
        else if (color !== lastCandleColors.color)
          lastCandleColors.allEqual = false;
      }
      if (lastCandleColors.allEqual) {
        if (lastCandleColors.color == "red" && trade.type == "sell")
          return false;
        if (lastCandleColors.color == "green" && trade.type == "buy")
          return false;
      }

      if (avoidingLatestSmallMovePercent > 2)
        avoidingLatestSmallMovePercent = 0.9;
      const smallMoveLength = (avoidingLatestSmallMovePercent / 100) * price;

      const last3CandlesMove = Math.abs(price - priceData.o[i - 3]);
      if (last3CandlesMove > smallMoveLength) return false;

      return true;
    };

    // if (reverseTheTradingLogic) {
    //   isBuySignal = !isBuySignal;
    //   isSellSignal = !isSellSignal;
    // }

    analyticDetails.totalPoints =
      initialSignalWeight + additionalIndicatorsWeight;
    analyticDetails.netSignal = isBuySignal
      ? signalEnum.buy
      : isSellSignal
      ? signalEnum.sell
      : signalEnum.hold;

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

      if (possibleProfit < targetProfit && useSRsToNeglectTrades) continue;

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

      if (possibleProfit < targetProfit && useSRsToNeglectTrades) continue;

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

  return { trades, analytics, indicators, preset };
};
