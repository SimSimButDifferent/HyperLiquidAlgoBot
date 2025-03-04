const Backtester = require("./Backtester")
const fs = require("fs")
const path = require("path")

class StrategyOptimizer {
    constructor() {
        this.results = []
        this.parameterSets = []
        this.bestResult = null
        this.optimizationMetric = "totalProfitLoss" // Default metric to optimize
    }

    /**
     * Set the parameter ranges to test
     * @param {Object} parameterRanges - Object with parameter names and their ranges
     * Example: {
     *   rsiPeriod: [10, 14, 20],
     *   bbPeriod: [15, 20, 25],
     *   leverage: [3, 5, 10]
     * }
     */
    setParameterRanges(parameterRanges) {
        this.parameterRanges = parameterRanges
        this.generateParameterSets()
    }

    /**
     * Set the metric to optimize for
     * @param {string} metric - Metric name (e.g., 'totalProfitLoss', 'sharpeRatio', 'winRate')
     */
    setOptimizationMetric(metric) {
        const validMetrics = [
            "totalProfitLoss",
            "sharpeRatio",
            "winRate",
            "maxDrawdown",
            "profitFactor",
        ]

        if (!validMetrics.includes(metric)) {
            console.warn(
                `Warning: ${metric} is not a recognized metric. Using totalProfitLoss instead.`,
            )
            this.optimizationMetric = "totalProfitLoss"
        } else {
            this.optimizationMetric = metric
        }
    }

    /**
     * Generate all possible combinations of parameters
     */
    generateParameterSets() {
        // Check if parameter ranges are set
        if (!this.parameterRanges) {
            throw new Error("No parameter ranges set. Call setParameterRanges() first.")
        }

        // Get parameter names and their possible values
        const paramNames = Object.keys(this.parameterRanges)
        const paramValues = paramNames.map((name) => this.parameterRanges[name])

        // Helper function to generate combinations recursively
        const generateCombinations = (index, current) => {
            if (index === paramNames.length) {
                this.parameterSets.push({ ...current })
                return
            }

            const name = paramNames[index]
            const values = paramValues[index]

            for (const value of values) {
                current[name] = value
                generateCombinations(index + 1, current)
            }
        }

        // Generate all combinations
        generateCombinations(0, {})
        console.log(`Generated ${this.parameterSets.length} parameter combinations to test`)
    }

