const { Hyperliquid } = require("hyperliquid")
const fs = require("fs")
require("dotenv").config()
const axios = require("axios")

const privateKey = process.env.AGENT_PRIVATE_KEY_TEST
const address = process.env.PUBLIC_ADDRESS
const agentAddress = process.env.AGENT_ADDRESS
const networkType = process.env.NETWORK_TYPE

async function getCandles(symbol, interval, count) {
    const sdk = new Hyperliquid({
        enableWs: false,
        testnet: false,
    })

    try {
        await sdk.connect()

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
        console.log(
            "last candle close:",
            candles[candles.length - 1].c,
            "at",
            new Date(candles[candles.length - 1].T).toISOString(),
        )

        return candles
    } catch (error) {
        console.error("Error fetching candles:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function getCurrentPrice(symbol) {
    const sdk = new Hyperliquid({
        enableWs: false,
        testnet: false,
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

async function getUserOpenPositions() {
    const sdk = new Hyperliquid({
        enableWs: false,
        privateKey: privateKey,
        testnet: true,
    })

    let retries = 3
    let delay = 1000 // 1 second initial delay

    while (retries > 0) {
        try {
            await sdk.connect()

            const userState = await sdk.info.perpetuals.getClearinghouseState(address)

            // Add null check for userState
            if (!userState) {
                throw new Error("Received null userState from API")
            }

            const activePositions = userState.assetPositions || []

            if (activePositions.length > 0) {
                console.log("Active position Open")
                return activePositions
            } else {
                console.log("No active positions")
                return []
            }
        } catch (error) {
            console.error(`Error fetching positions (${retries} retries left):`, error)
            retries--

            if (retries === 0) {
                throw new Error(
                    `Failed to fetch positions after multiple attempts: ${error.message}`,
                )
            }

            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, delay))
            delay *= 2 // Double the delay for next retry
        } finally {
            try {
                sdk.disconnect()
            } catch (error) {
                console.error("Error disconnecting SDK:", error)
            }
        }
    }
}

async function getUserOpenOrders() {
    try {
        const sdk = new Hyperliquid({
            enableWs: false,
            privateKey: privateKey,
            testnet: true,
        })

        await sdk.connect()

        const orders = await sdk.info.getUserOpenOrders(address)

        return orders
    } catch (error) {
        console.error("API Connection Error:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        })
    }
    throw new Error(`Failed to fetch orders: ${error.message}`)
}

// Add this helper function to test the connection separately
async function testConnection() {
    try {
        // const orders = await getUserOpenOrders()
        // console.log("Open orders:", orders)
        // console.log("-----------------------------------------------")
        const openpositions = await getUserOpenPositions()
        console.log("Open positions:", openpositions)
        console.log("-----------------------------------------------")

        // return orders
    } catch (error) {
        console.error("API Connection Test Failed:", {
            error: error.message,
        })
    }
}
// testConnection()
//     .then(() => {
//         console.log("Connection test complete")
//     })
//     .catch((error) => {
//         console.error("API Connection Test Failed:", {
//             error: error.message,
//         })
//     })

module.exports = {
    getCandles,
    getCurrentPrice,
    getUserOpenOrders,
    getUserOpenPositions,
}

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

// // // You can test it like this:
// testConnection()
//     .then(() => {
//         console.log("Connection test complete")
//     })
//     .catch(console.error)
