const fs = require("fs")
const path = require("path")
// Remove plotly API requirement since we're generating HTML directly
// const plotly = require("plotly")("username", "apiKey") // You'll need to sign up at plot.ly for free API key
// Use dynamic import for the 'open' package
// const open = require("open")

class BacktestVisualizer {
    constructor() {
        this.equityCurveData = null
        this.tradeData = null
    }

    loadData(equityCurveFile = "equity_curve.json", tradesFile = "backtest_trades.json") {
        try {
            // Load equity curve data
            const equityCurveContent = fs.readFileSync(equityCurveFile, "utf8")
            this.equityCurveData = JSON.parse(equityCurveContent)

            // Load trade data
            const tradesContent = fs.readFileSync(tradesFile, "utf8")
            this.tradeData = JSON.parse(tradesContent)

            console.log(
                `Loaded ${this.equityCurveData.length} equity points and ${this.tradeData.length} trades`,
            )
            return true
        } catch (error) {
            console.error(`Error loading data: ${error.message}`)
            return false
        }
    }

    generateEquityCurveChart(outputFile = "equity_curve_chart.html") {
        if (!this.equityCurveData) {
            console.error("No equity curve data loaded. Call loadData() first.")
            return false
        }

        // Format dates and extract equity values
        const dates = this.equityCurveData.map((point) => new Date(point.time))
        const equity = this.equityCurveData.map((point) => point.equity)
        const prices = this.equityCurveData.map((point) => point.price)

        // Create equity curve trace
        const equityTrace = {
            x: dates,
            y: equity,
            type: "scatter",
            mode: "lines",
            name: "Account Equity",
            line: {
                color: "rgba(0, 128, 0, 1)",
                width: 2,
            },
        }

        // Create price trace on secondary y-axis
        const priceTrace = {
            x: dates,
            y: prices,
            type: "scatter",
            mode: "lines",
            name: "Price",
            yaxis: "y2",
            line: {
                color: "rgba(128, 128, 128, 0.5)",
                width: 1,
            },
        }

        // Add trade entry/exit markers
        const longEntries = []
        const longExits = []
        const shortEntries = []
        const shortExits = []

        if (this.tradeData) {
            this.tradeData.forEach((trade) => {
                // Find corresponding price points in equity curve
                const entryPoint = this.equityCurveData.find(
                    (point) => point.time === trade.entryTime,
                )
                const exitPoint = this.equityCurveData.find(
                    (point) => point.time === trade.exitTime,
                )

                if (entryPoint && exitPoint) {
                    if (trade.type === "LONG") {
                        longEntries.push({
                            x: new Date(trade.entryTime),
                            y: entryPoint.price,
                        })
                        longExits.push({
                            x: new Date(trade.exitTime),
                            y: exitPoint.price,
                        })
                    } else {
                        shortEntries.push({
                            x: new Date(trade.entryTime),
                            y: entryPoint.price,
                        })
                        shortExits.push({
                            x: new Date(trade.exitTime),
                            y: exitPoint.price,
                        })
                    }
                }
            })
        }

        // Create marker traces for entries and exits
        const longEntryTrace = {
            x: longEntries.map((p) => p.x),
            y: longEntries.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            name: "Long Entries",
            yaxis: "y2",
            marker: {
                color: "green",
                symbol: "triangle-up",
                size: 10,
            },
        }

        const longExitTrace = {
            x: longExits.map((p) => p.x),
            y: longExits.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            name: "Long Exits",
            yaxis: "y2",
            marker: {
                color: "darkgreen",
                symbol: "triangle-down",
                size: 10,
            },
        }

        const shortEntryTrace = {
            x: shortEntries.map((p) => p.x),
            y: shortEntries.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            name: "Short Entries",
            yaxis: "y2",
            marker: {
                color: "red",
                symbol: "triangle-down",
                size: 10,
            },
        }

        const shortExitTrace = {
            x: shortExits.map((p) => p.x),
            y: shortExits.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            name: "Short Exits",
            yaxis: "y2",
            marker: {
                color: "darkred",
                symbol: "triangle-up",
                size: 10,
            },
        }

        // Combine all traces
        const data = [
            equityTrace,
            priceTrace,
            longEntryTrace,
            longExitTrace,
            shortEntryTrace,
            shortExitTrace,
        ]

        // Create chart layout
        const layout = {
            title: "Backtest Equity Curve and Trade Points",
            xaxis: {
                title: "Date",
                type: "date",
            },
            yaxis: {
                title: "Equity ($)",
                side: "left",
            },
            yaxis2: {
                title: "Price",
                side: "right",
                overlaying: "y",
            },
            legend: {
                orientation: "h",
                y: -0.2,
            },
            margin: {
                l: 60,
                r: 60,
                t: 60,
                b: 80,
            },
        }

        // Generate plotly figure
        const figure = { data, layout }

        // Create HTML file with the chart
        const htmlContent = this.generateHTMLChart(figure, "Equity Curve")
        fs.writeFileSync(outputFile, htmlContent)

        console.log(`Chart saved to ${outputFile}`)
        return outputFile
    }

