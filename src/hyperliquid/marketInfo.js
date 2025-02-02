const { Hyperliquid } = require("hyperliquid")
const fs = require("fs")
require("dotenv").config()

const privateKey = process.env.AGENT_PRIVATE_KEY_TEST
const address = process.env.AGENT_ADDRESS
const networkType = process.env.NETWORK_TYPE

let testnet = false
if (networkType === "testnet") {
    testnet = true
}

async function getCandles(symbol, interval, count) {
    const sdk = new Hyperliquid({
        enableWs: false,
        testnet: false,
    })

    // // try {
    // await sdk.connect()

    // Convert interval string to milliseconds
    const intervalToMs = {
        "1m": 60 * 1000,
        "3m": 3 * 60 * 1000,
        "5m": 5 * 60 * 1000,
        "10m": 10 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "30m": 30 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "4h": 4 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
    }

    const intervalMs = intervalToMs[interval]
    if (!intervalMs) {
        throw new Error(`Unsupported interval: ${interval}`)
    }

    // Calculate start and end times
    const endTime = Date.now()
    const startTime = endTime - count * intervalMs

    // Get candles
    const candles = await sdk.info.getCandleSnapshot(symbol, interval, startTime, endTime, true)

    console.log(`Retrieved ${candles.length} candles for ${symbol}`)
    console.log("last candle close", candles[candles.length - 1])

    // Ensure disconnect happens even if there's an error
    sdk.disconnect()

    return candles
}

async function getCurrentPrice(symbol) {
    const sdk = new Hyperliquid({
        enableWs: false,
        testnet: testnet,
    })

    try {
        await sdk.connect()
        const currentTime = new Date().getTime()
        const response = await sdk.info.getCandleSnapshot(
            symbol,
            "1m",
            currentTime,
            currentTime,
            true,
        )

        if (!response || !response[0] || !response[0].c) {
            throw new Error("Invalid price data received")
        }

        // Ensure we're working with a number
        const price = parseFloat(response[0].c)
        if (isNaN(price)) {
            throw new Error("Invalid price format received")
        }

        console.log(`Current ${symbol} price:`, price)
        return price
    } catch (error) {
        console.error("Error fetching current price:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function getUserOpenOrders() {
    const sdk = new Hyperliquid({
        enableWs: false,
        privateKey: process.env.AGENT_PRIVATE_KEY_TEST,
        address: process.env.PUBLIC_ADDRESS,
        testnet: false,
    })

    try {
        // Ensure the address is properly formatted
        if (!process.env.PUBLIC_ADDRESS || !process.env.PUBLIC_ADDRESS.startsWith("0x")) {
            throw new Error("Invalid address format in environment variables")
        }

        // Get user open orders with proper error handling
        const orders = await sdk.info.getUserOpenOrders(process.env.ADDRESS, false)

        // Validate the response
        if (!Array.isArray(orders)) {
            throw new Error("Invalid response format from API")
        }

        return orders
    } catch (error) {
        console.error("Error fetching open orders:", error)
        return [] // Return empty array on error
    }
}

async function main() {
    try {
        // const candles = await getCandles("BTC-PERP", "1m", 25)
        // console.log(candles)
        const price = await getCurrentPrice("BTC-PERP")
        console.log(price)
        // Force process exit after completion
        // process.exit(0)
    } catch (error) {
        console.error("Error fetching candles:", error)
        // process.exit(1)
    }
}
// // Only run main if this file is being run directly
if (require.main === module) {
    main()
}

module.exports = { getCandles, getCurrentPrice, getUserOpenOrders }

// interface Candle {
//     t: number; // open millis
//     T: number; // close millis
//     s: string; // coin
//     i: string; // interval
//     o: number; // open price
//     c: number; // close price
//     h: number; // high price
//     l: number; // low price
//     v: number; // volume (base unit)
//     n: number; // number of trades
//   }
