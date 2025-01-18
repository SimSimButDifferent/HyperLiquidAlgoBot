// const btcData = require("../../backtesting/data/BTC-USD/BTC-USD-1MIN.json")

function shortEMA(data) {
    const priceData = getPriceData(data)
    return calculateEMA(priceData, 9)
}

function longEMA(data) {
    const priceData = getPriceData(data)
    return calculateEMA(priceData, 21)
}

function getPriceData(candleStickData) {
    const candles = candleStickData.candles
    const priceData = candles.map((candle) => candle.close)
    const priceDatatoNumber = priceData.map((price) => Number(price))
    return priceDatatoNumber
}

function calculateEMA(priceData, period) {
    const initialSMA = priceData.slice(0, period).reduce((sum, price) => sum + price, 0) / period
    const smoothingFactor = 2 / (period + 1)
    const emaValues = [initialSMA]

    for (let i = period; i < priceData.length; i++) {
        const previousEMA = emaValues[emaValues.length - 1]
        const currentPrice = priceData[i]
        const currentEMA = (currentPrice - previousEMA) * smoothingFactor + previousEMA
        emaValues.push(currentEMA)
    }

    return emaValues
}

module.exports = {
    shortEMA,
    longEMA,
}
