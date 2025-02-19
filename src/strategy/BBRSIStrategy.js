const config = require("config")
const { calculateBollingerBands, calculateADX, calculateRSI } = require("./indicators")

class BBRSIStrategy {
    constructor(logger) {
        this.logger = logger
        this.market = config.get("trading.market")
        this.timeframe = config.get("trading.timeframe")
        this.profitTarget = config.get("trading.profitTarget")

        // Indicator settings
        const indicators = config.get("indicators")
        this.rsiPeriod = indicators.rsi.period
        this.rsiOverbought = indicators.rsi.overbought
        this.rsiOversold = indicators.rsi.oversold
        this.bbPeriod = indicators.bollinger.period
        this.bbStdDev = indicators.bollinger.stdDev
        this.adxPeriod = indicators.adx.period
        this.adxThreshold = indicators.adx.threshold
    }

    async evaluatePosition(data) {
        try {
            const bb = calculateBollingerBands(data, this.bbPeriod, this.bbStdDev)
            const adx = calculateADX(data, this.adxPeriod)
            const rsi = calculateRSI(data, this.rsiPeriod)

            const currentPrice = parseFloat(data[data.length - 1].close)
            const previousPrice = parseFloat(data[data.length - 2].close)

            const currentADX = adx[0]
            const currentRSI = rsi[0]

            // Long Entry Conditions
            const crossedBelowLower = previousPrice >= bb.lower && currentPrice < bb.lower
            const longConditions =
                crossedBelowLower &&
                currentRSI < this.rsiOversold &&
                currentADX >= this.adxThreshold

            // Short Entry Conditions
            const crossedAboveUpper = previousPrice <= bb.upper && currentPrice > bb.upper
            const shortConditions =
                crossedAboveUpper &&
                currentRSI > this.rsiOverbought &&
                currentADX >= this.adxThreshold

            // Exit Conditions
            const crossedUnderMiddle = previousPrice >= bb.middle && currentPrice < bb.middle
            const crossedUnderLower = previousPrice >= bb.lower && currentPrice < bb.lower

            if (longConditions) {
                const entryPrice = currentPrice
                const takeProfitPrice = entryPrice * (1 + this.profitTarget / 100)
                return {
                    signal: "LONG",
                    takeProfit: takeProfitPrice,
                }
            }

            if (shortConditions) {
                const entryPrice = currentPrice
                const takeProfitPrice = entryPrice * (1 - this.profitTarget / 100)
                return {
                    signal: "SHORT",
                    takeProfit: takeProfitPrice,
                }
            }

            if (currentRSI > this.rsiOverbought || crossedUnderMiddle) {
                return { signal: "CLOSE_LONG" }
            }

            if (currentRSI < this.rsiOversold || crossedUnderLower) {
                return { signal: "CLOSE_SHORT" }
            }

            return { signal: "NONE" }
        } catch (error) {
            this.logger.error("Error evaluating position", { error: error.message })
            throw error
        }
    }
}

module.exports = BBRSIStrategy
