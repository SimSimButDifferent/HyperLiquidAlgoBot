const { Hyperliquid } = require("hyperliquid")

async function getCandles(symbol, interval, count = 5000) {
    const sdk = new Hyperliquid({
        enableWs: false,
        privateKey: process.env.PRIVATE_KEY_TEST,
        testnet: true,
    })

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

    console.log(`Retrieved ${candles.length} candles for ${symbol}`)

    await sdk.disconnect()

    return candles
}

// Example usage
async function main() {
    try {
        const candles = await getCandles("BTC-PERP", "1m")
        console.log(`First candle time: ${new Date(candles[0].t).toISOString()}`)
        console.log(`Last candle time: ${new Date(candles[candles.length - 1].t).toISOString()}`)
        console.log(candles)
        console.log("Candles Length: ", candles.length)
    } catch (error) {
        console.error("Error fetching candles:", error)
    }
}

main()

module.exports = { getCandles }

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