    /**
     * Run the optimization with the generated parameter sets
     */
    async optimize() {
        if (this.parameterSets.length === 0) {
            throw new Error("No parameter sets generated. Call setParameterRanges() first.")
        }

        console.log(`Starting optimization with ${this.parameterSets.length} parameter sets...`)
        console.log(`Optimizing for: ${this.optimizationMetric}`)

        // Create a directory for optimization results
        const optimDir = path.join(process.cwd(), "optimization_results")
        if (!fs.existsSync(optimDir)) {
            fs.mkdirSync(optimDir)
        }

        this.results = []
        let bestScore = this.optimizationMetric === "maxDrawdown" ? Infinity : -Infinity

        // Run backtest for each parameter set
        for (let i = 0; i < this.parameterSets.length; i++) {
            const params = this.parameterSets[i]
            console.log(
                `Testing parameter set ${i + 1}/${this.parameterSets.length}: ${JSON.stringify(params)}`,
            )

            try {
                // Create backtester with specific parameters
                const backtester = new Backtester()

                // Apply the parameters to the backtester
                this.applyParameters(backtester, params)

                // Run the backtest
                await backtester.runBacktest()

                // Get the metrics from the test
                const metrics = backtester.metrics

                // Calculate additional metrics for comparison
                const winRate =
                    metrics.totalTrades > 0 ? metrics.winningTrades / metrics.totalTrades : 0

                const profitFactor =
                    metrics.losingTrades > 0
                        ? metrics.winningTrades / metrics.losingTrades
                        : metrics.winningTrades > 0
                          ? Infinity
                          : 0

                // Create result object
                const result = {
                    parameters: params,
                    metrics: {
                        ...metrics,
                        winRate,
                        profitFactor,
                    },
                    finalEquity: backtester.equity,
                }

                this.results.push(result)

                // Determine if this is the best result so far
                let score
                switch (this.optimizationMetric) {
                    case "totalProfitLoss":
                        score = metrics.totalProfitLoss
                        break
                    case "sharpeRatio":
                        score = metrics.sharpeRatio
                        break
                    case "winRate":
                        score = winRate
                        break
                    case "maxDrawdown":
                        score = metrics.maxDrawdown // Lower is better
                        break
                    case "profitFactor":
                        score = profitFactor
                        break
                    default:
                        score = metrics.totalProfitLoss
                }

                const isBetter =
                    this.optimizationMetric === "maxDrawdown"
                        ? score < bestScore
                        : score > bestScore

                if (isBetter) {
                    bestScore = score
                    this.bestResult = result

                    // Backup the result files
                    const files = [
                        "backtest_trades.json",
                        "equity_curve.json",
                        "trade_statistics.json",
                        "backtest_results.log",
                    ]

                    const bestDir = path.join(optimDir, "best_result")
                    if (!fs.existsSync(bestDir)) {
                        fs.mkdirSync(bestDir)
                    }

                    files.forEach((file) => {
                        if (fs.existsSync(file)) {
                            fs.copyFileSync(file, path.join(bestDir, file))
                        }
                    })

                    console.log(`New best result found! ${this.optimizationMetric}: ${bestScore}`)
                }
            } catch (error) {
                console.error(`Error testing parameter set: ${error.message}`)
            }
        }

        // Sort results for reporting
        this.sortResults()

        // Save all results to a file
        fs.writeFileSync(
            path.join(optimDir, "all_results.json"),
            JSON.stringify(this.results, null, 2),
        )

        // Generate report
        this.generateReport(path.join(optimDir, "optimization_report.html"))

        return this.bestResult
    }

    /**
     * Sort results based on the optimization metric
     */
    sortResults() {
        // Sort results based on the optimization metric
        this.results.sort((a, b) => {
            let aValue, bValue

            switch (this.optimizationMetric) {
                case "totalProfitLoss":
                    aValue = a.metrics.totalProfitLoss
                    bValue = b.metrics.totalProfitLoss
                    break
                case "sharpeRatio":
                    aValue = a.metrics.sharpeRatio
                    bValue = b.metrics.sharpeRatio
                    break
                case "winRate":
                    aValue = a.metrics.winRate
                    bValue = b.metrics.winRate
                    break
                case "maxDrawdown":
                    // For drawdown, lower is better
                    aValue = b.metrics.maxDrawdown
                    bValue = a.metrics.maxDrawdown
                    return aValue - bValue
                case "profitFactor":
                    aValue = a.metrics.profitFactor
                    bValue = b.metrics.profitFactor
                    break
                default:
                    aValue = a.metrics.totalProfitLoss
                    bValue = b.metrics.totalProfitLoss
            }

            return bValue - aValue // Sort in descending order
        })
    }

    /**
     * Apply the parameters to the backtester
     * @param {Backtester} backtester - The backtester instance
     * @param {Object} params - The parameters to apply
     */
    applyParameters(backtester, params) {
        // Handle common backtester parameters
        if ("leverage" in params) {
            backtester.leverage = params.leverage
        }

        if ("positionSize" in params) {
            backtester.positionSize = params.positionSize
        }

        if ("profitTarget" in params) {
            backtester.profitTarget = params.profitTarget
        }

        if ("tradingFee" in params) {
            backtester.tradingFee = params.tradingFee
        }

        // Store strategy parameters to apply when the strategy is created
        backtester.strategyParams = {}

        // Add any other parameters for the strategy
        for (const key in params) {
            if (!["leverage", "positionSize", "profitTarget", "tradingFee"].includes(key)) {
                backtester.strategyParams[key] = params[key]
            }
        }

        // Override the original strategy initialization to apply parameters
        const originalStrategy = backtester.strategy
        if (originalStrategy && Object.keys(backtester.strategyParams).length > 0) {
            Object.keys(backtester.strategyParams).forEach((key) => {
                if (key in originalStrategy) {
                    originalStrategy[key] = backtester.strategyParams[key]
                }
            })
        }
    }

