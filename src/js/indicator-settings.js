import { AdvancedLineSetting } from './components/AdvancedLineSetting.js';

/**
 * IndicatorSettingsController
 * Handles the TradingView-style settings modal for indicators.
 * Dynamically generates form fields based on indicator input metadata.
 */
export class IndicatorSettingsController {
    constructor(chart) {
        this.chart = chart;
        this.backdrop = document.getElementById('indicator-settings-backdrop');
        this.dialog = document.getElementById('indicator-settings-dialog');
        this.tabs = this.dialog.querySelectorAll('.chart-settings-tab');
        this.views = this.dialog.querySelectorAll('.chart-settings-view');

        this.activeIndicator = null;
        this.tempInputs = {};
        this.tempStyle = {};
        this.tempVisibility = {};
        this.tempMetadata = {};

        // Backups for revert logic
        this.backupInputs = {};
        this.backupStyle = {};
        this.backupVisibility = {};
        this.backupMetadata = {};
        this.alsInstances = [];

        this.init();
    }

    init() {
        // Tab switching
        this.tabs.forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });

        // Close/Cancel
        const closeBtn = this.dialog.querySelector('.chart-settings-close');
        if (closeBtn) closeBtn.onclick = () => this.close();

        const cancelBtn = document.getElementById('indicator-settings-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.close();

        // Ok / Save
        const okBtn = document.getElementById('indicator-settings-ok');
        if (okBtn) okBtn.onclick = () => this.apply();

        // Reset
        const resetBtn = document.getElementById('indicator-settings-reset');
        if (resetBtn) resetBtn.onclick = () => this.resetToDefaults();

        // Close on backdrop click
        this.backdrop.onclick = (e) => {
            if (e.target === this.backdrop) this.close();
        };

        // Hook into Chartify's callback
        this.chart.onIndicatorSettings = (id) => this.open(id);
    }

    switchTab(tabId) {
        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        this.views.forEach(v => v.classList.toggle('active', v.dataset.view === tabId));

        // Re-render tabs when switched to ensure sync with current inputs/metadata/style
        if (tabId === 'inputs') {
            this.renderInputs();
        } else if (tabId === 'style') {
            this.renderStyle();
        } else if (tabId === 'visibility') {
            this.renderVisibility();
        }
    }

    open(indicatorOrId) {
        let indicator;
        if (typeof indicatorOrId === 'string') {
            indicator = this.chart.indicators.find(ind => ind.id === indicatorOrId);
        } else {
            indicator = indicatorOrId;
        }

        if (!indicator) return;

        this.activeIndicator = indicator;

        // Deep clone current settings for temporary editing and backups
        this.backupInputs = JSON.parse(JSON.stringify(indicator.inputs || {}));
        this.backupStyle = JSON.parse(JSON.stringify(indicator.style || {}));
        this.backupVisibility = JSON.parse(JSON.stringify(indicator.visibility || {}));
        this.backupMetadata = JSON.parse(JSON.stringify(indicator.metadata || {}));

        this.tempInputs = JSON.parse(JSON.stringify(this.backupInputs));
        this.tempStyle = JSON.parse(JSON.stringify(this.backupStyle));
        this.tempVisibility = JSON.parse(JSON.stringify(this.backupVisibility));
        this.tempMetadata = JSON.parse(JSON.stringify(this.backupMetadata));

        // Ensure HLines and Shapes are in tempStyle for editing
        if (indicator.hlines && !this.tempStyle.hlines) {
            this.tempStyle.hlines = JSON.parse(JSON.stringify(indicator.hlines));
        }
        if (indicator.shapes && !this.tempStyle.shapes) {
            this.tempStyle.shapes = JSON.parse(JSON.stringify(indicator.shapes));
        }
        if (indicator.bgcolors && !this.tempStyle.bgcolors) {
            this.tempStyle.bgcolors = JSON.parse(JSON.stringify(indicator.bgcolors));
        }
        if (indicator.fills && !this.tempStyle.fills) {
            this.tempStyle.fills = JSON.parse(JSON.stringify(indicator.fills));
        }
        if (indicator.lines && !this.tempStyle.lines) {
            this.tempStyle.lines = { visible: true };
        }
        if (indicator.labels && !this.tempStyle.labels) {
            this.tempStyle.labels = { visible: true };
        }
        if (indicator.linefills && !this.tempStyle.linefills) {
            this.tempStyle.linefills = { visible: true };
        }
        if (indicator.arrows && !this.tempStyle.arrows) {
            this.tempStyle.arrows = JSON.parse(JSON.stringify(indicator.arrows));
        }
        if (indicator.chars && !this.tempStyle.chars) {
            this.tempStyle.chars = JSON.parse(JSON.stringify(indicator.chars));
        }
        if (indicator.boxes && !this.tempStyle.boxes) {
            this.tempStyle.boxes = { visible: true };
        }

        // Update Title
        document.getElementById('indicator-settings-title').textContent = `${indicator.name} Settings`;

        // Populate Views
        this.renderInputs();
        this.renderStyle();
        this.renderVisibility(); 

        // Show Modal
        this.switchTab('inputs');
        this.backdrop.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    close() {
        if (this.activeIndicator) {
            // Revert to backup state
            this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.backupInputs));
            this.activeIndicator.style = JSON.parse(JSON.stringify(this.backupStyle));
            this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.backupVisibility));
            this.activeIndicator.metadata = JSON.parse(JSON.stringify(this.backupMetadata));

            // Restore HLines and Shapes backup if it exists
            if (this.backupStyle.hlines) {
                this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.backupStyle.hlines));
            }
            if (this.backupStyle.shapes) {
                this.activeIndicator.shapes = JSON.parse(JSON.stringify(this.backupStyle.shapes));
            }
            if (this.backupStyle.bgcolors) {
                this.activeIndicator.bgcolors = JSON.parse(JSON.stringify(this.backupStyle.bgcolors));
            }
            if (this.backupStyle.fills) {
                this.activeIndicator.fills = JSON.parse(JSON.stringify(this.backupStyle.fills));
            }
            if (this.backupStyle.chars) {
                this.activeIndicator.chars = JSON.parse(JSON.stringify(this.backupStyle.chars));
            }
            if (this.backupStyle.arrows) {
                this.activeIndicator.arrows = JSON.parse(JSON.stringify(this.backupStyle.arrows));
            }

            this.chart.indicatorsDirty = true;
            this.chart.calculateIndicators();
            this.chart.render();
        }

        this.backdrop.classList.remove('active');
        document.body.style.overflow = '';
        this.cleanupALS();
        this.activeIndicator = null;
    }

    updatePreview() {
        if (!this.activeIndicator) return;

        this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.tempInputs));
        this.activeIndicator.style = JSON.parse(JSON.stringify(this.tempStyle));
        this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.tempVisibility));
        this.activeIndicator.metadata = JSON.parse(JSON.stringify(this.tempMetadata));

        if (this.tempStyle.hlines) {
            this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.tempStyle.hlines));
        }
        if (this.tempStyle.shapes) {
            this.activeIndicator.shapes = JSON.parse(JSON.stringify(this.tempStyle.shapes));
        }
        if (this.tempStyle.bgcolors) {
            this.activeIndicator.bgcolors = JSON.parse(JSON.stringify(this.tempStyle.bgcolors));
        }
        if (this.tempStyle.fills) {
            this.activeIndicator.fills = JSON.parse(JSON.stringify(this.tempStyle.fills));
        }
        if (this.tempStyle.chars) {
            this.activeIndicator.chars = JSON.parse(JSON.stringify(this.tempStyle.chars));
        }
        if (this.tempStyle.arrows) {
            this.activeIndicator.arrows = JSON.parse(JSON.stringify(this.tempStyle.arrows));
        }

        this.chart.indicatorsDirty = true;
        this.chart.styleVersion++;
        this.chart.calculateIndicators();
        this.chart.render();
    }

    apply() {
        if (!this.activeIndicator) return;

        // Save history
        this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.backupInputs));
        this.activeIndicator.style = JSON.parse(JSON.stringify(this.backupStyle));
        this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.backupVisibility));
        this.activeIndicator.metadata = JSON.parse(JSON.stringify(this.backupMetadata));
        this.chart.saveHistory();

        // Re-apply confirmed changes
        this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.tempInputs));
        this.activeIndicator.style = JSON.parse(JSON.stringify(this.tempStyle));
        this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.tempVisibility));
        this.activeIndicator.metadata = JSON.parse(JSON.stringify(this.tempMetadata));

        if (this.tempStyle.hlines) {
            this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.tempStyle.hlines));
        }
        if (this.tempStyle.shapes) {
            this.activeIndicator.shapes = JSON.parse(JSON.stringify(this.tempStyle.shapes));
        }
        if (this.tempStyle.bgcolors) {
            this.activeIndicator.bgcolors = JSON.parse(JSON.stringify(this.tempStyle.bgcolors));
        }
        if (this.tempStyle.fills) {
            this.activeIndicator.fills = JSON.parse(JSON.stringify(this.tempStyle.fills));
        }
        if (this.tempStyle.chars) {
            this.activeIndicator.chars = JSON.parse(JSON.stringify(this.tempStyle.chars));
        }
        if (this.tempStyle.arrows) {
            this.activeIndicator.arrows = JSON.parse(JSON.stringify(this.tempStyle.arrows));
        }

        this.chart.indicatorsDirty = true;
        this.chart.calculateIndicators();
        this.chart.render();

        this.chart.isLayoutDirty = true;
        if (this.chart._notifyDirtyChange) this.chart._notifyDirtyChange();

        this.activeIndicator = null;
        this.backdrop.classList.remove('active');
        document.body.style.overflow = '';
        this.cleanupALS();
    }

    resetToDefaults() {
        if (!this.activeIndicator || !this.activeIndicator.inputMetadata) return;
        Object.values(this.activeIndicator.inputMetadata).forEach(meta => {
            this.tempInputs[meta.id] = meta.defval;
        });
        this.renderInputs();
        this.updatePreview();
    }

    cleanupALS() {
        if (this.alsInstances) this.alsInstances.forEach(als => als.destroy());
        this.alsInstances = [];
    }

    renderInputs() {
        const container = document.getElementById('indicator-settings-inputs');
        container.innerHTML = '';
        const metadata = this.activeIndicator.inputMetadata;

        const hasInputs = metadata && Object.keys(metadata).length > 0;
        
        // Check if there are any plot-like elements
        const ind = this.activeIndicator;
        const hasPlots = (ind.plots && ind.plots.length > 0) ||
                         (ind.shapes && ind.shapes.length > 0) ||
                         (ind.chars && ind.chars.length > 0) ||
                         (ind.arrows && ind.arrows.length > 0) ||
                         (ind.candles && ind.candles.length > 0) ||
                         (ind.fills && ind.fills.length > 0) ||
                         (ind.bgcolors && ind.bgcolors.length > 0) ||
                         (ind.barcolors && ind.barcolors.length > 0) ||
                         (ind.linefills && ind.linefills.length > 0) ||
                         (ind.hlines && ind.hlines.length > 0) ||
                         (ind.lines && ind.lines.length > 0) ||
                         (ind.labels && ind.labels.length > 0) ||
                         (ind.boxes && ind.boxes.length > 0);

        if (!hasInputs && !hasPlots) {
            container.innerHTML = '<div class="settings-empty">No inputs or outputs available.</div>';
            return;
        }

        // Render Inputs if any
        if (hasInputs) {
            const groups = {};
            Object.values(metadata).forEach(meta => {
                const groupName = meta.group || 'General';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(meta);
            });

            for (const [groupName, inputs] of Object.entries(groups)) {
                const groupEl = document.createElement('div');
                groupEl.className = 'settings-group';
                if (groupName !== 'General' || Object.keys(groups).length > 1) {
                    const title = document.createElement('div');
                    title.className = 'settings-group-title';
                    title.textContent = groupName;
                    groupEl.appendChild(title);
                }
                inputs.forEach(meta => groupEl.appendChild(this.createInputRow(meta)));
                container.appendChild(groupEl);
            }
        }

        // Always render Output Values Section if the indicator has plots/outputs
        if (hasPlots) {
            const outputGroup = document.createElement('div');
            outputGroup.className = 'settings-group';
            
            const outputTitle = document.createElement('div');
            outputTitle.className = 'settings-group-title';
            outputTitle.textContent = 'OUTPUT VALUES';
            outputGroup.appendChild(outputTitle);

            // 1. Precision
            const precisionRow = document.createElement('div');
            precisionRow.className = 'settings-row';
            precisionRow.innerHTML = `<label class="settings-label">Precision</label>`;
            
            const precisionSelect = document.createElement('select');
            precisionSelect.className = 'settings-select';
            const precOptions = ['Default', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'];
            precOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.toLowerCase();
                el.textContent = opt;
                if (String((this.activeIndicator.metadata && this.activeIndicator.metadata.precision) || 'default').toLowerCase() === el.value) el.selected = true;
                precisionSelect.appendChild(el);
            });
            precisionSelect.onchange = (e) => {
                if (!this.tempMetadata) this.tempMetadata = {};
                this.tempMetadata.precision = e.target.value === 'default' ? 'default' : parseInt(e.target.value);
                this.updatePreview();
            };
            const precContainer = document.createElement('div');
            precContainer.className = 'settings-input-container';
            precContainer.appendChild(precisionSelect);
            precisionRow.appendChild(precContainer);
            outputGroup.appendChild(precisionRow);

            // 2. Labels on price scale
            const labelsRow = document.createElement('div');
            labelsRow.className = 'settings-row';
            const labelsCheck = document.createElement('input');
            labelsCheck.type = 'checkbox';
            labelsCheck.checked = (this.tempMetadata && this.tempMetadata.showLabelsOnPriceScale !== false);
            labelsCheck.onchange = (e) => {
                if (!this.tempMetadata) this.tempMetadata = {};
                this.tempMetadata.showLabelsOnPriceScale = e.target.checked;
                this.updatePreview();
            };
            labelsRow.appendChild(labelsCheck);
            labelsRow.appendChild(this.createCheckboxLabel('Labels on price scale'));
            outputGroup.appendChild(labelsRow);

            // 3. Values in status line
            const valuesRow = document.createElement('div');
            valuesRow.className = 'settings-row';
            const valuesCheck = document.createElement('input');
            valuesCheck.type = 'checkbox';
            valuesCheck.checked = (this.tempMetadata && this.tempMetadata.showValuesInStatusLine !== false);
            valuesCheck.onchange = (e) => {
                if (!this.tempMetadata) this.tempMetadata = {};
                this.tempMetadata.showValuesInStatusLine = e.target.checked;
                this.updatePreview();
            };
            valuesRow.appendChild(valuesCheck);
            valuesRow.appendChild(this.createCheckboxLabel('Values in status line'));
            outputGroup.appendChild(valuesRow);

            container.appendChild(outputGroup);
        }

        // Always render Input Values Section if the indicator has inputs or plots/outputs
        if (hasInputs || hasPlots) {
            const inputValGroup = document.createElement('div');
            inputValGroup.className = 'settings-group';
            
            const inputValTitle = document.createElement('div');
            inputValTitle.className = 'settings-group-title';
            inputValTitle.textContent = 'INPUT VALUES';
            inputValGroup.appendChild(inputValTitle);

            // 1. Inputs in status line
            const inputsRow = document.createElement('div');
            inputsRow.className = 'settings-row';
            const inputsCheck = document.createElement('input');
            inputsCheck.type = 'checkbox';
            inputsCheck.checked = (this.tempMetadata && this.tempMetadata.showInputsInStatusLine !== false);
            inputsCheck.onchange = (e) => {
                if (!this.tempMetadata) this.tempMetadata = {};
                this.tempMetadata.showInputsInStatusLine = e.target.checked;
                this.updatePreview();
            };
            inputsRow.appendChild(inputsCheck);
            inputsRow.appendChild(this.createCheckboxLabel('Inputs in status line'));
            inputValGroup.appendChild(inputsRow);

            container.appendChild(inputValGroup);
        }
    }

    createCheckboxLabel(text) {
        const label = document.createElement('label');
        label.className = 'settings-checkbox-label';
        label.textContent = text;
        return label;
    }

    createInputRow(meta) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        if (meta.tooltip) row.title = meta.tooltip;

        const currentValue = this.tempInputs[meta.id] !== undefined ? this.tempInputs[meta.id] : meta.defval;

        if (meta.type === 'bool') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!currentValue;
            checkbox.onchange = (e) => { this.tempInputs[meta.id] = e.target.checked; this.updatePreview(); };
            row.appendChild(checkbox);

            const label = document.createElement('label');
            label.className = 'settings-checkbox-label';
            label.textContent = meta.title || meta.id;
            row.appendChild(label);
            return row;
        }

        if (meta.type === 'color') {
            const label = document.createElement('label');
            label.className = 'settings-label';
            label.textContent = meta.title || meta.id;
            row.appendChild(label);

            const inputContainer = document.createElement('div');
            inputContainer.className = 'settings-input-container';

            const alsContainer = document.createElement('div');
            alsContainer.className = 'als-control-wrapper';
            const als = new AdvancedLineSetting(alsContainer, {
                showColor: true,
                showOpacity: true,
                showThickness: false,
                showStyle: false,
                compact: true,
                onChange: (val) => { 
                    this.tempInputs[meta.id] = val.rgba; 
                    this.updatePreview(); 
                }
            });
            als.setValue({ hexAlpha: currentValue || '#2196f3' });
            this.alsInstances.push(als);
            inputContainer.appendChild(alsContainer);
            row.appendChild(inputContainer);
            return row;
        }

        const label = document.createElement('label');
        label.className = 'settings-label';
        label.textContent = meta.title || meta.id;
        row.appendChild(label);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'settings-input-container';

        let inputEl;
        if (meta.type === 'source' || (meta.options && meta.options.length > 0)) {
            inputEl = document.createElement('select');
            inputEl.className = 'settings-select';

            if (meta.type === 'source') {
                const standardSources = [
                    { value: 'open', title: 'Open' },
                    { value: 'high', title: 'High' },
                    { value: 'low', title: 'Low' },
                    { value: 'close', title: 'Close' },
                    { value: 'hl2', title: '(H + L) / 2' },
                    { value: 'hlc3', title: '(H + L + C) / 3' },
                    { value: 'ohlc4', title: '(O + H + L + C) / 4' },
                    { value: 'hlcc4', title: '(H + L + C + C) / 4' }
                ];

                standardSources.forEach(src => {
                    const opt = document.createElement('option');
                    opt.value = src.value;
                    opt.textContent = src.title;
                    if (currentValue === src.value) opt.selected = true;
                    inputEl.appendChild(opt);
                });

                if (this.chart && this.chart.indicators) {
                    this.chart.indicators.forEach(ind => {
                        if (ind.id === this.activeIndicator.id) return;
                        if (ind.plots && ind.plots.length > 0) {
                            ind.plots.forEach(plot => {
                                if (plot.display === 'none') return;
                                const val = `${ind.id}:${plot.id}`;
                                const opt = document.createElement('option');
                                opt.value = val;
                                opt.textContent = `${ind.metadata.shorttitle || ind.name}: ${plot.title || plot.id}`;
                                if (currentValue === val) opt.selected = true;
                                inputEl.appendChild(opt);
                            });
                        }
                    });
                }
            } else {
                let options = meta.options || [];
                options.forEach(opt => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const title = typeof opt === 'object' ? opt.title : opt;
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = title;
                    if (currentValue === val) option.selected = true;
                    inputEl.appendChild(option);
                });
            }

            inputEl.onchange = (e) => { 
                this.tempInputs[meta.id] = e.target.value; 
                this.updatePreview(); 
            };
        } else {
            inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.inputMode = meta.type === 'float' ? 'decimal' : (meta.type === 'int' ? 'numeric' : 'text');
            inputEl.className = 'settings-input';
            inputEl.value = currentValue;
            
            inputEl.oninput = (e) => { 
                let val = e.target.value;
                // Normalize comma to dot for internal storage
                const internalVal = val.replace(',', '.');
                this.tempInputs[meta.id] = internalVal;
                this.updatePreview();
            };
        }
        inputContainer.appendChild(inputEl);
        row.appendChild(inputContainer);
        return row;
    }

    renderStyle() {
        const container = document.getElementById('indicator-settings-style');
        container.innerHTML = '';

        // Initialize tempStyle from activeIndicator if not already present
        if (!this.tempStyle.plots && this.activeIndicator.plots) {
            this.tempStyle.plots = this.activeIndicator.plots.map(p => ({
                color: p.color || '#2196F3',
                width: p.width || 2,
                style: p.style || 'solid',
                location: p.location || 'belowbar',
                type: p.type || 'line',
                visible: p.visible !== false,
                title: p.title,
                showPriceLine: !!p.showPriceLine,
                editable: p.editable !== false
            }));
        }

        if ((!this.tempStyle.shapes || this.tempStyle.shapes.length === 0) && this.activeIndicator.shapes) {
            this.tempStyle.shapes = this.activeIndicator.shapes.map(s => ({
                color: s.color || '#2196F3',
                style: s.style || 'triangleup',
                location: s.location || 'belowbar',
                visible: s.visible !== false,
                title: s.title || 'Shape',
                editable: s.editable !== false,
                // Advanced properties
                size: s.size || 'tiny',
                offset: s.offset || 0,
                text: s.text || '',
                textcolor: s.textcolor || '#ffffff',
                show_last: s.show_last || 0,
                format: s.format || 'price',
                precision: s.precision !== undefined ? s.precision : 2
            }));
        }

        if ((!this.tempStyle.chars || this.tempStyle.chars.length === 0 || Array.isArray(this.tempStyle.chars) === false) && this.activeIndicator.chars) {
            this.tempStyle.chars = this.activeIndicator.chars.map(c => ({
                color: c.color || '#2196F3',
                char: c.char || '★',
                location: c.location || 'abovebar',
                visible: c.visible !== false,
                title: c.title || 'Char',
                editable: c.editable !== false,
                // Advanced properties
                size: c.size || 'normal',
                offset: c.offset || 0,
                text: c.text || '',
                textcolor: c.textcolor || '#ffffff',
                show_last: c.show_last || 0,
                format: c.format || 'price',
                precision: c.precision !== undefined ? c.precision : 2
            }));
        }

        if ((!this.tempStyle.arrows || this.tempStyle.arrows.length === 0 || Array.isArray(this.tempStyle.arrows) === false) && this.activeIndicator.arrows) {
            this.tempStyle.arrows = this.activeIndicator.arrows.map(a => ({
                colorup: a.colorup || '#26a69a',
                colordown: a.colordown || '#f23645',
                visible: a.visible !== false,
                title: a.title || 'Arrow',
                editable: a.editable !== false,
                // Advanced properties
                offset: a.offset || 0,
                minheight: a.minheight !== undefined ? a.minheight : 20,
                maxheight: a.maxheight !== undefined ? a.maxheight : 100,
                show_last: a.show_last || 0,
                format: a.format || 'price',
                precision: a.precision !== undefined ? a.precision : 2
            }));
        }

        if ((!this.tempStyle.hlines || this.tempStyle.hlines.length === 0) && this.activeIndicator.hlines) {
            this.tempStyle.hlines = this.activeIndicator.hlines.map(h => ({
                color: h.color || '#999',
                width: h.width || 1,
                style: h.style || 'dashed',
                visible: h.visible !== false,
                title: h.title,
                price: h.price || 0
            }));
        }

        // Render Plots
        if (this.tempStyle.plots && this.tempStyle.plots.length > 0) {
            this.tempStyle.plots.forEach((plot, plotIdx) => {
                if (plot.editable === false) return;
                this.renderPlotRow(container, plot, plotIdx);
            });
        }

        // Render Shapes
        if (this.tempStyle.shapes && this.tempStyle.shapes.length > 0) {
            this.tempStyle.shapes.forEach((shape, shapeIdx) => {
                if (shape.editable === false) return;
                this.renderShapeRow(container, shape, shapeIdx);
            });
        }

        // Render Chars
        if (this.tempStyle.chars && this.tempStyle.chars.length > 0 && Array.isArray(this.tempStyle.chars)) {
            this.tempStyle.chars.forEach((char, charIdx) => {
                if (char.editable === false) return;
                this.renderCharRow(container, char, charIdx);
            });
        }

        // Render Arrows
        if (this.tempStyle.arrows && this.tempStyle.arrows.length > 0 && Array.isArray(this.tempStyle.arrows)) {
            this.tempStyle.arrows.forEach((arrow, arrowIdx) => {
                if (arrow.editable === false) return;
                this.renderArrowRow(container, arrow, arrowIdx);
            });
        }

        // Background Colors
        if (this.activeIndicator.bgcolors && this.activeIndicator.bgcolors.length > 0) {
            if (!this.tempStyle.bgcolors) this.tempStyle.bgcolors = [];
            this.activeIndicator.bgcolors.forEach((bg, bgIdx) => {
                if (bg.editable === false) return;
                // Ensure tempStyle entry exists
                if (!this.tempStyle.bgcolors[bgIdx]) {
                    this.tempStyle.bgcolors[bgIdx] = {
                        visible: bg.visible !== false,
                        color: bg.color,
                        title: bg.title,
                        colorMap: {}
                    };
                }
                this.renderBgColorRow(container, this.tempStyle.bgcolors[bgIdx], bgIdx);
            });
        }

        // Bar Colors
        if (this.activeIndicator.barcolors && this.activeIndicator.barcolors.length > 0) {
            if (!this.tempStyle.barcolors) this.tempStyle.barcolors = [];
            this.activeIndicator.barcolors.forEach((bc, bcIdx) => {
                if (bc.editable === false) return;
                if (!this.tempStyle.barcolors[bcIdx]) {
                    this.tempStyle.barcolors[bcIdx] = {
                        visible: bc.visible !== false,
                        color: bc.color,
                        title: bc.title || 'Bar Color',
                        colorMap: {}
                    };
                }
                this.renderBarColorRow(container, this.tempStyle.barcolors[bcIdx], bcIdx);
            });
        }

        // Custom Candles (plotcandle / plotbar)
        if (this.activeIndicator.candles && this.activeIndicator.candles.length > 0) {
            if (!this.tempStyle.candles) this.tempStyle.candles = [];
            this.activeIndicator.candles.forEach((c, cIdx) => {
                if (c.editable === false) return;
                const actualC = this.activeIndicator.candles[cIdx];
                const isBar = actualC && actualC.drawType === 'bar';
                if (!this.tempStyle.candles[cIdx]) {
                    this.tempStyle.candles[cIdx] = {
                        visible: c.visible !== false,
                        color: c.color,
                        title: c.title || (isBar ? 'Bars' : 'Candles'),
                        ...(!isBar && {
                            wickcolor: c.wickcolor || c.color,
                            bordercolor: c.bordercolor || c.color,
                        })
                    };
                }
                this.renderCandleRow(container, this.tempStyle.candles[cIdx], cIdx);
            });
        }

        // Fills (fill)
        if (this.activeIndicator.fills && this.activeIndicator.fills.length > 0) {
            if (!this.tempStyle.fills) this.tempStyle.fills = [];
            this.activeIndicator.fills.forEach((f, fIdx) => {
                if (f.editable === false) return;
                if (!this.tempStyle.fills[fIdx]) {
                    this.tempStyle.fills[fIdx] = {
                        visible: f.visible !== false,
                        color: f.color || 'rgba(33, 150, 243, 0.2)',
                        title: f.title || 'Fill',
                        show_last: f.show_last,
                        fillgaps: f.fillgaps !== false
                    };
                }
                this.renderFillRow(container, this.tempStyle.fills[fIdx], fIdx);
            });
        }

        // 2. Horizontal Lines (HLines)
        if (this.tempStyle.hlines && this.tempStyle.hlines.length > 0) {
            this.tempStyle.hlines.forEach((hline, plotIdx) => {
                this.renderHLineRow(container, hline, plotIdx);
            });
        }

        // Render Dynamic Lines
        if (this.activeIndicator.lines && this.activeIndicator.lines.length > 0) {
            if (!this.tempStyle.lines) {
                this.tempStyle.lines = { visible: true };
            }
            this.tempStyle.lines.title = 'Lines';
            this.renderDynamicLineRow(container, this.tempStyle.lines);
        }

        // Render Dynamic Labels
        if (this.activeIndicator.labels && this.activeIndicator.labels.length > 0) {
            if (!this.tempStyle.labels) {
                this.tempStyle.labels = { visible: true };
            }
            this.tempStyle.labels.title = 'Labels';
            this.renderDynamicLabelRow(container, this.tempStyle.labels);
        }

        // Render Dynamic Linefills
        if (this.activeIndicator.linefills && this.activeIndicator.linefills.length > 0) {
            if (!this.tempStyle.linefills) {
                this.tempStyle.linefills = { visible: true };
            }
            this.tempStyle.linefills.title = 'Linefills';
            this.renderDynamicLinefillRow(container, this.tempStyle.linefills);
        }



        // Render Dynamic Boxes
        if (this.activeIndicator.boxes && this.activeIndicator.boxes.length > 0) {
            if (!this.tempStyle.boxes) {
                this.tempStyle.boxes = { visible: true };
            }
            this.tempStyle.boxes.title = 'Boxes';
            this.renderDynamicBoxRow(container, this.tempStyle.boxes);
        }

        if (container.innerHTML === '') {
            container.innerHTML = '<div class="settings-empty">No style options available.</div>';
        }
    }

    renderDynamicLineRow(container, lineSet) {
        const mainRow = this.createBaseRow(lineSet, lineSet.title || 'Lines', (visible) => {
            lineSet.visible = visible;
            this.updatePreview();
        });
        container.appendChild(mainRow);
    }

    renderDynamicLabelRow(container, labelSet) {
        const mainRow = this.createBaseRow(labelSet, labelSet.title || 'Labels', (visible) => {
            labelSet.visible = visible;
            this.updatePreview();
        });
        container.appendChild(mainRow);
    }

    renderDynamicLinefillRow(container, lfSet) {
        const mainRow = this.createBaseRow(lfSet, lfSet.title || 'Linefills', (visible) => {
            lfSet.visible = visible;
            this.updatePreview();
        });
        container.appendChild(mainRow);
    }

    renderCharRow(container, charObj, charIdx) {
        const row = this.createBaseRow(charObj, charObj.title || `Char ${charIdx + 1}`, (visible) => {
            charObj.visible = visible;
            this.updatePreview();
        });

        const controls = document.createElement('div');
        controls.className = 'settings-plot-right';

        // 1. Standard Color Picker
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false,     
            compact: true,
            onChange: (val) => { charObj.color = val.rgba; this.updatePreview(); }
        });
        als.setValue({ hexAlpha: charObj.color || '#2196F3' });
        this.alsInstances.push(als);
        controls.appendChild(alsContainer);

        // 2. Character Input Box (1 char limit)
        const charInput = document.createElement('input');
        charInput.type = 'text';
        charInput.className = 'settings-input compact';
        charInput.style.width = '32px';
        charInput.maxLength = 1;
        charInput.value = charObj.char || '★';
        charInput.oninput = (e) => { charObj.char = e.target.value; this.updatePreview(); };
        controls.appendChild(charInput);

        // 3. Location Select
        const locSelect = document.createElement('select');
        locSelect.className = 'settings-select compact';
        locSelect.style.width = '100px';
        const locations = [
            { id: 'abovebar', label: 'Above bar' },
            { id: 'belowbar', label: 'Below bar' },
            { id: 'top', label: 'Top' },
            { id: 'bottom', label: 'Bottom' },
            { id: 'absolute', label: 'Absolute' }
        ];
        locations.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.label;
            locSelect.appendChild(opt);
        });
        locSelect.value = charObj.location || 'abovebar';
        locSelect.oninput = (e) => { charObj.location = e.target.value; this.updatePreview(); };
        controls.appendChild(locSelect);

        // 4. More Settings Button
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-settings-btn';
        moreBtn.innerHTML = '&#8942;';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openAdvancedCharSettings(moreBtn, charObj);
        };
        controls.appendChild(moreBtn);

        row.appendChild(controls);
        container.appendChild(row);
    }

    openAdvancedCharSettings(btn, charObj) {
        const popover = this.createPopover(btn);
        
        const addRow = (label, content) => {
            const sRow = document.createElement('div');
            sRow.className = 'settings-row';
            const sLabel = document.createElement('label');
            sLabel.textContent = label;
            sRow.appendChild(sLabel);
            sRow.appendChild(content);
            popover.appendChild(sRow);
        };

        // 1. Size
        const sizeSelect = document.createElement('select');
        ['tiny', 'small', 'normal', 'large', 'huge'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            sizeSelect.appendChild(opt);
        });
        sizeSelect.value = charObj.size || 'normal';
        sizeSelect.oninput = (e) => { charObj.size = e.target.value; this.updatePreview(); };
        addRow('Size', sizeSelect);

        // 2. Offset
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.value = charObj.offset || 0;
        offsetInput.oninput = (e) => { charObj.offset = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Offset', offsetInput);

        // 3. Text
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'None';
        textInput.value = charObj.text || '';
        textInput.oninput = (e) => { charObj.text = e.target.value; this.updatePreview(); };
        addRow('Text', textInput);

        // 4. Text Color
        const textColRow = document.createElement('div');
        textColRow.className = 'als-control-wrapper';
        const textColAls = new AdvancedLineSetting(textColRow, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false, 
            compact: true,
            onChange: (val) => { charObj.textcolor = val.rgba; this.updatePreview(); }
        });
        const resolveColor = (col, defaultCol) => Array.isArray(col) ? (col.find(v => v !== null) || defaultCol) : (col || defaultCol);
        textColAls.setValue({ hexAlpha: resolveColor(charObj.textcolor, '#ffffff') });
        this.alsInstances.push(textColAls);
        addRow('Text color', textColRow);

        // 5. Show Last
        const showLastInput = document.createElement('input');
        showLastInput.type = 'number';
        showLastInput.placeholder = 'All';
        showLastInput.value = charObj.show_last || 0;
        showLastInput.oninput = (e) => { charObj.show_last = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Show last', showLastInput);
    }

    renderArrowRow(container, arrowObj, arrowIdx) {
        const mainRow = this.createBaseRow(arrowObj, arrowObj.title || `Arrow ${arrowIdx + 1}`, (visible) => {
            arrowObj.visible = visible;
            this.updatePreview();
        });

        const plotGroup = document.createElement('div');
        plotGroup.className = 'settings-plot-group';
        plotGroup.appendChild(mainRow);

        // 1. Color Up Sub Row
        const controlsUp = document.createElement('div');
        controlsUp.className = 'settings-plot-right';

        const alsUpContainer = document.createElement('div');
        alsUpContainer.className = 'als-control-wrapper';
        const alsUp = new AdvancedLineSetting(alsUpContainer, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false,     
            compact: true,
            onChange: (val) => { arrowObj.colorup = val.rgba; this.updatePreview(); }
        });
        alsUp.setValue({ hexAlpha: arrowObj.colorup || '#26a69a' });
        this.alsInstances.push(alsUp);
        controlsUp.appendChild(alsUpContainer);

        const subRowUp = this.createSubRow('Arrow Up', controlsUp);
        plotGroup.appendChild(subRowUp);

        // 2. Color Down Sub Row
        const controlsDown = document.createElement('div');
        controlsDown.className = 'settings-plot-right';

        const alsDownContainer = document.createElement('div');
        alsDownContainer.className = 'als-control-wrapper';
        const alsDown = new AdvancedLineSetting(alsDownContainer, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false,     
            compact: true,
            onChange: (val) => { arrowObj.colordown = val.rgba; this.updatePreview(); }
        });
        alsDown.setValue({ hexAlpha: arrowObj.colordown || '#f23645' });
        this.alsInstances.push(alsDown);
        controlsDown.appendChild(alsDownContainer);

        const subRowDown = this.createSubRow('Arrow Down', controlsDown);
        plotGroup.appendChild(subRowDown);

        // 3. More Settings Button on the main row
        let mainControls = mainRow.querySelector('.settings-plot-right');
        if (!mainControls) {
            mainControls = document.createElement('div');
            mainControls.className = 'settings-plot-right';
            mainRow.appendChild(mainControls);
        }
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-settings-btn';
        moreBtn.innerHTML = '&#8942;';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openAdvancedArrowSettings(moreBtn, arrowObj);
        };
        mainControls.appendChild(moreBtn);

        container.appendChild(plotGroup);
    }

    openAdvancedArrowSettings(btn, arrowObj) {
        const popover = this.createPopover(btn);
        
        const addRow = (label, content) => {
            const sRow = document.createElement('div');
            sRow.className = 'settings-row';
            const sLabel = document.createElement('label');
            sLabel.textContent = label;
            sRow.appendChild(sLabel);
            sRow.appendChild(content);
            popover.appendChild(sRow);
        };

        // 1. Offset
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.value = arrowObj.offset || 0;
        offsetInput.oninput = (e) => { arrowObj.offset = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Offset', offsetInput);

        // 2. Min Height
        const minHeightInput = document.createElement('input');
        minHeightInput.type = 'number';
        minHeightInput.value = arrowObj.minheight !== undefined ? arrowObj.minheight : 20;
        minHeightInput.oninput = (e) => { arrowObj.minheight = parseInt(e.target.value) || 20; this.updatePreview(); };
        addRow('Min height', minHeightInput);

        // 3. Max Height
        const maxHeightInput = document.createElement('input');
        maxHeightInput.type = 'number';
        maxHeightInput.value = arrowObj.maxheight !== undefined ? arrowObj.maxheight : 100;
        maxHeightInput.oninput = (e) => { arrowObj.maxheight = parseInt(e.target.value) || 100; this.updatePreview(); };
        addRow('Max height', maxHeightInput);

        // 4. Show Last
        const showLastInput = document.createElement('input');
        showLastInput.type = 'number';
        showLastInput.placeholder = 'All';
        showLastInput.value = arrowObj.show_last || 0;
        showLastInput.oninput = (e) => { arrowObj.show_last = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Show last', showLastInput);
    }

    renderDynamicBoxRow(container, boxSet) {
        const mainRow = this.createBaseRow(boxSet, boxSet.title || 'Boxes', (visible) => {
            boxSet.visible = visible;
            this.updatePreview();
        });
        container.appendChild(mainRow);
    }

    renderPlotRow(container, plot, plotIdx) {
        // Use live data for color discovery
        const actualPlot = this.activeIndicator.plots[plotIdx];
        const colorsToDisplay = this.getColorsToDisplay(actualPlot || plot);
        const isMultiColor = colorsToDisplay.length > 1;

        const mainRow = this.createBaseRow(plot, plot.title || `Plot ${plotIdx + 1}`, (visible) => {
            plot.visible = visible;
            this.updatePreview();
        });

        if (!isMultiColor) {
            const controls = this.createPlotControls(plot, colorsToDisplay[0], true, plotIdx);
            const moreBtn = document.createElement('button');
            moreBtn.className = 'more-settings-btn';
            moreBtn.innerHTML = '&#8942;';
            moreBtn.onclick = (e) => { e.stopPropagation(); this.openAdvancedPlotSettings(moreBtn, plot, plotIdx); };
            controls.appendChild(moreBtn);
            mainRow.appendChild(controls);
            container.appendChild(mainRow);
        } else {
            const plotGroup = document.createElement('div');
            plotGroup.className = 'settings-plot-group';
            plotGroup.appendChild(mainRow);
            colorsToDisplay.forEach((cObj, i) => {
                const subRow = this.createSubRow(cObj.label, this.createPlotControls(plot, cObj, i === 0, plotIdx));
                if (i === 0) {
                    const moreBtn = document.createElement('button');
                    moreBtn.className = 'more-settings-btn';
                    moreBtn.innerHTML = '&#8942;';
                    moreBtn.onclick = (e) => { e.stopPropagation(); this.openAdvancedPlotSettings(moreBtn, plot, plotIdx); };
                    subRow.appendChild(moreBtn);
                }
                plotGroup.appendChild(subRow);
            });
            container.appendChild(plotGroup);
        }
    }

    renderShapeRow(container, plot, plotIdx) {
        const row = this.createBaseRow(plot, plot.title || `Shape ${plotIdx + 1}`, (visible) => {
            plot.visible = visible;
            this.updatePreview();
        });

        const controls = document.createElement('div');
        controls.className = 'settings-plot-right';

        // 1. Standard Color Picker (No Line Preview)
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false,     
            compact: true,
            onChange: (val) => { plot.color = val.rgba; this.updatePreview(); }
        });
        als.setValue({ hexAlpha: plot.color || '#2196F3' });
        this.alsInstances.push(als);
        controls.appendChild(alsContainer);

        // 2. Standard Shape Picker (Outline SVGs)
        const shapeWrapper = document.createElement('div');
        shapeWrapper.className = 'plot-mode-wrapper';
        const shapeTrigger = document.createElement('div');
        shapeTrigger.className = 'plot-mode-trigger';
        
        const shapes = [
            { id: 'arrowdown', title: 'Arrow Down', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 23l-8-8h4V5h8v10h4l-8 8z"/></svg>` },
            { id: 'arrowup', title: 'Arrow Up', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 5l8 8h-4v10h-8V13H6l8-8z"/></svg>` },
            { id: 'circle', title: 'Circle', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="14" cy="14" r="8"/></svg>` },
            { id: 'cross', title: 'Cross', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 5v18M5 14h18"/></svg>` },
            { id: 'diamond', title: 'Diamond', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 4l8 10-8 10-8-10 8-10z"/></svg>` },
            { id: 'flag', title: 'Flag', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 4v20M8 6h12v9H8V6z"/></svg>` },
            { id: 'labeldown', title: 'Label Down', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 18h16V8h-6l-2-3-2 3H6v10z"/></svg>` },
            { id: 'labelup', title: 'Label Up', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 8h16v10h-6l-2 3-2-3H6V8z"/></svg>` },
            { id: 'square', title: 'Square', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="16" height="16"/></svg>` },
            { id: 'triangledown', title: 'Triangle Down', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 22l-8-14h16l-8 14z"/></svg>` },
            { id: 'triangleup', title: 'Triangle Up', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 6l9 15H5l9-15z"/></svg>` },
            { id: 'xcross', title: 'X Cross', svg: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 8l12 12M20 8L8 20"/></svg>` }
        ];

        const currentStyle = (plot.style || 'triangleup').replace('shape.', '');
        const currentShape = shapes.find(s => s.id === currentStyle) || shapes.find(s => s.id === 'triangleup');
        shapeTrigger.innerHTML = currentShape.svg;
        
        const popover = document.createElement('div');
        popover.className = 'plot-mode-popover';
        
        shapes.forEach(s => {
            const item = document.createElement('div');
            item.className = `plot-mode-item ${currentStyle === s.id ? 'active' : ''}`;
            item.innerHTML = `${s.svg} <span>${s.title}</span>`;
            item.onclick = (e) => {
                e.stopPropagation();
                plot.style = s.id;
                shapeTrigger.innerHTML = s.svg;
                popover.classList.remove('active');
                this.updatePreview();
                this.renderStyle(); 
            };
            popover.appendChild(item);
        });

        this.setupPopover(shapeTrigger, popover);
        shapeWrapper.appendChild(shapeTrigger);
        controls.appendChild(shapeWrapper);

        // 3. Location Select
        const locSelect = document.createElement('select');
        locSelect.className = 'settings-select compact';
        locSelect.style.width = '100px';
        const locations = [
            { id: 'abovebar', label: 'Above bar' },
            { id: 'belowbar', label: 'Below bar' },
            { id: 'top', label: 'Top' },
            { id: 'bottom', label: 'Bottom' },
            { id: 'absolute', label: 'Absolute' }
        ];
        locations.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.label;
            locSelect.appendChild(opt);
        });
        locSelect.value = plot.location || 'belowbar';
        locSelect.oninput = (e) => { plot.location = e.target.value; this.updatePreview(); };
        controls.appendChild(locSelect);

        // 4. More Settings Button (Three Dots)
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-settings-btn';
        moreBtn.innerHTML = '&#8942;'; // Vertical ellipsis
        moreBtn.title = 'More Settings';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openAdvancedShapeSettings(moreBtn, plot, plotIdx);
        };
        controls.appendChild(moreBtn);

        row.appendChild(controls);
        container.appendChild(row);
    }

    renderBgColorRow(container, bg, bgIdx) {
        // Use live data for color discovery, but tempStyle for settings
        const actualBg = this.activeIndicator.bgcolors[bgIdx];
        const colorsToDisplay = this.getColorsToDisplay(actualBg);
        const isMultiColor = colorsToDisplay.length > 1;

        const mainRow = this.createBaseRow(bg, bg.title || `Background ${bgIdx + 1}`, (visible) => {
            bg.visible = visible;
            this.updatePreview();
        });

        if (!isMultiColor) {
            const controls = document.createElement('div');
            controls.className = 'settings-plot-right';

            const alsContainer = document.createElement('div');
            alsContainer.className = 'als-control-wrapper';
            const als = new AdvancedLineSetting(alsContainer, {
                showColor: true, 
                showOpacity: true, 
                showThickness: false, 
                showStyle: false,     
                compact: true,
                onChange: (val) => { 
                    bg.color = val.rgba; 
                    this.updatePreview(); 
                }
            });
            als.setValue({ hexAlpha: bg.color || (bg.data ? bg.data[0] : 'rgba(33, 150, 243, 0.3)') });
            this.alsInstances.push(als);
            controls.appendChild(alsContainer);
            mainRow.appendChild(controls);
            container.appendChild(mainRow);
        } else {
            const plotGroup = document.createElement('div');
            plotGroup.className = 'settings-plot-group';
            plotGroup.appendChild(mainRow);

            if (!bg.colorMap) bg.colorMap = {};

            colorsToDisplay.forEach((cObj, i) => {
                const controls = document.createElement('div');
                controls.className = 'settings-plot-right';

                const alsContainer = document.createElement('div');
                alsContainer.className = 'als-control-wrapper';
                const als = new AdvancedLineSetting(alsContainer, {
                    showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
                    onChange: (val) => {
                        bg.colorMap[cObj.color] = val.rgba;
                        cObj.color = val.rgba;
                        this.updatePreview();
                    }
                });
                als.setValue({ hexAlpha: bg.colorMap[cObj.color] || cObj.color });
                this.alsInstances.push(als);
                controls.appendChild(alsContainer);

                const subRow = this.createSubRow(cObj.label || `Color ${i + 1}`, controls);
                plotGroup.appendChild(subRow);
            });
            container.appendChild(plotGroup);

            // Add More Button to the main row of the group
            const moreBtn = document.createElement('button');
            moreBtn.className = 'more-settings-btn';
            moreBtn.innerHTML = '&#8942;';
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                this.openAdvancedBgColorSettings(moreBtn, bg, bgIdx);
            };
            let mainControls = mainRow.querySelector('.settings-plot-right');
            if (!mainControls) {
                mainControls = document.createElement('div');
                mainControls.className = 'settings-plot-right';
                mainRow.appendChild(mainControls);
            }
            mainControls.appendChild(moreBtn);
        }
    }

    openAdvancedBgColorSettings(btn, bg, bgIdx) {
        const popover = this.createPopover(btn);
        
        // Offset
        this.addNumberInput(popover, 'Offset', bg.offset || 0, (val) => {
            bg.offset = val;
            this.updatePreview();
        });

        // Show Last
        this.addNumberInput(popover, 'Show Last', bg.show_last || 0, (val) => {
            bg.show_last = val === 0 ? undefined : val;
            this.updatePreview();
        });
    }

    renderBarColorRow(container, bc, bcIdx) {
        // Use live data for color discovery
        const actualBc = this.activeIndicator.barcolors[bcIdx];
        const colorsToDisplay = this.getColorsToDisplay(actualBc);
        const isMultiColor = colorsToDisplay.length > 1;

        const mainRow = this.createBaseRow(bc, bc.title || `Bar Color ${bcIdx + 1}`, (visible) => {
            bc.visible = visible;
            this.updatePreview();
        });

        if (!isMultiColor) {
            const controls = document.createElement('div');
            controls.className = 'settings-plot-right';

            const alsContainer = document.createElement('div');
            alsContainer.className = 'als-control-wrapper';
            const als = new AdvancedLineSetting(alsContainer, {
                showColor: true, 
                showOpacity: true, 
                showThickness: false, 
                showStyle: false,     
                compact: true,
                onChange: (val) => { 
                    bc.color = val.rgba; 
                    this.updatePreview(); 
                }
            });
            als.setValue({ hexAlpha: bc.color || (bc.data ? bc.data[0] : '#2196f3') });
            this.alsInstances.push(als);
            controls.appendChild(alsContainer);

            // More Button
            const moreBtn = document.createElement('button');
            moreBtn.className = 'more-settings-btn';
            moreBtn.innerHTML = '&#8942;';
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                this.openAdvancedBarColorSettings(moreBtn, bc, bcIdx);
            };
            controls.appendChild(moreBtn);

            mainRow.appendChild(controls);
            container.appendChild(mainRow);
        } else {
            const plotGroup = document.createElement('div');
            plotGroup.className = 'settings-plot-group';
            plotGroup.appendChild(mainRow);

            if (!bc.colorMap) bc.colorMap = {};

            colorsToDisplay.forEach((cObj, i) => {
                const controls = document.createElement('div');
                controls.className = 'settings-plot-right';

                const alsContainer = document.createElement('div');
                alsContainer.className = 'als-control-wrapper';
                const als = new AdvancedLineSetting(alsContainer, {
                    showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
                    onChange: (val) => {
                        bc.colorMap[cObj.color] = val.rgba;
                        cObj.color = val.rgba;
                        this.updatePreview();
                    }
                });
                als.setValue({ hexAlpha: bc.colorMap[cObj.color] || cObj.color });
                this.alsInstances.push(als);
                controls.appendChild(alsContainer);

                const subRow = this.createSubRow(cObj.label || `Color ${i + 1}`, controls);
                plotGroup.appendChild(subRow);
            });
            container.appendChild(plotGroup);

            // Add More Button to the main row of the group
            const moreBtn = document.createElement('button');
            moreBtn.className = 'more-settings-btn';
            moreBtn.innerHTML = '&#8942;';
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                this.openAdvancedBarColorSettings(moreBtn, bc, bcIdx);
            };
            let mainControls = mainRow.querySelector('.settings-plot-right');
            if (!mainControls) {
                mainControls = document.createElement('div');
                mainControls.className = 'settings-plot-right';
                mainRow.appendChild(mainControls);
            }
            mainControls.appendChild(moreBtn);
        }
    }

    renderCandleRow(container, c, cIdx) {
        const actualC = this.activeIndicator.candles[cIdx];
        // Use live body color array for unique color detection
        const bodyColorData = actualC ? actualC.color : c.color;
        const colorsToDisplay = this.getColorsToDisplay({ color: bodyColorData });
        const isMultiColor = colorsToDisplay.length > 1;

        const mainRow = this.createBaseRow(c, c.title || `Candles ${cIdx + 1}`, (visible) => {
            c.visible = visible;
            this.updatePreview();
        });

        // More Settings Button on main row
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-settings-btn';
        moreBtn.innerHTML = '&#8942;';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openAdvancedCandleSettings(moreBtn, c, cIdx);
        };

        const plotGroup = document.createElement('div');
        plotGroup.className = 'settings-plot-group';

        if (!isMultiColor) {
            // Single body color: color picker + more btn on main row
            const controls = document.createElement('div');
            controls.className = 'settings-plot-right';
            const alsContainer = document.createElement('div');
            alsContainer.className = 'als-control-wrapper';
            const bodyColor = colorsToDisplay[0] ? colorsToDisplay[0].color : (c.color || '#2196f3');
            const als = new AdvancedLineSetting(alsContainer, {
                showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
                onChange: (val) => { c.color = val.rgba; this.updatePreview(); }
            });
            als.setValue({ hexAlpha: bodyColor });
            this.alsInstances.push(als);
            controls.appendChild(alsContainer);
            controls.appendChild(moreBtn);
            mainRow.appendChild(controls);
            container.appendChild(mainRow);
        } else {
            // Multi body color: sub-rows per unique color
            if (!c.colorMap) c.colorMap = {};

            const mainControls = document.createElement('div');
            mainControls.className = 'settings-plot-right';
            mainControls.appendChild(moreBtn);
            mainRow.appendChild(mainControls);
            plotGroup.appendChild(mainRow);

            colorsToDisplay.forEach((cObj, i) => {
                const originalColor = cObj.color; // capture before any mutation
                const controls = document.createElement('div');
                controls.className = 'settings-plot-right';
                const alsContainer = document.createElement('div');
                alsContainer.className = 'als-control-wrapper';
                const als = new AdvancedLineSetting(alsContainer, {
                    showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
                    onChange: (val) => {
                        c.colorMap[originalColor] = val.rgba;
                        // Do NOT mutate cObj.color — key must stay as originalColor
                        this.updatePreview();
                    }
                });
                als.setValue({ hexAlpha: c.colorMap[originalColor] || originalColor });
                this.alsInstances.push(als);
                controls.appendChild(alsContainer);
                plotGroup.appendChild(this.createSubRow(cObj.label || `Color ${i + 1}`, controls));
            });
            container.appendChild(plotGroup);
        }
    }

    openAdvancedBarColorSettings(btn, bc, bcIdx) {
        const popover = this.createPopover(btn);
        
        // Offset
        this.addNumberInput(popover, 'Offset', bc.offset || 0, (val) => {
            bc.offset = val;
            this.updatePreview();
        });

        // Show Last
        this.addNumberInput(popover, 'Show Last', bc.show_last || 0, (val) => {
            bc.show_last = val === 0 ? undefined : val;
            this.updatePreview();
        });
    }

    openAdvancedCandleSettings(btn, c, cIdx) {
        const actualC = this.activeIndicator.candles[cIdx];
        const isBar = actualC && actualC.drawType === 'bar';
        const popover = this.createPopover(btn);

        if (isBar) {
            this.addNumberInput(popover, 'Show Last', c.show_last || 0, (val) => {
                c.show_last = val === 0 ? undefined : val;
                this.updatePreview();
            });
            return;
        }

        const resolveColor = (col, def) => Array.isArray(col) ? (col.find(v => v !== null) || def) : (col || def);

        // Section header helper
        const addSection = (title) => {
            const h = document.createElement('div');
            h.className = 'settings-group-title';
            h.style.padding = '6px 0 2px 0';
            h.textContent = title;
            popover.appendChild(h);
        };

        // Helper: show color rows in popover.
        // For single color: one picker that sets c[scalarKey].
        // For multi color: sub-pickers that ONLY update colorMap[mapKey], never scalar.
        const addColorRows = (label, liveColorData, scalarColor, scalarKey, mapKey) => {
            const colorsToDisplay = this.getColorsToDisplay({ color: liveColorData });
            const isMulti = colorsToDisplay.length > 1;

            if (!isMulti) {
                this.addColorInputToPopover(popover, label, resolveColor(scalarColor, '#2196f3'), (v) => {
                    c[scalarKey] = v;
                    this.updatePreview();
                });
            } else {
                if (!c[mapKey]) c[mapKey] = {};
                const colorMap = c[mapKey];
                colorsToDisplay.forEach((cObj, i) => {
                    const originalColor = cObj.color;
                    this.addColorInputToPopover(
                        popover,
                        `${label} ${i + 1}`,
                        colorMap[originalColor] || originalColor,
                        (val) => {
                            colorMap[originalColor] = val;
                            // Do NOT set scalar — only remap per original color
                            this.updatePreview();
                        }
                    );
                });
            }
        };

        // Wick Color
        addSection('Wick');
        addColorRows('Wick',
            (actualC && Array.isArray(actualC.wickcolor)) ? actualC.wickcolor : (actualC ? actualC.color : c.color),
            c.wickcolor || c.color,
            'wickcolor', 'wickMap'
        );

        // Border Color
        addSection('Border');
        addColorRows('Border',
            (actualC && Array.isArray(actualC.bordercolor)) ? actualC.bordercolor : (actualC ? actualC.color : c.color),
            c.bordercolor || c.color,
            'bordercolor', 'borderMap'
        );

        // Show Last
        addSection('Other');
        this.addNumberInput(popover, 'Show Last', c.show_last || 0, (val) => {
            c.show_last = val === 0 ? undefined : val;
            this.updatePreview();
        });
    }

    renderFillRow(container, fill, fillIdx) {
        const mainRow = this.createBaseRow(fill, fill.title || `Fill ${fillIdx + 1}`, (visible) => {
            fill.visible = visible;
            this.updatePreview();
        });

        const controls = document.createElement('div');
        controls.className = 'settings-plot-right';

        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false,     
            compact: true,
            onChange: (val) => { 
                fill.color = val.rgba; 
                this.updatePreview(); 
            }
        });
        als.setValue({ hexAlpha: fill.color || 'rgba(33, 150, 243, 0.2)' });
        this.alsInstances.push(als);
        controls.appendChild(alsContainer);

        // More Settings Button
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-settings-btn';
        moreBtn.innerHTML = '&#8942;';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openAdvancedFillSettings(moreBtn, fill, fillIdx);
        };
        controls.appendChild(moreBtn);

        mainRow.appendChild(controls);
        container.appendChild(mainRow);
    }

    openAdvancedFillSettings(btn, fill, fillIdx) {
        const popover = this.createPopover(btn);
        
        // Show Last
        this.addNumberInput(popover, 'Show Last', fill.show_last || 0, (val) => {
            fill.show_last = val === 0 ? undefined : val;
            this.updatePreview();
        });

        // Fill Gaps Checkbox in Popover
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.style.justifyContent = 'flex-start';
        row.style.gap = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = fill.fillgaps === true;
        checkbox.onchange = (e) => {
            fill.fillgaps = e.target.checked;
            this.updatePreview();
        };
        row.appendChild(checkbox);

        const label = document.createElement('label');
        label.className = 'settings-checkbox-label';
        label.textContent = 'Fill Gaps';
        row.appendChild(label);

        popover.appendChild(row);
    }

    createPopover(btn) {
        // Remove any existing popovers
        const existing = document.querySelector('.advanced-settings-popover');
        const existingBackdrop = document.querySelector('.popover-backdrop');
        if (existing) existing.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'popover-backdrop';
        backdrop.onclick = () => {
            popover.remove();
            backdrop.remove();
        };
        document.body.appendChild(backdrop);

        const popover = document.createElement('div');
        popover.className = 'advanced-settings-popover';
        
        const rect = btn.getBoundingClientRect();
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.left = `${rect.right - 260}px`; // Align right edge (popover width is 260px)
        
        document.body.appendChild(popover);
        return popover;
    }

    addNumberInput(container, label, value, onChange) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `<label>${label}</label>`;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        input.oninput = (e) => onChange(parseInt(e.target.value));
        row.appendChild(input);
        container.appendChild(row);
    }

    addColorInput(container, label, value, onChange) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `<label>${label}</label>`;
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
            onChange: (val) => onChange(val.rgba)
        });
        als.setValue({ hexAlpha: value || '#2196f3' });
        this.alsInstances.push(als);
        row.appendChild(alsContainer);
        container.appendChild(row);
    }

    openAdvancedShapeSettings(btn, shape) {
        // Remove any existing popovers
        const existing = document.querySelector('.advanced-settings-popover');
        const existingBackdrop = document.querySelector('.popover-backdrop');
        if (existing) existing.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'popover-backdrop';
        backdrop.onclick = () => {
            popover.remove();
            backdrop.remove();
        };
        document.body.appendChild(backdrop);

        const popover = document.createElement('div');
        popover.className = 'advanced-settings-popover';
        
        const rect = btn.getBoundingClientRect();
        // Position relative to button but within screen bounds
        popover.style.top = `${rect.bottom + 8}px`;
        popover.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;

        const addRow = (label, content) => {
            const sRow = document.createElement('div');
            sRow.className = 'settings-row';
            const sLabel = document.createElement('label');
            sLabel.textContent = label;
            sRow.appendChild(sLabel);
            sRow.appendChild(content);
            popover.appendChild(sRow);
        };

        // 1. Size
        const sizeSelect = document.createElement('select');
        ['tiny', 'small', 'normal', 'large', 'huge'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            sizeSelect.appendChild(opt);
        });
        sizeSelect.value = shape.size || 'tiny';
        sizeSelect.oninput = (e) => { shape.size = e.target.value; this.updatePreview(); };
        addRow('Size', sizeSelect);

        // 2. Offset
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.value = shape.offset || 0;
        offsetInput.oninput = (e) => { shape.offset = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Offset', offsetInput);

        // 3. Text
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'None';
        textInput.value = shape.text || '';
        textInput.oninput = (e) => { shape.text = e.target.value; this.updatePreview(); };
        addRow('Text', textInput);

        // 4. Text Color
        const textColRow = document.createElement('div');
        textColRow.className = 'als-control-wrapper';
        const textColAls = new AdvancedLineSetting(textColRow, {
            showColor: true, 
            showOpacity: true, 
            showThickness: false, 
            showStyle: false, 
            compact: true,
            onChange: (val) => { shape.textcolor = val.rgba; this.updatePreview(); }
        });
        const resolveColor = (col, defaultCol) => Array.isArray(col) ? (col.find(v => v !== null) || defaultCol) : (col || defaultCol);
        textColAls.setValue({ hexAlpha: resolveColor(shape.textcolor, '#ffffff') });
        this.alsInstances.push(textColAls); // Track for cleanup
        addRow('Text color', textColRow);

        // 5. Show Last
        const showLastInput = document.createElement('input');
        showLastInput.type = 'number';
        showLastInput.placeholder = 'All';
        showLastInput.value = shape.show_last || 0;
        showLastInput.oninput = (e) => { shape.show_last = parseInt(e.target.value) || 0; this.updatePreview(); };
        addRow('Show last', showLastInput);

        document.body.appendChild(popover);
    }

    openAdvancedPlotSettings(btn, plot, plotIdx) {
        const popover = this.createPopover(btn);

        const updateStyle = (key, val) => {
            plot[key] = val;
            if (!this.tempStyle.plots) this.tempStyle.plots = {};
            if (!this.tempStyle.plots[plotIdx]) this.tempStyle.plots[plotIdx] = {};
            this.tempStyle.plots[plotIdx][key] = val;
            this.updatePreview();
        };

        // 1. Offset
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.value = plot.offset || 0;
        offsetInput.oninput = (e) => updateStyle('offset', parseInt(e.target.value) || 0);
        this.addRowToPopover(popover, 'Offset', offsetInput);

        // 2. Show Last
        const showLastInput = document.createElement('input');
        showLastInput.type = 'number';
        showLastInput.min = '0';
        showLastInput.value = plot.show_last || 0;
        showLastInput.oninput = (e) => updateStyle('show_last', parseInt(e.target.value) || 0);
        this.addRowToPopover(popover, 'Show Last', showLastInput);

        // 3. Baseline (Histbase) - Only for Area, Columns, or Histogram
        const currentStyle = Array.isArray(plot.style) ? plot.style[0] : (plot.style || 'solid');
        const needsBaseline = ['area', 'columns', 'column', 'histogram'].includes(currentStyle);
        if (needsBaseline) {
            const histbaseInput = document.createElement('input');
            histbaseInput.type = 'number';
            histbaseInput.step = 'any';
            histbaseInput.value = plot.histbase !== undefined ? plot.histbase : 0;
            histbaseInput.oninput = (e) => updateStyle('histbase', parseFloat(e.target.value) || 0);
            this.addRowToPopover(popover, 'Histbase', histbaseInput);
        }
    }

    addRowToPopover(popover, label, content) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `<label>${label}</label>`;
        row.appendChild(content);
        popover.appendChild(row);
    }

    addColorInputToPopover(popover, label, value, onChange) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `<label>${label}</label>`;
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false, compact: true,
            onChange: (val) => onChange(val.rgba)
        });
        const resolveColor = (col, defaultCol) => Array.isArray(col) ? (col.find(v => v !== null) || defaultCol) : (col || defaultCol);
        als.setValue({ hexAlpha: resolveColor(value, '#2196f3') });
        this.alsInstances.push(als);
        row.appendChild(alsContainer);
        popover.appendChild(row);
    }


    renderHLineRow(container, hline, hlineIdx) {
        const colorsToDisplay = this.getColorsToDisplay(hline);
        
        const mainRow = this.createBaseRow(hline, hline.title || `Level ${hlineIdx + 1}`, (visible) => {
            hline.visible = visible;
            this.updatePreview();
        });

        mainRow.appendChild(this.createHLineControls(hline, colorsToDisplay[0], true, hlineIdx));
        container.appendChild(mainRow); // Append directly to avoid group border
    }

    getColorsToDisplay(item) {
        const colors = [];
        const colorData = item.color || (item.id && (item.id.startsWith('bgcolor_') || item.id.startsWith('barcolor_')) ? item.data : null);

        if (Array.isArray(colorData)) {
            const uniqueColors = [...new Set(colorData.filter(c => c !== null && c !== 'na' && c !== 'none'))].slice(0, 6);
            uniqueColors.forEach((c, i) => colors.push({ color: c, label: `Color ${i + 1}`, index: i }));
        } else {
            colors.push({ color: item.color || (Array.isArray(item.data) ? item.data[0] : '#2196F3'), label: '', index: -1 });
        }
        return colors;
    }

    createBaseRow(item, titleText, onToggle) {
        const row = document.createElement('div');
        row.className = 'settings-plot-row';
        const leftSide = document.createElement('div');
        leftSide.className = 'settings-plot-left';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'settings-checkbox';
        checkbox.checked = item.visible !== false;
        checkbox.onchange = (e) => onToggle(e.target.checked);
        const title = document.createElement('span');
        title.className = 'settings-plot-title';
        title.textContent = titleText;
        leftSide.appendChild(checkbox);
        leftSide.appendChild(title);
        row.appendChild(leftSide);
        return row;
    }

    createSubRow(label, controls) {
        const subRow = document.createElement('div');
        subRow.className = 'settings-plot-sub-row';
        const subLeft = document.createElement('div');
        subLeft.className = 'settings-plot-left';
        const subLabel = document.createElement('span');
        subLabel.className = 'settings-sub-label';
        subLabel.textContent = label;
        subLeft.appendChild(subLabel);
        subRow.appendChild(subLeft);
        subRow.appendChild(controls);
        return subRow;
    }

    createPlotControls(plot, cObj, showExtraSelectors = true, plotIdx) {
        const rightSide = document.createElement('div');
        rightSide.className = 'settings-plot-right';
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        rightSide.appendChild(alsContainer);

        const actualStyle = Array.isArray(plot.style) ? plot.style[0] : plot.style;
        const isLineType = (actualStyle === 'solid' || actualStyle === 'dashed' || actualStyle === 'dotted' || actualStyle === 'step' || !actualStyle);

        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, showOpacity: true, showThickness: isLineType, showStyle: isLineType, compact: true,
            onChange: (val) => { 
                this.updatePlotStyle(plot, cObj, val, isLineType); 
                this.updatePreview(); 
            }
        });
        this.initALS(als, plot, cObj);

        if (showExtraSelectors) {
            const modeWrapper = document.createElement('div');
            modeWrapper.className = 'plot-mode-wrapper';
            const modeTrigger = document.createElement('div');
            modeTrigger.className = 'plot-mode-trigger';
            const currentStyle = Array.isArray(plot.style) ? plot.style[0] : (plot.style || 'solid');
            const baseMode = ['dashed', 'dotted'].includes(currentStyle) ? 'solid' : currentStyle;
            
            const modeIcons = {
                solid: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M4 14.5h20"/></svg>`,
                step: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M4 19h6V9h8v10h6"/></svg>`,
                histogram: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M6 21v-6M11 21V7M16 21v-10M21 21v-4"/></svg>`,
                columns: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M6 21v-8M12 21V5M18 21v-11M24 21v-5"/></svg>`,
                area: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M4 16c3-2 6-2 9 0s6 4 11 0v6H4z" fill="currentColor" fill-opacity="0.2"/></svg>`,
                circles: `<svg viewBox="0 0 28 28" stroke-width="3"><circle cx="6" cy="18" r="1"/><circle cx="13" cy="10" r="1"/><circle cx="21" cy="15" r="1"/></svg>`,
                cross: `<svg viewBox="0 0 28 28" stroke-width="2.2"><path d="M5 18h2M6 17v2M12 10h2M13 9v2M20 15h2M21 14v2"/></svg>`
            };
            modeTrigger.innerHTML = modeIcons[baseMode] || modeIcons.solid;
            
            const popover = document.createElement('div');
            popover.className = 'plot-mode-popover';
            const header = document.createElement('div');
            header.className = 'plot-mode-header';
            const isPriceLineActive = (this.tempStyle.plots && this.tempStyle.plots[plotIdx]) ? this.tempStyle.plots[plotIdx].showPriceLine : !!plot.showPriceLine;
            header.innerHTML = `<span>Price line</span><label class="settings-switch"><input type="checkbox" ${isPriceLineActive ? 'checked' : ''}><span class="settings-slider"></span></label>`;
            header.querySelector('input').onchange = (e) => {
                plot.showPriceLine = e.target.checked;
                if (!this.tempStyle.plots[plotIdx]) this.tempStyle.plots[plotIdx] = {};
                this.tempStyle.plots[plotIdx].showPriceLine = e.target.checked;
                this.updatePreview();
            };
            popover.appendChild(header);

            ['solid','step','histogram','columns','area','circles','cross'].forEach(m => {
                const item = document.createElement('div');
                item.className = `plot-mode-item ${baseMode === m ? 'active' : ''}`;
                item.innerHTML = `${modeIcons[m]} <span>${m.charAt(0).toUpperCase() + m.slice(1)}</span>`;
                item.onclick = (e) => { 
                    e.stopPropagation(); 
                    plot.style = m; 
                    popover.classList.remove('active');
                    this.renderStyle(); 
                    this.updatePreview(); 
                };
                popover.appendChild(item);
            });

            this.setupPopover(modeTrigger, popover);
            modeWrapper.appendChild(modeTrigger);
            rightSide.appendChild(modeWrapper);
        }
        return rightSide;
    }

    createHLineControls(hline, cObj, showExtraSelectors = true, hlineIdx) {
        const rightSide = document.createElement('div');
        rightSide.className = 'settings-plot-right';
        const alsContainer = document.createElement('div');
        alsContainer.className = 'als-control-wrapper';
        rightSide.appendChild(alsContainer);

        const als = new AdvancedLineSetting(alsContainer, {
            showColor: true, showOpacity: true, showThickness: true, showStyle: true, compact: true,
            onChange: (val) => { hline.color = val.rgba; hline.width = val.thickness; hline.style = val.style; this.updatePreview(); }
        });
        als.setValue({ hexAlpha: hline.color, thickness: hline.width || 1, style: hline.style || 'dashed' });
        this.alsInstances.push(als);

        if (showExtraSelectors) {
            const priceInput = document.createElement('input');
            priceInput.type = 'number'; priceInput.className = 'settings-input';
            priceInput.value = hline.price || 0;
            priceInput.oninput = (e) => {
                hline.price = parseFloat(e.target.value) || 0;
                if (hline.data) hline.data.fill(hline.price);
                this.updatePreview();
            };
            rightSide.appendChild(priceInput);
        }
        return rightSide;
    }

    updatePlotStyle(plot, cObj, val, isLineType) {
        if (cObj.index === -1) {
            plot.color = val.rgba;
            if (isLineType) {
                plot.width = val.thickness; plot.lineStyle = val.style;
                if (!['step','area','columns','histogram','circles','cross'].includes(plot.style)) plot.style = val.style;
            }
        } else {
            if (Array.isArray(plot.color)) plot.color = plot.color.map(c => c === cObj.color ? val.rgba : c);
            else plot.color = val.rgba;
            cObj.color = val.rgba;
            if (isLineType) this.updateMultiColorStyle(plot, val);
        }
    }

    updateMultiColorStyle(plot, val) {
        if (Array.isArray(plot.color)) {
            if (!Array.isArray(plot.width)) plot.width = new Array(plot.color.length).fill(plot.width || 2);
            if (!Array.isArray(plot.style)) plot.style = new Array(plot.color.length).fill(plot.style || 'solid');
            if (!Array.isArray(plot.lineStyle)) plot.lineStyle = new Array(plot.color.length).fill(plot.lineStyle || 'solid');
            plot.color.forEach((c, idx) => {
                if (c === val.rgba) {
                    plot.width[idx] = val.thickness; plot.lineStyle[idx] = val.style;
                    const s = Array.isArray(plot.style) ? plot.style[idx] : plot.style;
                    if (!['step','area','columns','histogram','circles','cross'].includes(s)) {
                        if (Array.isArray(plot.style)) plot.style[idx] = val.style; else plot.style = val.style;
                    }
                }
            });
        } else {
            plot.width = val.thickness; plot.lineStyle = val.style;
            if (!['step','area','columns','histogram','circles','cross'].includes(plot.style)) plot.style = val.style;
        }
    }

    initALS(als, plot, cObj) {
        const ls = Array.isArray(plot.lineStyle) ? (plot.lineStyle[plot.color.indexOf(cObj.color)] || 'solid') : (plot.lineStyle || 'solid');
        const bs = Array.isArray(plot.style) ? (plot.style[plot.color.indexOf(cObj.color)] || 'solid') : (plot.style || 'solid');
        const eff = (ls === 'dashed' || ls === 'dotted') ? ls : ((bs === 'dashed' || bs === 'dotted') ? bs : 'solid');
        als.setValue({ hexAlpha: cObj.color, thickness: plot.width || 2, style: eff });
        this.alsInstances.push(als);
    }

    setupPopover(trigger, popover) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.plot-mode-popover').forEach(p => { if (p !== popover) p.classList.remove('active'); });
            if (!popover.classList.contains('active')) {
                document.body.appendChild(popover);
                const rect = trigger.getBoundingClientRect();
                popover.style.position = 'fixed'; popover.style.top = `${rect.top - 6}px`; popover.style.left = `${rect.right + 10}px`;
                popover.classList.add('active');
                const close = (event) => {
                    if (!popover.contains(event.target) && event.target !== trigger) {
                        popover.classList.remove('active');
                        window.removeEventListener('mousedown', close); window.removeEventListener('wheel', close);
                    }
                };
                window.addEventListener('mousedown', close); window.addEventListener('wheel', close);
            } else popover.classList.remove('active');
        };
    }

    renderVisibility() {
        const visRows = this.dialog.querySelectorAll('#indicator-settings-visibility .visibility-row[data-category]');
        const currentVis = this.tempVisibility || { seconds:{enabled:true,min:1,max:59}, minutes:{enabled:true,min:1,max:59}, hours:{enabled:true,min:1,max:24}, days:{enabled:true,min:1,max:366}, weeks:{enabled:true,min:1,max:52}, months:{enabled:true,min:1,max:12} };
        visRows.forEach(row => {
            const cat = row.dataset.category;
            const settings = currentVis[cat] || { enabled: true, min: 1, max: 100 };
            const cb = row.querySelector('input[type="checkbox"]');
            const inputs = row.querySelectorAll('.visibility-input-small');
            const slider = row.querySelector('.visibility-slider');
            if (cb) cb.checked = settings.enabled !== false;
            if (inputs.length === 2 && slider) {
                inputs[0].value = settings.min || 1;
                inputs[1].value = settings.max || 100;
                slider.value = inputs[0].value;
                const update = () => { this.tempVisibility[cat] = { enabled: cb.checked, min: parseInt(inputs[0].value), max: parseInt(inputs[1].value) }; this.updatePreview(); };
                cb.onchange = update;
                inputs[0].oninput = (e) => { slider.value = e.target.value; update(); };
                inputs[1].oninput = update;
                slider.oninput = (e) => { inputs[0].value = e.target.value; update(); };
            }
        });
    }
}
