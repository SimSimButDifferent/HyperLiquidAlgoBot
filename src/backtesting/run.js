const Backtester = require("./Backtester")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")
const config = require("config")
const path = require("path")
const fs = require("fs")

async function main() {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
        .option("config", {
            alias: "c",
            describe: "Configuration profile to use (default or backtest)",
            type: "string",
            default: "default",
        })
        .option("market", {
            alias: "m",
            describe: "Market to backtest (e.g., BTC-PERP)",
            type: "string",
        })
        .option("timeframe", {
            alias: "t",
            describe: "Timeframe to use (e.g., 15m, 1h)",
            type: "string",
        })
        .option("leverage", {
            alias: "l",
            describe: "Leverage to use for backtesting",
            type: "number",
        })
        .option("position", {
            alias: "p",
            describe: "Position size as a decimal (e.g., 0.1 for 10%)",
            type: "number",
        })
        .option("profit", {
            alias: "tp",
            describe: "Profit target percentage",
            type: "number",
        })
        .option("capital", {
            alias: "cap",
            describe: "Initial capital for backtesting",
            type: "number",
        })
        .help().argv

    // Get default values from config
    const tradingConfig = config.get("trading")

    // Define values based on profile
    let defaultMarket,
        defaultTimeframe,
        defaultLeverage,
        defaultPositionSize,
        defaultProfitTarget,
        initialCapital,
        tradingFee

    if (argv.config === "backtest") {
        // Backtest profile values
        defaultMarket = "BTC-PERP"
        defaultTimeframe = "15m"
        defaultLeverage = 5 // More conservative leverage for backtesting
        defaultPositionSize = 0.1 // 10% position size
        defaultProfitTarget = 1.5
        initialCapital = 10000
        tradingFee = 0.001

        console.log("Using backtest profile with conservative settings")
    } else {
        // Default profile values from config
        defaultMarket = tradingConfig.market
        defaultTimeframe = tradingConfig.timeframe
        defaultLeverage = tradingConfig.leverage
        defaultPositionSize = tradingConfig.positionSize
        defaultProfitTarget = tradingConfig.profitTarget
        initialCapital = 1000
        tradingFee = 0.001
    }

    // Set actual values to use (command line args override config)
    const market = argv.market || defaultMarket
    const timeframe = argv.timeframe || defaultTimeframe
    const leverage = argv.leverage !== undefined ? argv.leverage : defaultLeverage
    const positionSize = argv.position !== undefined ? argv.position : defaultPositionSize
    const profitTarget = argv.profit !== undefined ? argv.profit : defaultProfitTarget
    const capital = argv.capital !== undefined ? argv.capital : initialCapital

    console.log("Starting backtester with parameters:", {
        config: argv.config,
        market,
        timeframe,
        leverage,
        positionSize,
        profitTarget,
        initialCapital: capital,
        tradingFee,
    })

    const backtester = new Backtester()

    // Set values on backtester
    backtester.symbol = market
    backtester.timeframe = timeframe
    backtester.leverage = leverage
    backtester.positionSize = positionSize
    backtester.profitTarget = profitTarget
    backtester.initialCapital = capital
    backtester.equity = capital
    backtester.tradingFee = tradingFee

    try {
        console.time("Backtest execution time")
        await backtester.runBacktest()
        console.timeEnd("Backtest execution time")
        console.log("Backtesting completed successfully!")
    } catch (error) {
        console.error("Error during backtesting:", error.message)
        process.exit(1)
    }
}

main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
