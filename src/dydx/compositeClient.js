const {
    Network,
    CompositeClient,
    LocalWallet,
    BECH32_PREFIX,
    SubaccountClient,
    OrderType,
    OrderSide,
    OrderTimeInForce,
    OrderExecution,
} = require("@dydxprotocol/v4-client-js")
require("dotenv").config()

async function getCompositeClient() {
    const MNEMONIC = process.env.MNEMONIC
    const networkType = process.env.NETWORK_TYPE

    let network

    if (networkType === "mainnet") {
        network = Network.mainnet()
    } else {
        network = Network.testnet()
    }

    const client = await CompositeClient.connect(network)

    const wallet = await LocalWallet.fromMnemonic(MNEMONIC, BECH32_PREFIX)

    async function placeOrder() {
        const subaccount = new SubaccountClient(wallet, 0)
        const clientId = 123 // set to a number, can be used by the client to identify the order
        const market = "BTC-USD" // perpertual market id
        const type = OrderType.LIMIT // order type
        const side = OrderSide.BUY // side of the order
        const timeInForce = OrderTimeInForce.IOC // UX TimeInForce
        const execution = OrderExecution.DEFAULT
        const price = 96000 // price of 30,000;
        const size = 0.0001 // subticks are calculated by the price of the order
        const postOnly = false // If true, order is post only
        const reduceOnly = false // if true, the order will only reduce the position size
        const triggerPrice = null // required for conditional orders

        // console.log(client)
        const order = await client.placeOrder(
            subaccount,
            market,
            type,
            side,
            price,
            size,
            clientId,
            timeInForce,
            0,
            execution,
            postOnly,
            reduceOnly,
            triggerPrice,
        )
        const tx = await order.tx
        console.log("Order successful, tx:", tx)
        return order
    }

    async function closeOrder(orderId) {
        const order = await client.cancelOrder(orderId)

        return order
    }

    return { client, wallet, placeOrder, closeOrder }
}

// getCompositeClient()
//     .then((client) => {
//         console.log(client)
//     })
//     .catch((error) => {
//         console.error(error)
//     })

module.exports = { getCompositeClient }
