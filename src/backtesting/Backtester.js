const fs = require("fs")
const path = require("path")
const config = require("config")
const BBRSIStrategy = require("../strategy/BBRSIStrategy")
const winston = require("winston")

class Backtester {
    constructor() {
        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.Console({ level: "info" }),
                new winston.transports.File({
                    filename: "backtest_results.log",
                    level: "debug",
                }),
            ],
        })

        // Trading configuration from config file
        const tradingConfig = config.get("trading")
        this.symbol = tradingConfig.market // BTC-PERP
        this.leverage = tradingConfig.leverage // 20
        this.positionSize = tradingConfig.positionSize // 0.001
        this.timeframe = tradingConfig.timeframe // 15m
        this.profitTarget = tradingConfig.profitTarget // 1.5
        this.leverageMode = tradingConfig.leverageMode // isolated
        this.initialCapital = 1000 // Starting with $1000

        // Trading state
        this.equity = this.initialCapital
        this.position = null
        this.trades = []
        this.equity_curve = []
        this.takeProfitPrice = null

        // Performance metrics
        this.metrics = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfitLoss: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            longTrades: 0,
            shortTrades: 0,
            marginCalls: 0,
        }

        // Trading fees (0.1% per trade)
        this.tradingFee = 0.001

        // Replace direct strategy instantiation with createStrategy method call
        this.strategy = this.createStrategy()

        this.logger.info("Backtester initialized with parameters:", {
            symbol: this.symbol,
            leverage: this.leverage,
            positionSize: this.positionSize,
            timeframe: this.timeframe,
            profitTarget: this.profitTarget,
            leverageMode: this.leverageMode,
            initialCapital: this.initialCapital,
        })
    }

    // Add createStrategy method that can be overridden
    createStrategy() {
        return new BBRSIStrategy(this.logger)
    }

    async loadData() {
        const filePath = path.join(
            __dirname,
            "data",
            this.symbol,
            `${this.symbol}-${this.timeframe}.json`,
        )
        this.logger.info(`Loading data from ${filePath}`)

        try {
            const rawData = fs.readFileSync(filePath)
            this.data = JSON.parse(rawData)
            this.logger.info(`Loaded ${this.data.length} candles for ${this.symbol}`)
        } catch (error) {
            this.logger.error(`Failed to load data: ${error.message}`)
            throw error
        }
    }

    calculatePnL(entryPrice, exitPrice, isLong, size) {
        const direction = isLong ? 1 : -1
        const percentageChange = ((exitPrice - entryPrice) / entryPrice) * direction
        const grossPnL = this.equity * size * percentageChange * this.leverage
        const fees = this.equity * size * this.tradingFee * 2 // Entry and exit fees
        return grossPnL - fees
    }

    isLiquidated(currentPrice) {
        if (!this.position) return false

        // Using a more realistic approach to liquidation calculation
        // based on the percent change needed to liquidate at given leverage

        const entryPrice = this.position.entryPrice
        const isLong = this.position.type === "LONG"

        // Maintenance margin ratio for crypto typically 0.5%-1%
        const maintenanceMarginRatio = 0.005

        // Calculate liquidation price
        // For longs: liqPrice = entry * (1 - (1 / leverage) + maintenanceMarginRatio)
        // For shorts: liqPrice = entry * (1 + (1 / leverage) - maintenanceMarginRatio)

        let liquidationPrice
        if (isLong) {
            liquidationPrice = entryPrice * (1 - 1 / this.leverage + maintenanceMarginRatio)
            return currentPrice <= liquidationPrice
        } else {
            liquidationPrice = entryPrice * (1 + 1 / this.leverage - maintenanceMarginRatio)
            return currentPrice >= liquidationPrice
        }
    }

    checkTakeProfit(currentPrice) {
        if (!this.position || !this.takeProfitPrice) return false

        if (this.position.type === "LONG") {
            return currentPrice >= this.takeProfitPrice
        } else {
            return currentPrice <= this.takeProfitPrice
        }
    }

    async runBacktest() {
        await this.loadData()
        // Ensure enough lookback for indicators (especially Bollinger Bands which need 20 periods)
        let lookback = Math.max(50, config.get("indicators.bollinger.period") + 10)

        this.logger.info(`Starting backtest on ${this.symbol} with ${this.data.length} candles`)
        this.logger.info(`Using leverage: ${this.leverage}x, position size: ${this.positionSize}`)

        for (let i = lookback; i < this.data.length; i++) {
            const currentCandle = this.data[i]
            const currentPrice = parseFloat(currentCandle.c)

            // Check for take profit first
            if (this.position && this.checkTakeProfit(currentPrice)) {
                // Execute take profit
                const pnl = this.calculatePnL(
                    this.position.entryPrice,
                    this.takeProfitPrice, // Use take profit price, not current price
                    this.position.type === "LONG",
                    this.position.size,
                )

                this.equity += pnl
                this.metrics.totalProfitLoss += pnl
                this.metrics.totalTrades++

                if (pnl > 0) this.metrics.winningTrades++
                else this.metrics.losingTrades++

                this.trades.push({
                    type: this.position.type,
                    entry: this.position.entryPrice,
                    exit: this.takeProfitPrice,
                    pnl: pnl,
                    entryTime: this.position.entryTime,
                    exitTime: currentCandle.t,
                    exitReason: "TAKE_PROFIT",
                })

                this.logger.info(`Take profit executed for ${this.position.type}`, {
                    entry: this.position.entryPrice,
                    exit: this.takeProfitPrice,
                    pnl: pnl,
                })

                this.position = null
                this.takeProfitPrice = null
            }

            // Check for liquidation
            if (this.position && this.isLiquidated(currentPrice)) {
                // In a real liquidation, you lose your entire margin amount
                const marginAmount = (this.position.size * this.equity) / this.leverage
                const pnl = -1 * marginAmount // Complete loss of margin

                this.equity += pnl

                this.metrics.marginCalls++
                this.metrics.totalTrades++
                this.metrics.losingTrades++
                this.metrics.totalProfitLoss += pnl

                this.trades.push({
                    type: this.position.type,
                    entry: this.position.entryPrice,
                    exit: currentPrice,
                    pnl: pnl,
                    entryTime: this.position.entryTime,
                    exitTime: currentCandle.t,
                    exitReason: "LIQUIDATION",
                })

                this.logger.info("Position Liquidated", {
                    price: currentPrice,
                    entry: this.position.entryPrice,
                    type: this.position.type,
                    equity: this.equity,
                })

                this.position = null
                this.takeProfitPrice = null

                // Don't break from the loop, allow backtesting to continue with remaining equity
            }

            // Get strategy signal
            const lookbackData = this.data.slice(i - lookback, i + 1)
            const signalResult = await this.strategy.evaluatePosition(lookbackData)

            // Log indicator details for debugging - only if there's a signal
            if (signalResult.signal !== "NONE") {
                this.logger.debug("Signal generated:", {
                    time: new Date(currentCandle.t).toISOString(),
                    price: currentPrice,
                    signal: signalResult.signal,
                    rsi: signalResult.indicators.rsi,
                    adx: signalResult.indicators.adx,
                    bb: signalResult.indicators.bb,
                })
            }

            // Handle position entry/exit
            if (signalResult.signal === "LONG" && !this.position) {
                this.position = {
                    type: "LONG",
                    entryPrice: currentPrice,
                    size: this.positionSize,
                    entryTime: currentCandle.t,
                }
                this.takeProfitPrice = signalResult.takeProfit
                this.metrics.longTrades++
                this.logger.info("Entered Long Position", {
                    price: currentPrice,
                    takeProfitPrice: this.takeProfitPrice,
                    equity: this.equity,
                })
            } else if (signalResult.signal === "SHORT" && !this.position) {
                this.position = {
                    type: "SHORT",
                    entryPrice: currentPrice,
                    size: this.positionSize,
                    entryTime: currentCandle.t,
                }
                this.takeProfitPrice = signalResult.takeProfit
                this.metrics.shortTrades++
                this.logger.info("Entered Short Position", {
                    price: currentPrice,
                    takeProfitPrice: this.takeProfitPrice,
                    equity: this.equity,
                })
            } else if (
                (signalResult.signal === "CLOSE_LONG" && this.position?.type === "LONG") ||
                (signalResult.signal === "CLOSE_SHORT" && this.position?.type === "SHORT")
            ) {
                if (this.position) {
                    const pnl = this.calculatePnL(
                        this.position.entryPrice,
                        currentPrice,
                        this.position.type === "LONG",
                        this.position.size,
                    )

                    this.equity += pnl
                    this.metrics.totalProfitLoss += pnl
                    this.metrics.totalTrades++

                    if (pnl > 0) this.metrics.winningTrades++
                    else this.metrics.losingTrades++

                    this.trades.push({
                        type: this.position.type,
                        entry: this.position.entryPrice,
                        exit: currentPrice,
                        pnl: pnl,
                        entryTime: this.position.entryTime,
                        exitTime: currentCandle.t,
                        exitReason: "SIGNAL",
                    })

                    this.logger.info(`Closed ${this.position.type} position on signal`, {
                        entry: this.position.entryPrice,
                        exit: currentPrice,
                        pnl: pnl,
                    })

                    this.position = null
                    this.takeProfitPrice = null
                }
            }

            // Record equity curve
            this.equity_curve.push({
                time: currentCandle.t,
                equity: this.equity,
                hasPosition: this.position !== null,
                positionType: this.position?.type || null,
                price: currentPrice,
            })
        }

        this.calculateMetrics()
        this.generateReport()
    }

    calculateMetrics() {
        // Calculate Sharpe Ratio
        if (this.trades.length > 0) {
            const returns = this.trades.map((t) => t.pnl / this.initialCapital)
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
            const stdDev = Math.sqrt(
                returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length,
            )
            // Prevent division by zero
            this.metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0 // Annualized
        }

        // Calculate Max Drawdown
        let peak = this.initialCapital
        let maxDrawdown = 0

        this.equity_curve.forEach((point) => {
            if (point.equity > peak) peak = point.equity
            const drawdown = (peak - point.equity) / peak
            if (drawdown > maxDrawdown) maxDrawdown = drawdown
        })

        this.metrics.maxDrawdown = maxDrawdown
    }

    generateReport() {
        // Prevent division by zero
        const winRate =
            this.metrics.totalTrades > 0
                ? (this.metrics.winningTrades / this.metrics.totalTrades) * 100
                : 0

        const profitFactor =
            this.metrics.losingTrades > 0
                ? this.metrics.winningTrades / this.metrics.losingTrades
                : 0

        const report = {
            "--- TRADE ANALYSIS ---": {
                "Net Profit": `$${this.metrics.totalProfitLoss.toFixed(2)}`,
                "Max Drawdown": `${(this.metrics.maxDrawdown * 100).toFixed(2)}%`,
                "Total Trades": this.metrics.totalTrades,
                "Win Rate": `${winRate.toFixed(2)}%`,
                "Profit Factor": profitFactor.toFixed(2),
                "Final Equity": `$${this.equity.toFixed(2)}`,
            },
            "--- RISK/PERFORMANCE RATIOS ---": {
                "Long/Short Ratio": `${this.metrics.longTrades}/${this.metrics.shortTrades}`,
                "Sharpe Ratio": this.metrics.sharpeRatio.toFixed(2),
                "Margin Calls": this.metrics.marginCalls,
            },
        }

        // Log to console and file
        this.logger.info("Backtest Results:", report)

        // Save detailed trade history
        fs.writeFileSync("backtest_trades.json", JSON.stringify(this.trades, null, 2))

        // Save equity curve
        fs.writeFileSync("equity_curve.json", JSON.stringify(this.equity_curve, null, 2))

        // Create more detailed trade statistics
        const tradeStats = this.analyzeTradeStatistics()
        fs.writeFileSync("trade_statistics.json", JSON.stringify(tradeStats, null, 2))

        this.logger.info("Trade Statistics:", tradeStats)
    }

    analyzeTradeStatistics() {
        const stats = {
            totalTrades: this.metrics.totalTrades,
            profitableTrades: this.metrics.winningTrades,
            losingTrades: this.metrics.losingTrades,
            winRate:
                this.metrics.totalTrades > 0
                    ? this.metrics.winningTrades / this.metrics.totalTrades
                    : 0,
            averageProfitPerTrade: 0,
            averageWin: 0,
            averageLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            profitByExitReason: {
                SIGNAL: 0,
                TAKE_PROFIT: 0,
                LIQUIDATION: 0,
            },
            tradesByExitReason: {
                SIGNAL: 0,
                TAKE_PROFIT: 0,
                LIQUIDATION: 0,
            },
        }

        if (this.trades.length === 0) return stats

        // Calculate average profit/loss and other metrics
        let totalProfit = 0
        let totalWinProfit = 0
        let totalLossProfit = 0
        let winCount = 0
        let lossCount = 0

        this.trades.forEach((trade) => {
            totalProfit += trade.pnl

            // Count by exit reason
            if (trade.exitReason) {
                stats.tradesByExitReason[trade.exitReason] =
                    (stats.tradesByExitReason[trade.exitReason] || 0) + 1
                stats.profitByExitReason[trade.exitReason] =
                    (stats.profitByExitReason[trade.exitReason] || 0) + trade.pnl
            }

            if (trade.pnl > 0) {
                winCount++
                totalWinProfit += trade.pnl
                if (trade.pnl > stats.largestWin) stats.largestWin = trade.pnl
            } else {
                lossCount++
                totalLossProfit += trade.pnl
                if (trade.pnl < stats.largestLoss) stats.largestLoss = trade.pnl
            }
        })

        stats.averageProfitPerTrade = totalProfit / this.trades.length
        stats.averageWin = winCount > 0 ? totalWinProfit / winCount : 0
        stats.averageLoss = lossCount > 0 ? totalLossProfit / lossCount : 0

        return stats
    }
}

module.exports = Backtester
