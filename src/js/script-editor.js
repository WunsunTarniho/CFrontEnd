/**
 * ScriptEditorController - Manages the Monaco Editor for ZenScript.
 */
/**
 * ScriptEditorController - Manages the Monaco Editor for ZenScript.
 */

import { ZEN_DOCS } from './zen-docs.js';
import { registerZenScript } from './zen-providers.js';
import * as ZenScript from '../../Chartify/lib/ZenScript.js';



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
            registerZenScript(monaco);
            this.createEditor();
            this.setupEventListeners();
            this.isInitialized = true;
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

        // Monaco content change listener with 300ms debounce to prevent typing lag
        let validationTimeout = null;
        this.editor.onDidChangeModelContent(() => {
            this.updateButtonStates();
            if (validationTimeout) {
                clearTimeout(validationTimeout);
            }
            validationTimeout = setTimeout(() => {
                this.validateScript();
            }, 300);
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
