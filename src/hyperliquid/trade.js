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

class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests
        this.timeWindow = timeWindow
        this.requests = []
        this.blocked = false
    }

    async waitIfNeeded() {
        const now = Date.now()
        // Remove old requests
        this.requests = this.requests.filter((time) => now - time < this.timeWindow)

        if (this.requests.length >= this.maxRequests) {
            // Calculate required wait time
            const oldestRequest = this.requests[0]
            const waitTime = this.timeWindow - (now - oldestRequest)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            return this.waitIfNeeded() // Recursively check again
        }

        this.requests.push(now)
    }
}

class SDKPool {
    constructor() {
        this.sdk = null
        this.lastUsed = null
        this.connectionTimeout = 30000 // 30 seconds
        this.rateLimiter = new RateLimiter(1, 10000) // 1 request every 10 seconds
    }

    async getSDK() {
        await this.rateLimiter.waitIfNeeded()

        const now = Date.now()
        if (!this.sdk || !this.lastUsed || now - this.lastUsed > this.connectionTimeout) {
            if (this.sdk) {
                try {
                    await this.sdk.disconnect()
                } catch (error) {
                    console.error("Error disconnecting old SDK:", error)
                }
            }

            this.sdk = new Hyperliquid({
                privateKey: privateKey,
                address: address,
                testnet: testnet,
                enableWs: false,
            })

            await this.sdk.connect()
        }

        this.lastUsed = now
        return this.sdk
    }

    async releaseSDK() {
        // Don't disconnect immediately, let the timeout handle it
        this.lastUsed = Date.now()
    }
}

const sdkPool = new SDKPool()

async function limitLong(symbol, quantity, limitPrice) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        const orderRequest = {
            coin: symbol,
            is_buy: false, // Selling to take profit on long
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Gtc", // Good-till-cancelled for take profit orders
                },
            },
            reduce_only: true, // This is a closing order
        }

        console.log("Take profit order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in limitLong:", error)
        throw error
    } finally {
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function limitShort(symbol, quantity, limitPrice) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        const orderRequest = {
            coin: symbol,
            is_buy: true, // Buying to take profit on short
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Gtc", // Good-till-cancelled for take profit orders
                },
            },
            reduce_only: true, // This is a closing order
        }

        console.log("Take profit order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in limitShort:", error)
        throw error
    } finally {
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function openShort(symbol, quantity) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        const currentPrice = await getCurrentPrice(symbol)
        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market sell, set limit price slightly lower than current price
        const limitPrice = parseFloat((currentPrice * 0.995).toFixed(0))

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
            reduce_only: false,
        }

        console.log("Short order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in openShort:", error)
        throw error
    } finally {
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function closeShort(symbol, quantity) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

        const parsedQuantity = parseFloat(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new Error("Invalid quantity. Must be a positive number")
        }

        const currentPrice = await getCurrentPrice(symbol)
        if (!currentPrice || typeof currentPrice !== "number") {
            throw new Error("Invalid current price received")
        }

        // For market buy, set limit price slightly higher than current price
        const limitPrice = parseFloat((currentPrice * 1.005).toFixed(0))

        const orderRequest = {
            coin: symbol,
            is_buy: true,
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Gtc",
                },
            },
            reduce_only: true,
        }

        console.log("Close short order request:", orderRequest)
        const order = await sdk.exchange.placeOrder(orderRequest)
        return order
    } catch (error) {
        console.error("Error in closeShort:", error)
        throw error
    } finally {
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function cancelOrder(orderId) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()
        const order = await sdk.exchange.cancelOrder(orderId)
        console.log("Order cancelled:", orderId)
        return order
    } catch (error) {
        console.error("Error cancelling order:", error)
        throw error
    } finally {
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function setLeverage(symbol, leverageAmount, leverageMode) {
    const sdk = new Hyperliquid({
        privateKey: privateKey,
        address: address,
        testnet: testnet,
        enableWs: false,
    })

    try {
        await sdk.connect()

        const result = await sdk.exchange.updateLeverage(symbol, leverageMode, leverageAmount)
        console.log("Leverage set")
        return result
    } catch (error) {
        console.error("Error in setLeverage:", error)
        throw error
    } finally {
        sdk.disconnect()
    }
}

async function openLong(symbol, quantity) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

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

        const orderRequest = {
            coin: symbol,
            is_buy: true,
            sz: parsedQuantity,
            limit_px: limitPrice,
            order_type: {
                limit: {
                    tif: "Gtc",
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
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function closeLong(symbol, quantity) {
    let sdk
    try {
        sdk = await sdkPool.getSDK()

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
        if (sdk) {
            await sdkPool.releaseSDK()
        }
    }
}

async function withRetry(operation, maxRetries = 3) {
    let lastError
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            if (error.code === 429) {
                const waitTime = Math.pow(2, i) * 1000 // exponential backoff: 1s, 2s, 4s
                console.log(`Rate limited. Waiting ${waitTime}ms before retry...`)
                await new Promise((resolve) => setTimeout(resolve, waitTime))
                continue
            }
            throw error // If it's not a rate limit error, throw immediately
        }
    }
    throw lastError
}

module.exports = {
    openLong: (symbol, quantity) => withRetry(() => openLong(symbol, quantity)),
    closeLong: (symbol, quantity) => withRetry(() => closeLong(symbol, quantity)),
    openShort: (symbol, quantity) => withRetry(() => openShort(symbol, quantity)),
    closeShort: (symbol, quantity) => withRetry(() => closeShort(symbol, quantity)),
    limitLong: (symbol, quantity, price) => withRetry(() => limitLong(symbol, quantity, price)),
    limitShort: (symbol, quantity, price) => withRetry(() => limitShort(symbol, quantity, price)),
    cancelOrder: (orderId) => withRetry(() => cancelOrder(orderId)),
    setLeverage: (symbol, leverage, mode) => withRetry(() => setLeverage(symbol, leverage, mode)),
}

// setLeverage("BTC-PERP", 20, "isolated").catch(console.error)

// const orderRequest = {
//     coin: "SOL-PERP",
//     is_buy: true,
//     sz: 15,
//     limit_px: 180,
//     order_type: { limit: { tif: "Gtc" } },
//     reduce_only: false,
//     cloid: cloid,
// }
