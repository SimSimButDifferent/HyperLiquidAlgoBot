/**
 * ML Optimizer for trading strategies
 * Implements machine learning models to optimize strategy parameters
 * and identify important features/indicators
 */

const fs = require("fs")
const path = require("path")
const util = require("util")
const childProcess = require("child_process")
const exec = util.promisify(childProcess.exec)

// Constants
const DATA_FOLDER = "ml_data"
const MODELS_FOLDER = "ml_models"
const PYTHON_SCRIPT_PATH = path.join(__dirname, "python", "ml_train.py")

class MLOptimizer {
    constructor(options = {}) {
        // Ensure required folders exist
        this.ensureFoldersExist()

        // Base options
        this.datasetSize = options.datasetSize || 1000 // Number of backtests to run for data collection
        this.targetMetric = options.targetMetric || "totalProfitLoss"
        this.validationSplit = options.validationSplit || 0.2
        this.modelType = options.modelType || "randomforest" // randomforest, xgboost, or neuralnetwork
        this.featureImportanceMethod = options.featureImportanceMethod || "shap" // shap or permutation

        // Parameter ranges for training
        this.parameterRanges = options.parameterRanges || {
            // Default parameter ranges for the BBRSI strategy
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
        }

        // Technical indicators to use as features
        this.technicalIndicators = options.technicalIndicators || [
            "rsi",
            "bollinger_bands",
            "adx",
            "macd",
            "ema",
            "atr",
            "obv",
            "vwap",
            "price_change",
        ]

        // Market data settings
        this.market = options.market || "BTC-PERP"
        this.timeframe = options.timeframe || "15m"

        // Path to store the dataset
        this.datasetPath = path.join(DATA_FOLDER, `${this.market}_${this.timeframe}_dataset.csv`)

        // Results storage
        this.optimizedParameters = null
        this.featureImportance = null
        this.modelMetrics = null
        this.hasPythonDependencies = false
    }

    /**
     * Ensure required folders exist
     */
    ensureFoldersExist() {
        if (!fs.existsSync(DATA_FOLDER)) {
            fs.mkdirSync(DATA_FOLDER, { recursive: true })
        }

        if (!fs.existsSync(MODELS_FOLDER)) {
            fs.mkdirSync(MODELS_FOLDER, { recursive: true })
        }

        if (!fs.existsSync(path.join(__dirname, "python"))) {
            fs.mkdirSync(path.join(__dirname, "python"), { recursive: true })
        }
    }

    /**
     * Check for required Python dependencies
     */
    async checkPythonDependencies() {
        try {
            // Try to run Python and check for numpy, pandas, scikit-learn
            const { stdout, stderr } = await exec(
                'python -c "import numpy, pandas, sklearn, xgboost, shap"',
            )
            this.hasPythonDependencies = true
            console.log("Python dependencies verified.")
            return true
        } catch (error) {
            console.error("Missing Python dependencies. Please install the required packages:")
            console.error("pip install numpy pandas scikit-learn xgboost shap matplotlib")
            this.hasPythonDependencies = false
            return false
        }
    }

    /**
     * Generate a dataset by running multiple backtests with different parameters
     */
    async generateDataset() {
        console.log(`Generating ML dataset with ${this.datasetSize} samples...`)

        // Create a CSV file for the dataset
        const headerRow = this.createDatasetHeader()
        fs.writeFileSync(this.datasetPath, headerRow + "\n")

        // Run backtests with different parameter combinations
        for (let i = 0; i < this.datasetSize; i++) {
            const parameters = this.generateRandomParameters()

            // Log progress every 10%
            if (i % Math.max(1, Math.floor(this.datasetSize / 10)) === 0) {
                console.log(`Progress: ${Math.round((i / this.datasetSize) * 100)}%`)
            }

            try {
                // Run backtest with these parameters
                const result = await this.runBacktest(parameters)

                // Extract features and target metrics
                const dataRow = this.extractFeaturesAndTarget(parameters, result)

                // Append to dataset
                fs.appendFileSync(this.datasetPath, dataRow + "\n")
            } catch (error) {
                console.error(`Error in backtest run ${i}:`, error.message)
                // Continue with next iteration
            }
        }

        console.log(`Dataset generation completed. Dataset saved to ${this.datasetPath}`)
        return this.datasetPath
    }

