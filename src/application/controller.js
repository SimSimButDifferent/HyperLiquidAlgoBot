const { testWebSocket } = require("../hyperliquid/websocket")
const { getCandles, getCurrentPrice, getUserOpenOrders } = require("../hyperliquid/marketInfo")
const { openLong, closeLong } = require("../hyperliquid/trade")
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

const tradingConfig = config.get("trading")
const symbol = tradingConfig.market
const interval = tradingConfig.timeframe
const leverage = tradingConfig.leverage
const positionSize = tradingConfig.positionSize

console.log("symbol", symbol)
console.log("interval", interval)
console.log("leverage", leverage)
console.log("positionSize", positionSize)

async function main(symbol, interval) {
    const strategy = new ScalpingStrategy(logger)

    try {
        async function trade() {
            try {
                const marketData = await getCandles(symbol, interval, 25)
                // Check for existing open orders
                const openOrders = await getUserOpenOrders()

                const signal = await strategy.evaluatePosition(marketData)

                if (signal === "LONG" && openOrders.length === 0) {
                    const order = await openLong(symbol, positionSize)
                    console.log("Order placed successfully:", order)
                } else if (signal === "CLOSE_LONG" && openOrders.length > 0) {
                    const order = await closeLong(symbol, positionSize)
                    console.log("Order closed successfully:", order)
                }
            } catch (error) {
                console.error("Error executing trade:", error)
            }
        }

        // Convert interval string to number
        const intervalNumber = parseInt(interval.split("m")[0])

        const intervalId = setInterval(
            () => {
                trade().catch((error) => {
                    console.error("Error in trade interval:", error)
                })
            },
            intervalNumber * 60 * 1000,
        )

        // Later, if you need to stop the bot:
        // clearInterval(intervalId)
    } catch (error) {
        console.log(error.message)
    }
}

main(symbol, interval)
    .then(() => {
        console.log("Bot started successfully.")
    })
    .catch((error) => {
        console.error("Error starting bot:", error)
    })
