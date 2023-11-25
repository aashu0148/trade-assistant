import React, { useEffect, useRef, useState } from "react";
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
import Spinner from "Components/Spinner/Spinner";

// import stockData from "utils/stockData";
import {
  calculateAngle,
  formatSecondsToHrMinSec,
  formatTime,
  getDateFormatted,
  getRandomNumber,
  getTimeFormatted,
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

function HomePage() {
  const [tooltipDetails, setTooltipDetails] = useState({
    style: {},
    close: "",
    index: "",
    date: "",
  });
  const [loadingPage, setLoadingPage] = useState(true);
  const [chartDisplayIndices, setChartDisplayIndices] = useState([0, 200]);
  const [tradesTaken, setTradesTaken] = useState([]);

  const [selectedStock, setSelectedStock] = useState("");
  const [stockData, setStockData] = useState({});

  const availableStocks = [
    ...Object.keys(stockData).map((key) => ({
      value: key,
      label: `${key} | ${
        stockData[key]["5"].c[stockData[key]["5"].c.length - 1]
      }`,
      data: stockData[key],
    })),
  ].filter((item) => item.data["5"]?.c?.length);

  const stock = stockData[selectedStock] || {
    5: {
      c: [],
      t: [],
      v: [],
      o: [],
      h: [],
      l: [],
    },
  };
  const cdi1 = chartDisplayIndices[0];
  const cdi2 = chartDisplayIndices[1] - cdi1 < 50 ? 50 : chartDisplayIndices[1];
  const finalStockData = Object.keys(stock).reduce((acc, key) => {
    acc[key] = {
      t: stock[key].t.slice(cdi1, cdi2),
      h: stock[key].h.slice(cdi1, cdi2),
      l: stock[key].l.slice(cdi1, cdi2),
      o: stock[key].o.slice(cdi1, cdi2),
      c: stock[key].c.slice(cdi1, cdi2),
      v: stock[key].v.slice(cdi1, cdi2),
    };

    return acc;
  }, {});

  const debounce = (func, time = 400) => {
    clearTimeout(timer);
    timer = setTimeout(func, time);
  };

  const fetchStockData = async () => {
    const res = await fetch(
      `https://trade-p129.onrender.com/trade/data?from=1678213800000&to=1691519400000`,
      {
        headers: {
          Authorization:
            "$2b$05$.X7vV5TJ3eQPoAGoOGnHH.K6ROXzZ7JzDWqkdj/1JKbtTSlLr7xt2",
        },
      }
    );
    const json = await res.json();
    if (!json?.success || !json?.data) return;

    setLoadingPage(false);
    setStockData(json.data);

    if (!selectedStock) setSelectedStock(Object.keys(json.data)[0]);
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
      rsi: false,
      mfi: false,
      stochastic: false,
      willR: false,
      vwap: false,
      cci: false,
      sr: false,
      sr15min: false,
      br: false,
      macd: false,
      sma: false,
    };
    const otherIndicators = {
      rsi: false,
      mfi: false,
      stochastic: false,
      willR: false,
      vwap: false,
      cci: false,
      psar: false,
    };
    const impIndicators = {
      sr: false,
      sr15min: false,
      br: false,
      macd: false,
      sma: false,
    };
    const indicatorCombinations = getAllCombinations(
      Object.keys(indicators).map((item) => item + "_")
    ).filter((item) => {
      const inds = item.split("_").filter((s) => s);

      let otherIndCount = 0,
        impIndCount = 0;
      inds.forEach((i) => {
        if (Object.keys(otherIndicators).includes(i)) otherIndCount++;
        if (Object.keys(impIndicators).includes(i)) impIndCount++;
      });

      return otherIndCount > 2 || impIndCount < 2 ? false : true;
    });

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
        const profits = trades.filter((item) => item.status == "profit").length;

        const profitPercent = (profits / total) * 100;

        if (profitPercent > 50 && total > 20) {
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
      // {
      //   name: "Tata motors",
      //   ...stockData.TATAMOTORS,
      // },
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
      "JINDALSTEL",
      "JSWENERGY",
      "COALINDIA",
      "MANINFRA",
      "HDFCBANK",
      "IBULHSGFIN",
      "ZOMATO",
      "ITC",
      "FORCEMOT",
      "BSE",
      "INDIGO",
      "UBL",
    ];

    for (let i = 0; i < stockNames.length; ++i) {
      const name = stockNames[i];
      const sData = stockData[name];
      if (!sData) continue;

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
      width: 1350,
      height: 1050,
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
    const timeArr = finalStockData["5"].t;
    candleSeries.setData(
      finalStockData["5"].c.map((item, i) => ({
        time: finalStockData["5"].t[i],
        high: finalStockData["5"].h[i],
        low: finalStockData["5"].l[i],
        open: finalStockData["5"].o[i],
        close: finalStockData["5"].c[i],
      }))
    );

    // update tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartElem.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartElem.clientHeight
      ) {
        setTooltipDetails((prev) => ({
          ...prev,
          style: { ...prev.style, opacity: 0 },
        }));
      } else {
        // time will be in the same format that we supplied to setData.
        // thus it will be YYYY-MM-DD
        const dateStr = param.time;
        const data = param.seriesPrices.get(candleSeries);
        const price = data.value !== undefined ? data.value : data.close;

        const y = param.point.y;
        let left = param.point.x;
        if (left > chartElem.clientWidth) {
          left = param.point.x;
        }

        let top = y;
        if (top > chartElem.clientHeight) {
          top = y;
        }

        const style = {
          opacity: "1",
          top: top + "px",
          left: left + "px",
        };

        const index = timeArr.findIndex((item) => item == dateStr);

        setTooltipDetails({
          style,
          index,
          close: price,
          date: `${getDateFormatted(
            dateStr * 1000,
            true,
            true
          )} ${getTimeFormatted(dateStr * 1000)}`,
        });
      }
    });

    // chart.addCustomSeries(0,{})

    const colors = ["#a6b8ff50", "#ffd4a650", "#e0a6ff50", "#ffa6e050"];

    // trade Marks
    const {
      trades,
      indicators = {},
      analytics,
    } = await takeTrades(
      finalStockData,
      {
        additionalIndicators: {
          tl: true,
          // sr: true,
          // sr15min: true,
          // br: true,
          // bollinger: true,
          // macd: true,
          // cci: true,
        },
        vPointOffset: 7,
        trendLineVPointOffset: 7,
        decisionMakingPoints: 3,
      },
      false
    );

    // const vPoints = indicators.vPs;
    // vPoints.forEach((v, i) => {
    //   const color = colors[i % colors.length];

    //   const line = chart.addLineSeries({
    //     pane: 0,
    //     color: "blue",
    //     lineWidth: 8,
    //   });

    //   line.setData([
    //     {
    //       time: finalStockData["5"].t[v.index - 1],
    //       value: v.value,
    //     },
    //     {
    //       time: finalStockData["5"].t[v.index + 1],
    //       value: v.value,
    //     },
    //   ]);
    // });

    // console.log(trades, indicators);
    // trade marks
    trades.forEach((trade, i) => {
      const color = colors[i % colors.length];
      const line = chart.addLineSeries({
        pane: 0,
        color: trade.type == "buy" ? "green" : "red",
        lineWidth: 8,
      });

      line.setData([
        {
          time: finalStockData["5"].t[trade.startIndex - 2],
          value: trade.startPrice,
        },
        {
          time: finalStockData["5"].t[trade.startIndex + 2],
          value: trade.startPrice,
        },
      ]);
    });

    console.log(
      `Profit: ${trades.filter((item) => item.status == "profit").length}`,
      trades,
      trades.map((item) => item.status),
      indicators.allSignals,
      indicators.trendLines
    );

    // // Moving averages
    // const smallMaSeries = chart.addLineSeries({
    //   priceFormat: { type: "price" },
    //   color: "blue",
    //   lineWidth: 1,
    //   pane: 0,
    // });
    // smallMaSeries.setData(
    //   finalStockData["5"].c.map((item, i) => ({
    //     time: finalStockData["5"].t[i],
    //     value: indicators.smallMA ? indicators.smallMA[i] : "",
    //   }))
    // );
    // const bigMaSeries = chart.addLineSeries({
    //   priceFormat: { type: "price" },
    //   color: "yellow",
    //   lineWidth: 1,
    //   pane: 0,
    // });
    // bigMaSeries.setData(
    //   finalStockData["5"].c.map((item, i) => ({
    //     time: finalStockData["5"].t[i],
    //     value: indicators.bigMA ? indicators.bigMA[i] : "",
    //   }))
    // );

    // trend lines
    const trendLines = indicators.trendLines || [];
    trendLines.forEach((tLine) => {
      const line = chart.addLineSeries({
        pane: 0,
        color: "#197beb",
        lineWidth: 2,
      });

      line.setData([
        {
          time: finalStockData["5"].t[tLine.points[0].index],
          value: tLine.points[0].value,
        },
        {
          time: finalStockData["5"].t[
            tLine.points[tLine.points.length - 1].index
          ],
          value: tLine.points[tLine.points.length - 1].value,
        },
      ]);
    });

    // range marks
    // const ranges = indicators.ranges || [];

    // ranges.forEach((range, i) => {
    //   const color = colors[i % colors.length];
    //   const line = chart.addLineSeries({
    //     pane: 0,
    //     color,
    //     lineWidth: 8,
    //   });

    //   line.setData([
    //     {
    //       time: finalStockData["5"].t[range.start.index],
    //       value: range.min,
    //     },
    //     {
    //       time: finalStockData["5"].t[
    //         range.stillStrong
    //           ? finalStockData["5"].t.length - 1
    //           : range.end.index
    //       ],
    //       value: range.min,
    //     },
    //   ]);

    // const line2 = chart.addLineSeries({
    //   pane: 0,
    //   color,
    //   lineWidth: 3,
    // });
    // line2.setData([
    //   {
    //     time: finalStockData["5"].t[range.start.index],
    //     value: range.max,
    //   },
    //   {
    //     time: finalStockData["5"].t[
    //       range.stillStrong
    //         ? finalStockData["5"].t.length - 1
    //         : range.end.index
    //     ],
    //     value: range.max,
    //   },
    // ]);
    // });

    // MACD
    const macdSeries = chart.addLineSeries({
      priceFormat: { type: "price" },
      color: "green",
      lineWidth: 1,
      pane: 1,
    });
    macdSeries.setData(
      finalStockData["5"].c.map((item, i) => ({
        time: finalStockData["5"].t[i],
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
      finalStockData["5"].c.map((item, i) => ({
        time: finalStockData["5"].t[i],
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
      finalStockData["5"].c.map((item, i) => ({
        time: finalStockData["5"].t[i],
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
    if (loadingPage) return;

    debounce(onIndicesUpdate, 1100);
  }, [loadingPage, chartDisplayIndices, selectedStock]);

  useEffect(() => {
    fetchStockData();
  }, []);

  return loadingPage ? (
    <div className="spinner-container">
      <Spinner />
    </div>
  ) : (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <button className="button" onClick={handleSingleTrade}>
          Single run
        </button>

        <button className="button" onClick={handleLoopTestTrades}>
          Loop test trades
        </button>
      </div>

      <div className="chips">
        {availableStocks.map((item) => (
          <div
            className={`chip ${selectedStock == item.value ? "active" : ""}`}
            key={item.value}
            onClick={() => setSelectedStock(item.value)}
          >
            {item.label}
          </div>
        ))}
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

      <div className={styles.chartOuter}>
        <div className={styles.tooltip} style={{ ...tooltipDetails.style }}>
          <div className={styles.item}>
            <label>Index</label>
            <span>{tooltipDetails.index}</span>
          </div>
          <div className={styles.item}>
            <label>Close</label>
            <span>{tooltipDetails.close}</span>
          </div>
          <div className={styles.item}>
            <label>Date</label>
            <span>{tooltipDetails.date}</span>
          </div>
        </div>

        <div id="chart" />
      </div>
    </div>
  );
}

export default HomePage;