    /**
     * Create the header row for the dataset
     */
    createDatasetHeader() {
        // Parameter names form the first columns
        const parameterNames = Object.keys(this.parameterRanges)

        // Then technical indicator feature names
        const featureNames = []
        this.technicalIndicators.forEach((indicator) => {
            // Each indicator might have multiple features
            switch (indicator) {
                case "rsi":
                    featureNames.push("rsi_value", "rsi_slope", "rsi_divergence")
                    break
                case "bollinger_bands":
                    featureNames.push(
                        "bb_width",
                        "bb_percent_b",
                        "price_to_upper",
                        "price_to_lower",
                    )
                    break
                case "adx":
                    featureNames.push("adx_value", "di_plus", "di_minus")
                    break
                case "macd":
                    featureNames.push("macd_value", "macd_signal", "macd_histogram")
                    break
                case "ema":
                    featureNames.push("ema_fast", "ema_slow", "ema_ratio")
                    break
                case "atr":
                    featureNames.push("atr_value", "atr_percent")
                    break
                case "obv":
                    featureNames.push("obv_value", "obv_slope")
                    break
                case "vwap":
                    featureNames.push("vwap_value", "price_to_vwap")
                    break
                case "price_change":
                    featureNames.push("daily_return", "weekly_return", "volatility")
                    break
                default:
                    featureNames.push(indicator)
            }
        })

        // Target metrics as the last columns
        const targetMetrics = [
            "totalProfitLoss",
            "sharpeRatio",
            "maxDrawdown",
            "winRate",
            "profitFactor",
        ]

        // Combine all columns
        return [...parameterNames, ...featureNames, ...targetMetrics].join(",")
    }

    /**
     * Generate a random set of parameters within defined ranges
     */
    generateRandomParameters() {
        const parameters = {}

        Object.entries(this.parameterRanges).forEach(([param, range]) => {
            const { min, max, step, type } = range
            let value

            if (type === "int") {
                // Generate random integer
                const steps = Math.floor((max - min) / step) + 1
                value = min + Math.floor(Math.random() * steps) * step
            } else if (type === "float") {
                // Generate random float
                const steps = Math.floor((max - min) / step) + 1
                value = min + Math.floor(Math.random() * steps) * step
                value = parseFloat(value.toFixed(2)) // Round to 2 decimal places
            } else if (type === "boolean") {
                // Generate random boolean
                value = Math.random() >= 0.5
            } else {
                // Default to float
                value = min + Math.random() * (max - min)
                value = parseFloat(value.toFixed(2))
            }

            parameters[param] = value
        })

        return parameters
    }

