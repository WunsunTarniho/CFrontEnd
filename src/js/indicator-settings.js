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

        // Backups for revert logic
        this.backupInputs = {};
        this.backupStyle = {};
        this.backupVisibility = {};
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

        this.tempInputs = JSON.parse(JSON.stringify(this.backupInputs));
        this.tempStyle = JSON.parse(JSON.stringify(this.backupStyle));
        this.tempVisibility = JSON.parse(JSON.stringify(this.backupVisibility));

        // Ensure HLines are in tempStyle for editing
        if (indicator.hlines && !this.tempStyle.hlines) {
            this.tempStyle.hlines = JSON.parse(JSON.stringify(indicator.hlines));
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

            // Restore HLines backup if it exists
            if (this.backupStyle.hlines) {
                this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.backupStyle.hlines));
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

        if (this.tempStyle.hlines) {
            this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.tempStyle.hlines));
        }

        this.chart.indicatorsDirty = true;
        this.chart.calculateIndicators();
        this.chart.render();
    }

    apply() {
        if (!this.activeIndicator) return;

        // Save history
        this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.backupInputs));
        this.activeIndicator.style = JSON.parse(JSON.stringify(this.backupStyle));
        this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.backupVisibility));
        this.chart.saveHistory();

        // Re-apply confirmed changes
        this.activeIndicator.inputs = JSON.parse(JSON.stringify(this.tempInputs));
        this.activeIndicator.style = JSON.parse(JSON.stringify(this.tempStyle));
        this.activeIndicator.visibility = JSON.parse(JSON.stringify(this.tempVisibility));

        if (this.tempStyle.hlines) {
            this.activeIndicator.hlines = JSON.parse(JSON.stringify(this.tempStyle.hlines));
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
        if (!metadata || Object.keys(metadata).length === 0) {
            container.innerHTML = '<div class="settings-empty">No inputs available.</div>';
            return;
        }

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

        if ((!this.tempStyle.plots || this.tempStyle.plots.length === 0) && this.activeIndicator.plots) {
            this.tempStyle.plots = this.activeIndicator.plots.map(p => ({
                color: p.color || '#2196F3',
                width: p.width || 2,
                style: p.style || 'solid',
                visible: p.visible !== false,
                title: p.title,
                showPriceLine: !!p.showPriceLine
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

        // 1. Regular Plots
        if (this.tempStyle.plots && this.tempStyle.plots.length > 0) {
            this.tempStyle.plots.forEach((plot, plotIdx) => {
                this.renderPlotRow(container, plot, plotIdx);
            });
        }

        // 2. Horizontal Lines (HLines)
        if (this.tempStyle.hlines && this.tempStyle.hlines.length > 0) {
            this.tempStyle.hlines.forEach((hline, plotIdx) => {
                this.renderHLineRow(container, hline, plotIdx);
            });
        }

        if (container.innerHTML === '') {
            container.innerHTML = '<div class="settings-empty">No style options available.</div>';
        }
    }

    renderPlotRow(container, plot, plotIdx) {
        const plotGroup = document.createElement('div');
        plotGroup.className = 'settings-plot-group';

        const colorsToDisplay = this.getColorsToDisplay(plot);
        const isMultiColor = colorsToDisplay.length > 1;

        const mainRow = this.createBaseRow(plot, plot.title || `Plot ${plotIdx + 1}`, (visible) => {
            plot.visible = visible;
            this.updatePreview();
        });

        if (!isMultiColor) {
            mainRow.appendChild(this.createPlotControls(plot, colorsToDisplay[0], true, plotIdx));
            plotGroup.appendChild(mainRow);
        } else {
            plotGroup.appendChild(mainRow);
            colorsToDisplay.forEach((cObj, i) => {
                plotGroup.appendChild(this.createSubRow(cObj.label, this.createPlotControls(plot, cObj, i === 0, plotIdx)));
            });
        }
        container.appendChild(plotGroup);
    }

    renderHLineRow(container, hline, hlineIdx) {
        const plotGroup = document.createElement('div');
        plotGroup.className = 'settings-plot-group';
        const colorsToDisplay = this.getColorsToDisplay(hline);
        
        const mainRow = this.createBaseRow(hline, hline.title || `Level ${hlineIdx + 1}`, (visible) => {
            hline.visible = visible;
            this.updatePreview();
        });

        mainRow.appendChild(this.createHLineControls(hline, colorsToDisplay[0], true, hlineIdx));
        plotGroup.appendChild(mainRow);
        container.appendChild(plotGroup);
    }

    getColorsToDisplay(plot) {
        const colors = [];
        if (Array.isArray(plot.color)) {
            const uniqueColors = [...new Set(plot.color.filter(c => c !== null))].slice(0, 4);
            uniqueColors.forEach((c, i) => colors.push({ color: c, label: `Color ${i}`, index: i }));
        } else {
            colors.push({ color: plot.color || '#2196F3', label: '', index: -1 });
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
            onChange: (val) => { this.updatePlotStyle(plot, cObj, val, isLineType); this.updatePreview(); }
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
