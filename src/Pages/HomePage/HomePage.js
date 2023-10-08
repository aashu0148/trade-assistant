import React, { useEffect, useState } from "react";
import { sma as smaIndicator } from "technicalindicators";
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
import "chartjs-chart-financial";
import { IndicatorsNormalized } from "@ixjb94/indicators/dist";
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
import "chartjs-adapter-luxon";
import ZoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import { CrosshairPlugin, Interpolate } from "chartjs-plugin-crosshair";

import InputControl from "../../Components/InputControl/InputControl";

// import stockData from "utils/stockData";
import {
  calculateAngle,
  formatSecondsToHrMinSec,
  formatTime,
  getRandomNumber,
  nearlyEquateNums,
} from "utils/util";
import { Range, takeTrades } from "utils/tradeUtil";

import styles from "./HomePage.module.scss";

const IXJIndicators = new IndicatorsNormalized();
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
  CrosshairPlugin,
  ZoomPlugin
);
Interaction.modes.interpolate = Interpolate;

// console.log(sma(200, tataMotorsStockPrices.c));
// console.log(rsi(tataMotorsStockPrices.c));
// console.log(macd(tataMotorsStockPrices.c));

let timer;
const timeFrame = 5;
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
const indicatorsWeightEnum = {
  bollingerBand: 3,
  movingAvg: 1,
  sr: 2,
  macd: 1,
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
};

