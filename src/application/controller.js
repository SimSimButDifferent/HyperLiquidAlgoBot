const { testWebSocket } = require("../hyperliquid/websocket")
const { getCandles, getUserOpenOrders, getUserOpenPositions } = require("../hyperliquid/marketInfo")
const { openLong, closeLong, setLeverage } = require("../hyperliquid/trade")
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
const leverageMode = tradingConfig.leverageMode
const positionSize = tradingConfig.positionSize
const indicators = config.get("indicators")
const shortEmaPeriod = indicators.ema.shortEmaPeriod
const longEmaPeriod = indicators.ema.longEmaPeriod

console.log("symbol", symbol)
console.log("interval", interval)
console.log("leverage", leverage)
console.log("positionSize", positionSize)
console.log("shortEmaPeriod", shortEmaPeriod)
console.log("longEmaPeriod", longEmaPeriod)
logger.info("symbol", symbol)
logger.info("interval", interval)
logger.info("leverage", leverage)
logger.info("positionSize", positionSize)
logger.info("shortEmaPeriod", shortEmaPeriod)
logger.info("longEmaPeriod", longEmaPeriod)
logger.info("Boot time", new Date().toISOString())

async function main(symbol, interval) {
    const strategy = new ScalpingStrategy(logger)
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 5

    try {
        async function trade() {
            try {
                const marketData = await getCandles(symbol, interval, 25)

                // Add validation for market data
                if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
                    throw new Error("Invalid market data received")
                }

                let openOrders
                try {
                    openOrders = await getUserOpenPositions()
                } catch (error) {
                    logger.error("Error fetching positions, assuming no open positions:", error)
                    openOrders = []
                }

                const signal = await strategy.evaluatePosition(marketData)

                if (signal === "LONG" && openOrders.length === 0) {
                    console.log("Opening long position")
                    const order = await openLong(symbol, positionSize)
                    console.log("Order placed successfully:", order)
                    logger.info("Order placed successfully:", order)
                    console.log("Order response:", order.response.data[0])
                } else if (signal === "CLOSE_LONG" && openOrders.length > 0) {
                    console.log("Closing long position")
                    const order = await closeLong(symbol, positionSize)
                    console.log("Order closed successfully:", order)
                    logger.info("Order closed successfully:", order)
                    console.log("Order response:", order.response.data[0])
                }

                // Reset consecutive errors on successful execution
                consecutiveErrors = 0
            } catch (error) {
                consecutiveErrors++
                console.error(
                    `Error executing trade (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
                    error,
                )

                // If too many consecutive errors, stop the bot
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.error("Too many consecutive errors, stopping bot")
                    clearInterval(intervalId)
                    process.exit(1)
                }

                // Add delay before next attempt
                await new Promise((resolve) => setTimeout(resolve, 5000))
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
        logger.error("Fatal error in main:", error)
        process.exit(1)
    }
}

main(symbol, interval)
    .then(() => {
        console.log("Bot started successfully.")
    })
    .catch((error) => {
        console.error("Error starting bot:", error)
    })