    generateTradePerformanceChart(outputFile = "trade_performance_chart.html") {
        if (!this.tradeData) {
            console.error("No trade data loaded. Call loadData() first.")
            return false
        }

        // Extract trade performance data
        const tradePnLs = this.tradeData.map((trade) => trade.pnl)
        const tradeNumbers = Array.from({ length: tradePnLs.length }, (_, i) => i + 1)
        const cumulativePnL = tradePnLs.reduce((acc, pnl, i) => {
            const previousSum = i > 0 ? acc[i - 1] : 0
            return [...acc, previousSum + pnl]
        }, [])

        // Separate winning and losing trades
        const winningTrades = this.tradeData.filter((trade) => trade.pnl > 0)
        const losingTrades = this.tradeData.filter((trade) => trade.pnl <= 0)

        // Group trades by exit reason
        const exitReasons = [...new Set(this.tradeData.map((trade) => trade.exitReason))]
        const pnlByExitReason = {}

        exitReasons.forEach((reason) => {
            const trades = this.tradeData.filter((trade) => trade.exitReason === reason)
            pnlByExitReason[reason] = trades.reduce((sum, trade) => sum + trade.pnl, 0)
        })

        // Create trace for trade P&L
        const tradePnLTrace = {
            x: tradeNumbers,
            y: tradePnLs,
            type: "bar",
            name: "Trade P&L",
            marker: {
                color: tradePnLs.map((pnl) => (pnl > 0 ? "green" : "red")),
            },
        }

        // Create trace for cumulative P&L
        const cumulativePnLTrace = {
            x: tradeNumbers,
            y: cumulativePnL,
            type: "scatter",
            mode: "lines+markers",
            name: "Cumulative P&L",
            line: {
                color: "blue",
                width: 2,
            },
        }

        // Pie chart for winning vs losing trades
        const winLosePieTrace = {
            labels: ["Winning Trades", "Losing Trades"],
            values: [winningTrades.length, losingTrades.length],
            type: "pie",
            domain: {
                row: 0,
                column: 1,
            },
            name: "Win/Loss Ratio",
            marker: {
                colors: ["green", "red"],
            },
        }

        // Pie chart for P&L by exit reason
        const pnlByExitReasonPieTrace = {
            labels: Object.keys(pnlByExitReason),
            values: Object.values(pnlByExitReason),
            type: "pie",
            domain: {
                row: 1,
                column: 1,
            },
            name: "P&L by Exit Reason",
            marker: {
                colors: ["blue", "purple", "orange"],
            },
        }

        // Combine all traces
        const data = [tradePnLTrace, cumulativePnLTrace]

        // Create chart layout
        const layout = {
            title: "Trade Performance Analysis",
            grid: {
                rows: 1,
                columns: 1,
            },
            xaxis: {
                title: "Trade Number",
            },
            yaxis: {
                title: "P&L ($)",
            },
            legend: {
                orientation: "h",
                y: -0.2,
            },
            margin: {
                l: 60,
                r: 60,
                t: 60,
                b: 80,
            },
        }

        // Generate plotly figure
        const figure = { data, layout }

        // Create separate pie chart figures
        const winLosePieFigure = {
            data: [winLosePieTrace],
            layout: {
                title: "Win/Loss Distribution",
                height: 400,
                width: 500,
            },
        }

        const pnlByExitReasonPieFigure = {
            data: [pnlByExitReasonPieTrace],
            layout: {
                title: "P&L by Exit Reason",
                height: 400,
                width: 500,
            },
        }

        // Create HTML content with all charts
        const htmlContent = this.generateHTMLWithMultipleCharts(
            {
                tradePerformance: figure,
                winLossRatio: winLosePieFigure,
                pnlByExitReason: pnlByExitReasonPieFigure,
            },
            "Trade Performance Analysis",
        )

        fs.writeFileSync(outputFile, htmlContent)

        console.log(`Chart saved to ${outputFile}`)
        return outputFile
    }

