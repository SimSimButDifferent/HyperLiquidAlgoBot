# dYdX v4 Scalping Bot

A scalping trading bot for dYdX v4 platform focusing on BTC-USD market.

## Features

- 15-minute timeframe scalping strategy
- Multiple technical indicators (RSI, VWAP, ATR)
- Real-time position monitoring
- SQLite database for trade tracking
- Comprehensive logging system
- Rate limiting and API protection
- Test mode support

## Prerequisites

- Node.js >= 16
- TypeScript
- dYdX v4 account (non-US/Canada)
- Initial trading capital (USDC)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your details:
   ```
   PRIVATE_KEY=your_private_key
   DYDX_ADDRESS=your_dydx_address
   ```
4. Configure trading parameters in `config/default.json`

## Usage

1. Start in test mode (default):

   ```bash
   npm start
   ```

2. Start in production mode:
   ```bash
   NODE_ENV=production npm start
   ```

## Configuration

Edit `config/default.json` to modify:

- Position size
- Stop loss/take profit levels
- Maximum concurrent positions
- Technical indicator parameters
- Daily loss limits
- Logging preferences

## Database Schema

The SQLite database tracks:

- Trade entry/exit points
- Position sizes
- PnL
- Win rate statistics
- Performance metrics
- Indicator values at entry/exit

## Monitoring

- Console logs for real-time updates
- Detailed log files in `logs/` directory
- Trade performance metrics in SQLite database

## Safety Features

- Daily loss limit (10%)
- Maximum concurrent positions (3)
- Rate limiting protection
- Test mode for strategy validation

## Disclaimer

This bot is for educational purposes only. Trading cryptocurrency carries significant risk. Make sure you understand the risks and comply with all local regulations.
