/**
 * ScriptEditorController - Manages the Monaco Editor for ZenScript.
 */
export class ScriptEditorController {
    constructor(chart) {
        this.chart = chart;
        this.container = document.getElementById('script-editor-panel');
        this.monacoContainer = document.getElementById('monaco-editor-container');
        this.nameInput = document.getElementById('editor-script-name');
        
        this.editor = null;
        this.currentScriptName = "New Indicator";
        this.currentScriptId = null;
        this.addChartBtn = document.getElementById('editor-add-chart-btn');
        this.isInitialized = false;
        this.defaultScript = "// ZenScript Indicator\nint length = 14;\nfloat src = close;\nfloat val = sma(src, length);\nplot(val, \"SMA\", #2962ff);";
        
        // Dirty state tracking
        this.lastSavedScript = "";
        this.lastSavedName = "";
        this.lastAppliedScript = "";
        this.temporaryIndicatorId = null;

        this.init();
    }

    async init() {
        if (typeof require === 'undefined') {
            console.error('Monaco loader not found');
            return;
        }

        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });

        require(['vs/editor/editor.main'], () => {
            this.registerZenScript();
            this.createEditor();
            this.setupEventListeners();
            this.isInitialized = true;
        });
    }

    registerZenScript() {
        // Register a new language
        monaco.languages.register({ id: 'zenscript' });

        // Lexer definition
        monaco.languages.setMonarchTokensProvider('zenscript', {
            tokenizer: {
                root: [
                    // Comments FIRST
                    [/\/\/.*$/, 'comment'],

                    // Colors (Hex, RGB, RGBA)
                    [/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/, 'color-literal'],
                    [/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d\.]+\s*)?\)/, 'color-literal'],

                    // Function calls and definitions: any word followed by (
                    [/[a-z_$][\w$]*(?=\s*\()/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'predefined'
                        }
                    }],

                    // Variable declarations (e.g., int src =)
                    [/(int|float|bool|string|color|void|array)(\s+)([a-z_$][\w$]*)/, ['keyword', '', 'identifier']],

                    // Named Arguments (e.g., color=, title=)
                    [/[a-z_$][\w$]*(?=\s*=(?!=))/, 'attribute.name'],

                    // Identifiers and keywords
                    [/[a-z_$][\w$]*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@builtins': 'predefined',
                            '@default': 'identifier'
                        }
                    }],

                    // Brackets and Delimiters
                    [/[{}()\[\]]/, '@brackets'],
                    [/[;,.]/, 'delimiter'],

                    // Specific Operators (Longer ones first)
                    [/:=/, 'operator'],
                    [/=>/, 'operator'],
                    [/[<>=\+\-\*\/%&|^!]+/, 'operator'],

                    // Numbers
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],

                    // Strings
                    [/"([^"\\]|\\.)*"/, 'string'],
                    [/'([^'\\]|\\.)*'/, 'string'],
                ]
            },
            keywords: [
                'int', 'float', 'bool', 'string', 'color', 'void', 'return', 'if', 'else', 'switch', 'case', 'default', 'true', 'false', 'na', 'for', 'to', 'and', 'or', 'not', 'array'
            ],
            builtins: [
                'plot', 'sma', 'ema', 'rsi', 'stoch', 'bb', 'atr', 'supertrend', 'vwap',
                'input', 'indicator', 'plotshape', 'hline', 'fill', 'rgba',
                'label', 'label.new', 'line', 'line.new', 'bar_index',
                'open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4',
                'stdev', 'variance', 'covariance', 'correlation', 'linreg', 'linreg_slope', 'linreg_intercept',
                'array', 'array.new_float', 'array.new_int', 'array.new_bool', 'array.new_color', 'array.new_string', 'array.push', 'array.get', 'array.set', 'array.size', 'array.clear', 'array.remove', 'array.insert', 'array.pop', 'array.shift', 'array.unshift', 'array.sort', 'array.avg', 'array.min', 'array.max', 'array.sum'
            ]
        });

        // High-Performance Color Provider
        monaco.languages.registerColorProvider('zenscript', {
            provideDocumentColors: (model) => {
                const text = model.getValue();
                if (!text) return [];
                
                const colors = [];
                // More precise regex
                const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
                const rgbaRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d\.]+)\s*)?\)/g;
                
                let match;
                while ((match = hexRegex.exec(text))) {
                    const startPos = model.getPositionAt(match.index);
                    const endPos = model.getPositionAt(match.index + match[0].length);
                    
                    let hex = match[1];
                    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                    if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
                    
                    if (hex.length !== 6 && hex.length !== 8) continue;

                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;
                    const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

                    colors.push({
                        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                        color: { red: r, green: g, blue: b, alpha: a }
                    });
                }

                while ((match = rgbaRegex.exec(text))) {
                    const startPos = model.getPositionAt(match.index);
                    const endPos = model.getPositionAt(match.index + match[0].length);
                    
                    colors.push({
                        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                        color: { 
                            red: Math.min(255, parseInt(match[1])) / 255, 
                            green: Math.min(255, parseInt(match[2])) / 255, 
                            blue: Math.min(255, parseInt(match[3])) / 255, 
                            alpha: match[4] ? Math.min(1, parseFloat(match[4])) : 1 
                        }
                    });
                }
                return colors;
            },
            provideColorPresentations: (model, colorInfo) => {
                const color = colorInfo.color;
                const r = Math.round(color.red * 255);
                const g = Math.round(color.green * 255);
                const b = Math.round(color.blue * 255);
                const a = color.alpha;
                const label = a === 1 
                    ? `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
                    : `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
                return [{ label: label }];
            }
        });

        // Language configuration (brackets, comments)
        monaco.languages.setLanguageConfiguration('zenscript', {
            comments: {
                lineComment: '//',
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        });

        // Tokyo Night Theme
        monaco.editor.defineTheme('zen-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: 'bb9af7', fontStyle: 'bold' }, // Purple
                { token: 'predefined', foreground: '7aa2f7' },               // Blue (Functions)
                { token: 'attribute.name', foreground: 'e0af68' },            // Orange (Named Args)
                { token: 'comment', foreground: '565f89', fontStyle: 'italic' }, // Muted Blue-Gray
                { token: 'string', foreground: '9ece6a' },                   // Green
                { token: 'number', foreground: 'ff9e64' },                   // Orange
                { token: 'operator', foreground: '89ddff' },                 // Cyan
                { token: 'identifier', foreground: 'c0caf5' },               // Light Blue/White (Variables)
                { token: 'delimiter', foreground: 'bb9af7' },               // Purple
                { token: 'color-literal', foreground: 'f7768e' },           // Pinkish-Red for Color Codes
            ],
            colors: {
                'editor.background': '#000000',
                'editor.foreground': '#a9b1d6',
                'editor.lineHighlightBackground': '#24283b',
                'editorCursor.foreground': '#c0caf5',
                'editor.selectionBackground': '#33467C',
                'editorIndentGuide.background': '#292e42',
                'editor.lineNumbersForeground': '#3b4261',
            }
        });

        // Rich IntelliSense & Auto-Completion Provider for ZenScript
        monaco.languages.registerCompletionItemProvider('zenscript', {
            triggerCharacters: ['.'],
            provideCompletionItems: (model, position) => {
                // Check if we are typing after a dot
                const lastLine = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                const dotMatch = lastLine.match(/([a-zA-Z_]\w*)\.$/);
                if (dotMatch) {
                    const namespace = dotMatch[1];
                    const suggestions = [];
                    
                    if (namespace === 'color') {
                        const colors = ['red', 'green', 'blue', 'white', 'black', 'yellow', 'orange', 'purple', 'gray', 'teal', 'lime', 'maroon', 'navy', 'olive', 'silver', 'aqua', 'fuchsia', 'new', 'rgb', 'gradient'];
                        colors.forEach(c => {
                            if (c === 'gradient') {
                                suggestions.push({
                                    label: c,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: 'gradient(${1:close}, ${2:0}, ${3:100}, ${4:color.red}, ${5:color.green})',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: 'color.gradient(value, bottom_value, top_value, bottom_color, top_color)'
                                });
                            } else if (c === 'new') {
                                suggestions.push({
                                    label: c,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: 'new(${1:color.blue}, ${2:50})',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: 'color.new(color, transparency)'
                                });
                            } else if (c === 'rgb') {
                                suggestions.push({
                                    label: c,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: 'rgb(${1:255}, ${2:255}, ${3:255})',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: 'color.rgb(red, green, blue, transparency?)'
                                });
                            } else {
                                suggestions.push({
                                    label: c,
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    insertText: c,
                                    detail: `color.${c}`
                                });
                            }
                        });
                    } else if (namespace === 'input') {
                        const inputs = [
                            { name: 'int', defval: '1' },
                            { name: 'float', defval: '1.0' },
                            { name: 'bool', defval: 'true' },
                            { name: 'string', defval: '"Default"' },
                            { name: 'color', defval: 'color.blue' },
                            { name: 'source', defval: 'close' }
                        ];
                        inputs.forEach(i => {
                            suggestions.push({
                                label: i.name,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: i.name + '(${1:' + i.defval + '}, title="${2:Title}")',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `input.${i.name}(${i.defval}, title)`
                            });
                        });
                    } else if (namespace === 'box') {
                        const boxMethods = ['new', 'set_left', 'set_top', 'set_right', 'set_bottom', 'set_border_color', 'set_border_width', 'set_border_style', 'set_extend', 'set_bgcolor', 'set_text', 'set_text_size', 'set_text_color', 'set_text_halign', 'set_text_valign', 'delete'];
                        boxMethods.forEach(m => {
                            suggestions.push({
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: m + '($0)',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `box.${m}`
                            });
                        });
                    } else if (namespace === 'label') {
                        suggestions.push({
                            label: 'new',
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: 'new(x=${1:bar_index}, y=${2:high}, text="${3:Text}")',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: 'label.new(x, y, text)'
                        });
                    } else if (namespace === 'line') {
                        suggestions.push({
                            label: 'new',
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: 'new(x1=${1:bar_index[1]}, y1=${2:low[1]}, x2=${3:bar_index}, y2=${4:low})',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: 'line.new(x1, y1, x2, y2)'
                        });
                    } else if (namespace === 'array') {
                        const arrayMethods = ['new_float', 'new_int', 'new_bool', 'new_color', 'new_string', 'push', 'get', 'set', 'size', 'clear', 'remove', 'insert', 'pop', 'shift', 'unshift', 'sort', 'avg', 'min', 'max', 'sum'];
                        arrayMethods.forEach(m => {
                            let ins = m + '($0)';
                            if (m.startsWith('new_')) {
                                ins = m + '(${1:size}, ${2:initial_value})';
                            } else if (m === 'push' || m === 'unshift' || m === 'insert') {
                                ins = m + '(${1:arr}, ${2:value})';
                            } else if (m === 'get' || m === 'remove') {
                                ins = m + '(${1:arr}, ${2:index})';
                            } else if (m === 'set') {
                                ins = m + '(${1:arr}, ${2:index}, ${3:value})';
                            } else {
                                ins = m + '(${1:arr})';
                            }
                            suggestions.push({
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: ins,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `array.${m}`
                            });
                        });
                    }
                    
                    return { suggestions: suggestions };
                }

                // Default suggestions (keywords, builtins, variables, functions)
                const suggestions = [];

                // Keywords
                const keywords = ['int', 'float', 'bool', 'string', 'color', 'void', 'return', 'if', 'else', 'switch', 'case', 'default', 'true', 'false', 'na', 'for', 'to'];
                keywords.forEach(k => {
                    suggestions.push({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k
                    });
                });

                // Variables
                const variables = ['open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'bar_index'];
                variables.forEach(v => {
                    suggestions.push({
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: v,
                        detail: 'Built-in time-series series'
                    });
                });

                // Built-in Functions
                const functions = [
                    { name: 'indicator', snippet: 'indicator(title="${1:My Indicator}", overlay=${2:true})', desc: 'Declare script as indicator' },
                    { name: 'sma', snippet: 'sma(${1:close}, ${2:14})', desc: 'Simple Moving Average' },
                    { name: 'ema', snippet: 'ema(${1:close}, ${2:14})', desc: 'Exponential Moving Average' },
                    { name: 'rsi', snippet: 'rsi(${1:close}, ${2:14})', desc: 'Relative Strength Index' },
                    { name: 'stoch', snippet: 'stoch(${1:close}, ${2:high}, ${3:low}, ${4:14})', desc: 'Stochastic Oscillator' },
                    { name: 'bb', snippet: 'bb(${1:close}, ${2:20}, ${3:2})', desc: 'Bollinger Bands' },
                    { name: 'atr', snippet: 'atr(${1:14})', desc: 'Average True Range' },
                    { name: 'supertrend', snippet: 'supertrend(${1:3}, ${2:10})', desc: 'SuperTrend indicator' },
                    { name: 'vwap', snippet: 'vwap(${1:close})', desc: 'Volume Weighted Average Price' },
                    { name: 'plot', snippet: 'plot(${1:close}, title="${2:My Plot}", color=${3:color.blue})', desc: 'Plot series on chart' },
                    { name: 'plotshape', snippet: 'plotshape(${1:close > open}, title="${2:Shape}", style="${3:triangleup}", location="${4:belowbar}", color=${5:color.green})', desc: 'Plot shape on chart' },
                    { name: 'plotchar', snippet: 'plotchar(${1:close > open}, title="${2:Char}", char="${3:B}", location="${4:belowbar}", color=${5:color.green})', desc: 'Plot character on chart' },
                    { name: 'plotarrow', snippet: 'plotarrow(${1:close - open}, title="${2:Arrow}")', desc: 'Plot arrow on chart' },
                    { name: 'plotcandle', snippet: 'plotcandle(${1:open}, ${2:high}, ${3:low}, ${4:close})', desc: 'Plot candles on chart' },
                    { name: 'hline', snippet: 'hline(${1:0}, title="${2:Zero Line}", color=${3:color.gray})', desc: 'Plot horizontal line' },
                    { name: 'bgcolor', snippet: 'bgcolor(${1:color.new(color.blue, 90)})', desc: 'Change background color' },
                    { name: 'barcolor', snippet: 'barcolor(${1:color.blue})', desc: 'Change bar/candle color' },
                    { name: 'fill', snippet: 'fill(${1:p1}, ${2:p2}, color=${3:color.new(color.blue, 90)})', desc: 'Fill background between plots' },
                    { name: 'crossover', snippet: 'crossover(${1:s1}, ${2:s2})', desc: 'Check if s1 crosses above s2' },
                    { name: 'crossunder', snippet: 'crossunder(${1:s1}, ${2:s2})', desc: 'Check if s1 crosses below s2' },
                    { name: 'change', snippet: 'change(${1:close})', desc: 'Difference between current and previous value' },
                    { name: 'highest', snippet: 'highest(${1:close}, ${2:14})', desc: 'Highest value in a lookback window' },
                    { name: 'lowest', snippet: 'lowest(${1:close}, ${2:14})', desc: 'Lowest value in a lookback window' },
                    { name: 'pivothigh', snippet: 'pivothigh(${1:leftBars}, ${2:rightBars})', desc: 'Pivot High point index' },
                    { name: 'pivotlow', snippet: 'pivotlow(${1:leftBars}, ${2:rightBars})', desc: 'Pivot Low point index' },
                    { name: 'fixnan', snippet: 'fixnan(${1:close})', desc: 'Replace NaN with the last non-NaN value' },
                    { name: 'stdev', snippet: 'stdev(${1:close}, ${2:14})', desc: 'Standard Deviation' },
                    { name: 'variance', snippet: 'variance(${1:close}, ${2:14})', desc: 'Variance' },
                    { name: 'covariance', snippet: 'covariance(${1:close}, ${2:open}, ${3:14})', desc: 'Covariance of two series' },
                    { name: 'correlation', snippet: 'correlation(${1:close}, ${2:open}, ${3:14})', desc: 'Pearson Correlation Coefficient' },
                    { name: 'linreg', snippet: 'linreg(${1:close}, ${2:14}, ${3:0})', desc: 'Linear Regression Value' },
                    { name: 'linreg_slope', snippet: 'linreg_slope(${1:close}, ${2:14})', desc: 'Linear Regression Slope' },
                    { name: 'linreg_intercept', snippet: 'linreg_intercept(${1:close}, ${2:14})', desc: 'Linear Regression Intercept' }
                ];

                functions.forEach(f => {
                    suggestions.push({
                        label: f.name,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: f.snippet,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: f.desc,
                        documentation: f.desc
                    });
                });

                // Add namespace base suggestions
                const namespaces = ['color', 'input', 'box', 'label', 'line', 'array'];
                namespaces.forEach(ns => {
                    suggestions.push({
                        label: ns,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: ns,
                        detail: `Namespace ${ns}`
                    });
                });

                return { suggestions: suggestions };
            }
        });

        // Monaco Signature Help Provider (Argument suggestions when typing '(' or ',')
        monaco.languages.registerSignatureHelpProvider('zenscript', {
            signatureHelpTriggerCharacters: ['(', ','],
            signatureHelpRetriggerCharacters: [','],
            provideSignatureHelp: (model, position, token, context) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                let openParenIndex = -1;
                let commaCount = 0;
                let depth = 0;
                
                for (let i = textUntilPosition.length - 1; i >= 0; i--) {
                    const char = textUntilPosition[i];
                    if (char === ')') {
                        depth++;
                    } else if (char === '(') {
                        if (depth === 0) {
                            openParenIndex = i;
                            break;
                        } else {
                            depth--;
                        }
                    } else if (char === ',' && depth === 0) {
                        commaCount++;
                    }
                }
                
                if (openParenIndex === -1) return null;
                
                let nameEnd = openParenIndex;
                while (nameEnd > 0 && /\s/.test(textUntilPosition[nameEnd - 1])) {
                    nameEnd--;
                }
                
                let nameStart = nameEnd;
                while (nameStart > 0 && /[a-zA-Z0-9_\.]/.test(textUntilPosition[nameStart - 1])) {
                    nameStart--;
                }
                
                const functionName = textUntilPosition.substring(nameStart, nameEnd);
                if (!functionName) return null;
                
                const signatures = {
                    'sma': {
                        label: 'float sma(float source, int length)',
                        documentation: 'Simple Moving Average (SMA).',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Series of values to be averaged (e.g. close).' },
                            { label: 'length', documentation: 'Type: int - Number of bars (e.g. 14).' }
                        ]
                    },
                    'ema': {
                        label: 'float ema(float source, int length)',
                        documentation: 'Exponential Moving Average (EMA).',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Series of values to be averaged.' },
                            { label: 'length', documentation: 'Type: int - Number of bars (e.g. 14).' }
                        ]
                    },
                    'rsi': {
                        label: 'float rsi(float source, int length)',
                        documentation: 'Relative Strength Index (RSI).',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Series of values to calculate RSI.' },
                            { label: 'length', documentation: 'Type: int - Number of bars.' }
                        ]
                    },
                    'stoch': {
                        label: 'float stoch(float source, float high, float low, int length)',
                        documentation: 'Stochastic Oscillator calculation.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Main source series (close).' },
                            { label: 'high', documentation: 'Type: float - High price series.' },
                            { label: 'low', documentation: 'Type: float - Low price series.' },
                            { label: 'length', documentation: 'Type: int - Length (bars).' }
                        ]
                    },
                    'bb': {
                        label: 'float bb(float source, int length, float mult)',
                        documentation: 'Bollinger Bands calculation.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Main source series (close).' },
                            { label: 'length', documentation: 'Type: int - Length (bars).' },
                            { label: 'mult', documentation: 'Type: float - Standard deviation multiplier.' }
                        ]
                    },
                    'atr': {
                        label: 'float atr(int length)',
                        documentation: 'Average True Range (ATR).',
                        parameters: [
                            { label: 'length', documentation: 'Type: int - Number of bars.' }
                        ]
                    },
                    'supertrend': {
                        label: 'float supertrend(float factor, int period)',
                        documentation: 'SuperTrend calculation.',
                        parameters: [
                            { label: 'factor', documentation: 'Type: float - Multiplier factor.' },
                            { label: 'period', documentation: 'Type: int - ATR period length.' }
                        ]
                    },
                    'vwap': {
                        label: 'float vwap(float source)',
                        documentation: 'Volume Weighted Average Price (VWAP).',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Main source series.' }
                        ]
                    },
                    'plot': {
                        label: 'plot plot(float series, string title, color color, int width, string style, bool force_overlay)',
                        documentation: 'Plots a time-series on the chart, returning a plot reference for area filling.',
                        parameters: [
                            { label: 'series', documentation: 'Type: float - Data series to plot (e.g. close).' },
                            { label: 'title', documentation: 'Type: string - Title of the plot.' },
                            { label: 'color', documentation: 'Type: color - Color of the plot line (e.g. color.blue).' },
                            { label: 'width', documentation: 'Type: int - Width of the line (e.g. 2).' },
                            { label: 'style', documentation: 'Type: string - Plot style ("line", "histogram", "columns").' },
                            { label: 'force_overlay', documentation: 'Type: bool - Force plot on main chart.' }
                        ]
                    },
                    'plotshape': {
                        label: 'void plotshape(float|bool series, string title, string style, string location, color color, string size, string text)',
                        documentation: 'Plots a shape at specific locations when a condition is met.',
                        parameters: [
                            { label: 'series', documentation: 'Type: float|bool - Boolean/float condition series.' },
                            { label: 'title', documentation: 'Type: string - Plot title.' },
                            { label: 'style', documentation: 'Type: string - Shape style (e.g., "triangleup", "triangledown").' },
                            { label: 'location', documentation: 'Type: string - Shape location (e.g., "abovebar", "belowbar").' },
                            { label: 'color', documentation: 'Type: color - Color of the shape.' },
                            { label: 'size', documentation: 'Type: string - Size of the shape.' },
                            { label: 'text', documentation: 'Type: string - Annotation text.' }
                        ]
                    },
                    'plotchar': {
                        label: 'void plotchar(float|bool series, string title, string char, string location, color color, string size)',
                        documentation: 'Plots characters on the chart.',
                        parameters: [
                            { label: 'series', documentation: 'Type: float|bool - Boolean/float condition series.' },
                            { label: 'title', documentation: 'Type: string - Plot title.' },
                            { label: 'char', documentation: 'Type: string - Character to plot (e.g. "B" or "S").' },
                            { label: 'location', documentation: 'Type: string - Location on chart.' },
                            { label: 'color', documentation: 'Type: color - Color of character.' },
                            { label: 'size', documentation: 'Type: string - Size.' }
                        ]
                    },
                    'plotarrow': {
                        label: 'void plotarrow(float|bool series, string title, color colorup, color colordown)',
                        documentation: 'Plots up/down arrows based on series value.',
                        parameters: [
                            { label: 'series', documentation: 'Type: float|bool - Data series (positive plots up, negative plots down).' },
                            { label: 'title', documentation: 'Type: string - Plot title.' },
                            { label: 'colorup', documentation: 'Type: color - Up arrow color.' },
                            { label: 'colordown', documentation: 'Type: color - Down arrow color.' }
                        ]
                    },
                    'plotcandle': {
                        label: 'void plotcandle(float open, float high, float low, float close, string title, color color, color wickcolor, color bordercolor)',
                        documentation: 'Plots a custom candlestick series.',
                        parameters: [
                            { label: 'open', documentation: 'Type: float - Open price series.' },
                            { label: 'high', documentation: 'Type: float - High price series.' },
                            { label: 'low', documentation: 'Type: float - Low price series.' },
                            { label: 'close', documentation: 'Type: float - Close price series.' },
                            { label: 'title', documentation: 'Type: string - Plot title in legend.' },
                            { label: 'color', documentation: 'Type: color - Body fill color.' },
                            { label: 'wickcolor', documentation: 'Type: color - Wick color.' },
                            { label: 'bordercolor', documentation: 'Type: color - Border color.' }
                        ]
                    },
                    'hline': {
                        label: 'hline hline(float price, string title, color color, int width, string style)',
                        documentation: 'Plots a constant horizontal price line, returning an hline reference for area filling.',
                        parameters: [
                            { label: 'price', documentation: 'Type: float - Price level.' },
                            { label: 'title', documentation: 'Type: string - Title.' },
                            { label: 'color', documentation: 'Type: color - Line color.' },
                            { label: 'width', documentation: 'Type: int - Line width.' },
                            { label: 'style', documentation: 'Type: string - Line style.' }
                        ]
                    },
                    'bgcolor': {
                        label: 'void bgcolor(color color, string title, bool force_overlay)',
                        documentation: 'Fills the background color of the chart.',
                        parameters: [
                            { label: 'color', documentation: 'Type: color - Background color.' },
                            { label: 'title', documentation: 'Type: string - Title.' },
                            { label: 'force_overlay', documentation: 'Type: bool - Force background fill on main chart.' }
                        ]
                    },
                    'barcolor': {
                        label: 'void barcolor(color color, string title, bool force_overlay)',
                        documentation: 'Colors the chart bars/candles.',
                        parameters: [
                            { label: 'color', documentation: 'Type: color - Bar color.' },
                            { label: 'title', documentation: 'Type: string - Title.' },
                            { label: 'force_overlay', documentation: 'Type: bool - Force color on main chart.' }
                        ]
                    },
                    'fill': {
                        label: 'void fill(plot p1, plot p2, color color, string title)',
                        documentation: 'Fills the region between two plot lines.',
                        parameters: [
                            { label: 'p1', documentation: 'Type: plot - First plot reference.' },
                            { label: 'p2', documentation: 'Type: plot - Second plot reference.' },
                            { label: 'color', documentation: 'Type: color - Fill color.' },
                            { label: 'title', documentation: 'Type: string - Title.' }
                        ]
                    },
                    'crossover': {
                        label: 'bool crossover(float s1, float s2)',
                        documentation: 'Checks if series 1 crosses above series 2.',
                        parameters: [
                            { label: 's1', documentation: 'Type: float - First data series.' },
                            { label: 's2', documentation: 'Type: float - Second data series.' }
                        ]
                    },
                    'crossunder': {
                        label: 'bool crossunder(float s1, float s2)',
                        documentation: 'Checks if series 1 crosses below series 2.',
                        parameters: [
                            { label: 's1', documentation: 'Type: float - First data series.' },
                            { label: 's2', documentation: 'Type: float - Second data series.' }
                        ]
                    },
                    'highest': {
                        label: 'float highest(float source, int length)',
                        documentation: 'Highest value in a lookback window.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'lowest': {
                        label: 'float lowest(float source, int length)',
                        documentation: 'Lowest value in a lookback window.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'stdev': {
                        label: 'float stdev(float source, int length)',
                        documentation: 'Standard Deviation.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'variance': {
                        label: 'float variance(float source, int length)',
                        documentation: 'Sample variance of a series.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'covariance': {
                        label: 'float covariance(float source1, float source2, int length)',
                        documentation: 'Covariance of two series.',
                        parameters: [
                            { label: 'source1', documentation: 'Type: float - First source series.' },
                            { label: 'source2', documentation: 'Type: float - Second source series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'correlation': {
                        label: 'float correlation(float source1, float source2, int length)',
                        documentation: 'Pearson Correlation Coefficient of two series.',
                        parameters: [
                            { label: 'source1', documentation: 'Type: float - First source series.' },
                            { label: 'source2', documentation: 'Type: float - Second source series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'linreg': {
                        label: 'float linreg(float source, int length, int offset)',
                        documentation: 'Linear regression curve value at offset.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' },
                            { label: 'offset', documentation: 'Type: int - Bar offset (optional, default: 0).' }
                        ]
                    },
                    'linreg_slope': {
                        label: 'float linreg_slope(float source, int length)',
                        documentation: 'Linear regression slope.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'linreg_intercept': {
                        label: 'float linreg_intercept(float source, int length)',
                        documentation: 'Linear regression intercept.',
                        parameters: [
                            { label: 'source', documentation: 'Type: float - Source data series.' },
                            { label: 'length', documentation: 'Type: int - Lookback length.' }
                        ]
                    },
                    'indicator': {
                        label: 'void indicator(string title, string shorttitle, bool overlay, int max_lines_count, int max_labels_count)',
                        documentation: 'Declares script properties (Must be called once at script start).',
                        parameters: [
                            { label: 'title', documentation: 'Type: string - Full name of the indicator.' },
                            { label: 'shorttitle', documentation: 'Type: string - Short name shown in legend.' },
                            { label: 'overlay', documentation: 'Type: bool - Render on main chart if true.' },
                            { label: 'max_lines_count', documentation: 'Type: int - Max lines.' },
                            { label: 'max_labels_count', documentation: 'Type: int - Max labels.' }
                        ]
                    },
                    'input.int': {
                        label: 'int input.int(int defval, string title, int minval, int maxval)',
                        documentation: 'Declares an integer user-input configuration.',
                        parameters: [
                            { label: 'defval', documentation: 'Type: int - Default integer value.' },
                            { label: 'title', documentation: 'Type: string - Input title label.' },
                            { label: 'minval', documentation: 'Type: int - Minimum permitted value.' },
                            { label: 'maxval', documentation: 'Type: int - Maximum permitted value.' }
                        ]
                    },
                    'input.float': {
                        label: 'float input.float(float defval, string title, float minval, float maxval)',
                        documentation: 'Declares a float user-input configuration.',
                        parameters: [
                            { label: 'defval', documentation: 'Type: float - Default float value.' },
                            { label: 'title', documentation: 'Type: string - Input title label.' },
                            { label: 'minval', documentation: 'Type: float - Minimum permitted value.' },
                            { label: 'maxval', documentation: 'Type: float - Maximum permitted value.' }
                        ]
                    },
                    'input.bool': {
                        label: 'bool input.bool(bool defval, string title)',
                        documentation: 'Declares a boolean user-input checkbox.',
                        parameters: [
                            { label: 'defval', documentation: 'Type: bool - Default boolean value.' },
                            { label: 'title', documentation: 'Type: string - Input title label.' }
                        ]
                    },
                    'input.string': {
                        label: 'string input.string(string defval, string title, any options)',
                        documentation: 'Declares a string user-input text or dropdown.',
                        parameters: [
                            { label: 'defval', documentation: 'Type: string - Default string value.' },
                            { label: 'title', documentation: 'Type: string - Input title label.' },
                            { label: 'options', documentation: 'Type: any - Dropdown options array (e.g. ["EMA", "SMA"]).' }
                        ]
                    },
                    'input.color': {
                        label: 'color input.color(color defval, string title)',
                        documentation: 'Declares a color user-input colorpicker.',
                        parameters: [
                            { label: 'defval', documentation: 'Type: color - Default color value.' },
                            { label: 'title', documentation: 'Type: string - Input title label.' }
                        ]
                    },
                    'input.source': {
                        label: 'float input.source(float defval, string title)',
                        documentation: 'Declares a data source selector (close, open, high, low).',
                        parameters: [
                            { label: 'defval', documentation: 'Type: float - Default data source (close).' },
                            { label: 'title', documentation: 'Type: string - Input title label.' }
                        ]
                    },
                    'color.new': {
                        label: 'color color.new(color color, int transparency)',
                        documentation: 'Applies transparency level to a color.',
                        parameters: [
                            { label: 'color', documentation: 'Type: color - Base color (e.g. color.blue).' },
                            { label: 'transparency', documentation: 'Type: int - Transparency percentage (0 to 100).' }
                        ]
                    },
                    'color.rgb': {
                        label: 'color color.rgb(int red, int green, int blue, int transparency)',
                        documentation: 'Creates a custom color from RGB values.',
                        parameters: [
                            { label: 'red', documentation: 'Type: int - Red component (0 to 255).' },
                            { label: 'green', documentation: 'Type: int - Green component (0 to 255).' },
                            { label: 'blue', documentation: 'Type: int - Blue component (0 to 255).' },
                            { label: 'transparency', documentation: 'Type: int - Transparency percentage (optional, 0 to 100).' }
                        ]
                    },
                    'color.gradient': {
                        label: 'color color.gradient(float value, float bottom_value, float top_value, color bottom_color, color top_color)',
                        documentation: 'Calculates a color dynamically based on a value between bottom and top values, interpolating between two colors.',
                        parameters: [
                            { label: 'value', documentation: 'Type: float - The series or value to base the gradient calculation on.' },
                            { label: 'bottom_value', documentation: 'Type: float - The lower boundary value representing the bottom of the gradient range.' },
                            { label: 'top_value', documentation: 'Type: float - The upper boundary value representing the top of the gradient range.' },
                            { label: 'bottom_color', documentation: 'Type: color - Color corresponding to bottom_value.' },
                            { label: 'top_color', documentation: 'Type: color - Color corresponding to top_value.' }
                        ]
                    },
                    'box.new': {
                        label: 'box box.new(int left, float top, int right, float bottom, color border_color, int border_width, string border_style, string extend, string xloc, color bgcolor, string text, string text_size, color text_color)',
                        documentation: 'Draws a box shape on the chart.',
                        parameters: [
                            { label: 'left', documentation: 'Type: int - Left boundary (bar index).' },
                            { label: 'top', documentation: 'Type: float - Top boundary price level.' },
                            { label: 'right', documentation: 'Type: int - Right boundary (bar index).' },
                            { label: 'bottom', documentation: 'Type: float - Bottom boundary price level.' },
                            { label: 'border_color', documentation: 'Type: color - Color of the box border.' },
                            { label: 'border_width', documentation: 'Type: int - Width of the box border (pixels).' },
                            { label: 'border_style', documentation: 'Type: string - Border style ("solid", "dashed", "dotted").' },
                            { label: 'extend', documentation: 'Type: string - Extend box horizontally ("none", "left", "right", "both").' },
                            { label: 'xloc', documentation: 'Type: string - X coordinate positioning format ("bar_index" or "bar_time").' },
                            { label: 'bgcolor', documentation: 'Type: color - Background fill color.' },
                            { label: 'text', documentation: 'Type: string - Text content to display inside the box.' },
                            { label: 'text_size', documentation: 'Type: string - Text size ("small", "normal", "large", "huge").' },
                            { label: 'text_color', documentation: 'Type: color - Color of the text.' }
                        ]
                    },
                    'label.new': {
                        label: 'label label.new(int x, float y, string text, string xloc, string yloc, color color, string style, color textcolor, string size)',
                        documentation: 'Creates an interactive text label on the chart.',
                        parameters: [
                            { label: 'x', documentation: 'Type: int - X coordinate (bar index).' },
                            { label: 'y', documentation: 'Type: float - Y coordinate (price level).' },
                            { label: 'text', documentation: 'Type: string - Label text content.' },
                            { label: 'xloc', documentation: 'Type: string - X positioning coordinate system ("bar_index").' },
                            { label: 'yloc', documentation: 'Type: string - Y positioning coordinate system ("price", "abovebar", "belowbar").' },
                            { label: 'color', documentation: 'Type: color - Background color of the label.' },
                            { label: 'style', documentation: 'Type: string - Label shape style (e.g. "label_up", "label_down", "label_center").' },
                            { label: 'textcolor', documentation: 'Type: color - Label text color.' },
                            { label: 'size', documentation: 'Type: string - Text size ("small", "normal", "large").' }
                        ]
                    },
                    'line.new': {
                        label: 'line line.new(int x1, float y1, int x2, float y2, color color, int width, string style)',
                        documentation: 'Draws a customized line segment on the chart.',
                        parameters: [
                            { label: 'x1', documentation: 'Type: int - Start X coordinate (bar index).' },
                            { label: 'y1', documentation: 'Type: float - Start Y coordinate (price).' },
                            { label: 'x2', documentation: 'Type: int - End X coordinate (bar index).' },
                            { label: 'y2', documentation: 'Type: float - End Y coordinate (price).' },
                            { label: 'color', documentation: 'Type: color - Color of the line.' },
                            { label: 'width', documentation: 'Type: int - Width of the line (pixels).' },
                            { label: 'style', documentation: 'Type: string - Line style ("solid", "dashed", "dotted").' }
                        ]
                    }
                };

                // Dynamic Scan of the entire document to parse custom functions signature details!
                const docText = model.getValue();
                const funcRegex = /([a-zA-Z_|]+)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*=>/g;
                let match;
                while ((match = funcRegex.exec(docText))) {
                    const returnType = match[1];
                    const funcName = match[2];
                    const paramsStr = match[3];
                    
                    const params = [];
                    const paramLabels = [];
                    if (paramsStr.trim()) {
                        const paramParts = paramsStr.split(',');
                        paramParts.forEach(p => {
                            const parts = p.trim().split(/\s+/);
                            if (parts.length >= 2) {
                                const pType = parts[0];
                                const pName = parts[1];
                                paramLabels.push(`${pType} ${pName}`);
                                params.push({
                                    label: pName,
                                    documentation: `Type: ${pType}`
                                });
                            } else if (parts.length === 1 && parts[0]) {
                                const pName = parts[0];
                                paramLabels.push(pName);
                                params.push({
                                    label: pName,
                                    documentation: `Type: any`
                                });
                            }
                        });
                    }
                    
                    signatures[funcName] = {
                        label: `${returnType} ${funcName}(${paramLabels.join(', ')})`,
                        documentation: '',
                        parameters: params
                    };
                }
                
                const sig = signatures[functionName];
                if (!sig) return null;
                
                return {
                    value: {
                        signatures: [{
                            label: sig.label,
                            documentation: sig.documentation,
                            parameters: sig.parameters
                        }],
                        activeSignature: 0,
                        activeParameter: Math.min(commaCount, sig.parameters.length - 1)
                    },
                    dispose: () => {}
                };
            }
        });
    }

    createEditor() {
        this.editor = monaco.editor.create(this.monacoContainer, {
            value: this.defaultScript,
            language: 'zenscript',
            theme: 'zen-dark',
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            minimap: { enabled: true },
            automaticLayout: true,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            padding: { top: 10 }
        });
    }

    setupEventListeners() {
        document.getElementById('editor-close-btn').addEventListener('click', () => this.hide());
        document.getElementById('editor-new-btn').addEventListener('click', () => this.handleNew());
        document.getElementById('editor-save-btn').addEventListener('click', () => this.handleSave());
        document.getElementById('editor-add-chart-btn').addEventListener('click', () => this.handleApply());

        // Sync header name to currentScriptName
        this.nameInput.addEventListener('input', () => {
            this.currentScriptName = this.nameInput.value.trim() || "Untitled";
            this.updateButtonStates();
        });

        // Monaco content change listener
        this.editor.onDidChangeModelContent(() => {
            this.validateScript();
            this.updateButtonStates();
        });
    }

    updateButtonStates() {
        this.updateSaveButton();
        this.updateApplyButton();
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('editor-save-btn');
        if (!saveBtn) return;

        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        
        const isDirty = currentScript !== this.lastSavedScript || currentName !== this.lastSavedName;
        // Keep active if there's an error so user can click to peek the error!
        const shouldEnable = isDirty || (this.isScriptValid === false);

        saveBtn.disabled = !shouldEnable;
        saveBtn.style.opacity = shouldEnable ? "1" : "0.4";
        saveBtn.style.pointerEvents = shouldEnable ? "auto" : "none";
    }

    show(scriptData = null) {
        this.container.style.display = 'flex';
        // Resize chart if needed
        window.dispatchEvent(new Event('resize'));
        
        if (scriptData) {
            this.editor.setValue(scriptData.script);
            this.currentScriptName = scriptData.name;
            // Only use ID if it's a database ID (doesn't start with 'ind_')
            this.currentScriptId = (scriptData.id && String(scriptData.id).startsWith('ind_')) ? null : scriptData.id;
            this.nameInput.value = scriptData.name;
            
            this.lastSavedScript = scriptData.script;
            this.lastSavedName = scriptData.name;
            
            // Backup original script for ROLLBACK feature
            this.originalScriptBeforeEdit = scriptData.script;
            
            // Check if this indicator is already on chart to get its current script
            const name = scriptData.name;
            const existingInd = this.chart?.indicators?.find(ind => (this.currentScriptId && ind.id === this.currentScriptId) || (ind.name === name));
            this.lastAppliedScript = existingInd ? existingInd.script : "";
        } else {
            this.currentScriptId = null;
            this.lastSavedScript = this.defaultScript;
            this.lastSavedName = "New Indicator";
            this.originalScriptBeforeEdit = null;
            this.lastAppliedScript = "";
            this.editor.setValue(this.defaultScript);
            this.nameInput.value = "New Indicator";
        }

        this.updateButtonStates();
        this.logConsole("Editor opened.");
        this.validateScript();
    }

    updateApplyButton() {
        if (!this.addChartBtn) return;
        
        const name = (this.nameInput?.value || this.currentScriptName).trim();
        const id = this.currentScriptId;
        
        const isActive = this.chart && this.chart.indicators && this.chart.indicators.some(ind => {
            return (id && ind.id === id) || (ind.name === name);
        });

        if (isActive) {
            this.addChartBtn.title = 'Sync with Chart';
            this.addChartBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
            `;
            
            const currentScript = this.editor.getValue();
            const isDirty = currentScript !== this.lastAppliedScript;
            
            // Keep enabled if there's an error so they can click it to see the popup!
            const shouldEnable = isDirty || (this.isScriptValid === false);

            this.addChartBtn.disabled = !shouldEnable;
            this.addChartBtn.style.opacity = shouldEnable ? "1" : "0.4";
            this.addChartBtn.style.pointerEvents = shouldEnable ? "auto" : "none";
        } else {
            this.addChartBtn.title = 'Add to Chart';
            this.addChartBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
            this.addChartBtn.disabled = false;
            this.addChartBtn.style.opacity = "1";
            this.addChartBtn.style.pointerEvents = "auto";
        }
    }

    hide() {
        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        const isDirty = (currentScript !== this.lastSavedScript) || (currentName !== this.lastSavedName);

        if (isDirty || this.temporaryIndicatorId) {
            let message = "You have unsaved changes. Exit anyway?";
            if (this.temporaryIndicatorId && !this.currentScriptId) {
                message = "This indicator is not saved and will be removed from the chart. Continue?";
            }
            
            const confirmed = confirm(message);
            if (!confirmed) return;

            // ROLLBACK: Revert indicator on chart to its original state before this edit session
            if (this.chart && this.originalScriptBeforeEdit !== undefined) {
                const name = this.lastSavedName;
                const id = this.currentScriptId;
                const existingInd = this.chart.indicators.find(ind => (id && ind.id === id) || (ind.name === name));
                
                if (existingInd && existingInd.script !== this.originalScriptBeforeEdit) {
                    this.chart.removeIndicator(existingInd.id);
                    if (this.originalScriptBeforeEdit) {
                        this.chart.addIndicator(name, this.originalScriptBeforeEdit, id);
                    }
                }
            }

            // Cleanup temporary indicator if needed
            if (this.temporaryIndicatorId && this.chart && this.chart.removeIndicator) {
                this.chart.removeIndicator(this.temporaryIndicatorId);
            }
            this.temporaryIndicatorId = null;
        }

        this.container.style.display = 'none';
        window.dispatchEvent(new Event('resize'));
    }

    logConsole(message, type = 'info') {
        const consoleOutput = document.getElementById('editor-console-output');
        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    validateScript() {
        if (!this.editor) {
            this.isScriptValid = true;
            return true;
        }
        const script = this.editor.getValue();
        const model = this.editor.getModel();
        if (!model) {
            this.isScriptValid = true;
            return true;
        }

        const markers = [];
        let isValid = true;

        try {
            const lexer = new ZenScript.Lexer(script);
            const parser = new ZenScript.Parser(lexer);
            const ast = parser.parseProgram();

            const validator = new ZenScript.Validator(ast, script);
            const validationErrors = validator.validate();

            validationErrors.forEach(err => {
                isValid = false;
                markers.push({
                    severity: monaco.MarkerSeverity.Error,
                    message: err.message,
                    startLineNumber: err.line,
                    startColumn: err.column,
                    endLineNumber: err.line,
                    endColumn: err.column + (err.tokenLength || 1)
                });
            });
        } catch (e) {
            isValid = false;
            const pos = (e.pos !== undefined) ? e.pos : 0;
            const message = e.rawMessage || e.message;
            const tokenLen = e.tokenLength || 1;
            const { line, column } = ZenScript.getLineAndColumn(script, pos);
            
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: message,
                startLineNumber: line,
                startColumn: column,
                endLineNumber: line,
                endColumn: column + tokenLen
            });
        }

        monaco.editor.setModelMarkers(model, 'zenscript', markers);
        
        // Strictly prevent saving or applying if there are compilation/validation errors
        this.isScriptValid = isValid;

        // Auto-peek & console error logic
        if (!isValid && markers.length > 0) {
            const firstErr = markers[0];
            
            // Print descriptive error immediately to console
            if (this.lastPrintedError !== firstErr.message) {
                this.logConsole(`${firstErr.message} (Line ${firstErr.startLineNumber}, Col ${firstErr.startColumn})`, "error");
                this.lastPrintedError = firstErr.message;
            }
        } else {
            this.lastPrintedError = null;

            // Close active error peek/widget immediately when resolved!
            if (this.editor) {
                try {
                    const markerController = this.editor.getContribution('editor.contrib.markerController');
                    if (markerController && typeof markerController.close === 'function') {
                        markerController.close();
                    } else {
                        this.editor.focus();
                        this.editor.trigger('keyboard', 'escape', {});
                    }
                } catch (e) {
                    this.editor.focus();
                    this.editor.trigger('keyboard', 'escape', {});
                }
            }
        }

        return isValid;
    }

    triggerErrorPeek() {
        if (this.editor && this.isScriptValid === false) {
            const currentSelection = this.editor.getSelection();
            this.editor.getAction('editor.action.marker.next').run();
            if (currentSelection) {
                setTimeout(() => {
                    if (this.editor) {
                        this.editor.setSelection(currentSelection);
                    }
                }, 50);
            }
        }
    }

    async handleSave() {
        if (!this.validateScript()) {
            this.logConsole("Cannot save: Script has compilation or validation errors. Check the red squiggly lines in the editor.", "error");
            this.triggerErrorPeek();
            return;
        }
        // Now that name is in header, we can save directly!
        const name = this.nameInput.value.trim();
        if (!name) {
            this.logConsole("Indicator name cannot be empty.", 'error');
            this.nameInput.focus();
            return;
        }
        
        this.currentScriptName = name;
        await this.confirmSave();
    }

    async confirmSave() {
        const name = this.currentScriptName;
        const script = this.editor.getValue();

        try {
            const url = this.currentScriptId 
                ? `http://localhost:5000/api/v1/indicators/${this.currentScriptId}` 
                : 'http://localhost:5000/api/v1/indicators';
            
            const method = this.currentScriptId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, script, userId: "6633b499e1a90c2e34789abc" })
            });
            const result = await response.json();
            if (result.success) {
                this.logConsole(`Script "${name}" ${this.currentScriptId ? 'updated' : 'saved'} successfully!`, 'success');
                this.currentScriptName = name;
                if (!this.currentScriptId) {
                    this.currentScriptId = result.data.id;
                    this.temporaryIndicatorId = null; // No longer temporary once saved to DB
                }
                
                this.lastSavedScript = script;
                this.lastSavedName = name;
                this.updateButtonStates();

                document.getElementById('editor-script-name').textContent = name;
                // Refresh modal list if it's open
                if (window.indicatorsModalController) {
                    window.indicatorsModalController.fetchUserIndicators();
                }
            } else {
                this.logConsole(`Error saving script: ${result.message}`, 'error');
            }
        } catch (err) {
            this.logConsole(`Network error: ${err.message}`, 'error');
        }
    }

    handleApply() {
        if (!this.validateScript()) {
            this.logConsole("Cannot apply: Script has compilation or validation errors. Check the red squiggly lines in the editor.", "error");
            this.triggerErrorPeek();
            return;
        }
        const script = this.editor.getValue();
        const name = this.nameInput.value.trim() || this.currentScriptName;
        try {
            if (this.chart && this.chart.addIndicator) {
                try {
                    const indicator = this.chart.addIndicator(name, script, this.currentScriptId);
                    
                    // If it was just added, only update our local ID if it's a real database ID
                    // (Local IDs start with 'ind_')
                    if (indicator && indicator.id) {
                        if (!String(indicator.id).startsWith('ind_')) {
                            this.currentScriptId = indicator.id;
                            this.temporaryIndicatorId = null;
                        } else if (!this.currentScriptId) {
                            // It's a new script and not yet in DB, track it as temporary
                            this.temporaryIndicatorId = indicator.id;
                        }
                        this.lastAppliedScript = script;
                        this.updateButtonStates();
                    }

                    this.logConsole(`Indicator ${this.addChartBtn.title === 'Sync with Chart' ? 'synced' : 'added'} successfully.`, 'success');
                } catch (e) {
                    console.error("ZenScript Error:", e);
                    this.logConsole(`ZenScript Error: ${e.message}`, 'error');
                }
            } else {
                this.logConsole("Chart not ready to receive scripts.", 'error');
            }
        } catch (err) {
            this.logConsole(`Compile Error: ${err.message}`, 'error');
        }
    }

    handleNew() {
        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        const isDirty = currentScript !== this.lastSavedScript || currentName !== this.lastSavedName;

        if (!isDirty || confirm("Are you sure you want to create a new script? Any unsaved changes will be lost.")) {
            // Remove existing temporary indicator from chart if it exists
            if (this.temporaryIndicatorId && this.chart && this.chart.removeIndicator) {
                this.chart.removeIndicator(this.temporaryIndicatorId);
            }

            this.currentScriptName = "New Indicator";
            this.currentScriptId = null;
            this.temporaryIndicatorId = null;
            this.nameInput.value = this.currentScriptName;
            this.editor.setValue(this.defaultScript);
            
            this.lastSavedScript = this.defaultScript;
            this.lastSavedName = "New Indicator";
            this.lastAppliedScript = "";
            this.updateButtonStates();
            
            this.logConsole("New script started.");
        }
    }
}
