const { Network, SocketClient } = require("@dydxprotocol/v4-client-js")
const { marketData } = require("./indexer")
const fs = require("fs")
require("dotenv").config()

function connectSocket() {
    let contents

    const address = process.env.ADDRESS
    console.log(address)

    const networkType = process.env.NETWORK_TYPE
    let network
    if (networkType === "mainnet") {
        network = Network.mainnet()
    } else {
        network = Network.testnet()
    }

    const mySocket = new SocketClient(
        network.indexerConfig,
        () => {
            console.log("socket opened")
        },
        () => {
            console.log("socket closed")
        },
        (message) => {
            // console.log(message);
            if (typeof message.data === "string") {
                const jsonString = message.data
                try {
                    const data = JSON.parse(jsonString)
                    console.log(
                        "--------------------------------DATA--------------------------------",
                    )
                    contents = data.contents
                    console.log(contents)
                    if (data.type === "connected") {
                        mySocket.subscribeToCandles("BTC-USD", "1MIN")
                        mySocket.subscribeToSubaccount(address, 0)
                    }
                    console.log(data)
                } catch (e) {
                    console.error("Error parsing JSON message:", e)
                }
            }
        },
        (event) => {
            console.error("Encountered error:", event.message)
        },
    )
    mySocket.connect()
}

// connectSocket()

module.exports = { connectSocket }
