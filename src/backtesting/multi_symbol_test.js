const Backtester = require("./Backtester")
const fs = require("fs")
const path = require("path")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")

class MultiSymbolTester {
    constructor(options = {}) {
        this.markets = options.markets || []
        this.timeframe = options.timeframe || "15m"
        this.leverage = options.leverage || 5
        this.positionSize = options.positionSize || 0.1
        this.profitTarget = options.profitTarget || 1.5
        this.initialCapital = options.initialCapital || 10000
        this.tradingFee = options.tradingFee || 0.001
        this.startDate = options.startDate || null
        this.endDate = options.endDate || null
        this.strategyParams = options.strategyParams || {}

        this.results = []
        this.combinedEquityCurve = []
        this.combinedMetrics = {
            totalProfitLoss: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            marketsCovered: 0,
        }
    }

    /**
     * Add a market to test
     * @param {string} market - Market symbol
     */
    addMarket(market) {
        if (!this.markets.includes(market)) {
            this.markets.push(market)
        }
    }

    /**
     * Set multiple markets to test
     * @param {Array<string>} markets - Array of market symbols
     */
    setMarkets(markets) {
        this.markets = [...markets]
    }

    /**
     * Run backtests on all specified markets
     */
    async runAllBacktests() {
        if (this.markets.length === 0) {
            throw new Error("No markets specified. Add markets before running tests.")
        }

        console.log(`Starting multi-symbol backtest on ${this.markets.length} markets`)
        console.log(
            `Timeframe: ${this.timeframe}, Leverage: ${this.leverage}, Position Size: ${this.positionSize}, Profit Target: ${this.profitTarget}`,
        )

        // Create output directory
        const outputDir = path.join(process.cwd(), "multi_symbol_results")
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir)
        }

        let overallEquity = this.initialCapital
        this.results = []

        // Initialize the combined equity curve with the initial capital
        this.combinedEquityCurve = []
        const firstTimestamp = new Date().getTime()
        this.combinedEquityCurve.push({
            timestamp: firstTimestamp,
            equity: overallEquity,
            drawdown: 0,
            trade: null,
        })

        // Track the combined performance metrics
        let combinedWinningTrades = 0
        let combinedLosingTrades = 0
        let combinedTotalTrades = 0
        let combinedProfitLoss = 0
        let combinedTotalWin = 0
        let combinedTotalLoss = 0
        let combinedLargestWin = 0
        let combinedLargestLoss = 0
        let allReturns = []

        for (let i = 0; i < this.markets.length; i++) {
            const market = this.markets[i]
            console.log(`\nTesting market ${i + 1}/${this.markets.length}: ${market}`)

            try {
                // Create backtester for this market
                const backtester = new Backtester({
                    market,
                    timeframe: this.timeframe,
                    leverage: this.leverage,
                    positionSize: this.positionSize,
                    profitTarget: this.profitTarget,
                    initialCapital: this.initialCapital,
                    tradingFee: this.tradingFee,
                })

                // Apply any strategy parameters
                if (Object.keys(this.strategyParams).length > 0) {
                    Object.assign(backtester.strategyParams, this.strategyParams)
                }

                // Set date range if specified
                if (this.startDate) {
                    backtester.startDate = this.startDate
                }
                if (this.endDate) {
                    backtester.endDate = this.endDate
                }

                // Run the backtest
                await backtester.runBacktest()

                // Get results
                const marketResult = {
                    market,
                    metrics: backtester.metrics,
                    finalEquity: backtester.equity,
                    equityCurve: backtester.equityCurve,
                    trades: backtester.trades,
                }

                // Add to overall results
                this.results.push(marketResult)

                // Update combined metrics
                combinedWinningTrades += backtester.metrics.winningTrades
                combinedLosingTrades += backtester.metrics.losingTrades
                combinedTotalTrades += backtester.metrics.totalTrades
                combinedProfitLoss += backtester.metrics.totalProfitLoss

                // Track combined win/loss metrics
                combinedTotalWin += backtester.metrics.winningTrades * backtester.metrics.averageWin
                combinedTotalLoss +=
                    backtester.metrics.losingTrades * Math.abs(backtester.metrics.averageLoss)

                if (backtester.metrics.largestWin > combinedLargestWin) {
                    combinedLargestWin = backtester.metrics.largestWin
                }

                if (Math.abs(backtester.metrics.largestLoss) > combinedLargestLoss) {
                    combinedLargestLoss = Math.abs(backtester.metrics.largestLoss)
                }

                // Add daily returns to combined returns
                allReturns = allReturns.concat(backtester.dailyReturns || [])

                // Update combined equity curve
                this.mergeCurves(backtester.equityCurve)

                // Generate market-specific reports
                this.generateMarketReport(market, marketResult, outputDir)

                console.log(`Market ${market} test complete: `)
                console.log(`  Profit/Loss: $${backtester.metrics.totalProfitLoss.toFixed(2)}`)
                console.log(`  Win Rate: ${(backtester.metrics.winRate * 100).toFixed(2)}%`)
                console.log(`  Max Drawdown: ${(backtester.metrics.maxDrawdown * 100).toFixed(2)}%`)
                console.log(`  Trades: ${backtester.metrics.totalTrades}`)
            } catch (error) {
                console.error(`Error testing market ${market}: ${error.message}`)
            }
        }

        // Calculate combined metrics
        const successfulMarkets = this.results.length
        this.combinedMetrics = {
            totalProfitLoss: combinedProfitLoss,
            winningTrades: combinedWinningTrades,
            losingTrades: combinedLosingTrades,
            totalTrades: combinedTotalTrades,
            winRate: combinedTotalTrades > 0 ? combinedWinningTrades / combinedTotalTrades : 0,
            averageWin: combinedWinningTrades > 0 ? combinedTotalWin / combinedWinningTrades : 0,
            averageLoss: combinedLosingTrades > 0 ? -combinedTotalLoss / combinedLosingTrades : 0,
            largestWin: combinedLargestWin,
            largestLoss: -combinedLargestLoss,
            profitFactor:
                combinedTotalLoss > 0
                    ? combinedTotalWin / combinedTotalLoss
                    : combinedTotalWin > 0
                      ? Infinity
                      : 0,
            maxDrawdown: this.calculateMaxDrawdown(this.combinedEquityCurve),
            sharpeRatio: this.calculateSharpeRatio(allReturns),
            marketsCovered: successfulMarkets,
        }

        // Save combined equity curve
        fs.writeFileSync(
            path.join(outputDir, "combined_equity_curve.json"),
            JSON.stringify(this.combinedEquityCurve, null, 2),
        )

        // Save combined metrics
        fs.writeFileSync(
            path.join(outputDir, "combined_metrics.json"),
            JSON.stringify(this.combinedMetrics, null, 2),
        )

        // Save all results
        fs.writeFileSync(
            path.join(outputDir, "all_results.json"),
            JSON.stringify(this.results, null, 2),
        )

        // Generate summary report
        this.generateSummaryReport(outputDir)

        console.log("\n--- Multi-Symbol Backtest Complete ---")
        console.log(
            `Tested ${successfulMarkets} out of ${this.markets.length} markets successfully`,
        )
        console.log(`Combined Profit/Loss: $${this.combinedMetrics.totalProfitLoss.toFixed(2)}`)
        console.log(`Combined Win Rate: ${(this.combinedMetrics.winRate * 100).toFixed(2)}%`)
        console.log(
            `Combined Max Drawdown: ${(this.combinedMetrics.maxDrawdown * 100).toFixed(2)}%`,
        )
        console.log(`Total Trades: ${this.combinedMetrics.totalTrades}`)
        console.log(`Sharpe Ratio: ${this.combinedMetrics.sharpeRatio.toFixed(2)}`)
        console.log(`Results saved to ${outputDir}`)

        return {
            results: this.results,
            combinedMetrics: this.combinedMetrics,
            combinedEquityCurve: this.combinedEquityCurve,
        }
    }

    /**
     * Merge a market equity curve into the combined curve
     * @param {Array} marketCurve - The market equity curve to merge
     */
    mergeCurves(marketCurve) {
        if (!marketCurve || marketCurve.length === 0) return

        // Create a map of the existing timestamps in combined curve
        const combinedMap = new Map()
        this.combinedEquityCurve.forEach((point) => {
            combinedMap.set(point.timestamp, point)
        })

        // Process each point in the market curve
        marketCurve.forEach((marketPoint) => {
            const timestamp = marketPoint.timestamp

            if (combinedMap.has(timestamp)) {
                // If this timestamp exists, update the equity
                const combinedPoint = combinedMap.get(timestamp)

                // If this point has a trade, add its PnL to the combined equity
                if (marketPoint.trade) {
                    combinedPoint.equity += marketPoint.trade.pnl || 0
                    combinedPoint.trade = marketPoint.trade // Store the latest trade
                }

                // Update drawdown calculation later
            } else {
                // If this timestamp doesn't exist yet, add it to the combined curve
                // but use the latest equity from the combined curve as a base
                const latestEquity =
                    this.combinedEquityCurve[this.combinedEquityCurve.length - 1].equity

                const newPoint = {
                    timestamp,
                    equity: latestEquity,
                    drawdown: 0,
                    trade: marketPoint.trade,
                }

                // If this point has a trade, add its PnL
                if (marketPoint.trade) {
                    newPoint.equity += marketPoint.trade.pnl || 0
                }

                this.combinedEquityCurve.push(newPoint)
                combinedMap.set(timestamp, newPoint)
            }
        })

        // Sort combined curve by timestamp
        this.combinedEquityCurve.sort((a, b) => a.timestamp - b.timestamp)

        // Recalculate drawdowns for the entire curve
        this.recalculateDrawdowns()
    }

    /**
     * Recalculate drawdowns for the entire equity curve
     */
    recalculateDrawdowns() {
        let peak = this.initialCapital

        for (let i = 0; i < this.combinedEquityCurve.length; i++) {
            const point = this.combinedEquityCurve[i]

            // Update peak if we have a new high
            if (point.equity > peak) {
                peak = point.equity
            }

            // Calculate drawdown as a percentage from peak
            const drawdown = peak > 0 ? (peak - point.equity) / peak : 0
            point.drawdown = drawdown
        }
    }

    /**
     * Calculate maximum drawdown from equity curve
     * @param {Array} equityCurve - The equity curve
     * @returns {number} Maximum drawdown as a decimal
     */
    calculateMaxDrawdown(equityCurve) {
        if (!equityCurve || equityCurve.length === 0) return 0

        let maxDrawdown = 0
        for (const point of equityCurve) {
            if (point.drawdown > maxDrawdown) {
                maxDrawdown = point.drawdown
            }
        }

        return maxDrawdown
    }

    /**
     * Calculate Sharpe Ratio from array of returns
     * @param {Array} returns - Array of daily returns
     * @returns {number} Sharpe Ratio
     */
    calculateSharpeRatio(returns) {
        if (!returns || returns.length === 0) return 0

        // Calculate average return
        const avgReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length

        // Calculate standard deviation
        const variance =
            returns.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / returns.length
        const stdDev = Math.sqrt(variance)

        // Annualized Sharpe Ratio (assuming daily returns)
        const annualizedReturn = avgReturn * 252 // 252 trading days in a year
        const annualizedStdDev = stdDev * Math.sqrt(252)

        return annualizedStdDev > 0 ? annualizedReturn / annualizedStdDev : 0
    }

    /**
     * Generate a summary report for all markets
     * @param {string} outputDir - Directory to save the report
     */
    generateSummaryReport(outputDir) {
        // Sort results by profit/loss
        const sortedResults = [...this.results].sort(
            (a, b) => b.metrics.totalProfitLoss - a.metrics.totalProfitLoss,
        )

        // Create rows for each market
        const marketRows = sortedResults
            .map((result, index) => {
                const metrics = result.metrics

                return `
            <tr>
                <td>${index + 1}</td>
                <td>${result.market}</td>
                <td class="${metrics.totalProfitLoss >= 0 ? "positive" : "negative"}">
                    $${metrics.totalProfitLoss.toFixed(2)}
                </td>
                <td>${metrics.totalTrades}</td>
                <td>${(metrics.winRate * 100).toFixed(2)}%</td>
                <td>${metrics.profitFactor.toFixed(2)}</td>
                <td>${(metrics.maxDrawdown * 100).toFixed(2)}%</td>
                <td>${metrics.sharpeRatio.toFixed(2)}</td>
                <td>
                    <a href="market_${result.market.replace("-", "_")}.html">Details</a>
                </td>
            </tr>
            `
            })
            .join("")

        // Create HTML report
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Multi-Symbol Backtest Results</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                tr:hover { background-color: #ddd; }
                .positive { color: green; }
                .negative { color: red; }
                .metric-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 10px; flex: 1; min-width: 200px; }
                .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .metric-label { font-size: 14px; color: #666; }
                .metrics-container { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <h1>Multi-Symbol Backtest Results</h1>
            
            <div class="metrics-container">
                <div class="metric-box">
                    <div class="metric-label">Markets Tested</div>
                    <div class="metric-value">${this.combinedMetrics.marketsCovered}/${this.markets.length}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Total Net Profit</div>
                    <div class="metric-value" style="color: ${this.combinedMetrics.totalProfitLoss >= 0 ? "green" : "red"}">
                        $${this.combinedMetrics.totalProfitLoss.toFixed(2)}
                    </div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Total Trades</div>
                    <div class="metric-value">${this.combinedMetrics.totalTrades}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Win Rate</div>
                    <div class="metric-value">${(this.combinedMetrics.winRate * 100).toFixed(2)}%</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Max Drawdown</div>
                    <div class="metric-value">${(this.combinedMetrics.maxDrawdown * 100).toFixed(2)}%</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Sharpe Ratio</div>
                    <div class="metric-value">${this.combinedMetrics.sharpeRatio.toFixed(2)}</div>
                </div>
            </div>
            
            <h2>Markets Performance</h2>
            <table>
                <tr>
                    <th>#</th>
                    <th>Market</th>
                    <th>Net Profit</th>
                    <th>Trades</th>
                    <th>Win Rate</th>
                    <th>Profit Factor</th>
                    <th>Max Drawdown</th>
                    <th>Sharpe Ratio</th>
                    <th>Details</th>
                </tr>
                ${marketRows}
            </table>
            
            <p>
                <a href="combined_equity_curve.json" target="_blank">Download Combined Equity Curve</a> | 
                <a href="combined_metrics.json" target="_blank">Download Combined Metrics</a> | 
                <a href="all_results.json" target="_blank">Download All Results</a>
            </p>
        </body>
        </html>
        `

        // Write to file
        fs.writeFileSync(path.join(outputDir, "multi_symbol_report.html"), html)
    }

    /**
     * Generate a report for a specific market
     * @param {string} market - Market symbol
     * @param {Object} result - Market result
     * @param {string} outputDir - Directory to save the report
     */
    generateMarketReport(market, result, outputDir) {
        const metrics = result.metrics
        const trades = result.trades

        // Format trade rows
        const tradeRows = trades
            .map((trade, index) => {
                const entryDate = new Date(trade.entryTime).toLocaleString()
                const exitDate = trade.exitTime ? new Date(trade.exitTime).toLocaleString() : "Open"

                return `
            <tr>
                <td>${index + 1}</td>
                <td>${trade.direction}</td>
                <td>${entryDate}</td>
                <td>${exitDate}</td>
                <td>${trade.entryPrice.toFixed(2)}</td>
                <td>${trade.exitPrice ? trade.exitPrice.toFixed(2) : "-"}</td>
                <td class="${trade.pnl >= 0 ? "positive" : "negative"}">
                    $${trade.pnl.toFixed(2)}
                </td>
                <td>${trade.exitReason || "-"}</td>
            </tr>
            `
            })
            .join("")

        // Create HTML report
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${market} Backtest Results</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                tr:hover { background-color: #ddd; }
                .positive { color: green; }
                .negative { color: red; }
                .metric-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 10px; flex: 1; min-width: 200px; }
                .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .metric-label { font-size: 14px; color: #666; }
                .metrics-container { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <h1>${market} Backtest Results</h1>
            
            <div class="metrics-container">
                <div class="metric-box">
                    <div class="metric-label">Net Profit</div>
                    <div class="metric-value" style="color: ${metrics.totalProfitLoss >= 0 ? "green" : "red"}">
                        $${metrics.totalProfitLoss.toFixed(2)}
                    </div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Total Trades</div>
                    <div class="metric-value">${metrics.totalTrades}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Win Rate</div>
                    <div class="metric-value">${(metrics.winRate * 100).toFixed(2)}%</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Profit Factor</div>
                    <div class="metric-value">${metrics.profitFactor.toFixed(2)}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Max Drawdown</div>
                    <div class="metric-value">${(metrics.maxDrawdown * 100).toFixed(2)}%</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Sharpe Ratio</div>
                    <div class="metric-value">${metrics.sharpeRatio.toFixed(2)}</div>
                </div>
            </div>
            
            <h2>Additional Metrics</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Average Win</td>
                    <td>$${metrics.averageWin.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Average Loss</td>
                    <td>$${Math.abs(metrics.averageLoss).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Largest Win</td>
                    <td>$${metrics.largestWin.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Largest Loss</td>
                    <td>$${Math.abs(metrics.largestLoss).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Winning Trades</td>
                    <td>${metrics.winningTrades}</td>
                </tr>
                <tr>
                    <td>Losing Trades</td>
                    <td>${metrics.losingTrades}</td>
                </tr>
            </table>
            
            <h2>Trades</h2>
            <table>
                <tr>
                    <th>#</th>
                    <th>Direction</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Entry Price</th>
                    <th>Exit Price</th>
                    <th>PnL</th>
                    <th>Exit Reason</th>
                </tr>
                ${tradeRows}
            </table>
            
            <p>
                <a href="multi_symbol_report.html">Back to Summary</a>
            </p>
        </body>
        </html>
        `

        // Write to file
        fs.writeFileSync(path.join(outputDir, `market_${market.replace("-", "_")}.html`), html)
    }
}

// Run if called directly
if (require.main === module) {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
        .option("markets", {
            alias: "m",
            description: "Comma-separated list of markets to test",
            type: "string",
            demandOption: true,
        })
        .option("timeframe", {
            alias: "t",
            description: "Timeframe to use (e.g., 15m, 1h, 4h)",
            type: "string",
            default: "15m",
        })
        .option("leverage", {
            alias: "l",
            description: "Leverage to use",
            type: "number",
            default: 5,
        })
        .option("positionSize", {
            alias: "p",
            description: "Position size as a fraction of capital (0.1 = 10%)",
            type: "number",
            default: 0.1,
        })
        .option("profitTarget", {
            description: "Profit target multiplier",
            type: "number",
            default: 1.5,
        })
        .option("initialCapital", {
            description: "Initial capital for each market test",
            type: "number",
            default: 10000,
        })
        .option("startDate", {
            description: "Start date for backtest (YYYY-MM-DD)",
            type: "string",
        })
        .option("endDate", {
            description: "End date for backtest (YYYY-MM-DD)",
            type: "string",
        })
        .help()
        .alias("help", "h").argv

    // Parse markets
    const markets = argv.markets.split(",").map((m) => m.trim())

    // Parse dates if provided
    let startDate = null
    let endDate = null

    if (argv.startDate) {
        startDate = new Date(argv.startDate)
    }

    if (argv.endDate) {
        endDate = new Date(argv.endDate)
    }

    // Create multi-symbol tester
    const tester = new MultiSymbolTester({
        markets,
        timeframe: argv.timeframe,
        leverage: argv.leverage,
        positionSize: argv.positionSize,
        profitTarget: argv.profitTarget,
        initialCapital: argv.initialCapital,
        startDate,
        endDate,
    })

    // Run backtests
    tester
        .runAllBacktests()
        .then(() => {
            console.log("Multi-symbol backtest completed successfully")
        })
        .catch((error) => {
            console.error("Multi-symbol backtest failed:", error)
            process.exit(1)
        })
}

module.exports = MultiSymbolTester
