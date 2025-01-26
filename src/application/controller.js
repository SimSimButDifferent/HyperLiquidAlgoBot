const { testWebSocket } = require("../hyperliquid/websocket")
const { getCandles, getCurrentPrice } = require("../hyperliquid/marketInfo")
const ScalpingStrategy = require("../strategy/ScalpingStrategy")
const winston = require("winston")
const config = require("config")
const fs = require("fs")
require("dotenv").config()

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console({ level: "info" }),
        new winston.transports.File({ filename: "bot.log", level: "debug" }),
    ],
})

// const tradingData = require("../backtesting/data/BTC-PERP/BTC-PERP-1m.json")

const tradingConfig = config.get("trading")
const ticker = tradingConfig.market
const interval = tradingConfig.timeframe
const leverage = tradingConfig.leverage
const positionSize = tradingConfig.positionSize

async function initialize() {
    testWebSocket(ticker, interval)
    console.log("--------------------------------SOCKET CONNECTED--------------------------------")
}

async function main(ticker, interval) {
    const strategy = new ScalpingStrategy(logger)

    try {
        // const marketResponse = await getCandles(ticker, interval, 10)
        const marketData = await getCandles(ticker, interval, 10)

        // console.log("marketResponse", marketResponse)
        // const marketData = marketResponse[0]

        console.log("marketData", marketData)

        async function trade() {
            try {
                const signal = await strategy.evaluatePosition(marketData)
                const currentPrice = await getCurrentPrice(ticker)

                if (signal === "LONG") {
                    const price = currentPrice
                    const order = await placeOrder(price)
                    console.log("Order placed successfully:", order)
                } else if (signal === "CLOSE_LONG") {
                    const price = currentPrice
                    const order = await closeOrder(price)
                    console.log("Order closed successfully:", order)
                }
            } catch (error) {
                console.error("Error executing trade:", error)
            }
        }

        // interval string to number
        const intervalNumber = parseInt(interval.split("m")[0])
        console.log("intervalNumber", intervalNumber)

        // Run the trade function every interval
        setInterval(trade(), intervalNumber * 60 * 1000)
    } catch (error) {
        console.log(error.message)
    }
}

initialize()
    .then(() => {
        console.log("Candestickdata fetched successfully")
    })
    .catch((error) => {
        console.error("Error fetching candlestick data:", error)
    })

main(ticker, interval)
    .then(() => {
        console.log("Bot started successfully.")
    })
    .catch((error) => {
        console.error("Error starting bot:", error)
    })
