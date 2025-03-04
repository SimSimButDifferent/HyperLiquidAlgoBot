/**
 * Machine Learning Optimizer CLI
 * Trains ML models to optimize strategy parameters and identify important features
 */

const MLOptimizer = require("./ml_optimizer")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")

async function main() {
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
        .option("market", {
            alias: "m",
            description: "Market to optimize for (e.g., BTC-PERP)",
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
            alias: "metric",
            description:
                "Target metric to optimize (totalProfitLoss, sharpeRatio, winRate, profitFactor)",
            type: "string",
            default: "totalProfitLoss",
        })
        .option("model", {
            alias: "mod",
            description: "Model type (randomforest, xgboost, neuralnetwork)",
            type: "string",
            default: "randomforest",
        })
        .option("dataset-size", {
            alias: "n",
            description: "Number of backtest runs for dataset generation",
            type: "number",
            default: 100,
        })
        .option("skip-dataset", {
            description: "Skip dataset generation and use existing data",
            type: "boolean",
            default: false,
        })
        .option("feature-method", {
            description: "Feature importance method (shap, permutation)",
            type: "string",
            default: "shap",
        })
        .help()
        .alias("help", "h").argv

    console.log("===== Machine Learning Strategy Optimizer =====")
    console.log(`Market: ${argv.market}`)
    console.log(`Timeframe: ${argv.timeframe}`)
    console.log(`Target metric: ${argv.metric}`)
    console.log(`Model type: ${argv.model}`)
    console.log(`Dataset size: ${argv.datasetSize}`)
    console.log(`Feature importance method: ${argv.featureMethod}`)
    console.log("==============================================")

    // Create optimizer
    const optimizer = new MLOptimizer({
        market: argv.market,
        timeframe: argv.timeframe,
        targetMetric: argv.metric,
        modelType: argv.model,
        datasetSize: argv.datasetSize,
        featureImportanceMethod: argv.featureMethod,
        // Parameter ranges for the BBRSI strategy
        parameterRanges: {
            rsiPeriod: { min: 5, max: 30, step: 1, type: "int" },
            rsiOverbought: { min: 65, max: 85, step: 1, type: "int" },
            rsiOversold: { min: 15, max: 35, step: 1, type: "int" },
            bbPeriod: { min: 10, max: 50, step: 2, type: "int" },
            bbStdDev: { min: 1.5, max: 3.5, step: 0.1, type: "float" },
            adxPeriod: { min: 7, max: 30, step: 1, type: "int" },
            adxThreshold: { min: 15, max: 35, step: 1, type: "int" },
            // Backtester parameters
            leverage: { min: 1, max: 10, step: 1, type: "int" },
            positionSize: { min: 0.05, max: 0.5, step: 0.05, type: "float" },
            profitTarget: { min: 1.1, max: 3.0, step: 0.1, type: "float" },
        },
    })

    try {
        // Check Python dependencies
        const hasDependencies = await optimizer.checkPythonDependencies()
        if (!hasDependencies) {
            console.error("ML optimization requires Python with specific packages.")
            console.error("Please install the required packages:")
            console.error("pip install numpy pandas scikit-learn xgboost shap matplotlib")
            process.exit(1)
        }

        console.time("Total optimization time")

        // Generate dataset if needed
        if (!argv.skipDataset) {
            console.log(`\nGenerating dataset with ${argv.datasetSize} samples...`)
            console.time("Dataset generation")
            await optimizer.generateDataset()
            console.timeEnd("Dataset generation")
        } else {
            console.log("Skipping dataset generation, using existing data...")
        }

        // Train the model
        console.log("\nTraining ML model...")
        console.time("Model training")
        const results = await optimizer.trainModel()
        console.timeEnd("Model training")

        // Generate report
        console.log("\nGenerating optimization report...")
        const reportPath = optimizer.generateReport()

        console.log(`\nOptimization completed successfully!`)
        console.log(`Report saved to: ${reportPath}`)

        // Display optimized parameters
        console.log("\nOptimized Parameters:")
        console.table(results.optimizedParameters)

        // Display top 5 important features
        const topFeatures = optimizer.getImportantFeatures(5)
        console.log("\nTop 5 Important Features:")
        topFeatures.forEach((feature, index) => {
            console.log(`${index + 1}. ${feature.name}: ${feature.importance.toFixed(4)}`)
        })

        console.timeEnd("Total optimization time")
    } catch (error) {
        console.error("Error during ML optimization:", error)
        process.exit(1)
    }
}

// Run the main function
main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
