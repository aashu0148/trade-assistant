import React, { useEffect, useState } from "react";

import Spinner from "Components/Spinner/Spinner";
import Button from "Components/Button/Button";

import { takeTrades } from "utils/tradeUtil";
import { formatSecondsToHrMinSec } from "utils/util";

function TestPage() {
  const [loadingPage, setLoadingPage] = useState(true);
  const [stockData, setStockData] = useState({});
  const [selectedStocks, setSelectedStocks] = useState([]);

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
      `https://trade-p129.onrender.com/trade/data?from=1683225000000&to=1698550040946`,
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
      for (let vpOffset = 5; vpOffset < 15; vpOffset += 4) {
        console.log(symbol, "|", indicatorCombinations[i]);
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

        if (profitPercent > 45 && total > 20) {
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

  useEffect(() => {
    fetchStockData();
  }, []);

  return loadingPage ? (
    <div className="spinner-container">
      <Spinner />
    </div>
  ) : (
    <div className="container">
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
  );
}

export default TestPage;
