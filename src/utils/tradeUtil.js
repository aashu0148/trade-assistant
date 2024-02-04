import {
  EMA as technicalIndicatorSMA,
  RSI as technicalIndicatorRSI,
  MACD as technicalIndicatorMACD,
  BollingerBands as technicalIndicatorBollingerBands,
  CCI as technicalIndicatorCCI,
  Stochastic as technicalIndicatorStochastic,
  PSAR as technicalIndicatorPSAR,
  ADX as technicalIndicatorAdx,
} from "@debut/indicators";
import {
  volumeWeightedAveragePrice as getVwapValues,
  williamsR as getWillRValues,
  moneyFlowIndex as getMfiValues,
} from "indicatorts";

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
const signalWeights = {
  [signalEnum.sell]: -1,
  [signalEnum.hold]: 0,
  [signalEnum.buy]: 1,
};
export const indicatorEnum = {
  bollingerBand: "bollinger",
  sr: "sr",
  tl: "tl",
  engulf: "enfulf",
  ema: "ema",
  br: "br",
  allStar: "allStar",
  macd: "macd",
  rsi: "rsi",
  cci: "cci",
  trend: "trend",
  stochastic: "stochastic",
  psar: "psar",
  obv: "obv",
  vwap: "vwap",
  williamR: "willR",
  mfi: "mfi",
};
export const defaultTradePreset = {
  decisionMakingPoints: 3,
  additionalIndicators: {
    sr: true,
    tl: true,
    allStar: true,
    engulf: true,
    bollinger: false,
    ema: true,
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
  vPointOffset: 8,
  trendLineVPointOffset: 7,
  adxPeriod: 14,
  rsiLow: 30,
  rsiHigh: 70,
  emaLowPeriod: 12,
  emaHighPeriod: 26,
  rsiPeriod: 8,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  bollingerBandPeriod: 20,
  bollingerBandStdDev: 2,
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
  sr: 2,
  tl: 2,
  engulf: 2,
  sr15min: 2,
  allStar: 1,
  br: 2,
  macd: 1.5,
  rsi: 1,
  cci: 1,
  trend: 1,
  bollingerBand: 1,
  stochastic: 1,
  psar: 1,
  obv: 1,
  vwap: 1,
  williamR: 1,
  mfi: 1,
  vPs: 1,
  ema: 3,
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

const getSmaCrossedSignal = ({ emaLow = [], emaHigh = [] }) => {
  if (
    !emaLow?.length ||
    !emaHigh?.length ||
    emaLow.length > 3 ||
    emaHigh.length > 3
  )
    return signalEnum.hold;

  let signal = signalEnum.hold,
    s = 0;
  for (let i = 0; i < emaLow.length; ++i) {
    const d = emaLow[i] - emaHigh[i];

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
      allStar: false,
      cci: false,
      stochastic: false,
      vwap: false,
      engulf: false,
      meStar: false,
      psar: false,
      tl: false,
      br: false,
      rsi: false,
      macd: false,
      bollinger: false,
      ema: false,
    },
    decisionMakingPoints = 3,
    vPointOffset = 8,
    trendLineVPointOffset = 7,
    rsiLow = 30,
    rsiHigh = 70,
    emaLowPeriod = 18,
    adxPeriod = 14,
    emaHighPeriod = 150,
    rsiPeriod = 8,
    macdFastPeriod = 12,
    macdSlowPeriod = 26,
    macdSignalPeriod = 9,
    bollingerBandPeriod = 20,
    bollingerBandStdDev = 2,
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
  const indicatorSmallMA = new technicalIndicatorSMA(emaLowPeriod);
  const indicatorBigMA = new technicalIndicatorSMA(emaHighPeriod);
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
  const indicatorAdx = new technicalIndicatorAdx(adxPeriod);
  const indicatorBollingerBands = new technicalIndicatorBollingerBands(
    bollingerBandPeriod,
    bollingerBandStdDev
  );
  const indicatorPSAR = new technicalIndicatorPSAR(
    psarStart,
    psarAcceleration,
    psarMaxValue
  );

  const indicators = {
    lastCalculatedIndex: 0,
    smallMA: [],
    bigMA: [],
    rsi: [],
    cci: [],
    adx: [],
    macd: [],
    bollingerBand: [],
    stochastic: [],
    psar: [],
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

  const getCandleColor = (index) => {
    if (!index) return;
    const open = priceData.o[index];
    const close = priceData.c[index];

    return close - open > 0 ? "green" : "red";
  };

  const isDojiCandle = (index) => {
    if (!index) return false;

    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];

    const point05OfPrice = ((currClose > 350 ? 0.06 : 0.04) / 100) * currClose;
    const isDoji = Math.abs(currClose - currOpen) <= point05OfPrice;

    return isDoji;
  };

  const isPinCandle = (index) => {
    if (!index) return { isPin: false, isInvertedPin: false };
    const open = priceData.o[index];
    const close = priceData.c[index];
    const high = priceData.h[index];
    const low = priceData.l[index];

    const totalCandle = high - low;
    const lowerWick = (open < close ? open : close) - low;
    const upperWick = high - (open > close ? open : close);

    const lowerWickPercent = (lowerWick / totalCandle) * 100;
    const upperWickPercent = (upperWick / totalCandle) * 100;

    const isPin = lowerWickPercent >= 50 && upperWickPercent < 20;
    const isInvertedPin = upperWickPercent >= 50 && lowerWickPercent < 20;

    return {
      isPin,
      isInvertedPin,
      // lowerWick,
      // upperWick,
      // upperWickPercent,
      // lowerWickPercent,
    };
  };

  const getSrSignal = (index, srRanges = []) => {
    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];
    const prevOpen = priceData.o[index - 1];
    const currCandleColor = getCandleColor(index);

    const point1OfPrice = ((currClose > 350 ? 0.1 : 0.2) / 100) * currClose;
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

    const prevLow = priceData.l[index - 1];
    const prevHigh = priceData.h[index - 1];
    const pinType = isPinCandle(index - 1);
    const isPin = pinType.isPin ? true : false;
    const isInvertedPin = pinType.isInvertedPin ? true : false;

    if (!isPin && !isInvertedPin) return signalEnum.hold;

    const isSupportReversal = srRanges.some(
      (item) =>
        isPin &&
        currCandleColor == "green" &&
        currClose > item.max &&
        (item.max > prevLow || prevLow - item.max <= point1OfPrice)
    );
    if (isSupportReversal) return signalEnum.buy;

    const isResistanceReversal = srRanges.some(
      (item) =>
        isInvertedPin &&
        currCandleColor == "red" &&
        currClose < item.min &&
        (item.min < prevHigh || item.min - prevHigh <= point1OfPrice)
    );
    if (isResistanceReversal) return signalEnum.sell;

    return signalEnum.hold;
  };

  const getTLBreakOutDownSignal = (index) => {
    const strongTLs = indicators.trendLines.filter((item) => item.stillStrong);

    const currClose = priceData.c[index];
    const currOpen = priceData.o[index];
    const prevOpen = priceData.o[index - 1];
    const prevToPrevOpen = priceData.o[index - 2];

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

      const isAboveLineFunc = (p, i) => {
        const potentialY = m * i + c;
        return p > potentialY ? true : false;
      };

      const isAboveLine = {
        currClose: isAboveLineFunc(currClose, index),
        currOpen: isAboveLineFunc(currOpen, index),
        prevOpen: isAboveLineFunc(prevOpen, index - 1),
        prevToPrevOpen: isAboveLineFunc(prevToPrevOpen, index - 2),
      };

      const bigBreakout =
        isAboveLine.currClose &&
        !isAboveLine.currOpen &&
        !isAboveLine.prevOpen &&
        isBigCandle;
      if (bigBreakout)
        return {
          signal: signalEnum.buy,
          bigBreakout,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          isAboveLine,
        };

      const bigBreakdown =
        !isAboveLine.currClose &&
        isAboveLine.currOpen &&
        isAboveLine.prevOpen &&
        isBigCandle;
      if (bigBreakdown)
        return {
          signal: signalEnum.sell,
          bigBreakdown,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          isAboveLine,
        };

      const normalBreakout =
        isAboveLine.currClose &&
        isAboveLine.currOpen &&
        !isAboveLine.prevOpen &&
        !isAboveLine.prevToPrevOpen &&
        !isBigCandle;
      if (normalBreakout)
        return {
          signal: signalEnum.buy,
          normalBreakout,
          line: tl,
          currClose,
          currOpen,
          prevOpen,
          isAboveLine,
        };

      const normalBreakdown =
        !isAboveLine.currClose &&
        !isAboveLine.currOpen &&
        isAboveLine.prevOpen &&
        isAboveLine.prevToPrevOpen &&
        !isBigCandle;
      if (normalBreakdown)
        return {
          signal: signalEnum.sell,
          line: tl,
          normalBreakdown,
          currClose,
          currOpen,
          prevOpen,
          isAboveLine,
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
    const prevCandleLen = prevHigh - prevLow;
    const candleLen = currHigh - currLow;

    const lowerWickPercent = (lowerWick / candleLen) * 100;
    const upperWickPercent = (upperWick / candleLen) * 100;

    const isValidEngulf =
      prevCandleLen * 2 >= candleLen &&
      (currCandleColor == "green"
        ? lowerWickPercent < 28
        : upperWickPercent < 28);

    const signal =
      isEngulfed && isValidEngulf
        ? currCandleColor == "red"
          ? signalEnum.sell
          : signalEnum.buy
        : signalEnum.hold;

    return signal;
  };

  const getPsarSignal = (index) => {
    if (index < 2) return signalEnum.hold;

    const price = priceData.c[index];
    const prevPrice = priceData.c[index - 1];
    const psar = indicators.psar[index];
    const prevPsar = indicators.psar[index - 1];

    return price >= psar && prevPrice < prevPsar
      ? signalEnum.buy
      : price <= psar && prevPrice > prevPsar
      ? signalEnum.sell
      : signalEnum.hold;
  };

  const getVwapSignal = (index) => {
    if (index < 2) return signalEnum.hold;

    const price = priceData.c[index];
    const prevPrice = priceData.c[index - 1];
    const vwap = indicators.vwap[index];
    const prevVwap = indicators.vwap[index - 1];

    return price >= vwap && prevPrice < prevVwap
      ? signalEnum.buy
      : price <= vwap && prevPrice > prevVwap
      ? signalEnum.sell
      : signalEnum.hold;
  };

  const isStockSideways = (index) => {
    if (!index || index < 10) return true;

    const rsi = indicators.rsi[index];
    const adx = indicators.adx[index];

    const lastFewRsiCount = 4;
    const prev4Rsi = indicators.rsi.slice(index - lastFewRsiCount, index);

    let isSidewaysRsiCount = 0;
    prev4Rsi.forEach((r) => (r < 60 && r > 40 ? ++isSidewaysRsiCount : ""));
    const isRsiSideways =
      rsi < 60 && rsi > 40 && isSidewaysRsiCount >= lastFewRsiCount - 2;

    const isAdxSideways = adx.adx <= 20;

    return isAdxSideways && isRsiSideways;
  };

  const updateIndicatorValues = (index) => {
    const high = priceData.h[index];
    const low = priceData.l[index];
    const price = priceData.c[index];

    const emaL = indicatorSmallMA.nextValue(price);
    const emaH = indicatorBigMA.nextValue(price);
    const rsi = indicatorRsi.nextValue(price);
    const cci = indicatorCCI.nextValue(high, low, price);
    const macd = indicatorMacd.nextValue(price);
    const bollingerBand = indicatorBollingerBands.nextValue(price);
    const adx = indicatorAdx.nextValue(high, low, price);
    const stochastic = indicatorStochastic.nextValue(high, low, price).k;
    const psar = indicatorPSAR.nextValue(high, low, price);
    const engulfSignal = getEngulfSignal(index);

    indicators.engulf.push(engulfSignal);
    indicators.smallMA.push(emaL);
    indicators.bigMA.push(emaH);
    indicators.rsi.push(rsi);
    indicators.cci.push(cci);
    indicators.adx.push(adx);
    indicators.macd.push(macd || {});
    indicators.bollingerBand.push(bollingerBand || {});
    indicators.stochastic.push(stochastic);
    indicators.psar.push(psar);
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

    const williamRange = getWillRValues(
      priceData.h.slice(0, startTakingTradeIndex),
      priceData.l.slice(0, startTakingTradeIndex),
      priceData.c.slice(0, startTakingTradeIndex)
    );
    const moneyFlowIndex = getMfiValues(
      mfiPeriod,
      priceData.h.slice(0, startTakingTradeIndex),
      priceData.l.slice(0, startTakingTradeIndex),
      priceData.c.slice(0, startTakingTradeIndex),
      priceData.v.slice(0, startTakingTradeIndex)
    );
    const vwap = getVwapValues(
      mfiPeriod,
      priceData.c.slice(0, startTakingTradeIndex),
      priceData.v.slice(0, startTakingTradeIndex)
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
    let statusNumber = 0,
      tradeHigh,
      tradeLow;
    if (
      !triggerPrice ||
      !target ||
      !sl ||
      !Array.isArray(data?.c) ||
      !data?.c?.length
    )
      return {
        statusNumber,
        tradeHigh,
        tradeLow,
      };

    tradeHigh = data.h[0];
    tradeLow = data.l[0];
    for (let i = 0; i < data.c.length; ++i) {
      const l = data.l[i];
      const h = data.h[i];

      if (h > tradeHigh) tradeHigh = h;
      else if (l < tradeLow) tradeLow = l;

      if (
        statusNumber == 0 &&
        ((isSellTrade && l < target) || (!isSellTrade && h > target))
      ) {
        statusNumber = 1;
      }
      if (
        statusNumber == 0 &&
        ((isSellTrade && h >= sl) || (!isSellTrade && l <= sl))
      ) {
        statusNumber = -1;
      }
    }

    return { statusNumber, tradeHigh, tradeLow };
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

      const longTradePriceData = {
        c: priceData.c.slice(tradeStartIndex - 72, currentIndex),
        o: priceData.o.slice(tradeStartIndex - 72, currentIndex),
        h: priceData.h.slice(tradeStartIndex - 72, currentIndex),
        l: priceData.l.slice(tradeStartIndex - 72, currentIndex),
        t: priceData.t.slice(tradeStartIndex - 72, currentIndex),
        v: priceData.v.slice(tradeStartIndex - 72, currentIndex),
      };
      const { statusNumber, tradeHigh, tradeLow } = checkTradeCompletion(
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

      trades[i].tradeHigh = tradeHigh;
      trades[i].tradeLow = tradeLow;
      trades[i].priceData = longTradePriceData;
      trades[i].tradeStartIndex = 72;

      if (status == trade.status) return;

      // update the trade status
      trades[i].status = status;

      if (status !== "taken") trades[i].endIndex = currentIndex;
    });
  };

  for (let i = startTakingTradeIndex; i < priceData.c.length; i++) {
    const priceIntervalLength = 180;
    const startI = i - priceIntervalLength < 0 ? 0 : i - priceIntervalLength;

    const times = priceData.t.slice(startI, i + 1);
    const prices = priceData.c.slice(startI, i + 1);
    const highs = priceData.h.slice(startI, i + 1);
    const lows = priceData.l.slice(startI, i + 1);
    const vols = priceData.v.slice(startI, i + 1);

    const effectiveI = i - startI;

    const price = prices[effectiveI];

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
        indicators.ranges[indicators.ranges.length - 1]?.start?.index || 0;
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
            ?.index || 0
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

    const ind_willR = getWillRValues(highs, lows, prices);
    const ind_mfi = getMfiValues(mfiPeriod, highs, lows, prices);
    const ind_vwap = getVwapValues(vwapPeriod, prices, vols);

    indicators.vwap.push(ind_vwap[ind_vwap.length - 1]);
    indicators.mfi.push(ind_mfi[ind_mfi.length - 1]);
    indicators.williamR.push(ind_willR[ind_willR.length - 1]);

    const smallMA = indicators.smallMA;
    const bigMA = indicators.bigMA;
    const CCI = indicators.cci;
    const RSI = indicators.rsi;
    const MACD = indicators.macd;
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
    const willR = indicators.williamR[i];

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
    // const isSideways = isStockSideways(i);

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
    const vwapSignal = getVwapSignal(i);
    const cciSignal =
      cci > 100
        ? signalEnum.buy
        : cci < -100
        ? signalEnum.sell
        : signalEnum.hold;
    const macdSignal = getMacdSignal(MACD.slice(i - 2, i + 1));
    const emaSignal = getSmaCrossedSignal({
      emaLow: smallMA.slice(i - 2, i + 1),
      emaHigh: bigMA.slice(i - 2, i + 1),
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
    const psarSignal = getPsarSignal(i);
    const isSideways = isStockSideways(i);

    let brSignal, tlSignal;

    let analyticDetails = {
      allowedIndicatorSignals: {},
      index: i,
      price,
    };
    // const lastMoreCandleDiff = prices[i] - prices[i - lastMoreCandleOffset];
    // const lastFewCandleDiff = prices[i] - prices[i - lastFewCandleOffset];
    // const lastFewCandlePercent = (lastFewCandleDiff / price) * 100;

    const getNetSignalConsideringPrevSignals = (
      indicatorName,
      currSignal,
      includeLast3 = false
    ) => {
      let finalSignal = currSignal;

      if (finalSignal == signalEnum.hold) {
        const signalMinus1 = indicators.allSignals[i - 1][indicatorName];
        const signalMinus2 = indicators.allSignals[i - 2][indicatorName];
        let signalMinus3;
        if (includeLast3)
          signalMinus3 = indicators.allSignals[i - 3][indicatorName];

        if (signalMinus1 && signalMinus1 !== signalEnum.hold)
          finalSignal = signalMinus1;
        else if (signalMinus2 && signalMinus2 !== signalEnum.hold)
          finalSignal = signalMinus2;
        else if (signalMinus3 && signalMinus3 !== signalEnum.hold)
          finalSignal = signalMinus3;
      }

      return finalSignal;
    };

    const getAllStarSignal = () => {
      const signals = [
        getNetSignalConsideringPrevSignals(
          indicatorEnum.macd,
          macdSignal,
          true
        ),
        getNetSignalConsideringPrevSignals(indicatorEnum.vwap, vwapSignal),
        getNetSignalConsideringPrevSignals(indicatorEnum.psar, psarSignal),
        getNetSignalConsideringPrevSignals(indicatorEnum.ema, emaSignal, true),
      ];

      let buyCount = 0,
        sellCount = 0;
      signals.forEach((item) => {
        if (item == signalEnum.buy) buyCount++;
        else if (item == signalEnum.sell) sellCount++;
      });

      if (buyCount >= signals.length - 1) return signalEnum.buy;
      if (sellCount >= signals.length - 1) return signalEnum.sell;
      return signalEnum.hold;
    };
    const allStarSignal = getAllStarSignal();

    const allowedIndicatorSignals = [];

    const calculateFurtherIndicatorsSignals = () => {
      if (additionalIndicators.sr) {
        let finalSrSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.sr,
          srSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.sr,
          signal: finalSrSignal,
          weight: signalWeights[finalSrSignal] * indicatorsWeightEnum.sr,
        });

        analyticDetails.allowedIndicatorSignals.sr = finalSrSignal;
      }
      if (additionalIndicators.tl) {
        tlSignal = getTLBreakOutDownSignal(i).signal;
        let finalTlSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.tl,
          tlSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.tl,
          signal: finalTlSignal,
          weight: signalWeights[finalTlSignal] * indicatorsWeightEnum.tl,
        });

        analyticDetails.allowedIndicatorSignals.tl = finalTlSignal;
      }
      if (additionalIndicators.rsi) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.rsi,
          signal: rsiSignal,
          weight: signalWeights[rsiSignal] * indicatorsWeightEnum.rsi,
        });

        analyticDetails.allowedIndicatorSignals.rsi = rsiSignal;
      }
      if (additionalIndicators.engulf) {
        let finalEngulfSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.engulf,
          engulfSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.engulf,
          signal: finalEngulfSignal,
          weight:
            signalWeights[finalEngulfSignal] * indicatorsWeightEnum.engulf,
        });

        analyticDetails.allowedIndicatorSignals.engulf = finalEngulfSignal;
      }
      if (additionalIndicators.macd) {
        let finalMacdSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.macd,
          macdSignal,
          true
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.macd,
          signal: finalMacdSignal,
          weight: signalWeights[finalMacdSignal] * indicatorsWeightEnum.macd,
        });

        analyticDetails.allowedIndicatorSignals.macd = finalMacdSignal;
      }
      if (additionalIndicators.allStar) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.allStar,
          signal: allStarSignal,
          weight: signalWeights[allStarSignal] * indicatorsWeightEnum.allStar,
        });

        analyticDetails.allowedIndicatorSignals.allStar = allStarSignal;
      }
      if (additionalIndicators.ema) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.ema,
          signal: emaSignal,
          weight: signalWeights[emaSignal] * indicatorsWeightEnum.ema,
        });

        analyticDetails.allowedIndicatorSignals.ema = emaSignal;
      }
      if (additionalIndicators.bollinger) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.bollingerBand,
          signal: bollingerBandSignal,
          weight:
            signalWeights[bollingerBandSignal] *
            indicatorsWeightEnum.bollingerBand,
        });

        analyticDetails.allowedIndicatorSignals.bollinger = bollingerBandSignal;
      }
      if (additionalIndicators.br) {
        brSignal = getBreakOutDownSignal(i).signal;

        let finalBrSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.br,
          brSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.br,
          signal: finalBrSignal,
          weight: signalWeights[finalBrSignal] * indicatorsWeightEnum.br,
        });

        analyticDetails.allowedIndicatorSignals.br = finalBrSignal;
      }
      if (additionalIndicators.cci) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.cci,
          signal: cciSignal,
          weight: signalWeights[cciSignal] * indicatorsWeightEnum.cci,
        });

        analyticDetails.allowedIndicatorSignals.cci = cciSignal;
      }
      if (additionalIndicators.mfi) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.mfi,
          signal: mfiSignal,
          weight: signalWeights[mfiSignal] * indicatorsWeightEnum.mfi,
        });

        analyticDetails.allowedIndicatorSignals.mfi = mfiSignal;
      }
      if (additionalIndicators.stochastic) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.stochastic,
          signal: stochasticSignal,
          weight:
            signalWeights[stochasticSignal] * indicatorsWeightEnum.stochastic,
        });

        analyticDetails.allowedIndicatorSignals.stochastic = stochasticSignal;
      }
      if (additionalIndicators.vwap) {
        let finalSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.vwap,
          vwapSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.vwap,
          signal: finalSignal,
          weight: signalWeights[finalSignal] * indicatorsWeightEnum.vwap,
        });

        analyticDetails.allowedIndicatorSignals.vwap = finalSignal;
      }
      if (additionalIndicators.psar) {
        let finalSignal = getNetSignalConsideringPrevSignals(
          indicatorEnum.psar,
          psarSignal
        );

        allowedIndicatorSignals.push({
          name: indicatorEnum.psar,
          signal: finalSignal,
          weight: signalWeights[finalSignal] * indicatorsWeightEnum.psar,
        });

        analyticDetails.allowedIndicatorSignals.psar = finalSignal;
      }
      // if (additionalIndicators.trend) {
      //   allowedIndicatorSignals.push(
      //     signalWeights[trendSignal] * indicatorsWeightEnum.trend
      //   );
      //   analyticDetails.allowedIndicatorSignals.trend = trendSignal;
      // }
      if (additionalIndicators.willR) {
        allowedIndicatorSignals.push({
          name: indicatorEnum.williamR,
          signal: willRSignal,
          weight: signalWeights[willRSignal] * indicatorsWeightEnum.williamR,
        });

        analyticDetails.allowedIndicatorSignals.willR = willRSignal;
      }
    };
    calculateFurtherIndicatorsSignals();

    let signalsWeight =
      allowedIndicatorSignals.reduce(
        (acc, curr) => (curr.weight || 0) + acc,
        0
      ) || 0;

    if (isSideways) {
      if (signalsWeight < 0) signalsWeight++;
      else if (signalsWeight > 0) signalsWeight--;
    }

    const decisionMakingPoint = decisionMakingPoints || 3;

    let isBuySignal = signalsWeight >= decisionMakingPoint;
    let isSellSignal = signalsWeight <= -1 * decisionMakingPoint;

    indicators.allSignals.push({
      [indicatorEnum.sr]: srSignal,
      [indicatorEnum.macd]: macdSignal,
      [indicatorEnum.rsi]: rsiSignal,
      [indicatorEnum.tl]: tlSignal,
      [indicatorEnum.br]: brSignal,
      [indicatorEnum.allStar]: allStarSignal,
      [indicatorEnum.engulf]: engulfSignal,
      tlFull: getTLBreakOutDownSignal(i),
      // brFull: getBreakOutDownSignal(i),
      [indicatorEnum.cci]: cciSignal,
      [indicatorEnum.mfi]: mfiSignal,
      [indicatorEnum.ema]: emaSignal,
      [indicatorEnum.psar]: psarSignal,
      [indicatorEnum.vwap]: vwapSignal,
      [indicatorEnum.williamR]: willRSignal,
      allowedIndicatorSignals,
      isBuySignal,
      isSellSignal,
      isSideways,
    });

    if (!isBuySignal && !isSellSignal) {
      analytics.push({
        ...analyticDetails,
      });
      continue;
    }

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
        (hour == 9 && min <= 25) ||
        (hour >= 14 && min >= 30)
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
        isAnyDoji: false,
      };
      for (let c = 0; c < 4; ++c) {
        const color = getCandleColor(i - c);

        if (!lastCandleColors.color) lastCandleColors.color = color;
        else if (color !== lastCandleColors.color)
          lastCandleColors.allEqual = false;

        if (!lastCandleColors.isAnyDoji && isDojiCandle(i - c))
          lastCandleColors.isAnyDoji = true;
      }

      if (lastCandleColors.allEqual && !lastCandleColors.isAnyDoji) {
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

    analyticDetails.netSignal = isBuySignal
      ? signalEnum.buy
      : isSellSignal
      ? signalEnum.sell
      : signalEnum.hold;

    // analyticDetails.allowedIndicatorSignals = allowedIndicatorSignals;
    // analyticDetails.initialSignalWeight = initialSignalWeight;
    // analyticDetails.additionalIndicatorsWeight = additionalIndicatorsWeight;
    analytics.push({
      ...analyticDetails,
    });

    const trade = {
      time: priceData.t[i],
      startIndex: i,
      startPrice: price,
      type: isBuySignal ? signalEnum.buy : signalEnum.sell,
      target: isBuySignal ? price + targetProfit : price - targetProfit,
      sl: isBuySignal ? price - stopLoss : price + stopLoss,
      analytics: analyticDetails,
      status: "taken",
      preset,
    };

    if (isAllowedToTakeThisTrade(trade)) trades.push(trade);
  }

  return { trades, analytics, indicators, preset };
};
