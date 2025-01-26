# Hyperliquid EMA Cross Trading Bot

An automated trading bot that implements an EMA (Exponential Moving Average) crossover strategy on the Hyperliquid DEX. The bot monitors BTC-PERP price movements and executes trades based on the crossover of short (9-period) and long (21-period) EMAs.

## Features

- Real-time price monitoring via Hyperliquid WebSocket
- EMA crossover strategy implementation
- Configurable trading parameters
- Comprehensive logging system
- Automated trade execution
- Risk management controls

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Hyperliquid account and API keys

## Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd hyperliquid-ema-bot
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create a `.env` file in the root directory:
    ```env
    PRIVATE_KEY_TEST=your_private_key_here
    ```

## Configuration

The bot's behavior can be customized through the `config/default.json` file:

```json
{
    "trading": {
        "market": "BTC-PERP",
        "positionSize": 5,
        "leverage": 5,
        "timeframe": "1m"
        // ... other trading parameters
    }
}
```

### Key Configuration Parameters

- `market`: Trading pair (default: BTC-PERP)
- `positionSize`: Position size in USD
- `leverage`: Trading leverage
- `timeframe`: Candlestick interval
- `stopLoss`: Stop loss percentage
- `takeProfit`: Take profit percentage

## Usage

Start the trading bot:

```bash
npm start
```

## Strategy Details

The bot implements an EMA crossover strategy:

- **Entry Signal (LONG)**: When the short-term EMA (9) crosses above the long-term EMA (21)
- **Exit Signal**: When the short-term EMA crosses below the long-term EMA

## Project Structure

```
├── src/
│   ├── application/
│   │   └── controller.js
│   ├── hyperliquid/
│   │   ├── marketInfo.js
│   │   └── websocket.js
│   └── strategy/
│       ├── ScalpingStrategy.js
│       └── indicators/
│           └── ema.js
├── config/
│   └── default.json
└── .env
```

## Safety Features

- Configurable position sizes
- Stop-loss and take-profit mechanisms
- Daily loss limits
- Rate limiting
- Comprehensive error handling

## Logging

The bot maintains detailed logs in:

- Console output for important information
- `bot.log` file for debugging and detailed operations

## Disclaimer

This bot is for educational purposes only. Cryptocurrency trading carries significant risks. Always test thoroughly on testnet before using real funds.

## License

[Your chosen license]

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
