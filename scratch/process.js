const fs = require('fs');
let code = fs.readFileSync('../../scratch/transformers.js', 'utf8');

// Replacements
code = code.replace(/this\.#rawData/g, 'this.chart.rawData');

// List of properties that should be this.chart.*
const chartProps = [
    'renkoBoxSizeMethod', 'renkoAtRLength', 'renkoPercentageValue', 'renkoBoxSize', '_lastRenkoBrickSize', 'renkoSource',
    'kagiReversalAmount', 'kagiReversalType', 'kagiSource', 'lbNumber',
    'pnfBoxSize', 'pnfReversal', 'pnfSource', 'pnfOneStepBack', 'pnfBoxSizeMethod', 'pnfAtrLength', 'pnfPercentageValue'
];

chartProps.forEach(prop => {
    const regex = new RegExp('this\\\\.' + prop, 'g');
    code = code.replace(regex, 'this.chart.' + prop);
});

// Any other 'this.something' ?
// Let's check visually later.
fs.writeFileSync('../../scratch/transformers.js', code);
