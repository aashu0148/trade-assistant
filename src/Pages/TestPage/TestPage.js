import React, { useEffect, useState } from "react";
import ReactJSON from "react-json-view";

import Spinner from "Components/Spinner/Spinner";
import Button from "Components/Button/Button";

import { takeTrades } from "utils/tradeUtil";
import { formatSecondsToHrMinSec } from "utils/util";

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
      `https://trade-p129.onrender.com/trade/data?from=1692238818805&to=1700878818805`,
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
      macd: false,
      sma: false,
      cci: false,
      sr: false,
      br: false,
      tl: false,
    };
    const otherIndicators = {
      rsi: false,
      mfi: false,
      stochastic: false,
      willR: false,
      cci: false,
      macd: false,
      sma: false,
    };
    const impIndicators = {
      tl: false,
      sr: false,
      br: false,
    };
    const indicatorCombinations = getAllCombinations(
      Object.keys(indicators).map((item) => item + "_")
    ).filter((item) => {
      if (item.includes("rsi") && item.includes("cci")) return false;
      if (item.includes("rsi") && item.includes("willR")) return false;
      if (!item.includes("tl")) return false;

      const inds = item.split("_").filter((s) => s);

      let otherIndCount = 0,
        impIndCount = 0;
      inds.forEach((i) => {
        if (Object.keys(otherIndicators).includes(i)) otherIndCount++;
        if (Object.keys(impIndicators).includes(i)) impIndCount++;
      });

      return otherIndCount > 3 || impIndCount < 1 ? false : true;
    });
    shuffleArray(indicatorCombinations);

    console.log(indicatorCombinations);
    let goodTradeMetrics = [];
    for (let i = 0; i < indicatorCombinations.length; ++i) {
      for (let vpOffset = 6; vpOffset < 13; vpOffset += 3) {
        for (let tlVpOffset = 7; tlVpOffset < 12; tlVpOffset += 2) {
          const indicators = indicatorCombinations[i]
            .split("_")
            .filter((item) => item);

          const indicatorsObj = {};
          indicators.forEach((item) => (indicatorsObj[item] = true));

          const { trades, preset } = await takeTrades(priceData, {
            additionalIndicators: indicatorsObj,
            vPointOffset: vpOffset,
            trendLineVPointOffset: tlVpOffset,
          });

          if (!trades.length) {
            console.log("No trades!");
            continue;
          }

          const total = trades.length;
          const profits = trades.filter(
            (item) => item.status == "profit"
          ).length;
          const lost = trades.filter((item) => item.status == "loss").length;
          const unfinished = trades.filter(
            (item) => item.status == "unfinished"
          ).length;
          const unfinishedPercent = (unfinished / total) * 100;

          const profitPercent = (profits / (profits + lost)) * 100;

          console.log(
            `${symbol} | ${
              indicatorCombinations[i]
            } | PP-${profitPercent.toFixed(
              1
            )} | UfP-${unfinishedPercent.toFixed(1)} | T-${total}`
          );
          if (profitPercent > 45 && total > 20 && unfinishedPercent < 25) {
            goodTradeMetrics.push({
              symbol: symbol,
              analytics: {
                profitPercent,
                indicatorsObj,
                vpOffset,
                tlVpOffset,
                total,
                profitable: profits,
                lossMaking: lost,
                unfinished,
              },
              preset,
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
    }

    goodTradeMetrics = goodTradeMetrics.sort((a, b) =>
      a.total > b.total ? -1 : 1
    );

    console.log(`🔵 Trades for: ${symbol}`, structuredClone(goodTradeMetrics));
    localStorage.setItem(
      `${symbol}_trades`,
      JSON.stringify(goodTradeMetrics.slice(0, 20))
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
      acc[key] = JSON.parse(storageObj[key]);

      return acc;
    }, {});

    setLocalStorageObj(storage);
  };

  useEffect(() => {
    fetchStockData();
    getAllStoredResults();
  }, []);

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

        {showJSON ? (
          <Button outlineButton onClick={() => setShowJSON(false)}>
            Hide JSON
          </Button>
        ) : (
          <Button onClick={() => setShowJSON(true)}>Show JSON</Button>
        )}

        {showJSON ? (
          <ReactJSON
            style={{ height: "600px", overflowY: "auto" }}
            src={localStorageObj}
            theme={"monokai"}
          />
        ) : (
          ""
        )}
      </div>
    </div>
  );
}

export default TestPage;
