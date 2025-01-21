module.exports = {
    trading: {
        market: "BTC-USD",
        positionSize: 5,
        leverage: 5,
        maxPositions: 3,
        timeframe: "1m",
        stopLoss: {
            percentage: 1.5,
        },
        takeProfit: {
            percentage: 2.5,
        },
        dailyLossLimit: 10,
        testMode: true,
    },
    indicators: {
        rsi: {
            period: 14,
            overbought: 70,
            oversold: 30,
            exitLong: 45,
            exitShort: 55,
        },
        vwap: {
            period: 14,
            deviation: 1.5,
        },
        atr: {
            period: 14,
            multiplier: 1.5,
        },
        ema: {
            shortEmaPeriod: 9,
            longEmaPeriod: 21,
        },
    },
    database: {
        path: "./db/trades.db",
    },
    logging: {
        console: {
            level: "info",
        },
        file: {
            level: "debug",
            path: "./logs/bot.log",
        },
    },
    rateLimit: {
        maxRequestsPerSecond: 10,
        maxOrdersPerMinute: 30,
    },
}
