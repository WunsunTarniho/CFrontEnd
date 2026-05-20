import { ZEN_DOCS } from './zen-docs.js';

export function registerZenScript(monaco) {
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
            'plot', 'sma', 'ema', 'rsi', 'stoch', 'bb', 'macd', 'volume_profile', 'atr', 'supertrend', 'vwap',
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
            const word = model.getWordAtPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word ? word.startColumn : position.column,
                endColumn: word ? word.endColumn : position.column
            };

            // Check if we are typing after a dot
            const lastLine = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });
            
            const dotMatch = lastLine.match(/([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)?$/);
            if (dotMatch) {
                const namespace = dotMatch[1];
                const suggestions = [];
                
                if (namespace === 'color') {
                    const colors = ['red', 'green', 'blue', 'white', 'black', 'yellow', 'orange', 'purple', 'gray', 'teal', 'lime', 'maroon', 'navy', 'olive', 'silver', 'aqua', 'fuchsia', 'new', 'rgb', 'gradient'];
                    colors.forEach(c => {
                        const kind = c === 'gradient' || c === 'new' || c === 'rgb' ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Property;
                        let ins = c;
                        let rules = undefined;
                        
                        if (c === 'gradient') {
                            ins = 'gradient(${1:close}, ${2:0}, ${3:100}, ${4:color.red}, ${5:color.green})';
                            rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                        } else if (c === 'new') {
                            ins = 'new(${1:color.blue}, ${2:50})';
                            rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                        } else if (c === 'rgb') {
                            ins = 'rgb(${1:255}, ${2:255}, ${3:255})';
                            rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                        }
                        
                        const item = {
                            label: c,
                            kind: kind,
                            insertText: ins,
                            insertTextRules: rules,
                            detail: `color.${c}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`color.${c}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
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
                        const item = {
                            label: i.name,
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: i.name + '(${1:' + i.defval + '}, title="${2:Title}")',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `input.${i.name}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`input.${i.name}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
                    });
                } else if (namespace === 'box') {
                    const boxMethods = ['new', 'set_left', 'set_top', 'set_right', 'set_bottom', 'set_border_color', 'set_border_width', 'set_border_style', 'set_extend', 'set_bgcolor', 'set_text', 'set_text_size', 'set_text_color', 'set_text_halign', 'set_text_valign', 'delete'];
                    boxMethods.forEach(m => {
                        const item = {
                            label: m,
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: m + '($0)',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `box.${m}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`box.${m}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
                    });
                } else if (namespace === 'label') {
                    const labelMethods = ['new'];
                    labelMethods.forEach(m => {
                        const item = {
                            label: m,
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: m === 'new' ? 'new(x=${1:bar_index}, y=${2:high}, text="${3:Text}")' : m + '($0)',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `label.${m}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`label.${m}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
                    });
                } else if (namespace === 'line') {
                    const lineMethods = ['new'];
                    lineMethods.forEach(m => {
                        const item = {
                            label: m,
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: m === 'new' ? 'new(x1=${1:bar_index[1]}, y1=${2:low[1]}, x2=${3:bar_index}, y2=${4:low})' : m + '($0)',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `line.${m}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`line.${m}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
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
                        
                        const item = {
                            label: m,
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: ins,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `array.${m}`,
                            range: range
                        };

                        const doc = ZEN_DOCS[`array.${m}`];
                        if (doc) {
                            item.detail = doc.signature;
                            item.documentation = {
                                value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                       doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                            };
                        }
                        suggestions.push(item);
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
                    insertText: k,
                    range: range
                });
            });

            // Variables
            const variables = ['open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'bar_index'];
            variables.forEach(v => {
                suggestions.push({
                    label: v,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: v,
                    detail: 'Built-in time-series series',
                    range: range
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
                { name: 'macd', snippet: 'macd(${1:close}, ${2:12}, ${3:26}, ${4:9})', desc: 'Moving Average Convergence Divergence' },
                { name: 'volume_profile', snippet: 'volume_profile(${1:200}, ${2:50})', desc: 'Volume Profile (lookback-based)' },
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
                { name: 'linreg_intercept', snippet: 'linreg_intercept(${1:close}, ${2:14})', desc: 'Linear Regression Intercept' },
                { name: 'rgba', snippet: 'rgba(${1:255}, ${2:255}, ${3:255}, ${4:1.0})', desc: 'Create custom color with red, green, blue, alpha' },
                { name: 'abs', snippet: 'abs(${1:close})', desc: 'Absolute value' },
                { name: 'ceil', snippet: 'ceil(${1:close})', desc: 'Ceiling rounding' },
                { name: 'floor', snippet: 'floor(${1:close})', desc: 'Floor rounding' },
                { name: 'sqrt', snippet: 'sqrt(${1:close})', desc: 'Square root' },
                { name: 'exp', snippet: 'exp(${1:close})', desc: 'Natural exponent (e^x)' },
                { name: 'log', snippet: 'log(${1:close})', desc: 'Natural logarithm' },
                { name: 'log10', snippet: 'log10(${1:close})', desc: 'Base 10 logarithm' },
                { name: 'pow', snippet: 'pow(${1:close}, ${2:2})', desc: 'Power function (base^exponent)' },
                { name: 'sin', snippet: 'sin(${1:close})', desc: 'Trigonometric sine' },
                { name: 'cos', snippet: 'cos(${1:close})', desc: 'Trigonometric cosine' },
                { name: 'tan', snippet: 'tan(${1:close})', desc: 'Trigonometric tangent' },
                { name: 'asin', snippet: 'asin(${1:close})', desc: 'Trigonometric arcsine' },
                { name: 'acos', snippet: 'acos(${1:close})', desc: 'Trigonometric arccosine' },
                { name: 'atan', snippet: 'atan(${1:close})', desc: 'Trigonometric arctangent' },
                { name: 'sign', snippet: 'sign(${1:close})', desc: 'Sign of value (1, -1, or 0)' },
                { name: 'min', snippet: 'min(${1:close}, ${2:open})', desc: 'Minimum of two values/series' },
                { name: 'max', snippet: 'max(${1:close}, ${2:open})', desc: 'Maximum of two values/series' },
                { name: 'nz', snippet: 'nz(${1:close}, ${2:0.0})', desc: 'Replace NaN/null with replacement value' },
                { name: 'na', snippet: 'na(${1:close})', desc: 'Check if value is NaN/null' },
                { name: 'wma', snippet: 'wma(${1:close}, ${2:14})', desc: 'Weighted Moving Average' },
                { name: 'rma', snippet: 'rma(${1:close}, ${2:14})', desc: 'Running Moving Average (used in ATR)' },
                { name: 'tr', snippet: 'tr()', desc: 'True Range' },
                { name: 'print', snippet: 'print(${1:value})', desc: 'Print debug message to developer console' },
                { name: 'plotbar', snippet: 'plotbar(${1:open}, ${2:high}, ${3:low}, ${4:close})', desc: 'Plot price bars on chart' }
            ];

            functions.forEach(f => {
                const doc = ZEN_DOCS[f.name];
                const docDetails = doc ? {
                    detail: doc.signature,
                    documentation: {
                        value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                               doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                    }
                } : {
                    detail: f.desc,
                    documentation: f.desc
                };

                suggestions.push({
                    label: f.name,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: f.snippet,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: range,
                    ...docDetails
                });
            });

            // Add namespace base suggestions
            const namespaces = ['color', 'input', 'box', 'label', 'line', 'array'];
            namespaces.forEach(ns => {
                suggestions.push({
                    label: ns,
                    kind: monaco.languages.CompletionItemKind.Module,
                    insertText: ns,
                    detail: `Namespace ${ns}`,
                    range: range
                });
            });

            return { suggestions: suggestions };
        }
    });

    // Rich Hover Provider for ZenScript
    monaco.languages.registerHoverProvider('zenscript', {
        provideHover: (model, position) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const line = model.getLineContent(position.lineNumber);
            const beforeWord = line.substring(0, word.startColumn - 1);
            const dotMatch = beforeWord.match(/([a-zA-Z_]\w*)\.$/);
            
            let lookupKey = word.word;
            if (dotMatch) {
                lookupKey = `${dotMatch[1]}.${word.word}`;
            }

            const doc = ZEN_DOCS[lookupKey];
            if (doc) {
                const contents = [];
                contents.push({ value: `\`\`\`zenscript\n${doc.signature}\n\`\`\`` });
                contents.push({ value: doc.desc });
                if (doc.params && doc.params.length > 0) {
                    const paramsList = doc.params.map(p => `* \`${p.name}\`: ${p.desc}`).join('\n');
                    contents.push({ value: `**Parameters:**\n${paramsList}` });
                }
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: contents
                };
            }

            const builtInVars = {
                'open': 'Built-in time-series representing the Open price of each bar.',
                'high': 'Built-in time-series representing the High price of each bar.',
                'low': 'Built-in time-series representing the Low price of each bar.',
                'close': 'Built-in time-series representing the Close price of each bar.',
                'volume': 'Built-in time-series representing the Volume of each bar.',
                'time': 'Built-in time-series representing the timestamp of each bar.',
                'timestamp': 'Built-in time-series representing the timestamp of each bar.',
                'hl2': 'Built-in time-series: `(high + low) / 2`.',
                'hlc3': 'Built-in time-series: `(high + low) / close` or HLC average.',
                'ohlc4': 'Built-in time-series: `(open + high + low + close) / 4`.',
                'hlcc4': 'Built-in time-series: `(high + low + close + close) / 4`.',
                'bar_index': 'Built-in variable representing the current index of the bar (starting at 0).',
                'na': 'Representing a null, missing, or Not-a-Number value.'
            };

            if (builtInVars[word.word]) {
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [
                        { value: `\`\`\`zenscript\nfloat ${word.word}\n\`\`\`` },
                        { value: builtInVars[word.word] }
                    ]
                };
            }

            const namespaces = {
                'color': 'Namespace containing color constants and color creation/manipulation functions.',
                'input': 'Namespace containing user-input configuration functions.',
                'box': 'Namespace containing drawing functions and property setters for box elements.',
                'label': 'Namespace containing drawing functions for label elements.',
                'line': 'Namespace containing drawing functions for line elements.',
                'array': 'Namespace containing array creation and manipulation functions.'
            };

            if (namespaces[word.word]) {
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [
                        { value: `\`\`\`zenscript\nnamespace ${word.word}\n\`\`\`` },
                        { value: namespaces[word.word] }
                    ]
                };
            }

            return null;
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
            
            const signatures = {};
            for (const [key, doc] of Object.entries(ZEN_DOCS)) {
                const params = (doc.params || []).map(p => ({
                    label: p.name,
                    documentation: p.desc
                }));
                signatures[key] = {
                    label: doc.signature,
                    documentation: doc.desc,
                    parameters: params
                };
            }

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
