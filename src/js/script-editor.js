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
        this.defaultScript = "// ZenScript Indicator\nvar length = 14;\nvar src = close;\nvar val = sma(src, length);\nplot(val, \"SMA\", #2962ff);";
        
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
                    [/[a-z_$][\w$]*(?=\s*\()/, 'predefined'],

                    // Variable declarations (e.g., var src =)
                    [/(var)(\s+)([a-z_$][\w$]*)/, ['keyword', '', 'identifier']],

                    // Named Arguments (e.g., color=, title=)
                    [/[a-z_$][\w$]*(?=\s*=(?!=))/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'attribute.name'
                        }
                    }],

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
                'var', 'let', 'const', 'if', 'else', 'switch', 'case', 'default', 'true', 'false', 'na', 'for', 'to'
            ],
            builtins: [
                'plot', 'sma', 'ema', 'rsi', 'stoch', 'bb', 'atr', 'supertrend', 'vwap',
                'input', 'indicator', 'plotshape', 'hline', 'fill', 'rgba',
                'label', 'label.new', 'line', 'line.new', 'bar_index',
                'open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'
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
        saveBtn.disabled = !isDirty;
        saveBtn.style.opacity = isDirty ? "1" : "0.4";
        saveBtn.style.pointerEvents = isDirty ? "auto" : "none";
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
            this.addChartBtn.disabled = !isDirty;
            this.addChartBtn.style.opacity = isDirty ? "1" : "0.4";
            this.addChartBtn.style.pointerEvents = isDirty ? "auto" : "none";
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

    async handleSave() {
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