function HomePage() {
  const [chartDisplayIndices, setChartDisplayIndices] = useState([0, 200]);
  const [tradesTaken, setTradesTaken] = useState([]);

  const [stockData, setStockData] = useState({});

  const stock = stockData.HDFCLIFE || {
    c: [],
    t: [],
    v: [],
    o: [],
    h: [],
    l: [],
  };
  const cdi1 = chartDisplayIndices[0];
  const cdi2 = chartDisplayIndices[1] - cdi1 < 50 ? 50 : chartDisplayIndices[1];
  const finalStockData = {
    t: stock.t.slice(cdi1, cdi2),
    h: stock.h.slice(cdi1, cdi2),
    l: stock.l.slice(cdi1, cdi2),
    o: stock.o.slice(cdi1, cdi2),
    c: stock.c.slice(cdi1, cdi2),
    v: stock.v.slice(cdi1, cdi2),
  };
  const finalStockPrices = finalStockData.c;
  const finalStockVolumes = finalStockData.v;
  const finalStockTimestamps = finalStockData.t.map((item) => item * 1000);

  const lowestStockPrice = finalStockPrices.reduce(
    (acc, curr) => (curr < acc ? curr : acc),
    Number.MAX_SAFE_INTEGER
  );
  const highestStockPrice = finalStockPrices.reduce(
    (acc, curr) => (curr > acc ? curr : acc),
    0
  );

  const debounce = (func, time = 400) => {
    clearTimeout(timer);
    timer = setTimeout(func, time);
  };

  const fetchStockData = async () => {
    const res = await fetch(
      `https://trade-p129.onrender.com/trade/recent-data`,
      {
        headers: {
          Authorization:
            "$2b$05$.X7vV5TJ3eQPoAGoOGnHH.K6ROXzZ7JzDWqkdj/1JKbtTSlLr7xt2",
        },
      }
    );
    const json = await res.json();
    if (!json?.success || !json?.data) return;

    setStockData(json.data);
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

  const getVPoints = ({
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
        // console.log(
        //   startPoint.value,
        //   currPoint.value,
        //   isNearlyEqual,
        //   allowedDx
        // );
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

  const getCandleTrendEstimate = (
    index,
    priceData = {},
    trendCheckingLastFewCandles = 8
  ) => {
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
    const point3OfPrice = (0.35 / 100) * currPrice;
    const point1OfPrice = (0.15 / 100) * currPrice;
    const avgPrice = arr.reduce((acc, curr) => acc + curr.c, 0) / arr.length;
    let rangeCandles = 0;
    for (let i = 0; i < arr.length; ++i) {
      const isNearlyEq = nearlyEquateNums(avgPrice, arr[i].c, point3OfPrice);

      if (isNearlyEq) rangeCandles++;
    }

    if (arr.length - rangeCandles < 3) return trendEnum.range;

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

    if (
      redCandlesCount - greenCandlesCount > 1 &&
      currPrice < longPeriodAvgPrice
    )
      return trendEnum.down;
    else if (
      greenCandlesCount - redCandlesCount > 1 &&
      currPrice > longPeriodAvgPrice
    )
      return trendEnum.up;
    else return trendEnum.range;
  };

  const getTrendEstimates = (prices = [], startCheckFrom = 12) => {
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

  const vps = getVPoints({ prices: finalStockPrices });
  const ranges = getSupportResistanceRangesFromVPoints(vps, finalStockPrices);

  // let vps, ranges;
  // for (let i = 0; i < finalStockPrices.length; ++i) {
  //   const { vPoints, ranges: rngs } = rangeObj.nextRangeValue({
  //     price: finalStockPrices[i],
  //   });
  //   vps = vPoints;
  //   ranges = rngs;
  // }
  // console.log(ranges);

  // const pricesWithTrends = getTrendEstimates(finalStockPrices);
  const pricesWithTrends = finalStockData.c.map((item, i) => {
    if (i < 10) return { index: i, trend: trendEnum.range };

    const trend = getCandleTrendEstimate(i, finalStockData);
    return { index: i, trend };
  });
  const trends = groupByTrends(pricesWithTrends);

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
      ...trends.map((item, i) => ({
        type: "box",
        xMin: i == 0 ? 0 : trends[i - 1].index,
        xMax: item.index,
        yMin: lowestStockPrice,
        yMax: highestStockPrice,
        backgroundColor:
          item.trend == "up"
            ? `rgba(17,221,96, 0.18)`
            : item.trend == "down"
            ? "rgba(221,17,17, 0.14)"
            : "rgba(150,150,150, 0.18)",
        borderColor: "transparent",
      })),
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

  const testTakeTradeForBestNumbers = async (priceData, symbol) => {
    function getAllCombinations(arr) {
      function helper(start, current) {
        result.push(current.join(""));

        for (let i = start; i < arr.length; i++) {
          current.push(arr[i]);
          helper(i + 1, current);
          current.pop();
        }
      }

      const result = [];
      helper(0, []);
      return result;
    }
    const indicators = {
      br: false,
      rsi: false,
      macd: false,
      sma: false,
      mfi: false,
      stochastic: false,
      willR: false,
      vwap: false,
      cci: false,
      // psar: false,
    };
    const indicatorCombinations = getAllCombinations(
      Object.keys(indicators).map((item) => item + "_")
    ).filter((item) => item.split("_").length < 6);

    let goodTradeMetrics = [];

    for (let i = 0; i < indicatorCombinations.length; ++i) {
      for (let vpOffset = 5; vpOffset < 15; vpOffset += 3) {
        console.log(symbol);
        const indicators = indicatorCombinations[i]
          .split("_")
          .filter((item) => item);

        const indicatorsObj = {};
        indicators.forEach((item) => (indicatorsObj[item] = true));

        const { trades } = await takeTrades(priceData, {
          additionalIndicators: indicatorsObj,
          vPointOffset: vpOffset,
        });

        if (!trades.length) {
          console.log("No trades!");
          continue;
        }

        const total = trades.length;
        const profits = trades.filter((item) => item.result == "profit").length;

        const profitPercent = (profits / total) * 100;

        if (profitPercent > 50 && total > 8) {
          goodTradeMetrics.push({
            profitPercent,
            indicatorsObj,
            vpOffset,
            total,
            profitable: profits,
            lossMaking: total - profits,
          });

          console.log(
            `🟡P-P:${parseInt(
              profitPercent
            )}, vp-o:${vpOffset}, t:${total}, indicators:${Object.keys(
              indicatorsObj
            ).join(" | ")}`
          );
        }
      }
    }

    goodTradeMetrics = goodTradeMetrics.sort((a, b) =>
      a.total > b.total ? -1 : 1
    );

    console.log(`🔵 Trades for: ${symbol}`, structuredClone(goodTradeMetrics));
    localStorage.setItem(`${symbol}_trades`, JSON.stringify(goodTradeMetrics));
  };

  const handleSingleTrade = async () => {
    const stocks = [
      {
        name: "Tata motors",
        ...stockData.TATAMOTORS,
      },
      // {
      //   name: "Tata steel",
      //   ...stockData.TATASTEEL,
      // },
      // {
      //   name: "INDIANB",
      //   ...stockData.INDIANB,
      // },
      // {
      //   name: "Bhel",
      //   ...stockData.BHEL,
      // },
    ];

    const tradeResults = [];
    for (let i = 0; i < stocks.length; ++i) {
      const item = stocks[i];

      const days = parseInt((item.c.length * 5) / 60 / 6);

      console.log(`🟡 Taking trade for: ${item.name}`);
      const startTime = Date.now();
      const { trades } = await takeTrades(item, {});
      const total = trades.length;
      const profitable = trades.filter(
        (item) => item.result == "profit"
      ).length;

      const endTime = Date.now();
      const seconds = (endTime - startTime) / 1000;
      const trade = {
        stock: item.name,
        "profit percent 💸": `${((profitable / total) * 100).toFixed(2)}%`,
        days,
        Trades: total,
        ProfitMaking: profitable,
        "loss making": total - profitable,
        trades: trades,
        "⏱️Time taken": seconds + "s",
      };

      tradeResults.push(trade);
    }

    console.table(tradeResults);
  };

  const handleLoopTestTrades = async () => {
    const stockNames = [
      "LAOPALA",
      "LATENTVIEW",
      "BHEL",
      "JSWENERGY",
      "AMBUJACEM",
      "VBL",
      "ZEEL",
      "INDHOTEL",
      "INDIANB",
      "SUNTV",
      "DLF",
      "OIL",
      "JINDALSAW",
      "ADANIPOWER",
      "RBLBANK",
      "BSE",
    ];

    for (let i = 0; i < stockNames.length; ++i) {
      const name = stockNames[i];
      const sData = stockData[name];

      const startTime = Date.now();
      await testTakeTradeForBestNumbers(sData, name);
      const endTime = Date.now();

      const seconds = (endTime - startTime) / 1000;
      console.log(`⏱️Time taken: ${formatSecondsToHrMinSec(seconds)}`);
    }
  };

  const renderChart = async () => {
    const chartElem = document.querySelector("#chart");
    chartElem.innerHTML = "";

    const { createChart } = window.LightweightCharts;

    const chart = createChart(chartElem, {
      width: 1250,
      height: 650,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
      pane: 0,
    });

    const candleSeries = chart.addCandlestickSeries({
      pane: 0,
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candleSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        high: finalStockData.h[i],
        low: finalStockData.l[i],
        open: finalStockData.o[i],
        close: finalStockData.c[i],
      }))
    );

    // chart.addCustomSeries(0,{})

    const colors = ["#a6b8ff", "#ffd4a6", "#e0a6ff", "#ffa6e0"];

    // trade Marks
    const {
      trades,
      indicators = {},
      analytics,
    } = await takeTrades(
      finalStockData,
      {
        additionalIndicators: {
          br: true,
          bollinger: true,
          macd: true,
          sma: true,
        },
        decisionMakingPoints: 3,
      },
      false
    );

    console.log(trades, indicators);
    trades.forEach((trade, i) => {
      const color = colors[i % colors.length];
      const line = chart.addLineSeries({
        pane: 0,
        color: trade.type == "buy" ? "green" : "red",
        lineWidth: 5,
      });

      line.setData([
        {
          time: finalStockData.t[trade.startIndex - 1],
          value: trade.startPrice,
        },
        {
          time: finalStockData.t[trade.startIndex + 1],
          value: trade.startPrice,
        },
      ]);
    });

    // Moving averages
    const smallMaSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "blue",
      lineWidth: 1,
      pane: 0,
    });
    smallMaSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        value: indicators.smallMA ? indicators.smallMA[i] : "",
      }))
    );
    const bigMaSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "yellow",
      lineWidth: 1,
      pane: 0,
    });
    bigMaSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        value: indicators.bigMA ? indicators.bigMA[i] : "",
      }))
    );

    // range marks
    const ranges = indicators.ranges;
    ranges.forEach((range, i) => {
      const color = colors[i % colors.length];
      const line = chart.addLineSeries({
        pane: 0,
        color,
        lineWidth: 1,
      });

      line.setData([
        {
          time: finalStockData.t[range.start.index],
          value: range.min,
        },
        {
          time: finalStockData.t[range.end.index],
          value: range.min,
        },
      ]);

      const line2 = chart.addLineSeries({
        pane: 0,
        color,
        lineWidth: 1,
      });
      line2.setData([
        {
          time: finalStockData.t[range.start.index],
          value: range.max,
        },
        {
          time: finalStockData.t[range.end.index],
          value: range.max,
        },
      ]);
    });

    // MACD
    const macdSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "green",
      lineWidth: 1,
      pane: 1,
    });
    macdSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        value: indicators.macd ? indicators.macd[i]?.macd : "",
      }))
    );

    const macdSignalSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "red",
      lineWidth: 1,
      pane: 1,
    });
    macdSignalSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        value: indicators.macd ? indicators.macd[i]?.signal : "",
      }))
    );

    // RSI
    const rsiSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "purple",
      lineWidth: 1,
      pane: 2,
    });

    rsiSeries.setData(
      finalStockData.c.map((item, i) => ({
        time: finalStockData.t[i],
        value: indicators.rsi ? indicators.rsi[i] : "",
      }))
    );

    chart.timeScale().fitContent();
  };

  const onIndicesUpdate = () => {
    setTradesTaken([]);

    // renderChartJsChart();
    renderChart();
  };

  useEffect(() => {
    // debounce(onIndicesUpdate, 1200);
  }, [chartDisplayIndices]);

  useEffect(() => {
    fetchStockData();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.title}>Prices Data</p>
      </div>

      <div className={styles.buttons}>
        <button className="button" onClick={handleSingleTrade}>
          Single run
        </button>

        <button className="button" onClick={handleLoopTestTrades}>
          Loop test trades
        </button>
      </div>

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

      <div id="chart" />

      {/* <div className={styles.chart} id="chart-js-container"></div> */}

      <div className={styles.chart}>
        <div
          className={styles.chartInner}
          // style={{ width: `${pricesData.labels.length * 30}px` }}
        >
          <Line options={pricesOptions} data={pricesData} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
