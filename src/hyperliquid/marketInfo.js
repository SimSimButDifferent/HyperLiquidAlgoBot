const { Hyperliquid } = require("hyperliquid")
const fs = require("fs")

async function getCandles(symbol, interval, count = 5000) {
    const sdk = new Hyperliquid({
        enableWs: false,
        privateKey: process.env.PRIVATE_KEY_TEST,
        testnet: false,
    })

    try {
        await sdk.connect()

        // Convert interval string to milliseconds
        const intervalToMs = {
            "1m": 60 * 1000,
            "5m": 5 * 60 * 1000,
            "15m": 15 * 60 * 1000,
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

        fs.mkdirSync(`./src/backtesting/data/${symbol}`, { recursive: true })
        fs.writeFileSync(
            `./src/backtesting/data/${symbol}/${symbol}-${interval}.json`,
            JSON.stringify(candles, null, 2),
        )

        console.log(`Retrieved ${candles.length} candles for ${symbol}`)

        return candles
    } finally {
        // Ensure disconnect happens even if there's an error
        sdk.disconnect()
    }
}

async function getCurrentPrice(symbol) {
    const sdk = new Hyperliquid({
        enableWs: false,
        privateKey: process.env.PRIVATE_KEY_TEST,
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

        const responseData = response[0]
        const price = responseData.c

        return Number(price)
    } finally {
        await sdk.disconnect()
    }
}

// // Example usage
// async function main() {
//     try {
//         const candles = await getCandles("BTC-PERP", "1m")
//         console.log(`First candle time: ${new Date(candles[0].t).toISOString()}`)
//         console.log(`Last candle time: ${new Date(candles[candles.length - 1].t).toISOString()}`)
//         console.log("Candles Length: ", candles.length)

//         // Optional: log full candle data if needed
//         // console.log(candles)
//     } catch (error) {
//         console.error("Error fetching candles:", error)
//         process.exit(1)
//     }
//     // Ensure the process exits after completion
//     process.exit(0)
// }
async function main() {
    try {
        const price = await getCurrentPrice("BTC-PERP")
        console.log(price)
    } catch (error) {
        console.error("Error fetching candles:", error)
        process.exit(1)
    }
}
// // Only run main if this file is being run directly
if (require.main === module) {
    main()
}

module.exports = { getCandles, getCurrentPrice }

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
