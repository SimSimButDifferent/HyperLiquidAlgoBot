const { getCompositeClient } = require("../dydx/compositeClient")
const { getIndexerClient, marketData } = require("../dydx/indexer")
const { connectSocket } = require("../dydx/websocket")
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

const compositeClient = getCompositeClient()
const indexerClient = getIndexerClient()
const tradingData = marketData(indexerClient)

const tradingConfig = config.get("trading")
const ticker = tradingConfig.market
const timeframe = tradingConfig.timeframe
const leverage = tradingConfig.leverage
const positionSize = tradingConfig.positionSize

async function initialize(indexerClient, tradingData) {
    console.log(
        "--------------------------------INDEXER CLIENT CONNECTED--------------------------------",
    )
    console.log(indexerClient)
    console.log(
        "--------------------------------TRADING DATA FETCHED--------------------------------",
    )
    console.log(tradingData)
    console.log("--------------------------------SOCKET CONNECTED--------------------------------")
    connectSocket()
}

async function main(tradingData) {
    const strategy = new ScalpingStrategy(logger, compositeClient)

    // Get perpetual markets
    async function getPerpetualMarkets(ticker) {
        try {
            const response = await indexerClient.markets.getPerpetualMarkets(ticker)
            return response.markets
        } catch (error) {
            console.log(error.message)
        }
    }

    const marketResponse = await getPerpetualMarkets(ticker)
    console.log("marketResponse", marketResponse)
    const marketData = marketResponse[ticker]

    const tickSize = parseFloat(marketData.tickSize)

    async function trade(tradingData) {
        try {
            const signal = await strategy.evaluatePosition(tradingData)
            const currentPrice = strategy.getCurrentPrice()

            if (signal === "LONG") {
                const price = currentPrice + tickSize
                const order = await placeOrder(price)
                console.log("Order placed successfully:", order)
            } else if (signal === "CLOSE_LONG") {
                const price = currentPrice - tickSize
                const order = await closeOrder(price)
                console.log("Order closed successfully:", order)
            }
        } catch (error) {
            console.error("Error executing trade:", error)
        }
    }

    // Run the trade function every 15 minutes
    setInterval(trade(tradingData), 1 * 60 * 1000)
}

initialize(indexerClient, tradingData)
    .then(() => {
        console.log("Candestickdata fetched successfully")
    })
    .catch((error) => {
        console.error("Error fetching candlestick data:", error)
    })

main(tradingData)
    .then(() => {
        console.log("Bot started successfully.")
    })
    .catch((error) => {
        console.error("Error starting bot:", error)
    })
