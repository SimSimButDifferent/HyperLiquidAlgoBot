const Backtester = require("./Backtester")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")

async function main() {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
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
        .help().argv

    console.log("Starting backtester with parameters:", argv)

    const backtester = new Backtester()

    // Override config with command line parameters if provided
    if (argv.market) {
        console.log(`Setting market to ${argv.market}`)
        backtester.symbol = argv.market
    }

    if (argv.timeframe) {
        console.log(`Setting timeframe to ${argv.timeframe}`)
        backtester.timeframe = argv.timeframe
    }

    if (argv.leverage) {
        console.log(`Setting leverage to ${argv.leverage}`)
        backtester.leverage = argv.leverage
    }

    if (argv.position) {
        console.log(`Setting position size to ${argv.position}`)
        backtester.positionSize = argv.position
    }

    try {
        await backtester.runBacktest()
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
