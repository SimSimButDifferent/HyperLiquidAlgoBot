const config = require("config")
const { shortEMA, longEMA } = require("./indicators/ema")

class ScalpingStrategy {
    constructor(logger) {
        this.logger = logger
        this.market = config.get("trading.market")
        this.timeframe = config.get("trading.timeframe")
        this.leverage = config.get("trading.leverage")
        this.positionSize = config.get("trading.positionSize")
    }

    async evaluatePosition(data) {
        try {
            const shortEmaValues = shortEMA(data)
            const longEmaValues = longEMA(data)

            const shortEma = shortEmaValues[shortEmaValues.length - 1]
            const longEma = longEmaValues[longEmaValues.length - 1]

            if (shortEma > longEma) {
                this.logger.info("Long entry conditions met", { shortEma, longEma })
                return "LONG"
            }

            if (shortEma < longEma) {
                this.logger.info("Close long conditions met", { shortEma, longEma })
                return "CLOSE_LONG"
            }

            return "NONE"
        } catch (error) {
            this.logger.error("Error evaluating position", { error })
            throw error
        }
    }
}

module.exports = ScalpingStrategy
