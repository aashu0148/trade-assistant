import React, { useEffect, useState } from "react";
// import { macd, rsi, sma, onBalanceVolume } from "indicatorts";
import {
  sma as smaIndicator,
  rsi as rsiIndicator,
  macd as macdIndicator,
  obv as obvIndicator,
} from "technicalindicators";
import {
  SMA as technicalIndicatorSMA,
  RSI as technicalIndicatorRSI,
  MACD as technicalIndicatorMACD,
} from "@debut/indicators";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Interaction,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import { CrosshairPlugin, Interpolate } from "chartjs-plugin-crosshair";

import { stockPrices } from "utils/constants";
import {
  calculateAngle,
  formatTime,
  getRandomNumber,
  nearlyEquateNums,
} from "utils/util";

import styles from "./HomePage.module.scss";
import InputControl from "../../Components/InputControl/InputControl";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
  CrosshairPlugin
);
Interaction.modes.interpolate = Interpolate;

// console.log(sma(200, stockPrices.c));
// console.log(rsi(stockPrices.c));
// console.log(macd(stockPrices.c));

let timer;
const timeFrame = 5;
const dxForTimeFrames = {
  5: 0.02 / 100,
  15: 0.08 / 100,
  60: 1.5 / 100,
};
const getDxForPrice = (price, time = timeFrame) => {
  const dxPercentForTimeFrames = {
    5: 0.17 / 100,
    15: 0.8 / 100,
    60: 1.9 / 100,
  };

  return dxPercentForTimeFrames[time] * price;
};
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