    /**
     * Generate an HTML report of the optimization results
     * @param {string} outputFile - Path to save the report
     */
    generateReport(outputFile) {
        // Format parameter combinations as table rows
        let paramRows = this.results
            .slice(0, 20)
            .map((result, index) => {
                const params = result.parameters
                const metrics = result.metrics

                const paramCells = Object.keys(params)
                    .map((key) => `<td>${params[key]}</td>`)
                    .join("")

                const metricValue =
                    this.optimizationMetric === "maxDrawdown"
                        ? metrics.maxDrawdown.toFixed(2) + "%"
                        : this.optimizationMetric === "winRate"
                          ? (metrics.winRate * 100).toFixed(2) + "%"
                          : metrics[this.optimizationMetric].toFixed(2)

                return `
            <tr>
                <td>${index + 1}</td>
                ${paramCells}
                <td>${metricValue}</td>
                <td>$${metrics.totalProfitLoss.toFixed(2)}</td>
                <td>${(metrics.winRate * 100).toFixed(2)}%</td>
                <td>${metrics.profitFactor.toFixed(2)}</td>
                <td>${(metrics.maxDrawdown * 100).toFixed(2)}%</td>
                <td>${metrics.sharpeRatio.toFixed(2)}</td>
            </tr>
            `
            })
            .join("")

        // Get parameter headers
        const paramHeaders = Object.keys(this.results[0]?.parameters || {})
            .map((key) => `<th>${key}</th>`)
            .join("")

        // Create HTML content
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Strategy Optimization Results</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                tr:hover { background-color: #ddd; }
                .best-result { background-color: #e6ffe6; }
                .metric-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 10px; flex: 1; min-width: 200px; }
                .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .metric-label { font-size: 14px; color: #666; }
                .metrics-container { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <h1>Strategy Optimization Results</h1>
            
            <div class="metrics-container">
                <div class="metric-box">
                    <div class="metric-label">Parameter Combinations Tested</div>
                    <div class="metric-value">${this.parameterSets.length}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Optimization Metric</div>
                    <div class="metric-value">${this.optimizationMetric}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Best ${this.optimizationMetric}</div>
                    <div class="metric-value">
                        ${
                            this.optimizationMetric === "maxDrawdown"
                                ? (this.bestResult?.metrics.maxDrawdown * 100).toFixed(2) + "%"
                                : this.optimizationMetric === "winRate"
                                  ? (this.bestResult?.metrics.winRate * 100).toFixed(2) + "%"
                                  : this.bestResult?.metrics[this.optimizationMetric].toFixed(2)
                        }
                    </div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Best Net Profit</div>
                    <div class="metric-value">$${this.bestResult?.metrics.totalProfitLoss.toFixed(2)}</div>
                </div>
            </div>
            
            <h2>Best Parameters</h2>
            <table>
                <tr>
                    ${Object.keys(this.bestResult?.parameters || {})
                        .map((key) => `<th>${key}</th>`)
                        .join("")}
                </tr>
                <tr>
                    ${Object.values(this.bestResult?.parameters || {})
                        .map((value) => `<td>${value}</td>`)
                        .join("")}
                </tr>
            </table>
            
            <h2>Top 20 Results</h2>
            <table>
                <tr>
                    <th>Rank</th>
                    ${paramHeaders}
                    <th>${this.optimizationMetric}</th>
                    <th>Net Profit</th>
                    <th>Win Rate</th>
                    <th>Profit Factor</th>
                    <th>Max Drawdown</th>
                    <th>Sharpe Ratio</th>
                </tr>
                ${paramRows}
            </table>
            
            <p>
                <a href="best_result/backtest_trades.json" target="_blank">Download Best Result Trades</a> | 
                <a href="best_result/equity_curve.json" target="_blank">Download Best Result Equity Curve</a> | 
                <a href="all_results.json" target="_blank">Download All Results</a>
            </p>
        </body>
        </html>
        `

        // Write to file
        fs.writeFileSync(outputFile, html)
        console.log(`Optimization report saved to ${outputFile}`)
    }
}

module.exports = StrategyOptimizer
