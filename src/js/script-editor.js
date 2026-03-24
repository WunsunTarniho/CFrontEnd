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
        this.defaultScript = "// ZenScript Indicator\nvar length = 14;\nvar src = close;\nvar val = sma(src, length);\nplot(val, \"SMA\", #2962ff);";
        this.isInitialized = false;

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
                    [/[a-z_$][\w$]*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@builtins': 'predefined',
                            '@default': 'identifier'
                        }
                    }],
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>=\+\-\*\/%&|^!]+/, 'operator'],
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],
                    [/[;,.]/, 'delimiter'],
                    [/"([^"\\]|\\.)*"/, 'string'],
                    [/\/\/.*$/, 'comment'],
                ]
            },
            keywords: [
                'var', 'if', 'else', 'for', 'while', 'return', 'true', 'false'
            ],
            builtins: [
                'plot', 'sma', 'ema', 'rsi', 'macd', 'stoch', 'bb', 'atr',
                'open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4'
            ]
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
                { open: '"', close: '"' }
            ]
        });

        // Custom Theme
        monaco.editor.defineTheme('zen-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
                { token: 'predefined', foreground: '8be9fd' },
                { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
                { token: 'string', foreground: 'f1fa8c' },
                { token: 'number', foreground: 'bd93f9' },
                { token: 'operator', foreground: 'ff79c6' },
            ],
            colors: {
                'editor.background': '#131722',
                'editor.foreground': '#d1d4dc',
                'editor.lineHighlightBackground': '#2a2e39',
                'editorCursor.foreground': '#2962ff',
                'editor.selectionBackground': '#2962ff44',
                'editorIndentGuide.background': '#2a2e39',
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
        });
    }

    show(scriptData = null) {
        this.container.style.display = 'flex';
        // Resize chart if needed
        window.dispatchEvent(new Event('resize'));
        
        if (scriptData) {
            this.editor.setValue(scriptData.script);
            this.currentScriptName = scriptData.name;
            this.currentScriptId = scriptData.id || scriptData._id;
            this.nameInput.value = scriptData.name;
        } else {
            this.currentScriptId = null;
        }

        this.updateApplyButton();
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
            this.addChartBtn.textContent = 'Sync with Chart';
        } else {
            this.addChartBtn.textContent = 'Add to Chart';
        }
    }

    hide() {
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
                ? `http://localhost:5000/api/indicators/${this.currentScriptId}` 
                : 'http://localhost:5000/api/indicators';
            
            const method = this.currentScriptId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, script, userId: "1" })
            });
            const result = await response.json();
            if (result.success) {
                this.logConsole(`Script "${name}" ${this.currentScriptId ? 'updated' : 'saved'} successfully!`, 'success');
                this.currentScriptName = name;
                if (!this.currentScriptId) this.currentScriptId = result.data.id || result.data._id;
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
                // Now pass the currentScriptId (might be ind_... from chart or database ID)
                const indicator = this.chart.addIndicator(name, script, this.currentScriptId);
                
                // If it was just added, update our local ID so the button changes to "Sync"
                if (indicator && indicator.id) {
                    this.currentScriptId = indicator.id;
                    this.updateApplyButton();
                }

                // Mark as active script in localStorage
                localStorage.setItem('activeZenScript', JSON.stringify({
                    id: this.currentScriptId,
                    name: name,
                    code: script
                }));
                
                this.logConsole(`Indicator ${this.addChartBtn.textContent === 'Sync with Chart' ? 'synced' : 'added'} successfully.`, 'success');
            } else {
                this.logConsole("Chart not ready to receive scripts.", 'error');
            }
        } catch (err) {
            this.logConsole(`Compile Error: ${err.message}`, 'error');
        }
    }

    handleNew() {
        if (confirm("Are you sure you want to create a new script? Any unsaved changes will be lost.")) {
            this.currentScriptName = "New Indicator";
            this.currentScriptId = null;
            this.nameInput.value = this.currentScriptName;
            this.editor.setValue(this.defaultScript);
            this.logConsole("New script started.");
        }
    }
}
