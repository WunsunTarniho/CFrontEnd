const fs = require('fs');

const path = 'c:/Chart Libary - Copy/ChartFrontEnd/Chartify/lib/websocket-worker.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Array of tuples: [searchStringOrRegex, replacement]
const replacements = [
    // Binance Spot
    ["streams.push(`${ticker}@depth@100ms`);", "/* depth removed (lazy load) */"],
    // Binance Futures
    ["streams.push(`${symLower}@depth@100ms`);", "/* depth removed (lazy load) */"],
    // Bybit / Bybit Futures
    ["args.push(\"orderbook.50.\" + exchangeSymbol);", "/* depth removed (lazy load) */"],
    // OKX
    ["args.push({ channel: \"books\", instId: instId });", "/* depth removed (lazy load) */"],
    // OKX Futures
    ["args.push({ instType, channel: \"books\", instId: wireSymbol });", "/* depth removed (lazy load) */"],
    // Bitget
    ["args.push({ instType: \"ANY\", channel: \"books\", instId: exchangeSymbol });", "/* depth removed (lazy load) */"],
    // MEXC 
    ["params.push(`spot@public.aggre.depth.v3.api.pb@100ms@${wireSymbol}`);", "/* depth removed (lazy load) */"],
    ["params.push(`spot@public.aggre.depth.v3.api.pb@100ms@${exchangeSymbol}`);", "/* depth removed (lazy load) */"],
    ["method: \"sub.depth\",", "/* method: \"sub.depth\", (lazy load) */"],
    // Coinbase 
    ["channels: [\"ticker\", \"level2\", \"matches\"]", "channels: [\"ticker\", \"matches\"]"],
    // Kucoin (Spot uses topic: /spotMarket/level2Depth50)
    [/id: Date.now\(\), type: 'subscribe', topic: `\/spotMarket\/level2Depth50:\$\{wireSymbol\}`[^]*?response: true\n\s*\}\)\);/g, "/* depth removed (lazy load) */"],
    // Kucoin (Futures uses topic: /contractMarket/level2)
    [/id: Date.now\(\), type: 'subscribe', topic: `\/contractMarket\/level2:\$\{wireSymbol\}`[^]*?response: true\n\s*\}\)\);/g, "/* depth removed (lazy load) */"],
    // Kraken / Kraken Futures
    [/\{\s*channel: 'book',\s*depth: 25,\s*symbol: \[wireSymbol\]\s*\}/g, "/* depth removed (lazy load) */"],
    [/\{\s*feed: 'book',\s*product_ids: \[wireSymbol\]\s*\}/g, "/* depth removed (lazy load) */"],
    // Gateio 
    [/\{\s*time: Math\.floor\(Date\.now\(\) \/ 1000\),\s*channel: \"spot\.order_book\",\s*event: \"subscribe\",\s*payload: \[wireSymbol, \"20\", \"100ms\"\]\s*\}/g, "/* depth removed (lazy load) */"],
    [/\{\s*time: Math\.floor\(Date\.now\(\) \/ 1000\),\s*channel: \"futures\.order_book\",\s*event: \"subscribe\",\s*payload: \[wireSymbol, \"20\", \"0\"\]\s*\}/g, "/* depth removed (lazy load) */"]
];

replacements.forEach(([search, replace], index) => {
    const before = content;
    if (typeof search === 'string') {
        content = content.replaceAll(search, replace);
    } else {
        content = content.replace(search, replace);
    }
    
    if (before === content) {
        console.log(`[WARNING] Replacement ${index} had NO effect.`);
    } else {
        console.log(`[SUCCESS] Replacement ${index} applied.`);
    }
});

fs.writeFileSync(path, content, 'utf8');
console.log('Worker refactored successfully.');