    generateDrawdownChart(outputFile = "drawdown_chart.html") {
        if (!this.equityCurveData) {
            console.error("No equity curve data loaded. Call loadData() first.")
            return false
        }

        // Calculate drawdown at each point
        const equity = this.equityCurveData.map((point) => point.equity)
        const dates = this.equityCurveData.map((point) => new Date(point.time))

        let peak = equity[0]
        const drawdowns = equity.map((eq) => {
            if (eq > peak) peak = eq
            const drawdown = ((peak - eq) / peak) * 100 // Convert to percentage
            return drawdown
        })

        // Find maximum drawdown
        const maxDrawdown = Math.max(...drawdowns)
        const maxDrawdownIndex = drawdowns.indexOf(maxDrawdown)

        // Create drawdown trace
        const drawdownTrace = {
            x: dates,
            y: drawdowns,
            type: "scatter",
            mode: "lines",
            name: "Drawdown (%)",
            line: {
                color: "red",
                width: 2,
            },
        }

        // Mark maximum drawdown
        const maxDrawdownTrace = {
            x: [dates[maxDrawdownIndex]],
            y: [drawdowns[maxDrawdownIndex]],
            type: "scatter",
            mode: "markers+text",
            name: "Max Drawdown",
            text: [`${maxDrawdown.toFixed(2)}%`],
            textposition: "top",
            marker: {
                color: "black",
                size: 10,
            },
        }

        // Combine traces
        const data = [drawdownTrace, maxDrawdownTrace]

        // Create chart layout
        const layout = {
            title: "Equity Drawdown Analysis",
            xaxis: {
                title: "Date",
                type: "date",
            },
            yaxis: {
                title: "Drawdown (%)",
                autorange: "reversed", // Inverting axis to show drawdowns as negative
            },
            legend: {
                orientation: "h",
                y: -0.2,
            },
        }

        // Generate plotly figure
        const figure = { data, layout }

        // Create HTML file with the chart
        const htmlContent = this.generateHTMLChart(figure, "Drawdown Analysis")
        fs.writeFileSync(outputFile, htmlContent)

        console.log(`Drawdown chart saved to ${outputFile}`)
        return outputFile
    }

    // Helper to generate HTML with embedded plotly chart
    generateHTMLChart(figure, title) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .chart-container { width: 100%; height: 600px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div id="chart" class="chart-container"></div>
            <script>
                const figure = ${JSON.stringify(figure)};
                Plotly.newPlot('chart', figure.data, figure.layout);
            </script>
        </body>
        </html>
        `
    }

    // Helper to generate HTML with multiple charts
    generateHTMLWithMultipleCharts(figures, title) {
        const chartDivs = Object.keys(figures)
            .map((id) => `<div id="${id}" class="chart-container"></div>`)
            .join("\n")

        const chartScripts = Object.entries(figures)
            .map(
                ([id, figure]) => `
            const figure_${id} = ${JSON.stringify(figure)};
            Plotly.newPlot('${id}', figure_${id}.data, figure_${id}.layout);
        `,
            )
            .join("\n")

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .chart-container { width: 100%; height: 500px; margin-bottom: 40px; }
                .chart-grid { display: flex; flex-wrap: wrap; }
                .chart-grid .chart-container { width: 48%; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            ${chartDivs}
            <script>
                ${chartScripts}
            </script>
        </body>
        </html>
        `
    }