    /**
     * Run a backtest with specific parameters
     */
    async runBacktest(parameters) {
        // Create a temporary configuration file for this backtest
        const configPath = path.join(DATA_FOLDER, `temp_config_${Date.now()}.json`)
        fs.writeFileSync(configPath, JSON.stringify(parameters, null, 2))

        // Run the backtester with these parameters
        const Backtester = require("./Backtester")
        const backtester = new Backtester({
            market: this.market,
            timeframe: this.timeframe,
            ...parameters,
        })

        try {
            const results = await backtester.runBacktest(true) // Silent mode

            // Clean up config
            fs.unlinkSync(configPath)

            return results
        } catch (error) {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath)
            }
            throw error
        }
    }

    /**
     * Extract features and target metrics from backtest results
     */
    extractFeaturesAndTarget(parameters, result) {
        // Start with parameters
        const values = Object.values(parameters).map((p) => p.toString())

        // Extract technical indicator features from the last data point
        // (This would come from the actual data in a real implementation)
        // Here we're just creating placeholder values
        const features = []
        this.technicalIndicators.forEach((indicator) => {
            switch (indicator) {
                case "rsi":
                    features.push(Math.random() * 100) // rsi_value
                    features.push(Math.random() * 2 - 1) // rsi_slope
                    features.push(Math.random() * 2 - 1) // rsi_divergence
                    break
                case "bollinger_bands":
                    features.push(Math.random() * 5) // bb_width
                    features.push(Math.random()) // bb_percent_b
                    features.push(Math.random() * 0.05) // price_to_upper
                    features.push(Math.random() * 0.05) // price_to_lower
                    break
                case "adx":
                    features.push(Math.random() * 100) // adx_value
                    features.push(Math.random() * 50) // di_plus
                    features.push(Math.random() * 50) // di_minus
                    break
                case "macd":
                    features.push(Math.random() * 100 - 50) // macd_value
                    features.push(Math.random() * 100 - 50) // macd_signal
                    features.push(Math.random() * 40 - 20) // macd_histogram
                    break
                case "ema":
                    features.push(Math.random() * 1000) // ema_fast
                    features.push(Math.random() * 1000) // ema_slow
                    features.push(0.8 + Math.random() * 0.4) // ema_ratio
                    break
                case "atr":
                    features.push(Math.random() * 100) // atr_value
                    features.push(Math.random() * 0.1) // atr_percent
                    break
                case "obv":
                    features.push(Math.random() * 1000000) // obv_value
                    features.push(Math.random() * 2 - 1) // obv_slope
                    break
                case "vwap":
                    features.push(Math.random() * 1000) // vwap_value
                    features.push(0.9 + Math.random() * 0.2) // price_to_vwap
                    break
                case "price_change":
                    features.push(Math.random() * 0.1 - 0.05) // daily_return
                    features.push(Math.random() * 0.2 - 0.1) // weekly_return
                    features.push(Math.random() * 0.05) // volatility
                    break
                default:
                    features.push(Math.random())
            }
        })

        // Add target metrics
        const targetMetrics = [
            result.metrics.totalProfitLoss,
            result.metrics.sharpeRatio || 0,
            result.metrics.maxDrawdown || 0,
            result.metrics.winRate || 0,
            result.metrics.profitFactor || 0,
        ]

        // Combine all values
        return [
            ...values,
            ...features.map((f) => f.toString()),
            ...targetMetrics.map((t) => t.toString()),
        ].join(",")
    }

    /**
     * Create the Python ML script for training
     */
    createPythonTrainingScript() {
        const scriptContent = `
# Machine Learning model for strategy optimization
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import pickle
import json
import os
import sys
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import xgboost as xgb
from xgboost import XGBRegressor
import shap

# Arguments
dataset_path = sys.argv[1]
output_path = sys.argv[2]
model_type = sys.argv[3]
target_column = sys.argv[4]
feature_importance_method = sys.argv[5]

# Load dataset
print(f"Loading dataset from {dataset_path}")
data = pd.read_csv(dataset_path)

# Get parameter columns (first n columns before the technical indicators)
param_columns = [col for col in data.columns if col not in 
                ['totalProfitLoss', 'sharpeRatio', 'maxDrawdown', 'winRate', 'profitFactor']]
param_columns = param_columns[:len(${JSON.stringify(Object.keys(this.parameterRanges))})]

# Feature columns (technical indicators)
feature_columns = [col for col in data.columns if col not in 
                  [...param_columns, 'totalProfitLoss', 'sharpeRatio', 'maxDrawdown', 'winRate', 'profitFactor']]

# Print info
print(f"Parameters: {param_columns}")
print(f"Features: {feature_columns}")
print(f"Target column: {target_column}")
print(f"Model type: {model_type}")

# Prepare input and output data
X = data[param_columns + feature_columns]  # Parameters + Technical indicators
y = data[target_column]                  # Target metric

# Split data into training and validation sets
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

# Standardize features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)

# Save scaler for later use
with open(os.path.join(output_path, 'scaler.pkl'), 'wb') as f:
    pickle.dump(scaler, f)

# Train the model
if model_type == 'randomforest':
    print("Training Random Forest model...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Feature importance
    if feature_importance_method == 'shap':
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_val_scaled)
        feature_importance = np.abs(shap_values).mean(0)
    else:  # permutation
        from sklearn.inspection import permutation_importance
        result = permutation_importance(model, X_val_scaled, y_val, n_repeats=10, random_state=42)
        feature_importance = result.importances_mean

elif model_type == 'xgboost':
    print("Training XGBoost model...")
    model = XGBRegressor(n_estimators=100, learning_rate=0.1, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Feature importance
    if feature_importance_method == 'shap':
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_val_scaled)
        feature_importance = np.abs(shap_values).mean(0)
    else:  # permutation
        from sklearn.inspection import permutation_importance
        result = permutation_importance(model, X_val_scaled, y_val, n_repeats=10, random_state=42)
        feature_importance = result.importances_mean
    
elif model_type == 'neuralnetwork':
    print("Training Neural Network model...")
    from sklearn.neural_network import MLPRegressor
    model = MLPRegressor(hidden_layer_sizes=(100, 50), max_iter=1000, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Feature importance for neural network (permutation only)
    from sklearn.inspection import permutation_importance
    result = permutation_importance(model, X_val_scaled, y_val, n_repeats=10, random_state=42)
    feature_importance = result.importances_mean

# Evaluate model
y_pred_train = model.predict(X_train_scaled)
y_pred_val = model.predict(X_val_scaled)

# Calculate metrics
train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
val_rmse = np.sqrt(mean_squared_error(y_val, y_pred_val))
train_r2 = r2_score(y_train, y_pred_train)
val_r2 = r2_score(y_val, y_pred_val)

print(f"Train RMSE: {train_rmse:.4f}")
print(f"Validation RMSE: {val_rmse:.4f}")
print(f"Train R²: {train_r2:.4f}")
print(f"Validation R²: {val_r2:.4f}")

# Save model
model_filename = os.path.join(output_path, f"{model_type}_{target_column}.pkl")
with open(model_filename, 'wb') as f:
    pickle.dump(model, f)

# Sort feature importance and get corresponding names
importance_indices = np.argsort(feature_importance)[::-1]
feature_names = np.array(param_columns + feature_columns)
sorted_feature_importance = feature_importance[importance_indices]
sorted_feature_names = feature_names[importance_indices]

# Save feature importance
feature_importance_dict = {
    'feature_names': sorted_feature_names.tolist(),
    'importance_values': sorted_feature_importance.tolist()
}

with open(os.path.join(output_path, 'feature_importance.json'), 'w') as f:
    json.dump(feature_importance_dict, f, indent=2)

# Plot feature importance
plt.figure(figsize=(12, 8))
plt.barh(range(len(sorted_feature_names)), sorted_feature_importance)
plt.yticks(range(len(sorted_feature_names)), sorted_feature_names)
plt.xlabel('Feature Importance')
plt.title(f'Feature Importance for {target_column} ({model_type})')
plt.tight_layout()
plt.savefig(os.path.join(output_path, 'feature_importance.png'))

# Find optimal parameters
param_importance = {}
for i, name in enumerate(param_columns):
    # Find the index of this parameter in the feature names array
    idx = np.where(feature_names == name)[0][0]
    param_importance[name] = feature_importance[idx]

# Sort parameters by importance
sorted_params = sorted(param_importance.items(), key=lambda x: x[1], reverse=True)
print("\\nParameter importance:")
for param, imp in sorted_params:
    print(f"{param}: {imp:.4f}")

# Save model metrics
metrics = {
    'train_rmse': float(train_rmse),
    'val_rmse': float(val_rmse),
    'train_r2': float(train_r2),
    'val_r2': float(val_r2),
    'parameter_importance': {param: float(imp) for param, imp in sorted_params}
}

with open(os.path.join(output_path, 'model_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

# Use the model to predict the optimal parameters
from scipy.optimize import differential_evolution

# Define the objective function for optimization
def objective(params_array):
    # Create a copy of a random data sample for its feature values
    sample_idx = np.random.randint(0, len(X_val))
    sample = X_val.iloc[sample_idx].copy()
    
    # Update parameter values (keeping feature values the same)
    for i, param in enumerate(param_columns):
        sample[param] = params_array[i]
    
    # Scale the features
    sample_scaled = scaler.transform(sample.values.reshape(1, -1))
    
    # Predict the target value (negative because we want to maximize)
    prediction = model.predict(sample_scaled)[0]
    
    # If trying to minimize (e.g., drawdown), return positive value
    if target_column in ['maxDrawdown']:
        return prediction
    
    # For metrics we want to maximize, return negative
    return -prediction

# Define bounds for each parameter
bounds = []
for param in param_columns:
    param_range = ${JSON.stringify(this.parameterRanges)}[param]
    bounds.append((param_range['min'], param_range['max']))

# Run the optimization
result = differential_evolution(objective, bounds, maxiter=100, popsize=20, recombination=0.7)

# Get the optimal parameters
optimal_params = {}
for i, param in enumerate(param_columns):
    param_range = ${JSON.stringify(this.parameterRanges)}[param]
    value = result.x[i]
    
    # Round according to parameter type
    if param_range['type'] == 'int':
        value = int(round(value))
    elif param_range['type'] == 'float':
        value = round(value, 2)
    
    optimal_params[param] = value

print("\\nOptimal Parameters:")
for param, value in optimal_params.items():
    print(f"{param}: {value}")

# Save optimal parameters
with open(os.path.join(output_path, 'optimal_parameters.json'), 'w') as f:
    json.dump(optimal_params, f, indent=2)

print("\\nTraining completed successfully.")
print(f"Results saved to {output_path}")
        `

        // Write the script to disk
        const scriptPath = PYTHON_SCRIPT_PATH
        fs.writeFileSync(scriptPath, scriptContent)

        return scriptPath
    }

    /**
     * Train the ML model
     */
    async trainModel() {
        // Check for Python dependencies
        const hasDependencies = await this.checkPythonDependencies()
        if (!hasDependencies) {
            throw new Error("Missing Python dependencies")
        }

        // Generate dataset or use existing one
        if (!fs.existsSync(this.datasetPath)) {
            await this.generateDataset()
        } else {
            console.log(`Using existing dataset at ${this.datasetPath}`)
        }

        // Create Python training script
        const scriptPath = this.createPythonTrainingScript()

        // Create output folder for model
        const outputFolder = path.join(
            MODELS_FOLDER,
            `${this.market}_${this.timeframe}_${this.modelType}`,
        )
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true })
        }

        console.log(`Training ${this.modelType} model for ${this.targetMetric}...`)

        try {
            // Run Python script
            const { stdout, stderr } = await exec(
                `python "${scriptPath}" "${this.datasetPath}" "${outputFolder}" "${this.modelType}" "${this.targetMetric}" "${this.featureImportanceMethod}"`,
            )

            console.log("Python training output:")
            console.log(stdout)

            if (stderr) {
                console.error("Python training errors:")
                console.error(stderr)
            }

            // Load results
            const optimalParamsPath = path.join(outputFolder, "optimal_parameters.json")
            const featureImportancePath = path.join(outputFolder, "feature_importance.json")
            const metricsPath = path.join(outputFolder, "model_metrics.json")

            if (fs.existsSync(optimalParamsPath)) {
                this.optimizedParameters = JSON.parse(fs.readFileSync(optimalParamsPath, "utf8"))
            }

            if (fs.existsSync(featureImportancePath)) {
                this.featureImportance = JSON.parse(fs.readFileSync(featureImportancePath, "utf8"))
            }

            if (fs.existsSync(metricsPath)) {
                this.modelMetrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"))
            }

            console.log("Model training completed successfully.")
            return {
                optimizedParameters: this.optimizedParameters,
                featureImportance: this.featureImportance,
                modelMetrics: this.modelMetrics,
            }
        } catch (error) {
            console.error("Error training ML model:", error)
            throw error
        }
    }

    /**
     * Get the most important features from the trained model
     */
    getImportantFeatures(topN = 10) {
        if (!this.featureImportance) {
            throw new Error("No feature importance data available. Train a model first.")
        }

        const { feature_names, importance_values } = this.featureImportance

        // Get top N features
        const result = feature_names
            .map((name, i) => ({ name, importance: importance_values[i] }))
            .slice(0, topN)

        return result
    }

    /**
     * Get the optimized strategy parameters
     */
    getOptimizedParameters() {
        if (!this.optimizedParameters) {
            throw new Error("No optimized parameters available. Train a model first.")
        }

        return this.optimizedParameters
    }

    /**
     * Generate a report on model performance and feature importance
     */
    generateReport(outputFile = "ml_optimization_report.html") {
        if (!this.modelMetrics || !this.featureImportance || !this.optimizedParameters) {
            throw new Error("No model results available. Train a model first.")
        }

        // Create HTML content
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>ML Strategy Optimization Results</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                tr:hover { background-color: #ddd; }
                .metric-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 10px; flex: 1; min-width: 200px; }
                .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .metric-label { font-size: 14px; color: #666; }
                .metrics-container { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
                .bar-chart { margin: 20px 0; }
                .bar { height: 25px; margin: 5px 0; background-color: #4CAF50; }
                .bar-label { display: inline-block; width: 200px; }
                .bar-value { display: inline-block; margin-left: 10px; }
            </style>
        </head>
        <body>
            <h1>Machine Learning Strategy Optimization Results</h1>
            
            <div class="metrics-container">
                <div class="metric-box">
                    <div class="metric-label">Model Type</div>
                    <div class="metric-value">${this.modelType}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Target Metric</div>
                    <div class="metric-value">${this.targetMetric}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Validation R²</div>
                    <div class="metric-value">${this.modelMetrics.val_r2.toFixed(4)}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Validation RMSE</div>
                    <div class="metric-value">${this.modelMetrics.val_rmse.toFixed(4)}</div>
                </div>
            </div>
            
            <h2>Optimal Strategy Parameters</h2>
            <table>
                <tr>
                    <th>Parameter</th>
                    <th>Optimal Value</th>
                    <th>Importance</th>
                </tr>
                ${Object.entries(this.optimizedParameters)
                    .map(([param, value]) => {
                        const importance = this.modelMetrics.parameter_importance[param] || 0
                        return `
                        <tr>
                            <td>${param}</td>
                            <td>${value}</td>
                            <td>${importance.toFixed(4)}</td>
                        </tr>
                        `
                    })
                    .join("")}
            </table>
            
            <h2>Feature Importance</h2>
            <div class="bar-chart">
                ${this.featureImportance.feature_names
                    .slice(0, 20) // Show top 20 features
                    .map((feature, i) => {
                        const importance = this.featureImportance.importance_values[i]
                        const maxImportance = Math.max(...this.featureImportance.importance_values)
                        const widthPercent = (importance / maxImportance) * 100

                        return `
                        <div>
                            <span class="bar-label">${feature}</span>
                            <div class="bar" style="width: ${widthPercent}%;"></div>
                            <span class="bar-value">${importance.toFixed(4)}</span>
                        </div>
                        `
                    })
                    .join("")}
            </div>
            
            <h2>Model Performance Metrics</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Training</th>
                    <th>Validation</th>
                </tr>
                <tr>
                    <td>RMSE</td>
                    <td>${this.modelMetrics.train_rmse.toFixed(4)}</td>
                    <td>${this.modelMetrics.val_rmse.toFixed(4)}</td>
                </tr>
                <tr>
                    <td>R²</td>
                    <td>${this.modelMetrics.train_r2.toFixed(4)}</td>
                    <td>${this.modelMetrics.val_r2.toFixed(4)}</td>
                </tr>
            </table>
            
            <h2>Next Steps</h2>
            <p>
                Use the optimal parameters in your strategy:
                <pre>
const strategy = new BBRSIStrategy({
    ${Object.entries(this.optimizedParameters)
        .map(([param, value]) => `    ${param}: ${value}`)
        .join(",\n")}
});
                </pre>
            </p>
            
            <p>
                Focus on the most important features for further optimization:
                <ul>
                    ${this.getImportantFeatures(5)
                        .map(
                            ({ name, importance }) =>
                                `<li>${name} (importance: ${importance.toFixed(4)})</li>`,
                        )
                        .join("")}
                </ul>
            </p>
        </body>
        </html>
        `

        // Write the report to file
        fs.writeFileSync(outputFile, html)
        console.log(`ML optimization report saved to ${outputFile}`)
        return outputFile
    }
}

module.exports = MLOptimizer
