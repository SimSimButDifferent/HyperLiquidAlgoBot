# Hyperliquid Algo Trading Bot

An advanced algorithmic trading bot for the Hyperliquid DEX, featuring a Bollinger Bands + RSI + ADX strategy, comprehensive backtesting framework, and machine learning optimization capabilities. This bot is designed for algorithmic trading on perpetual futures contracts, with a focus on automated strategy execution and optimization.

## Features

- **Multiple Trading Strategies**:

    - Bollinger Bands + RSI + ADX strategy (BBRSI)
    - ML-enhanced strategies with optimized parameters
    - Customizable entry/exit conditions

- **Advanced Backtesting System**:

    - Historical data analysis with realistic trade simulation
    - Performance metrics and statistics
    - Visualization of equity curves and trade performance
    - Multi-symbol testing capabilities
    - Risk management analysis

- **Machine Learning Optimization**:

    - Automated parameter optimization using ML models
    - Feature importance analysis
    - Support for different ML models (Random Forest, XGBoost, Neural Networks)
    - Optimized strategy parameter generation

- **Risk Management**:

    - Configurable position sizing
    - Take profit mechanisms
    - Liquidation prevention
    - Performance analysis

- **Visualization Tools**:
    - Equity curve visualization
    - Trade performance charts
    - Drawdown analysis
    - Interactive HTML reports

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Python 3.x (for ML optimization features)
- Python packages: numpy, pandas, scikit-learn, xgboost, shap, matplotlib

## Installation

1. Clone the repository:

    ```bash
    git clone <repository-url>
    cd hyperliquidalgobot
    ```

2. Install Node.js dependencies:

    ```bash
    npm install
    ```

3. Install Python dependencies (for ML features):

    ```bash
    pip install numpy pandas scikit-learn xgboost shap matplotlib
    ```

4. Create a `.env` file in the root directory:
    ```env
    PRIVATE_KEY=your_private_key_here
    ```

## Configuration

The bot's behavior can be customized through the configuration files in the `config/` directory:

- `default.json`: Default trading settings
- `backtest.json`: Specific settings for backtesting

### Key Configuration Parameters

**Trading Parameters:**

- `market`: Trading pair (default: BTC-PERP)
- `positionSize`: Position size as a decimal (e.g., 0.1 for 10%)
- `leverage`: Trading leverage
- `timeframe`: Candlestick interval
- `profitTarget`: Take profit percentage

**Indicator Parameters:**

- RSI settings: period, overbought, oversold levels
- Bollinger Bands settings: period, standard deviation
- ADX settings: period, threshold

## Usage

### Live Trading

Start the trading bot (not fully implemented yet):

```bash
npm start
```

### Backtesting

Run a backtest with default settings:

```bash
npm run backtest
```

Run a backtest with specific configuration:

```bash
node src/backtesting/run.js --config backtest
```

### ML-Enhanced Backtesting

Run a backtest with ML-optimized parameters:

```bash
node src/backtesting/run.js --config backtest --use-ml
```

Specify a particular ML model:

```bash
node src/backtesting/run.js --config backtest --use-ml --ml-model BTC-PERP_15m_randomforest
```

### Visualization

Visualize backtest results:

```bash
node src/backtesting/visualize.js
```

### ML Optimization

Generate ML-optimized parameters:

```bash
node src/backtesting/ml_optimize.js --market BTC-PERP --timeframe 15m
```

## Trading Strategies

### BBRSI Strategy

A strategy that combines Bollinger Bands, RSI, and ADX indicators:

- **Long Entry Conditions**:

    - Price crosses below the lower Bollinger Band
    - RSI is below the oversold level
    - ADX is above the threshold

- **Short Entry Conditions**:

    - Price crosses above the upper Bollinger Band
    - RSI is above the overbought level
    - ADX is above the threshold

- **Exit Conditions**:
    - Take profit at the configured target
    - Cross of price under/over middle Bollinger Band
    - RSI extreme levels (>80 for longs, <20 for shorts)

### ML-Enhanced Strategy

Extends the base strategies by applying machine learning optimized parameters:

- Uses the same signal generation logic as the base strategy
- Parameters are optimized using machine learning models
- Models analyze historical performance to find optimal settings
- Feature importance analysis identifies key indicators

## Project Structure

```
├── config/                      # Configuration files
│   ├── default.json             # Default trading settings
│   └── backtest.json            # Backtesting settings
├── src/
│   ├── application/             # Main application code
│   │   └── controller.js        # Application controller
│   ├── backtesting/             # Backtesting framework
│   │   ├── Backtester.js        # Core backtesting engine
│   │   ├── RiskManager.js       # Risk management module
│   │   ├── ml_optimizer.js      # ML optimization implementation
│   │   ├── ml_optimize.js       # ML optimization CLI
│   │   ├── visualization.js     # Visualization library
│   │   ├── visualize.js         # Visualization CLI
│   │   ├── run.js               # Backtesting runner
│   │   ├── strategies/          # Strategy implementations for backtesting
│   │   │   └── MLEnhancedStrategy.js  # ML-enhanced strategy
│   │   └── data/                # Historical data for backtesting
│   ├── hyperliquid/             # Hyperliquid integration
│   │   ├── marketInfo.js        # Market information fetching
│   │   ├── trade.js             # Trading functions
│   │   └── websocket.js         # WebSocket connection
│   └── strategy/                # Trading strategies
│       ├── BBRSIStrategy.js     # Bollinger Bands + RSI + ADX strategy
│       ├── ScalpingStrategy.js  # Scalping strategy
│       └── indicators/          # Technical indicators
│           ├── ema.js           # EMA calculation
│           └── index.js         # Indicator utilities
├── .env                         # Environment variables (not in repo)
└── package.json                 # Project dependencies
```

## Backtesting Results

The backtesting system generates several output files:

- `equity_curve.json`: Equity curve data
- `backtest_trades.json`: Detailed trade information
- `trade_statistics.json`: Performance statistics
- `equity_curve_chart.html`: Visual equity curve chart
- `trade_performance_chart.html`: Trade performance visualization
- `drawdown_chart.html`: Drawdown analysis
- `backtest_summary.html`: Complete backtest summary

## ML Optimization Results

The ML optimization process generates:

- Optimized parameter files in `src/backtesting/ml_models/`
- Feature importance analysis
- Performance metrics
- HTML reports

## Safety Features

- Configurable position sizing
- Take-profit mechanisms
- Risk management controls
- Comprehensive error handling

## Logging

The bot maintains detailed logs in:

- Console output for important information
- Log files for debugging and detailed operations

## Disclaimer

This bot is for educational purposes only. Cryptocurrency trading carries significant risks. Always test thoroughly on testnet before using real funds.

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