    // Generate all charts and open in browser
    async generateAllCharts() {
        // Make sure data is loaded
        if (!this.equityCurveData || !this.tradeData) {
            console.error("No data loaded. Call loadData() first.")
            return false
        }

        // Generate all charts
        const equityCurveChartFile = this.generateEquityCurveChart()
        const tradePerformanceChartFile = this.generateTradePerformanceChart()
        const drawdownChartFile = this.generateDrawdownChart()

        // Create summary report
        this.generateSummaryReport("backtest_summary.html")

        // Try to open the summary in browser
        try {
            // Use dynamic import for 'open'
            console.log("Generated summary report: backtest_summary.html")
            console.log("Please open backtest_summary.html in your browser to view the results")
            // const open = await import('open');
            // await open.default("backtest_summary.html");
            // console.log("Opening summary report in browser")
        } catch (error) {
            console.log(
                "Could not automatically open browser. Please open backtest_summary.html manually.",
            )
        }

        return true
    }

    // Generate a summary HTML report with links to all charts
    generateSummaryReport(outputFile = "backtest_summary.html") {
        const tradeStats = JSON.parse(fs.readFileSync("trade_statistics.json", "utf8"))

        // Calculate key metrics
        const initialCapital = this.equityCurveData[0].equity
        const finalEquity = this.equityCurveData[this.equityCurveData.length - 1].equity
        const totalReturn = (((finalEquity - initialCapital) / initialCapital) * 100).toFixed(2)

        // Format trade statistics into HTML
        const formatTradeStats = (stats) => {
            let html = '<table class="stats-table">'
            html += '<tr><th colspan="2">Trade Statistics</th></tr>'
            html += `<tr><td>Total Trades</td><td>${stats.totalTrades}</td></tr>`
            html += `<tr><td>Profitable Trades</td><td>${stats.profitableTrades} (${(stats.winRate * 100).toFixed(2)}%)</td></tr>`
            html += `<tr><td>Losing Trades</td><td>${stats.losingTrades}</td></tr>`
            html += `<tr><td>Average Profit per Trade</td><td>$${stats.averageProfitPerTrade.toFixed(2)}</td></tr>`
            html += `<tr><td>Average Win</td><td>$${stats.averageWin.toFixed(2)}</td></tr>`
            html += `<tr><td>Average Loss</td><td>$${stats.averageLoss.toFixed(2)}</td></tr>`
            html += `<tr><td>Largest Win</td><td>$${stats.largestWin.toFixed(2)}</td></tr>`
            html += `<tr><td>Largest Loss</td><td>$${stats.largestLoss.toFixed(2)}</td></tr>`
            html += "</table>"
            return html
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Backtest Summary Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                .summary-container { margin-bottom: 30px; }
                .chart-links { margin-top: 20px; }
                .chart-links a { display: block; margin-bottom: 10px; }
                .stats-table { border-collapse: collapse; width: 100%; max-width: 600px; }
                .stats-table td, .stats-table th { border: 1px solid #ddd; padding: 8px; }
                .stats-table th { padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #4CAF50; color: white; }
                .key-metrics { display: flex; flex-wrap: wrap; margin-bottom: 20px; }
                .metric-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px; margin: 10px; flex: 1; min-width: 200px; }
                .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
                .metric-label { font-size: 14px; color: #666; }
                .positive { color: green; }
                .negative { color: red; }
            </style>
        </head>
        <body>
            <h1>Backtest Summary Report</h1>
            
            <div class="summary-container">
                <h2>Key Metrics</h2>
                <div class="key-metrics">
                    <div class="metric-box">
                        <div class="metric-label">Initial Capital</div>
                        <div class="metric-value">$${initialCapital.toFixed(2)}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Final Equity</div>
                        <div class="metric-value">$${finalEquity.toFixed(2)}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Total Return</div>
                        <div class="metric-value ${parseFloat(totalReturn) >= 0 ? "positive" : "negative"}">${totalReturn}%</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Win Rate</div>
                        <div class="metric-value">${(tradeStats.winRate * 100).toFixed(2)}%</div>
                    </div>
                </div>
                
                ${formatTradeStats(tradeStats)}
            </div>
            
            <div class="chart-links">
                <h2>Detailed Charts</h2>
                <a href="equity_curve_chart.html" target="_blank">Equity Curve Chart</a>
                <a href="trade_performance_chart.html" target="_blank">Trade Performance Analysis</a>
                <a href="drawdown_chart.html" target="_blank">Drawdown Analysis</a>
            </div>
        </body>
        </html>
        `

        fs.writeFileSync(outputFile, html)
        console.log(`Summary report saved to ${outputFile}`)
        return outputFile
    }
}

module.exports = BacktestVisualizer
