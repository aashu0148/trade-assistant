import React, { useEffect, useMemo, useState } from "react";
// import ReactJSON from "react-json-view";
import { Copy } from "react-feather";
import { takeTrades, indicatorEnum } from "@aashu0148/yota-algo";

import Spinner from "Components/Spinner/Spinner";
import Button from "Components/Button/Button";

import {
  copyToClipboard,
  formatSecondsToHrMinSec,
  getTradeLabels,
} from "utils/util";

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function TestPage() {
  const [loadingPage, setLoadingPage] = useState(true);
  const [stockData, setStockData] = useState({});
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [localStorageObj, setLocalStorageObj] = useState({});
  const [showJSON, setShowJSON] = useState(false);

  const availableStocks = [
    ...Object.keys(stockData).map((key) => ({
      value: key,
      label: `${key} | ${
        stockData[key]["5"].c[stockData[key]["5"].c.length - 1]
      }`,
      data: stockData[key],
    })),
  ].filter((item) => item.data["5"]?.c?.length);

  const fetchStockData = async () => {
    const res = await fetch(
      `https://trade-p129.onrender.com/trade/data?from=1689186600000&to=1702190158456`,
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

    console.log("DATA fetched", json.data);
  };

  const testTradesLogic = async ({
    symbol,
    priceData,
    indicatorCombination,
    vpOffset,
    tlVpOffset,
    goodTradeMetrics = [],
    targetProfitPercent = 1.4,
    stopLossPercent = 0.7,
  }) => {
    const indicators = indicatorCombination.split("#").filter((item) => item);

    const indicatorsObj = {};
    indicators.forEach((item) => (indicatorsObj[item] = true));

    console.log(`${symbol} | ${indicatorCombination}`);

    const {
      trades,
      preset,
      indicators: drawnIndicators,
    } = takeTrades(priceData, {
      additionalIndicators: indicatorsObj,
      vPointOffset: vpOffset,
      trendLineVPointOffset: tlVpOffset,
      targetProfitPercent,
      stopLossPercent,
    });

    if (!trades.length) {
      console.log("No trades!");
      return {
        trades,
        profitPercent: 0,
        unfinishedPercent: 0,
        isGoodTrade: false,
      };
    }

    const total = trades.length;

    const tradeLabels = getTradeLabels(trades);

    const profitTrades = tradeLabels.reduce(
      (acc, curr) => (curr == "profit" ? acc + 1 : acc),
      0
    );
    const lossTrades = tradeLabels.reduce(
      (acc, curr) => (curr == "loss" ? acc + 1 : acc),
      0
    );
    const firstTargetTrades = tradeLabels.reduce(
      (acc, curr) => (curr == "half-profit" ? acc + 1 : acc),
      0
    );
    const unfinishedTrades = tradeLabels.reduce(
      (acc, curr) => (curr == "unfinished" ? acc + 1 : acc),
      0
    );
    const profitPercent =
      ((profitTrades + firstTargetTrades) /
        (profitTrades + firstTargetTrades + lossTrades)) *
      100;

    const unfinishedPercent = (unfinishedTrades / trades.length) * 100;

    const isGoodTrade =
      profitPercent > 60 && total > 45 && unfinishedPercent < 23;

    if (isGoodTrade) {
      goodTradeMetrics.push({
        symbol: symbol,
        analytics: {
          profitPercent,
          total,
          profitable: profitTrades,
          lossMaking: lossTrades,
          unfinished: unfinishedTrades,
        },
        preset,
      });

      console.log(
        `🟡P-P:${parseInt(profitPercent)} | PP-${profitPercent.toFixed(
          1
        )} | UfP-${unfinishedPercent.toFixed(1)} | T-${total}}`
      );
    }

    return {
      trades,
      indicators: drawnIndicators,
      preset,
      goodTradeMetrics,
      profitPercent,
      unfinishedPercent,
      isGoodTrade,
    };
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

    const otherIndicators = {
      // rsi: false,
      // bollinger: false,
      mfi: false,
      // stochastic: false,
      // willR: false,
      // cci: false,
      macd: false,
      sma: false,
    };
    const impIndicators = {
      tl: false,
      sr: false,
      br: false,
      // engulf: false,
      [indicatorEnum.momentumGroup]: false,
      [indicatorEnum.allStar]: false,
      [indicatorEnum.trapping]: false,
    };

    const indicatorCombinations = getAllCombinations(
      [...Object.keys(otherIndicators), ...Object.keys(impIndicators)].map(
        (item) => item + "#"
      )
    ).filter((item) => {
      if (item.includes("rsi") && item.includes("cci")) return false;
      if (item.includes("rsi") && item.includes("willR")) return false;
      if (!item.includes("tl")) return false;

      const inds = item.split("#").filter((s) => s);

      let otherIndCount = 0,
        impIndCount = 0;
      inds.forEach((i) => {
        if (Object.keys(otherIndicators).includes(i)) otherIndCount++;
        if (Object.keys(impIndicators).includes(i)) impIndCount++;
      });

      return otherIndCount > 3 || impIndCount < 1 ? false : true;
    });
    // shuffleArray(indicatorCombinations);

    const priceWinRatios = [
      {
        min: 0,
        max: 120,
        tp: 1,
        sp: 0.6,
      },
      {
        min: 120,
        max: 400,
        tp: 1.4,
        sp: 0.7,
      },
      {
        min: 300,
        max: 900,
        tp: 1.1,
        sp: 0.55,
      },
      {
        min: 900,
        max: 80000,
        tp: 1,
        sp: 0.6,
      },
    ];

    console.log(
      "indicatorCombinations:",
      indicatorCombinations.length,
      indicatorCombinations
    );
    let goodTradeMetrics = [],
      skipVpOffset = false;
    for (let i = 0; i < indicatorCombinations.length; ++i) {
      for (let vpOffset = 7; vpOffset < 11; vpOffset += 3) {
        if (skipVpOffset) {
          console.log("SKIPPING vpOffset");
          vpOffset = 14;
          skipVpOffset = false;
          continue;
        }

        const price = priceData["5"].c[0];
        const ratio = priceWinRatios.find(
          (item) => item.min < price && item.max >= price
        );

        const { trades, isGoodTrade, profitPercent } = await testTradesLogic({
          symbol,
          goodTradeMetrics,
          priceData,
          vpOffset,
          indicatorCombination: indicatorCombinations[i],
          targetProfitPercent: ratio.tp,
          stopLossPercent: ratio.sp,
        });

        if (profitPercent < 20) {
          skipVpOffset = true;
        }
      }
    }

    goodTradeMetrics = goodTradeMetrics.sort((a, b) =>
      a.analytics.total > b.analytics.total ? -1 : 1
    );

    console.log(`🔵 Trades for: ${symbol}`, structuredClone(goodTradeMetrics));
    localStorage.setItem(
      `${symbol}_trades`,
      JSON.stringify(goodTradeMetrics.slice(0, 35))
    );
  };

  const handleLoopTestTrades = async () => {
    for (let i = 0; i < selectedStocks.length; ++i) {
      const name = selectedStocks[i];
      const sData = stockData[name];
      if (!sData) continue;

      const startTime = Date.now();
      await testTakeTradeForBestNumbers(sData, name);
      const endTime = Date.now();

      const seconds = (endTime - startTime) / 1000;
      console.log(`⏱️Time taken: ${formatSecondsToHrMinSec(seconds)}`);
    }
  };

  const getAllStoredResults = () => {
    const storageObj = JSON.parse(JSON.stringify(localStorage));
    if (!Object.keys(storageObj).length) return;

    const storage = Object.keys(storageObj).reduce((acc, key) => {
      const res = JSON.parse(storageObj[key]);
      res.sort((a, b) => (a.analytics.total > b.analytics.total ? -1 : 1));

      acc[key] = res;
      return acc;
    }, {});

    setLocalStorageObj(storage);
  };

  useEffect(() => {
    fetchStockData();
    getAllStoredResults();
  }, []);

  const getTableFromAnalytics = (
    data = [
      { symbol: "", profitPercent: "", total: "", preset: {}, indicators: "" },
    ]
  ) => {
    return (
      <div
        style={{
          maxHeight: "200px",
          overflowY: "auto",
          width: "1200px",
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        <table className={`custom-table`} style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Profit percent</th>
              <th>Total</th>
              <th>Indicators</th>
              <th style={{ opacity: "0", cursor: "default" }}>action</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr key={item.profitPercent + item.total + item.symbol}>
                <td style={{ fontWeight: "bold" }}>{item.symbol}</td>
                <td style={{ fontWeight: "bold" }}>
                  {item.profitPercent.toFixed(2)}%
                </td>
                <td>{item.total}</td>
                <td>{item.indicators}</td>
                <td style={{ textAlign: "center" }}>
                  <Button
                    onClick={() => copyToClipboard(JSON.stringify(item.preset))}
                    outlineButton
                  >
                    <Copy /> Copy
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // const jsonDiv = useMemo(
  //   () => (
  //     <ReactJSON
  //       style={{ height: "600px", overflowY: "auto" }}
  //       src={localStorageObj}
  //       theme={"monokai"}
  //     />
  //   ),
  //   [localStorageObj]
  // );

  return loadingPage ? (
    <div className="spinner-container">
      <Spinner />
    </div>
  ) : (
    <div className="container">
      <div className="section">
        <p className="heading">Test stock for best numbers</p>

        <div className="chips">
          {availableStocks.map((item) => (
            <div
              className={`chip ${
                selectedStocks.includes(item.value) ? "active" : ""
              }`}
              key={item.value}
              onClick={() =>
                setSelectedStocks((prev) =>
                  prev.includes(item.value)
                    ? prev.filter((s) => s !== item.value)
                    : [...prev, item.value]
                )
              }
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="footer">
          <Button onClick={handleLoopTestTrades}>Start loop test</Button>
        </div>
      </div>

      <div className="section">
        <p className="heading">Previously tested data</p>

        {Object.keys(localStorageObj).map((symbol) =>
          localStorageObj[symbol]?.length
            ? getTableFromAnalytics(
                localStorageObj[symbol].map((item) => ({
                  ...item.analytics,
                  symbol,
                  preset: item.preset,
                  indicators: item.preset?.additionalIndicators
                    ? Object.keys(item.preset.additionalIndicators).join(", ")
                    : "",
                }))
              )
            : ""
        )}
        {/* 
        {showJSON ? (
          <Button outlineButton onClick={() => setShowJSON(false)}>
            Hide JSON
          </Button>
        ) : (
          <Button onClick={() => setShowJSON(true)}>Show JSON</Button>
        )} */}

        {/* {showJSON ? jsonDiv : ""} */}
      </div>
    </div>
  );
}

export default TestPage;
