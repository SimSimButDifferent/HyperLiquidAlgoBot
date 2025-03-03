const config = require("config")
const { calculateBollingerBands, calculateADX, calculateRSI } = require("./indicators")

class BBRSIStrategy {
    constructor(logger) {
        this.logger = logger
        this.market = config.get("trading.market")
        this.timeframe = config.get("trading.timeframe")
        this.profitTarget = config.get("trading.profitTarget")

        // Indicator settings from config
        const indicators = config.get("indicators")
        this.rsiPeriod = indicators.rsi.period // 14
        this.rsiOverbought = indicators.rsi.overbought // 75
        this.rsiOversold = indicators.rsi.oversold // 25
        this.bbPeriod = indicators.bollinger.period // 20
        this.bbStdDev = indicators.bollinger.stdDev // 2
        this.adxPeriod = indicators.adx.period // 14
        this.adxThreshold = indicators.adx.threshold // 25

        this.logger.info("Strategy initialized with parameters:", {
            market: this.market,
            timeframe: this.timeframe,
            profitTarget: this.profitTarget,
            rsi: {
                period: this.rsiPeriod,
                overbought: this.rsiOverbought,
                oversold: this.rsiOversold,
            },
            bollinger: { period: this.bbPeriod, stdDev: this.bbStdDev },
            adx: { period: this.adxPeriod, threshold: this.adxThreshold },
        })
    }

    async evaluatePosition(data) {
        try {
            // Calculate indicators
            const bb = calculateBollingerBands(data, this.bbPeriod, this.bbStdDev)
            const adx = calculateADX(data, this.adxPeriod)
            const rsi = calculateRSI(data, this.rsiPeriod)

            const currentPrice = parseFloat(data[data.length - 1].c)
            const previousPrice = parseFloat(data[data.length - 2].c)

            // Entry conditions matching Pine Script logic

            // Long Entry Conditions - ta.crossunder(close, lower)
            // 1. Price crosses below the lower Bollinger Band.
            // 2. RSI is below the oversold level.
            // 3. ADX is above the threshold.
            const crossedBelowLower = previousPrice >= bb.lower && currentPrice < bb.lower
            const longConditions =
                crossedBelowLower && rsi < this.rsiOversold && adx >= this.adxThreshold

            // Short Entry Conditions - ta.crossover(close, upper)
            // 1. Price crosses above the upper Bollinger Band.
            // 2. RSI is above the overbought level.
            // 3. ADX is above the threshold.
            const crossedAboveUpper = previousPrice <= bb.upper && currentPrice > bb.upper
            const shortConditions =
                crossedAboveUpper && rsi > this.rsiOverbought && adx >= this.adxThreshold

            // Exit Conditions matching Pine Script logic

            // Exit Long conditions - ta.crossunder(close, basis)
            // 1. Price crosses under the middle band (basis) OR
            // 2. RSI goes above 80 (using 80 instead of rsiOverbought for exit as per Pine Script)
            const crossedUnderMiddle = previousPrice >= bb.middle && currentPrice < bb.middle
            const rsiExitLong = rsi > 80

            // Exit Short conditions
            // 1. Price crosses under the lower band OR
            // 2. RSI goes below 20 (using 20 instead of rsiOversold for exit as per Pine Script)
            const crossedUnderLower = previousPrice >= bb.lower && currentPrice < bb.lower
            const rsiExitShort = rsi < 20

            // Prepare result with all indicator values
            const result = {
                signal: "NONE",
                indicators: {
                    bb: {
                        upper: bb.upper,
                        middle: bb.middle,
                        lower: bb.lower,
                    },
                    rsi: rsi,
                    adx: adx,
                    price: currentPrice,
                },
            }

            // Set appropriate signal based on conditions
            if (longConditions) {
                result.signal = "LONG"
                result.takeProfit = currentPrice * (1 + this.profitTarget / 100)
                this.logger.debug("Long signal generated", {
                    price: currentPrice,
                    rsi: rsi,
                    rsiThreshold: this.rsiOversold,
                    lowerBand: bb.lower,
                    adx: adx,
                    adxThreshold: this.adxThreshold,
                    takeProfit: result.takeProfit,
                })
            } else if (shortConditions) {
                result.signal = "SHORT"
                result.takeProfit = currentPrice * (1 - this.profitTarget / 100)
                this.logger.debug("Short signal generated", {
                    price: currentPrice,
                    rsi: rsi,
                    rsiThreshold: this.rsiOverbought,
                    upperBand: bb.upper,
                    adx: adx,
                    adxThreshold: this.adxThreshold,
                    takeProfit: result.takeProfit,
                })
            } else if ((crossedUnderMiddle || rsiExitLong) && currentPrice > 0) {
                result.signal = "CLOSE_LONG"
                this.logger.debug("Close long signal generated", {
                    price: currentPrice,
                    rsi: rsi,
                    middleBand: bb.middle,
                    crossedMiddle: crossedUnderMiddle,
                    rsiExitTriggered: rsiExitLong,
                })
            } else if ((crossedUnderLower || rsiExitShort) && currentPrice > 0) {
                result.signal = "CLOSE_SHORT"
                this.logger.debug("Close short signal generated", {
                    price: currentPrice,
                    rsi: rsi,
                    lowerBand: bb.lower,
                    crossedLower: crossedUnderLower,
                    rsiExitTriggered: rsiExitShort,
                })
            }

            return result
        } catch (error) {
            this.logger.error("Error evaluating position", { error: error.message })
            throw error
        }
    }
}

module.exports = BBRSIStrategy
