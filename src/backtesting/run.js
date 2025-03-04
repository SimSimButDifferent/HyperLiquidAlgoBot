const Backtester = require("./Backtester")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")
const config = require("config")
const path = require("path")
const fs = require("fs")
const MLEnhancedStrategy = require("./strategies/MLEnhancedStrategy")

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
        .option("use-ml", {
            alias: "ml",
            describe: "Use ML-optimized parameters",
            type: "boolean",
            default: false,
        })
        .option("ml-model", {
            describe: "ML model to use (e.g., BTC-PERP_15m_randomforest)",
            type: "string",
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
    const useML = argv["use-ml"] || false

    // If using ML, find available models
    let mlModelPath = null
    if (useML) {
        console.log("Looking for ML models...")
        const availableModels = MLEnhancedStrategy.getAvailableModels()

        if (availableModels.length === 0) {
            console.warn("No ML models found. Run the ml_optimize.js script first.")
            console.warn("Continuing with default strategy parameters...")
        } else {
            // If a specific model was requested, find it
            if (argv["ml-model"]) {
                const requestedModel = availableModels.find(
                    (model) => model.name === argv["ml-model"],
                )
                if (requestedModel) {
                    mlModelPath = requestedModel.path
                    console.log(`Using ML model: ${requestedModel.name}`)
                } else {
                    console.warn(`Requested model ${argv["ml-model"]} not found.`)
                }
            }
            // Otherwise, try to find a model matching the current market and timeframe
            else {
                const matchingModel = availableModels.find(
                    (model) => model.market === market && model.timeframe === timeframe,
                )

                if (matchingModel) {
                    mlModelPath = matchingModel.path
                    console.log(`Using matching ML model: ${matchingModel.name}`)
                }
            }

            // If still no model path, use the first available model
            if (!mlModelPath && availableModels.length > 0) {
                mlModelPath = availableModels[0].path
                console.log(`Using default ML model: ${availableModels[0].name}`)
            }
        }
    }

    console.log("Starting backtester with parameters:", {
        config: argv.config,
        market,
        timeframe,
        leverage,
        positionSize,
        profitTarget,
        initialCapital: capital,
        tradingFee,
        useML,
        mlModelPath,
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

    // If using ML strategy, override the strategy creation method
    if (useML && mlModelPath) {
        console.log("Setting up ML-enhanced strategy with model path:", mlModelPath)

        // Store the original createStrategy method
        const originalCreateStrategy = backtester.createStrategy

        // Override with ML-enhanced strategy
        backtester.createStrategy = function () {
            console.log("Creating ML-enhanced strategy instance")
            const mlStrategy = new MLEnhancedStrategy({
                baseStrategy: "BBRSI", // Default to BBRSI strategy
                modelPath: mlModelPath,
            })
            console.log("ML-enhanced strategy created")
            return mlStrategy
        }

        // Force recreation of the strategy
        backtester.strategy = backtester.createStrategy()

        console.log("Using ML-enhanced strategy with optimized parameters")
    }

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
