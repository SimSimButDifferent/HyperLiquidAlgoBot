const { Hyperliquid } = require("hyperliquid")
const { getCurrentPrice, getUserOpenPositions } = require("./marketInfo")
require("dotenv").config()

const privateKey = process.env.AGENT_PRIVATE_KEY_TEST
const address = process.env.AGENT_ADDRESS
const networkType = process.env.NETWORK_TYPE

let testnet = false
if (networkType === "testnet") {
    testnet = true
}

async function limitLong(symbol, quantity, limitPrice) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        console.log("placing order")

        // Convert quantity to number and validate
        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        // Get the current market price to use as limit price
        const currentPrice = await getCurrentPrice(symbol)
        console.log("Current price:", currentPrice)

        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // 1. Place Order
        const orderRequest = {
            coin: symbol,
            is_buy: true,
            sz: parsedQuantity, // SDK will convert to string internally
            limit_px: limitPrice, // SDK will convert to string internally
            order_type: {
                limit: {
                    tif: "Ioc", // Immediate-or-Cancel for market-like orders
                },
            },
            reduce_only: false,
        }

        console.log("Order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)

        console.log(`Long Order placed: ${order}`)
        return order
    } catch (error) {
        console.error("Error in openLong:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function setLeverage(symbol, leverage, leverageMode) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        const leverage = await sdk.exchange.updateLeverage(symbol, leverage, leverageMode)
        console.log("Leverage set:", leverage)
        return leverage
    } catch (error) {
        console.error("Error in setLeverage:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function openLong(symbol, quantity) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        console.log("placing order")

        // Convert quantity to number and validate
        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        // Get the current market price to use as limit price
        const currentPrice = await getCurrentPrice(symbol)
        console.log("Current price:", currentPrice)

        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market buy, set limit price slightly higher than current price
        const limitPrice = parseFloat((currentPrice * 1.005).toFixed(0))
        console.log("Limit price:", limitPrice)

        // 1. Place Order
        const orderRequest = {
            coin: symbol,
            is_buy: true,
            sz: parsedQuantity, // SDK will convert to string internally
            limit_px: limitPrice, // SDK will convert to string internally
            order_type: {
                limit: {
                    tif: "Gtc", // Good-till-cancel for market-like orders
                },
            },
            reduce_only: false,
        }

        console.log("Order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)

        console.log(`Long Order placed: ${order}`)
        return order
    } catch (error) {
        console.error("Error in openLong:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function closeLong(symbol, quantity) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        // Convert quantity to number and validate
        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        // Get the current market price to use as limit price
        const currentPrice = await getCurrentPrice(symbol)
        console.log("Current price:", currentPrice, typeof currentPrice)

        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market sell, set limit price slightly lower than current price
        const limitPrice = parseFloat((currentPrice * 0.995).toFixed(0))
        console.log("Limit price:", limitPrice, typeof limitPrice)

        const orderRequest = {
            coin: symbol,
            is_buy: false,
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Gtc",
                },
            },

            reduce_only: true,
        }

        console.log("Closing long order:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in closeLong:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function openShort(symbol, quantity) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        console.log("placing order")

        // Convert quantity to number and validate
        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        // Get the current market price to use as limit price
        const currentPrice = await getCurrentPrice(symbol)
        console.log("Current price:", currentPrice, typeof currentPrice)

        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market sell, set limit price slightly lower than current price
        const limitPrice = parseFloat((currentPrice * 0.95).toFixed(0))
        console.log("Limit price:", limitPrice, typeof limitPrice)

        // 1. Place Order
        const orderRequest = {
            coin: symbol,
            is_buy: false,
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Ioc", // Immediate-or-Cancel for market-like orders
                },
            },
            reduce_only: false,
        }

        console.log("Order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)

        console.log(`Short Order placed: ${order.order_id}`)
        return order
    } catch (error) {
        console.error("Error in openShort:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function closeShort(symbol, quantity) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        // Convert quantity to number and validate
        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        // Get the current market price to use as limit price
        const currentPrice = await getCurrentPrice(symbol)
        console.log("Current price:", currentPrice, typeof currentPrice)

        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market buy, set limit price slightly higher than current price
        const limitPrice = parseFloat((currentPrice * 1.05).toFixed(0))
        console.log("Limit price:", limitPrice, typeof limitPrice)

        const orderRequest = {
            coin: symbol,
            is_buy: true, // Buying to close short
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Ioc", // Immediate-or-Cancel for market-like orders
                },
            },
            reduce_only: true, // This is a closing order
        }

        console.log("Closing short order:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in closeShort:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

module.exports = { openLong, openShort, closeLong, closeShort, setLeverage }

// limitLong("BTC-PERP", 0.001, 98000)
//     .then((order) => {
//         console.log("Order placed successfully:", order.response.data.statuses)
//     })
//     .catch((error) => {
//         console.error("Error in openLong:", error)
//     })

// const main = async () => {
//     const sdk = new Hyperliquid({
//         privateKey: privateKey,
//         address: address,
//         testnet: testnet,
//         enableWs: false,
//     })
//     const openPositions = await getUserOpenPositions()
//     try {
//         if (openPositions.length > 0) {
//             console.log("User has open positions")
//             const closeLongOrder = await closeLong("BTC-PERP", 0.001)
//             console.log("Close long order placed:", closeLongOrder)
//         } else {
//             console.log("User has no open positions")
//             const openLongOrder = await openLong("BTC-PERP", 0.001)
//             console.log("Open long order placed:", openLongOrder)
//         }
//     } catch (error) {
//         console.error("Error in closeLong:", error)
//     }
// }

// limitLong("BTC-PERP", 0.001, 98000)
//     .then((order) => {
//         console.log("Order placed successfully:", order)
//     })
//     .catch((error) => {
//         console.error("Error in openLong:", error)
//     })

// main()
//     .then(() => {
//         console.log("Main function completed")
//     })
//     .catch((error) => {
//         console.error("Error in main:", error)
//     })

// closeLong("BTC-PERP", 0.001)
//     .then((order) => {
//         console.log("Order placed successfully:", order.response.data.statuses)
//     })
//     .catch((error) => {
//         console.error("Error in closeLong:", error)
//     })

// const orderRequest = {
//     coin: "SOL-PERP",
//     is_buy: true,
//     sz: 15,
//     limit_px: 180,
//     order_type: { limit: { tif: "Gtc" } },
//     reduce_only: false,
//     cloid: cloid,
// }
