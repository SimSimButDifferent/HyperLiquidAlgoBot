const StrategyOptimizer = require("./optimizer")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")

async function main() {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
        .option("market", {
            alias: "m",
            description: "Market to test on (e.g., BTC-PERP)",
            type: "string",
            default: "BTC-PERP",
        })
        .option("timeframe", {
            alias: "t",
            description: "Timeframe to use (e.g., 15m, 1h, 4h)",
            type: "string",
            default: "15m",
        })
        .option("metric", {
            description:
                "Metric to optimize for (totalProfitLoss, sharpeRatio, winRate, profitFactor, maxDrawdown)",
            type: "string",
            default: "totalProfitLoss",
        })
        .option("initialCapital", {
            description: "Initial capital to start with",
            type: "number",
            default: 10000,
        })
        .option("verbose", {
            alias: "v",
            description: "Enable verbose logging",
            type: "boolean",
            default: false,
        })
        .help()
        .alias("help", "h").argv

    console.log("Starting parameter optimization...")
    console.log("Market:", argv.market)
    console.log("Timeframe:", argv.timeframe)
    console.log("Optimization metric:", argv.metric)
    console.log("Initial capital:", argv.initialCapital)

    // Create optimizer
    const optimizer = new StrategyOptimizer()

    // Set optimization metric
    optimizer.setOptimizationMetric(argv.metric)

    // Define parameter ranges to test
    // These are example ranges for the BBRSIStrategy
    const parameterRanges = {
        // Backtester parameters
        leverage: [1, 2, 3, 5, 10],
        positionSize: [0.1, 0.2, 0.3, 0.5], // 10%, 20%, 30%, 50% of capital
        profitTarget: [1.2, 1.5, 2.0, 2.5], // Take profit at these multiples

        // Strategy parameters
        rsiPeriod: [7, 14, 21],
        rsiOverbought: [70, 75, 80],
        rsiOversold: [20, 25, 30],
        bbPeriod: [15, 20, 30],
        bbStdDev: [2, 2.5, 3],
        adxPeriod: [14, 21, 28],
        adxThreshold: [20, 25, 30],
    }

    // Set parameter ranges
    optimizer.setParameterRanges(parameterRanges)

    // Start optimization
    try {
        console.time("Optimization completed in")
        const bestResult = await optimizer.optimize()
        console.timeEnd("Optimization completed in")

        console.log("\n--- Best Parameter Set ---")
        console.log("Parameters:", JSON.stringify(bestResult.parameters, null, 2))
        console.log("Metric Value:", bestResult.metrics[argv.metric])
        console.log("Total Profit/Loss:", bestResult.metrics.totalProfitLoss)
        console.log("Win Rate:", (bestResult.metrics.winRate * 100).toFixed(2) + "%")
        console.log("Max Drawdown:", (bestResult.metrics.maxDrawdown * 100).toFixed(2) + "%")

        console.log(
            "\nOptimization report generated in optimization_results/optimization_report.html",
        )
        console.log("To see the best result charts, run:")
        console.log("node src/backtesting/visualize.js --results optimization_results/best_result")
    } catch (error) {
        console.error("Optimization failed:", error.message)
    }
}

// Run the main function
main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