function HomePage() {
  const [chartDisplayIndices, setChartDisplayIndices] = useState([0, 200]);
  const [tradesTaken, setTradesTaken] = useState([]);

  const cdi1 = chartDisplayIndices[0];
  const cdi2 = chartDisplayIndices[1] - cdi1 < 50 ? 50 : chartDisplayIndices[1];
  const finalStockPrices = stockPrices.c.slice(cdi1, cdi2);
  const finalStockVolumes = stockPrices.v.slice(cdi1, cdi2);
  const finalStockTimestamps = stockPrices.t
    .slice(cdi1, cdi2)
    .map((item) => item * 1000);
  const lowestStockPrice = finalStockPrices.reduce(
    (acc, curr) => (curr < acc ? curr : acc),
    Number.MAX_SAFE_INTEGER
  );
  const highestStockPrice = finalStockPrices.reduce(
    (acc, curr) => (curr > acc ? curr : acc),
    0
  );

  const calculateIndicators = (closingPrices = []) => {
    const smaPeriod = 14; // Period for SMA and RSI
    const macdFastPeriod = 19;
    const macdSlowPeriod = 30;
    const macdSignalPeriod = 8;

    const sma = new technicalIndicatorSMA(smaPeriod);
    const rsi = new technicalIndicatorRSI(smaPeriod);
    const macd = new technicalIndicatorMACD(
      macdFastPeriod,
      macdSlowPeriod,
      macdSignalPeriod
    );

    const indicators = [];

    for (const price of closingPrices) {
      const smaValue = sma.nextValue(price);
      const rsiValue = rsi.nextValue(price);
      const macdValues = macd.nextValue(price);

      indicators.push({
        price,
        sma: smaValue,
        rsi: rsiValue,
        macd: macdValues?.macd,
        signal: macdValues?.signal,
        histogram: macdValues?.histogram,
      });
    }

    return indicators;
  };

  const calculatedSma = smaIndicator({
    period: 14,
    values: finalStockPrices,
  });
  const calculatedSma200 = smaIndicator({
    period: 200,
    values: finalStockPrices,
  });
  const calculatedRsi = calculateIndicators(finalStockPrices).map(
    (item) => item.rsi
  );
  const calculatedMacd = calculateIndicators(finalStockPrices).map((item) => ({
    macd: item.macd,
    signal: item.signal,
  }));

  const debounce = (func) => {
    clearTimeout(timer);
    timer = setTimeout(func, 300);
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

  const getVPoints = (prices = [], offset = 10) => {
    if (!prices.length) return [];

    let output = [];
    for (let i = offset; i < prices.length; ++i) {
      const price = prices[i];

      const nearby = prices.slice(i - offset, i + offset);
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

  const getSupportResistanceRangesFromVPoints = (vPoints = [], prices = []) => {
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

  const getTrendEstimates = (prices = []) => {
    if (!prices?.length) return [];

    const vps = getVPoints(prices, 7);

    const chunkLength = 4,
      output = [
        ...vps.slice(0, chunkLength).map((item) => ({
          vPoint: {
            ...item,
          },
          trend: trendEnum.range,
        })),
      ];
    for (let i = chunkLength; i < vps.length; ++i) {
      const startPoint = vps[i - chunkLength];
      const currPoint = vps[i];

      const diff = currPoint.value - startPoint.value;
      const allowedDiff = 0.003 * currPoint.value;

      output.push({
        vPoint: {
          ...currPoint,
        },
        trend:
          Math.abs(diff) > allowedDiff
            ? diff > 0
              ? trendEnum.up
              : trendEnum.down
            : trendEnum.range,
      });
    }

    const priceWithTrend = [];
    for (let i = 0; i < output.length; ++i) {
      let startIndex = i == 0 ? 0 : output[i - 1].vPoint.index;

      const currentItem = output[i].vPoint;
      for (let j = startIndex; j < currentItem.index; ++j) {
        priceWithTrend[j] = output[i];
      }
    }

    const remainingVPointAtLast = prices.length - priceWithTrend.length;

    priceWithTrend.push(
      ...Array(remainingVPointAtLast).map(() => ({
        vPoint: {},
        trend: trendEnum.range,
      }))
    );

    return priceWithTrend.map((item, i) => ({
      ...item,
      index: i,
      value: prices[i],
    }));
  };

  const groupByTrends = (trends = []) => {
    if (!trends.length) return [];

    const output = [];

    for (let i = 0; i < trends.length - 1; ++i) {
      if (trends[i].trend == trends[i + 1].trend) continue;

      output.push(trends[i]);
    }

    output.push(trends[trends.length - 1]);

    return output;
  };

  const vps = getVPoints(finalStockPrices);
  const ranges = getSupportResistanceRangesFromVPoints(vps, finalStockPrices);
  const pricesWithTrends = getTrendEstimates(finalStockPrices);
  const trends = groupByTrends(pricesWithTrends);

  // console.log(pricesWithTrends);

  const pricesOptions = {
    // responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Prices",
      },
      tooltip: {
        mode: "interpolate",
        intersect: false,
      },
      crosshair: {
        line: {
          color: "#F66",
          width: 1,
        },
        sync: {
          enabled: true,
          group: 1,
          suppressTooltips: false,
        },
        zoom: {
          enabled: false,
        },
      },
    },
    scales: {
      x: {
        type: "category",
        ticks: {
          stepSize: 20,
          maxTicksLimit: 2000,
        },
      },
      y: {
        ticks: {
          stepSize: 1,
        },
      },
    },
    annotations: [
      // ...trends.map((item, i) => ({
      //   type: "box",
      //   xMin: i == 0 ? 0 : trends[i - 1].index,
      //   xMax: item.index,
      //   yMin: lowestStockPrice,
      //   yMax: highestStockPrice,
      //   backgroundColor:
      //     item.trend == "up"
      //       ? `rgba(17,221,96, 0.18)`
      //       : item.trend == "down"
      //       ? "rgba(221,17,17, 0.14)"
      //       : "rgba(150,150,150, 0.18)",
      //   borderColor: "transparent",
      // })),
      ...vps.map((item, i) => ({
        type: "point",
        xValue: item.index,
        yValue: item.value,
        backgroundColor: `rgba(45, 174, 246, 0.25)`,
        borderColor: `rgb(45,174,246)`,
      })),
      ...ranges.map((item, i) => ({
        type: "box",
        xMin: item.start.index,
        xMax: item.stillStrong ? finalStockPrices.length : item.end.index,
        yMin: item.min,
        yMax: item.max,
        backgroundColor: `rgba(7,222,151, 0.19)`,
        borderColor: `rgb(7,222,151)`,
      })),
      // ...ranges.map((item, i) => ({
      //   type: "label",
      //   xValue: item.start.index,
      //   yValue: item.start.value,
      //   xAdjust: -35,
      //   content: [`${item.min} - ${item.max}`],
      //   backgroundColor: `rgba(7,222,151,0.8)`,
      //   font: {
      //     size: 10,
      //     weight: "bold",
      //   },
      //   padding: 2,
      //   borderRadius: 5,
      //   color: "red",
      // })),
      ...tradesTaken.map((item, i) => ({
        type: "point",
        xValue: item.startIndex,
        yValue: item.startPrice,
        radius: 4,
        backgroundColor:
          item.type == signalEnum.buy
            ? `rgba(17,221,96, 0.8)`
            : "rgba(221,17,17, 0.8)",
        borderColor:
          item.type == signalEnum.buy
            ? `rgba(17,221,96, 0.8)`
            : "rgba(221,17,17, 0.8)",
      })),
    ],
  };

  const pricesData = {
    labels: finalStockTimestamps.map(
      (t, i) => cdi1 + i
      // new Date(t).toLocaleString("en-in")
    ),
    datasets: [
      {
        label: "Prices",
        data: finalStockPrices,
        fill: true,
        backgroundColor: `rgba(81, 52, 231, 0.15)`,
        borderColor: `rgb(81,52,231)`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
      // {
      //   label: "SMA (14)",
      //   data: calculatedSma,
      //   borderColor: "green",
      //   pointRadius: 0,
      //   borderWidth: 1,
      //   pointHoverRadius: 0,
      // },
      // {
      //   label: "SMA (200)",
      //   data: calculatedSma200,
      //   borderColor: "orange",
      //   pointRadius: 0,
      //   borderWidth: 1,
      //   pointHoverRadius: 0,
      // },
    ],
    pricesOptions,
  };

  const rsiData = {
    labels: finalStockTimestamps.map((t) =>
      new Date(t).toLocaleTimeString("en-in").split(":").slice(0, 2).join(":")
    ),
    datasets: [
      {
        label: "RSI",
        data: calculatedRsi,
        borderColor: "purple",
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  };

  const macdData = {
    labels: finalStockTimestamps.map((t) =>
      new Date(t).toLocaleTimeString("en-in").split(":").slice(0, 2).join(":")
    ),
    datasets: [
      {
        label: "Signal line",
        data: calculatedMacd.map((item) => item.signal),
        borderColor: "red",
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        label: "MACD line",
        data: calculatedMacd.map((item) => item.macd),
        borderColor: "green",
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  };

  const getMacdSignal = (macd) => {
    if (
      !macd?.length ||
      macd.length > 3 ||
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

  const takeTrades = (
    allPrices,
    allVolumes = [],
    {
      rsiLow = 48,
      rsiHigh = 63,
      smaLow = 18,
      smaHigh = 150,
      rsiPeriod = 8,
      macdFastPeriod = 14,
      macdSlowPeriod = 25,
      macdSignalPeriod = 8,
    }
  ) => {
    // const smallMA = sma(smaLow, allPrices);
    // const bigMA = sma(smaHigh, allPrices);
    // const RSI = rsi(allPrices);
    // const MACD = macd(allPrices);
    // const OBV = onBalanceVolume(allPrices, allVolumes);

    const indicatorSmallMA = new technicalIndicatorSMA(smaLow);
    const indicatorBigMA = new technicalIndicatorSMA(smaHigh);
    const indicatorRsi = new technicalIndicatorRSI(rsiPeriod);
    const indicatorMacd = new technicalIndicatorMACD(
      macdFastPeriod,
      macdSlowPeriod,
      macdSignalPeriod
    );

    const indicators = {
      smallMA: [],
      bigMA: [],
      rsi: [],
      macd: [],
    };

    let isTradeTaken = false,
      targetProfitPercent = 1.4 / 100,
      stopLossPercent = 0.7 / 100,
      trade = {},
      trades = [];

    let analytics = {
      signals: [],
      noOfBreakouts: 0,
      noOfBreakdowns: 0,
    };

    const startTakingTradeIndex = 200;

    for (let i = 0; i < startTakingTradeIndex; ++i) {
      const price = allPrices[i];

      const smaL = indicatorSmallMA.nextValue(price);
      const smaH = indicatorBigMA.nextValue(price);
      const rsi = indicatorRsi.nextValue(price);
      const macd = indicatorMacd.nextValue(price);

      indicators.smallMA.push(smaL);
      indicators.bigMA.push(smaH);
      indicators.rsi.push(rsi);
      indicators.macd.push(macd);
    }

    for (let i = startTakingTradeIndex; i < allPrices.length; i++) {
      const prices = allPrices.slice(0, i + 1);

      const prevPrice = prices[i - 1];
      const price = prices[i];

      if (isTradeTaken) {
        if (trade.type == signalEnum.buy) {
          if (price > trade.target) {
            trades.push({
              result: "profit",
              profit: trade.target - trade.startPrice,
              endPrice: price,
              endIndex: i,
              ...trade,
            });
            isTradeTaken = false;
            i = trade.startIndex;
          } else if (price < trade.sl) {
            trades.push({
              result: "loss",
              profit: trade.sl - trade.startPrice,
              endPrice: price,
              endIndex: i,
              ...trade,
            });
            isTradeTaken = false;
            i = trade.startIndex;
          }
        } else {
          if (price < trade.target) {
            trades.push({
              result: "profit",
              profit: trade.startPrice - trade.target,
              endPrice: price,
              endIndex: i,
              ...trade,
            });
            isTradeTaken = false;
            i = trade.startIndex;
          } else if (price > trade.sl) {
            trades.push({
              result: "loss",
              profit: trade.startPrice - trade.sl,
              endPrice: price,
              endIndex: i,
              ...trade,
            });
            isTradeTaken = false;
            i = trade.startIndex;
          }
        }
      } else {
        if (indicators.smallMA.length - 1 <= i) {
          const smaL = indicatorSmallMA.nextValue(price);
          const smaH = indicatorBigMA.nextValue(price);
          const rsi = indicatorRsi.nextValue(price);
          const macd = indicatorMacd.nextValue(price);

          indicators.smallMA.push(smaL);
          indicators.bigMA.push(smaH);
          indicators.rsi.push(rsi);
          indicators.macd.push(macd);
        }

        const smallMA = indicators.smallMA;
        const bigMA = indicators.bigMA;
        const RSI = indicators.rsi;
        const MACD = indicators.macd;
        // const OBV = obvIndicator({
        //   close: prices,
        //   volume: allVolumes,
        // });

        const vps = getVPoints(prices);
        const ranges = getSupportResistanceRangesFromVPoints(vps, prices);
        const strongSupportResistances = ranges.filter(
          (item) => item.stillStrong
        );
        // const pricesWithTrends = getTrendEstimates(prices);
        // const trend = pricesWithTrends[i].trend;
        const rsi = RSI[i];

        const targetProfit = targetProfitPercent * price;
        const stopLoss = stopLossPercent * price;

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
        const rsiSignal =
          rsi < rsiLow
            ? signalEnum.buy
            : rsi > rsiHigh
            ? signalEnum.sell
            : signalEnum.hold;
        const macdSignal = getMacdSignal(MACD.slice(i - 2, i + 1));
        const smaSignal = getSmaCrossedSignal({
          smaLow: smallMA.slice(i - 2, i + 1),
          smaHigh: bigMA.slice(i - 2, i + 1),
        });

        const netWeight =
          signalWeight[srSignal] * 2 +
          signalWeight[rsiSignal] +
          signalWeight[macdSignal] * 2 +
          signalWeight[smaSignal] * 2;

        const isBuySignal = netWeight >= 3;
        const isSellSignal = netWeight <= -3;

        const analytic = {
          rsi: rsiSignal,
          macd: macdSignal,
          macdVal: MACD.slice(i - 2, i + 1),
          sr: srSignal,
          sma: smaSignal,
          netSignal: isBuySignal
            ? signalEnum.buy
            : isSellSignal
            ? signalEnum.sell
            : signalEnum.hold,
          index: i,
          price,
        };
        analytics.signals.push({
          ...analytic,
        });

        if (isBuySignal) {
          // neglect trade if last trade is recent and type of BUY
          const lastTrade = trades.length ? trades[trades.length - 1] : {};
          if (lastTrade?.type) {
            if (
              lastTrade.type == signalEnum.buy &&
              i - lastTrade.startIndex < 4
            )
              continue;
          }

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

          if (possibleProfit < targetProfit) continue;

          isTradeTaken = true;
          trade = {
            startIndex: i,
            startPrice: price,
            type: signalEnum.buy,
            target:
              possibleProfit > targetProfit
                ? price + targetProfit
                : price + possibleProfit,
            sl: price - stopLoss,
            analytics: analytic,
            nearestResistance,
          };
        } else if (isSellSignal) {
          // neglect trade if last trade is recent and type of SELL
          const lastTrade = trades.length ? trades[trades.length - 1] : {};
          if (lastTrade?.type) {
            if (
              lastTrade.type == signalEnum.sell &&
              i - lastTrade.startIndex < 4
            )
              continue;
          }

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

          if (possibleProfit < targetProfit) continue;

          isTradeTaken = true;
          trade = {
            startIndex: i,
            startPrice: price,
            type: signalEnum.sell,
            target:
              possibleProfit > targetProfit
                ? price - targetProfit
                : price - possibleProfit,
            sl: price + stopLoss,
            analytics: analytic,
            nearestSupport,
          };
        }
      }
    }

    return { trades, analytics };
  };

  const testTakeTradeForBestNumbers = (allPrices, allVols) => {
    //     {
    //     "profitPercent": 42.30769230769231,
    //     "macdFastPeriod": 19,
    //     "macdSlowPeriod": 30,
    //     "rl": 47,
    //     "rh": 62,
    //     "sl": 19,
    //     "sh": 152,
    //     "total": 26,
    //     "profitable": 11,
    //     "lossMaking": 15
    // }
    //     {
    //     "profitPercent": 52.38095238095239,
    //     "macdFastPeriod": 14,
    //     "macdSlowPeriod": 25,
    //     "rl": 48,
    //     "rh": 63,
    //     "sl": 18,
    //     "sh": 150,
    //     "total": 21,
    //     "profitable": 11,
    //     "lossMaking": 10
    // }

    let goodTradeMetrics = {};

    for (let ri = 35, rj = 50; ri < 49; ++ri, ++rj) {
      for (let sl = 18, sh = 150; sl < 25; ++sl, sh += 2) {
        for (let macdFP = 9, macdSP = 20; macdFP < 20; ++macdFP, ++macdSP) {
          const { trades, analytics } = takeTrades(allPrices, allVols, {
            rsiLow: ri,
            rsiHigh: rj,
            smaLow: sl,
            smaHigh: sh,
            macdFastPeriod: macdFP,
            macdSlowPeriod: macdSP,
          });

          const total = trades.length;
          const profits = trades.filter(
            (item) => item.result == "profit"
          ).length;

          const profitPercent = (profits / total) * 100;

          if (
            !goodTradeMetrics.profitPercent ||
            profitPercent > goodTradeMetrics.profitPercent
          ) {
            goodTradeMetrics = {
              profitPercent,
              macdFastPeriod: macdFP,
              macdSlowPeriod: macdSP,
              rl: ri,
              rh: rj,
              sl,
              sh,
              total,
              profitable: profits,
              lossMaking: total - profits,
            };
          }

          console.log(
            `rl:${ri}, rh:${rj}, sl:${sl}, sh:${sh} fp:${macdFP} P-P:${parseInt(
              profitPercent
            )}`,
            goodTradeMetrics
          );
        }
      }
    }

    console.log("🔵", goodTradeMetrics);
  };

  const runFunc = () => {
    const allPrices = stockPrices.c;
    const allVols = stockPrices.v;
    // const allPrices = finalStockPrices;
    // const allVols = finalStockVolumes;

    // testTakeTradeForBestNumbers(allPrices, allVols);
    // return;

    const { trades } = takeTrades(allPrices, allVols, {});
    const total = trades.length;
    const profitable = trades.filter((item) => item.result == "profit").length;

    console.log(
      trades,
      total,
      profitable,
      `${((profitable / total) * 100).toFixed(2)}%`
    );
    // setTradesTaken(trades);
  };

  useEffect(() => {
    setTradesTaken([]);
  }, [chartDisplayIndices]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.title}>Prices Data</p>
      </div>

      <button className="button" onClick={runFunc}>
        Click me
      </button>

      <div className={styles.controls}>
        <InputControl
          className={styles.input}
          placeholder="min"
          max={chartDisplayIndices[1] - 50}
          min={0}
          numericInput
          value={chartDisplayIndices[0]}
          onChange={(e) =>
            setChartDisplayIndices((prev) => [
              parseInt(e.target.value),
              prev[1],
            ])
          }
        />

        <InputControl
          className={styles.input}
          placeholder="max"
          max={2000}
          min={0}
          numericInput
          value={chartDisplayIndices[1]}
          onChange={(e) =>
            setChartDisplayIndices((prev) => [
              prev[0],
              parseInt(e.target.value),
            ])
          }
        />
      </div>

      <div className={styles.chart}>
        <div
          className={styles.chartInner}
          // style={{ width: `${pricesData.labels.length * 30}px` }}
        >
          <Line options={pricesOptions} data={pricesData} />
        </div>
      </div>

      <div className={styles.chart}>
        <Line
          data={macdData}
          options={{
            maintainAspectRatio: false,
            scales: {
              y: {
                ticks: {
                  stepSize: 0.5,
                },
              },
            },
          }}
        />
      </div>

      <div className={styles.chart}>
        <Line
          data={rsiData}
          options={{
            maintainAspectRatio: false,
            scales: {
              y: {
                ticks: {
                  stepSize: 15,
                },
              },
            },
            annotations: [
              {
                type: "box",
                xMin: 0,
                xMax: finalStockPrices.length,
                yMin: 48,
                yMax: 63,
                backgroundColor: `rgba(45, 174, 246, 0.25)`,
                borderColor: `rgb(45,174,246)`,
              },
            ],
          }}
        />
      </div>
    </div>
  );
}

export default HomePage;
