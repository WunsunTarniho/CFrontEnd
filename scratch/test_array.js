// Initialize global window object for ZenScript global export
global.window = {};

const fs = require('fs');
const path = require('path');

// Read and evaluate ZenScript.js
const zenScriptCode = fs.readFileSync(path.join(__dirname, '../Chartify/lib/ZenScript.js'), 'utf8');
eval(zenScriptCode);

const { Lexer, Parser, Interpreter, Validator } = global.window.ZenScript;

// Simple test case for arrays in ZenScript
const code = `
indicator("Array Test", overlay=true)

// Create array and push elements
array a = array.new_float(0)
array.push(a, 10.5)
array.push(a, 20.5)
array.push(a, 30.0)

// Retrieve size and values
float sz = array.size(a)
float val0 = array.get(a, 0)
float val1 = array.get(a, 1)
float val2 = array.get(a, 2)

// Compute stats
float avg_val = array.avg(a)
float min_val = array.min(a)
float max_val = array.max(a)
float sum_val = array.sum(a)

plot(sz, "Size")
plot(val0, "Val0")
plot(avg_val, "Avg")
plot(min_val, "Min")
plot(max_val, "Max")
plot(sum_val, "Sum")
`;

// 1. Lex and Parse
const lexer = new Lexer(code);
const parser = new Parser(lexer);
const ast = parser.parse();

// 2. Validate
const validator = new Validator(ast, code);
const errors = validator.validate();
if (errors.length > 0) {
    console.error("Validation Errors:", errors);
    process.exit(1);
} else {
    console.log("Validation passed successfully!");
}

// 3. Execute
// We need mockup historical data
const barCount = 10;
const seriesData = {
    open: new Array(barCount).fill(100),
    high: new Array(barCount).fill(105),
    low: new Array(barCount).fill(95),
    close: new Array(barCount).fill(101),
    volume: new Array(barCount).fill(1000),
    time: new Array(barCount).fill(Date.now()),
    hl2: new Array(barCount).fill(100),
    hlc3: new Array(barCount).fill(100),
    ohlc4: new Array(barCount).fill(100),
    hlcc4: new Array(barCount).fill(100),
    bar_index: Array.from({ length: barCount }, (_, i) => i)
};

const interpreter = new Interpreter(ast, seriesData);
const results = interpreter.evaluate();

console.log("Execution succeeded!");
console.log("Plots returned:", Object.keys(results.plots));
for (const [name, plotData] of Object.entries(results.plots)) {
    console.log(`Plot '${name}':`, plotData.values.slice(0, 5));
}
