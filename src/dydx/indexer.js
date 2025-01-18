const { Network, IndexerClient } = require("@dydxprotocol/v4-client-js")
const fs = require("fs")
require("dotenv").config()

function getIndexerClient() {
    const networkType = process.env.NETWORK_TYPE

    let network

    if (networkType === "mainnet") {
        network = Network.mainnet()
    } else {
        network = Network.testnet()
    }

    const indexerClient = new IndexerClient(network.indexerConfig)

    return indexerClient
}

async function marketData(indexerClient) {
    // Get perpetual markets
    async function getPerpMarkets(ticker) {
        try {
            if (ticker.length > 0) {
                const response = await indexerClient.markets.getPerpetualMarkets(ticker)
                // console.log(response)

                return response.tickers
            } else {
                const response = await indexerClient.markets.getPerpetualMarkets()
                // console.log(response)
                return response.tickers
            }
        } catch (error) {
            console.log(error.message)
        }
    }

    async function getCandleStickData(ticker, timeFrame) {
        const response = await indexerClient.markets.getPerpetualMarketCandles(ticker, timeFrame)
        // console.log(response);
        fs.mkdirSync(`./src/backtesting/data/${ticker}`, { recursive: true })
        fs.writeFileSync(
            `./src/backtesting/data/${ticker}/${ticker}-${timeFrame}.json`,
            JSON.stringify(response, null, 2),
        )
        return response
    }
    return { getPerpMarkets, getCandleStickData }
}

async function accountData() {
    const networkType = process.env.NETWORK_TYPE

    const address = process.env.ADDRESS
    const mnemonic = process.env.MNEMONIC

    let network
    if (networkType === "mainnet") {
        network = Network.mainnet()
    } else {
        network = Network.testnet()
    }

    const client = new IndexerClient(network.indexerConfig)

    console.log("")
    console.log("----------------------CLIENT------------------------")
    console.log(client)
    console.log("")
    console.log("----------------------ADDRESS------------------------")
    console.log(address)
    console.log("")
    // Get subaccounts
    async function getSubaccounts() {
        try {
            const response = await client.account.getSubaccounts(address)
            console.log(response, "response")
            const subaccounts = response.subaccounts
            console.log(subaccounts)
            // const subaccount = subaccounts[0];
            // const subaccountNumber = subaccount.subaccountNumber;
            // console.log(subaccountNumber);
            return subaccounts
        } catch (error) {
            console.log(error)
        }
    }

    // console.log("----------------------GET SUBACCOUNTS------------------------")
    // console.log(await getSubaccounts())

    // Get asset positions
    async function getAssetPositions() {
        try {
            const response = await client.account.getSubaccountAssetPositions(address, 0)
            const positions = response.positions
            console.log(positions)
            if (positions.length > 0) {
                const positions0 = positions[0]
                // console.log(positions0)
            }
            return response
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET ASSET POSITIONS------------------------")
    // console.log(await getAssetPositions())
    // console.log("")

    // Get perp positions
    async function getPerpPositions() {
        try {
            const response = await client.account.getSubaccountPerpetualPositions(address, 0)
            // console.log(response)
            const positions = response.positions
            // console.log(positions)
            if (positions.length > 0) {
                const positions0 = positions[0]
                console.log(positions0)
            }
            return positions
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET PERP POSITIONS------------------------")
    // console.log(await getPerpPositions())
    // console.log("")

    // Get transfers
    async function getTransfers() {
        try {
            const response = await client.account.getSubaccountTransfers(address, 0)
            console.log(response)
            const transfers = response.transfers
            console.log(transfers)
            if (transfers.length > 0) {
                const transfer0 = transfers[0]
                console.log(transfer0)
            }
            return response
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET TRANSFERS------------------------")
    // console.log(await getTransfers())
    // console.log("")

    // Get orders
    async function getOrders() {
        try {
            const response = await client.account.getSubaccountOrders(address, 0)

            const orders = response

            if (orders.length > 0) {
                const order0 = orders[0]

                const order0Id = order0.id
            }
            return orders
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET ORDERS------------------------")
    // console.log(await getOrders())
    // console.log("")

    // Get fills
    async function getFills() {
        try {
            const response = await client.account.getSubaccountFills(address, 0)
            const fills = response.fills
            if (fills.length > 0) {
                const fill0 = fills[0]
                console.log(fill0)
            }
            return response
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET FILLS------------------------")
    // console.log(await getFills())
    // console.log("")

    // Get historical pnl
    async function getHistoricalPnl() {
        try {
            const response = await client.account.getSubaccountHistoricalPNLs(address, 0)
            // console.log(response);
            const historicalPnl = response.historicalPnl
            // console.log(historicalPnl);
            if (historicalPnl.length > 0) {
                const historicalPnl0 = historicalPnl[0]
                // console.log(historicalPnl0);
                return historicalPnl0
            }
        } catch (error) {
            console.log(error.message)
        }
    }

    // console.log("")
    // console.log("----------------------GET HISTORICAL PNL------------------------")
    // console.log(await getHistoricalPnl())
    // console.log("")

    return {
        getSubaccounts,
        getAssetPositions,
        getPerpPositions,
        getTransfers,
        getOrders,
        getFills,
        getHistoricalPnl,
    }
}

marketData()
    .then(() => {})
    .catch((error) => {
        console.log(error.message)
    })

// accountData().then(() => {
// }).catch((error) => {
//   console.log(error.message);
// });

module.exports = { getIndexerClient, accountData, marketData }
