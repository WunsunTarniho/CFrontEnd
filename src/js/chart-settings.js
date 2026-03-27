import { AdvancedLineSetting } from './components/AdvancedLineSetting.js';

export class ChartSettingsController {
    constructor(chart) {
        this.chart = chart;
        this.backdrop = document.getElementById('chart-settings-backdrop');
        this.dialog = document.getElementById('chart-settings-dialog');
        this.activeTab = 'symbol';
        this.advancedComponents = {};
        this.init();
    }

    init() {
        if (!this.backdrop || !this.dialog) return;

        // Close handlers
        const closeBtn = this.dialog.querySelector('.chart-settings-close');
        if (closeBtn) closeBtn.onclick = () => this.hide();

        const cancelBtn = document.getElementById('chart-settings-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.hide();

        const okBtn = document.getElementById('chart-settings-ok');
        if (okBtn) okBtn.onclick = () => {
            this.applySettings();
            this.hide();
        };

        this.backdrop.onclick = (e) => {
            if (e.target === this.backdrop) this.hide();
        };

        // Tab switching
        const tabs = this.dialog.querySelectorAll('.chart-settings-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                this.switchTab(tab.dataset.tab);
            };
        });

        // Initialize with default tab
        this.switchTab(this.activeTab);

        this.setupLivePreview();
    }

    setupLivePreview() {
        const h = (id, prop, isCheckbox = false, isNumeric = false, callback = null) => {
            const el = document.getElementById(id);
            if (!el) return;
            const event = isCheckbox ? 'change' : 'input';
            el.addEventListener(event, (e) => {
                let val = isCheckbox ? e.target.checked : e.target.value;
                if (isNumeric) val = parseFloat(val);

                // Update active property
                this.chart[prop] = val;

                // Update per-mode config if applicable
                const mode = this.chart.chartMode;
                if (this.chart.modeConfigs && this.chart.modeConfigs[mode] &&
                    this.chart.modeConfigs[mode].hasOwnProperty(prop)) {
                    this.chart.modeConfigs[mode][prop] = val;
                }

                if (callback) callback(val);
                this.chart.isLayoutDirty = true;
                this.chart.render(true);
            });
        };

        const hAdvanced = (id, options, propMap) => {
            const container = document.getElementById(id);
            if (!container) return;
            const comp = new AdvancedLineSetting(id, {
                ...options,
                onChange: (val) => {
                    Object.keys(propMap).forEach(key => {
                        const chartProp = propMap[key];
                        const newVal = val[key];
                        if (newVal !== undefined) {
                            this.chart[chartProp] = newVal;

                            const mode = this.chart.chartMode;
                            if (this.chart.modeConfigs && this.chart.modeConfigs[mode] &&
                                this.chart.modeConfigs[mode].hasOwnProperty(chartProp)) {
                                this.chart.modeConfigs[mode][chartProp] = newVal;
                            }
                        }
                    });
                    this.chart.isLayoutDirty = true;
                    this.chart.render(true);
                }
            });
            this.advancedComponents[id] = comp;
            return comp;
        };

        // Canvas
        hAdvanced('setting-bg-advanced', {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false
        }, { hexAlpha: 'backgroundColor' });

        hAdvanced('setting-bg-advanced-2', {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false
        }, { hexAlpha: 'backgroundColor2' });

        const bgTypeEl = document.getElementById('setting-bg-type');
        if (bgTypeEl) {
            bgTypeEl.addEventListener('change', () => {
                const color2 = document.getElementById('setting-bg-advanced-2');
                if (color2) color2.style.display = bgTypeEl.value === 'gradient' ? 'block' : 'none';
                this.chart.backgroundType = bgTypeEl.value;
                this.chart.isLayoutDirty = true;
                this.chart.render(true);
            });
        }

        hAdvanced('setting-vert-grid-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: true
        }, { hexAlpha: 'vertGridColor', thickness: 'vertGridWidth', style: 'vertGridStyle' });

        hAdvanced('setting-horz-grid-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: true
        }, { hexAlpha: 'horzGridColor', thickness: 'horzGridWidth', style: 'horzGridStyle' });

        h('setting-show-watermark', 'showWatermark', true);

        // Candles
        h('setting-candle-color-prev-close', 'colorBarsBasedOnPrevClose', true);
        h('setting-candle-body', 'showCandleBody', true);

        const hSmall = (id, propMap) => hAdvanced(id, {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false
        }, typeof propMap === 'string' ? { hexAlpha: propMap } : propMap);

        hSmall('setting-candle-body-up-advanced', 'candleBodyUpColor');
        hSmall('setting-candle-body-down-advanced', 'candleBodyDownColor');

        h('setting-candle-borders', 'showCandleBorders', true);
        hSmall('setting-candle-borders-up-advanced', 'candleBorderUpColor');
        hSmall('setting-candle-borders-down-advanced', 'candleBorderDownColor');

        h('setting-candle-wick', 'showCandleWick', true);
        hSmall('setting-candle-wick-up-advanced', 'candleWickUpColor');
        hSmall('setting-candle-wick-down-advanced', 'candleWickDownColor');

        // Bars
        h('setting-bar-color-prev-close', 'colorBarsBasedOnPrevClose', true);
        h('setting-bar-hlc', 'showHLCBars', true);
        h('setting-bar-thin', 'showThinBars', true);
        hSmall('setting-bar-up-advanced', 'barUpColor');
        hSmall('setting-bar-down-advanced', 'barDownColor');

        // Line
        h('setting-line-source', 'lineChartSource');
        const hLineWidth = (idTrigger, idDropdown, idPreview, prop) => {
            const trigger = document.getElementById(idTrigger);
            const dropdown = document.getElementById(idDropdown);
            const preview = document.getElementById(idPreview);
            if (!trigger || !dropdown || !preview) return;

            trigger.onclick = (e) => {
                e.stopPropagation();
                const isShowing = dropdown.classList.contains('show');
                // Close all other custom dropdowns first if any
                document.querySelectorAll('.custom-width-dropdown').forEach(d => d.classList.remove('show'));
                if (!isShowing) dropdown.classList.add('show');
            };

            dropdown.querySelectorAll('.custom-width-option').forEach(option => {
                option.onclick = (e) => {
                    e.stopPropagation();
                    const val = parseInt(option.dataset.value);
                    this.chart[prop] = val;
                    const mode = this.chart.chartMode;
                    if (this.chart.modeConfigs && this.chart.modeConfigs[mode] &&
                        this.chart.modeConfigs[mode].hasOwnProperty(prop)) {
                        this.chart.modeConfigs[mode][prop] = val;
                    }

                    // Update preview and active state
                    preview.style.height = `${val}px`;
                    dropdown.querySelectorAll('.custom-width-option').forEach(opt => {
                        opt.classList.toggle('active', opt === option);
                    });

                    dropdown.classList.remove('show');
                    this.chart.isLayoutDirty = true;
                    this.chart.render(true);
                };
            });

            // Global click to close
            document.addEventListener('click', () => dropdown.classList.remove('show'));
        };
        hLineWidth('setting-line-width-trigger', 'setting-line-width-dropdown', 'setting-line-width-preview', 'lineChartWidth');

        hSmall('setting-line-advanced', 'lineChartColor');
        hSmall('setting-line-advanced-2', 'lineChartColor2');

        // Area
        h('setting-area-source', 'areaSource');

        hAdvanced('setting-area-line-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: true
        }, { hexAlpha: 'areaLineColor', thickness: 'areaLineWidth', style: 'areaLineStyle' });

        hSmall('setting-area-fill-advanced-1', 'areaFillColor1');
        hSmall('setting-area-fill-advanced-2', 'areaFillColor2');

        // HLC Area
        h('setting-hlc-high-show', 'showHlcHighLine', true);
        h('setting-hlc-low-show', 'showHlcLowLine', true);

        hAdvanced('setting-hlc-high-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: false
        }, { hexAlpha: 'hlcHighLineColor', thickness: 'hlcHighLineWidth' });

        hAdvanced('setting-hlc-low-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: false
        }, { hexAlpha: 'hlcLowLineColor', thickness: 'hlcLowLineWidth' });

        hAdvanced('setting-hlc-close-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: false
        }, { hexAlpha: 'hlcCloseLineColor', thickness: 'hlcCloseLineWidth' });

        hSmall('setting-hlc-fill-up-advanced', 'hlcFillUpColor');
        hSmall('setting-hlc-fill-down-advanced', 'hlcFillDownColor');

        // Baseline
        h('setting-baseline-source', 'baselineSource');
        h('setting-baseline-level', 'baselineLevel', false, (val) => parseFloat(val));

        hAdvanced('setting-baseline-top-line-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: false
        }, { hexAlpha: 'baselineTopLineColor', thickness: 'baselineTopLineWidth' });

        hAdvanced('setting-baseline-bottom-line-advanced', {
            showColor: true, showOpacity: true, showThickness: true, showStyle: false
        }, { hexAlpha: 'baselineBottomLineColor', thickness: 'baselineBottomLineWidth' });

        hSmall('setting-baseline-fill-top-1-advanced', 'baselineFillTopColor1');
        hSmall('setting-baseline-fill-top-2-advanced', 'baselineFillTopColor2');
        hSmall('setting-baseline-fill-bottom-1-advanced', 'baselineFillBottomColor1');
        hSmall('setting-baseline-fill-bottom-2-advanced', 'baselineFillBottomColor2');

        // High-Low
        h('setting-high-low-body-show', 'showHighLowBody', true);
        h('setting-high-low-border-show', 'showHighLowBorder', true);
        hSmall('setting-high-low-body-advanced', 'highLowBodyColor');
        hSmall('setting-high-low-border-advanced', 'highLowBorderColor');

        // Heikin Ashi
        h('setting-ha-real-price', 'haRealPriceScaling', true);
        h('setting-ha-prev-close', 'colorBarsBasedOnPrevClose', true);
        h('setting-ha-body-show', 'haShowBody', true);
        h('setting-ha-borders-show', 'haShowBorders', true);
        h('setting-ha-wick-show', 'haShowWick', true);
        hSmall('setting-ha-body-up-advanced', 'haUpColor');
        hSmall('setting-ha-body-down-advanced', 'haDownColor');
        hSmall('setting-ha-borders-up-advanced', 'haBorderUpColor');
        hSmall('setting-ha-borders-down-advanced', 'haBorderDownColor');
        hSmall('setting-ha-wick-up-advanced', 'haWickUpColor');
        hSmall('setting-ha-wick-down-advanced', 'haWickDownColor');

        // Renko
        hSmall('setting-renko-up-body-advanced', 'renkoUpColor');
        hSmall('setting-renko-up-border-advanced', 'renkoUpBorderColor');
        hSmall('setting-renko-down-body-advanced', 'renkoDownColor');
        hSmall('setting-renko-down-border-advanced', 'renkoDownBorderColor');
        hSmall('setting-renko-wick-up-advanced', 'renkoWickUpColor');
        hSmall('setting-renko-wick-down-advanced', 'renkoWickDownColor');
        hSmall('setting-renko-proj-up-body-advanced', 'renkoProjectionUpColor');
        hSmall('setting-renko-proj-up-border-advanced', 'renkoProjectionUpBorderColor');
        hSmall('setting-renko-proj-down-body-advanced', 'renkoProjectionDownColor');
        hSmall('setting-renko-proj-down-border-advanced', 'renkoProjectionDownBorderColor');
        h('setting-renko-wick-show', 'renkoShowWick', true);
        h('setting-renko-source', 'renkoSource');
        h('setting-renko-box-method', 'renkoBoxSizeMethod', false, false, (val) => {
            const atrRow = document.getElementById('setting-renko-atr-row');
            const boxRow = document.getElementById('setting-renko-box-row');
            const percRow = document.getElementById('setting-renko-perc-row');
            if (atrRow) atrRow.style.display = val === 'atr' ? 'flex' : 'none';
            if (boxRow) boxRow.style.display = val === 'traditional' ? 'flex' : 'none';
            if (percRow) percRow.style.display = val === 'percentage' ? 'flex' : 'none';
            this.chart.setInitialView();
        });
        h('setting-renko-perc-value', 'renkoPercentageValue', false, true, () => {
            this.chart.setInitialView();
        });

        // Line Break
        hSmall('setting-lb-up-body-advanced', 'lbUpColor');
        hSmall('setting-lb-up-border-advanced', 'lbUpBorderColor');
        hSmall('setting-lb-down-body-advanced', 'lbDownColor');
        hSmall('setting-lb-down-border-advanced', 'lbDownBorderColor');
        hSmall('setting-lb-proj-up-body-advanced', 'lbProjectionUpColor');
        hSmall('setting-lb-proj-up-border-advanced', 'lbProjectionUpBorderColor');
        hSmall('setting-lb-proj-down-body-advanced', 'lbProjectionDownColor');
        hSmall('setting-lb-proj-down-border-advanced', 'lbProjectionDownBorderColor');
        h('setting-lb-number', 'lbNumber', false, true, () => {
            this.chart.setInitialView();
        });

        // Kagi
        hSmall('setting-kagi-up-body-advanced', 'kagiUpColor');
        hSmall('setting-kagi-down-body-advanced', 'kagiDownColor');
        hSmall('setting-kagi-proj-up-body-advanced', 'kagiProjectionUpColor');
        hSmall('setting-kagi-proj-down-body-advanced', 'kagiProjectionDownColor');
        h('setting-kagi-box-method', 'kagiBoxSizeMethod', false, false, (val) => {
            const atrRow = document.getElementById('setting-kagi-atr-row');
            const boxRow = document.getElementById('setting-kagi-box-row');
            const percRow = document.getElementById('setting-kagi-perc-row');
            if (atrRow) atrRow.style.display = val === 'atr' ? 'flex' : 'none';
            if (boxRow) boxRow.style.display = val === 'traditional' ? 'flex' : 'none';
            if (percRow) percRow.style.display = val === 'percentage' ? 'flex' : 'none';
            this.chart.setInitialView();
        });
        h('setting-kagi-box-size', 'kagiBoxSize', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-kagi-atr-length', 'kagiAtRLength', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-kagi-perc-value', 'kagiPercentageValue', false, true, () => {
            this.chart.setInitialView();
        });

        // Point & Figure
        hSmall('setting-pnf-up-body-advanced', 'pnfUpColor');
        hSmall('setting-pnf-down-body-advanced', 'pnfDownColor');
        hSmall('setting-pnf-proj-up-body-advanced', 'pnfProjectionUpColor');
        hSmall('setting-pnf-proj-down-body-advanced', 'pnfProjectionDownColor');
        h('setting-pnf-source', 'pnfSource', false, false, () => {
            this.chart.setInitialView();
        });
        h('setting-pnf-box-method', 'pnfBoxSizeMethod', false, false, (val) => {
            const atrRow = document.getElementById('setting-pnf-atr-row');
            const boxRow = document.getElementById('setting-pnf-box-row');
            if (atrRow) atrRow.style.display = val === 'atr' ? 'flex' : 'none';
            if (boxRow) boxRow.style.display = val === 'traditional' ? 'flex' : 'none';
            this.chart.setInitialView();
        });
        h('setting-pnf-box-size', 'pnfBoxSize', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-pnf-atr-length', 'pnfAtRLength', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-pnf-reversal', 'pnfReversal', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-pnf-one-step-back', 'pnfOneStepBack', true, false, () => {
            this.chart.setInitialView();
        });

        // Volume Footprint
        h('setting-footprint-row-size-method', 'footprintRowSizeMethod', false, false, () => {
            this.chart.setInitialView();
            const atrRow = document.getElementById('setting-footprint-atr-row');
            const manualRow = document.getElementById('setting-footprint-manual-row');
            const method = this.chart.footprintRowSizeMethod;
            if (atrRow) atrRow.style.display = method === 'atr' ? 'flex' : 'none';
            if (manualRow) manualRow.style.display = method === 'manual' ? 'flex' : 'none';
        });
        h('setting-footprint-atr-length', 'footprintAtrLength', false, true, () => {
             this.chart.setInitialView();
        });
        h('setting-footprint-row-size-manual', 'footprintRowSizeManual', false, true, () => {
             this.chart.setInitialView();
        });
        h('setting-footprint-type', 'footprintType', false, false, () => {
            this.chart.render();
        });
        h('setting-footprint-apply-gradient', 'footprintApplyGradient', true, false, () => {
            this.chart.render();
        });
        h('setting-footprint-value-area', 'footprintValueArea', true, false, () => {
            this.chart.render();
        });
        h('setting-footprint-value-area-percent', 'footprintValueAreaPercent', false, true, () => {
            this.chart.render();
        });

        // NEW: Labels & Imbalance Handlers
        h('setting-footprint-show-poc', 'footprintShowPOC', true, false, () => {
            this.chart.render();
        });
        hSmall('setting-footprint-poc-color', 'footprintPocColor');
        
        h('setting-footprint-show-summary', 'footprintShowSummary', true, false, () => {
            this.chart.render();
        });
        h('setting-footprint-imbalance-percent', 'footprintImbalancePercent', false, true, () => {
            this.chart.render();
        });
        h('setting-footprint-show-imbalance', 'footprintShowImbalance', true, false, () => {
            this.chart.render();
        });
        hSmall('setting-footprint-imbalance-up-color', 'footprintImbalanceUpColor');
        hSmall('setting-footprint-imbalance-down-color', 'footprintImbalanceDownColor');
        
        h('setting-footprint-show-stacked-imbalance', 'footprintShowStackedImbalance', true, false, () => {
            this.chart.render();
        });
        h('setting-footprint-stacked-levels', 'footprintStackedLevels', false, true, () => {
            this.chart.render();
        });

        // Background Gradients (Buy/Sell)
        for (let i = 1; i <= 4; i++) {
            hSmall(`setting-footprint-sell-bg-${i}`, null, (color) => {
                this.chart.footprintSellBgColors[i-1] = color;
                this.chart.render();
            });
            hSmall(`setting-footprint-buy-bg-${i}`, null, (color) => {
                this.chart.footprintBuyBgColors[i-1] = color;
                this.chart.render();
            });
        }
        h('setting-renko-atr-length', 'renkoAtRLength', false, true, () => {
            this.chart.setInitialView();
        });
        h('setting-renko-box-size', 'renkoBoxSize', false, true, () => {
            this.chart.setInitialView();
        });

        // Show/Hide second color picker for line gradient
        const lineTypeEl = document.getElementById('setting-line-color-type');
        if (lineTypeEl) {
            lineTypeEl.addEventListener('change', () => {
                this.updateLineUI(lineTypeEl.value);
                this.chart.lineChartColorType = lineTypeEl.value;
                this.chart.render(true);
            });
        }

        // Data Modification
        h('setting-precision', 'precision');
        h('setting-timezone', 'timezone');
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Update sidebar
        const tabs = this.dialog.querySelectorAll('.chart-settings-tab');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabId) tab.classList.add('active');
            else tab.classList.remove('active');
        });

        // Update content views
        const views = this.dialog.querySelectorAll('.chart-settings-view');
        views.forEach(view => {
            if (view.dataset.view === tabId) view.classList.add('active');
            else view.classList.remove('active');
        });
    }

    show() {
        if (this.backdrop) {
            this.backdrop.style.display = 'flex';
            this.showSymbolSection(this.chart.chartMode);
            this.syncInputsWithChart();
        }
    }

    showSymbolSection(mode) {
        // Hide all mode sections
        const sections = this.dialog.querySelectorAll('.settings-mode-section');
        sections.forEach(s => s.style.display = 'none');

        // Show relevant one
        let targetId = 'symbol-section-line'; // Default fallback
        const candleModes = ['candle', 'candlestick', 'hollow-candle'];

        if (candleModes.includes(mode)) {
            targetId = 'symbol-section-candles';
        } else if (mode === 'bars') {
            targetId = 'symbol-section-bars';
        } else if (mode === 'area') {
            targetId = 'symbol-section-area';
        } else if (['line', 'line-marker', 'step-line'].includes(mode)) {
            targetId = 'symbol-section-line';
        } else if (mode === 'hlc-area') {
            targetId = 'symbol-section-hlc-area';
        } else if (mode === 'baseline') {
            targetId = 'symbol-section-baseline';
        } else if (mode === 'high-low') {
            targetId = 'symbol-section-high-low';
        } else if (mode === 'heikin-ashi') {
            targetId = 'symbol-section-heikin-ashi';
        } else if (mode === 'renko') {
            targetId = 'symbol-section-renko';
        } else if (mode === 'line-break') {
            targetId = 'symbol-section-line-break';
        } else if (mode === 'kagi') {
            targetId = 'symbol-section-kagi';
        } else if (mode === 'pnf') {
            targetId = 'symbol-section-pnf';
        } else if (mode === 'footprint') {
            targetId = 'symbol-section-footprint';
        }

        const target = document.getElementById(targetId);
        if (target) target.style.display = 'block';
    }

    hide() {
        if (this.backdrop) {
            this.backdrop.style.display = 'none';
        }
    }

    syncInputsWithChart() {
        const s = (id, prop, isCheckbox = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (isCheckbox) el.checked = !!this.chart[prop];
            else el.value = this.chart[prop] || '';
        };

        const sAdvanced = (id, values) => {
            const comp = this.advancedComponents[id];
            if (comp) {
                comp.setValue(values);
            }
        };

        // Canvas
        s('setting-bg-type', 'backgroundType');
        sAdvanced('setting-bg-advanced', { hexAlpha: this.chart.backgroundColor });
        sAdvanced('setting-bg-advanced-2', { hexAlpha: this.chart.backgroundColor2 });

        const bgTypeEl = document.getElementById('setting-bg-type');
        const bgColor2 = document.getElementById('setting-bg-advanced-2');
        if (bgTypeEl && bgColor2) {
            bgColor2.style.display = this.chart.backgroundType === 'gradient' ? 'block' : 'none';
        }

        sAdvanced('setting-vert-grid-advanced', {
            hexAlpha: this.chart.vertGridColor,
            thickness: this.chart.vertGridWidth,
            style: this.chart.vertGridStyle
        });
        sAdvanced('setting-horz-grid-advanced', {
            hexAlpha: this.chart.horzGridColor,
            thickness: this.chart.horzGridWidth,
            style: this.chart.horzGridStyle
        });
        s('setting-show-watermark', 'showWatermark', true);

        // Candles
        s('setting-candle-color-prev-close', 'colorBarsBasedOnPrevClose', true);
        s('setting-candle-body', 'showCandleBody', true);
        sAdvanced('setting-candle-body-up-advanced', { hexAlpha: this.chart.candleBodyUpColor });
        sAdvanced('setting-candle-body-down-advanced', { hexAlpha: this.chart.candleBodyDownColor });

        s('setting-candle-borders', 'showCandleBorders', true);
        sAdvanced('setting-candle-borders-up-advanced', { hexAlpha: this.chart.candleBorderUpColor });
        sAdvanced('setting-candle-borders-down-advanced', { hexAlpha: this.chart.candleBorderDownColor });

        s('setting-candle-wick', 'showCandleWick', true);
        sAdvanced('setting-candle-wick-up-advanced', { hexAlpha: this.chart.candleWickUpColor });
        sAdvanced('setting-candle-wick-down-advanced', { hexAlpha: this.chart.candleWickDownColor });

        // Bars
        s('setting-bar-color-prev-close', 'colorBarsBasedOnPrevClose', true);
        s('setting-bar-hlc', 'showHLCBars', true);
        s('setting-bar-thin', 'showThinBars', true);
        sAdvanced('setting-bar-up-advanced', { hexAlpha: this.chart.barUpColor });
        sAdvanced('setting-bar-down-advanced', { hexAlpha: this.chart.barDownColor });

        // Area
        sAdvanced('setting-area-fill-advanced-1', { hexAlpha: this.chart.areaFillColor1 });
        sAdvanced('setting-area-fill-advanced-2', { hexAlpha: this.chart.areaFillColor2 });

        // HLC Area
        s('setting-hlc-high-show', 'showHlcHighLine');
        s('setting-hlc-low-show', 'showHlcLowLine');

        sAdvanced('setting-hlc-high-advanced', {
            hexAlpha: this.chart.hlcHighLineColor,
            thickness: this.chart.hlcHighLineWidth
        });
        sAdvanced('setting-hlc-low-advanced', {
            hexAlpha: this.chart.hlcLowLineColor,
            thickness: this.chart.hlcLowLineWidth
        });
        sAdvanced('setting-hlc-close-advanced', {
            hexAlpha: this.chart.hlcCloseLineColor,
            thickness: this.chart.hlcCloseLineWidth
        });
        sAdvanced('setting-hlc-fill-up-advanced', { hexAlpha: this.chart.hlcFillUpColor });
        sAdvanced('setting-hlc-fill-down-advanced', { hexAlpha: this.chart.hlcFillDownColor });

        // Baseline
        s('setting-baseline-source', 'baselineSource');
        s('setting-baseline-level', 'baselineLevel');
        sAdvanced('setting-baseline-top-line-advanced', {
            hexAlpha: this.chart.baselineTopLineColor,
            thickness: this.chart.baselineTopLineWidth
        });
        sAdvanced('setting-baseline-bottom-line-advanced', {
            hexAlpha: this.chart.baselineBottomLineColor,
            thickness: this.chart.baselineBottomLineWidth
        });
        sAdvanced('setting-baseline-fill-top-1-advanced', { hexAlpha: this.chart.baselineFillTopColor1 });
        sAdvanced('setting-baseline-fill-top-2-advanced', { hexAlpha: this.chart.baselineFillTopColor2 });
        sAdvanced('setting-baseline-fill-bottom-1-advanced', { hexAlpha: this.chart.baselineFillBottomColor1 });
        sAdvanced('setting-baseline-fill-bottom-2-advanced', { hexAlpha: this.chart.baselineFillBottomColor2 });

        // High-Low
        s('setting-high-low-body-show', 'showHighLowBody', true);
        s('setting-high-low-border-show', 'showHighLowBorder', true);
        sAdvanced('setting-high-low-body-advanced', { hexAlpha: this.chart.highLowBodyColor });
        sAdvanced('setting-high-low-border-advanced', { hexAlpha: this.chart.highLowBorderColor });

        // Heikin Ashi
        s('setting-ha-real-price', 'haRealPriceScaling', true);
        s('setting-ha-prev-close', 'colorBarsBasedOnPrevClose', true);
        s('setting-ha-body-show', 'haShowBody', true);
        s('setting-ha-borders-show', 'haShowBorders', true);
        s('setting-ha-wick-show', 'haShowWick', true);
        sAdvanced('setting-ha-body-up-advanced', { hexAlpha: this.chart.haUpColor });
        sAdvanced('setting-ha-body-down-advanced', { hexAlpha: this.chart.haDownColor });
        sAdvanced('setting-ha-borders-up-advanced', { hexAlpha: this.chart.haBorderUpColor });
        sAdvanced('setting-ha-borders-down-advanced', { hexAlpha: this.chart.haBorderDownColor });
        sAdvanced('setting-ha-wick-up-advanced', { hexAlpha: this.chart.haWickUpColor });
        sAdvanced('setting-ha-wick-down-advanced', { hexAlpha: this.chart.haWickDownColor });

        // Renko
        sAdvanced('setting-renko-up-body-advanced', { hexAlpha: this.chart.renkoUpColor });
        sAdvanced('setting-renko-up-border-advanced', { hexAlpha: this.chart.renkoUpBorderColor });
        sAdvanced('setting-renko-down-body-advanced', { hexAlpha: this.chart.renkoDownColor });
        sAdvanced('setting-renko-down-border-advanced', { hexAlpha: this.chart.renkoDownBorderColor });
        sAdvanced('setting-renko-wick-up-advanced', { hexAlpha: this.chart.renkoWickUpColor });
        sAdvanced('setting-renko-wick-down-advanced', { hexAlpha: this.chart.renkoWickDownColor });
        sAdvanced('setting-renko-proj-up-body-advanced', { hexAlpha: this.chart.renkoProjectionUpColor });
        sAdvanced('setting-renko-proj-up-border-advanced', { hexAlpha: this.chart.renkoProjectionUpBorderColor });
        sAdvanced('setting-renko-proj-down-body-advanced', { hexAlpha: this.chart.renkoProjectionDownColor });
        sAdvanced('setting-renko-proj-down-border-advanced', { hexAlpha: this.chart.renkoProjectionDownBorderColor });
        s('setting-renko-wick-show', 'renkoShowWick', true);
        s('setting-renko-source', 'renkoSource');
        s('setting-renko-box-method', 'renkoBoxSizeMethod');
        s('setting-renko-atr-length', 'renkoAtRLength');
        s('setting-renko-box-size', 'renkoBoxSize');
        s('setting-renko-perc-value', 'renkoPercentageValue');

        // Line Break
        sAdvanced('setting-lb-up-body-advanced', { hexAlpha: this.chart.lbUpColor });
        sAdvanced('setting-lb-up-border-advanced', { hexAlpha: this.chart.lbUpBorderColor });
        sAdvanced('setting-lb-down-body-advanced', { hexAlpha: this.chart.lbDownColor });
        sAdvanced('setting-lb-down-border-advanced', { hexAlpha: this.chart.lbDownBorderColor });
        sAdvanced('setting-lb-proj-up-body-advanced', { hexAlpha: this.chart.lbProjectionUpColor });
        sAdvanced('setting-lb-proj-up-border-advanced', { hexAlpha: this.chart.lbProjectionUpBorderColor });
        sAdvanced('setting-lb-proj-down-body-advanced', { hexAlpha: this.chart.lbProjectionDownColor });
        sAdvanced('setting-lb-proj-down-border-advanced', { hexAlpha: this.chart.lbProjectionDownBorderColor });
        s('setting-lb-number', 'lbNumber');

        // Kagi
        sAdvanced('setting-kagi-up-body-advanced', { hexAlpha: this.chart.kagiUpColor });
        sAdvanced('setting-kagi-down-body-advanced', { hexAlpha: this.chart.kagiDownColor });
        sAdvanced('setting-kagi-proj-up-body-advanced', { hexAlpha: this.chart.kagiProjectionUpColor });
        sAdvanced('setting-kagi-proj-down-body-advanced', { hexAlpha: this.chart.kagiProjectionDownColor });
        s('setting-kagi-box-method', 'kagiBoxSizeMethod');
        s('setting-kagi-box-size', 'kagiBoxSize');
        s('setting-kagi-atr-length', 'kagiAtRLength');
        s('setting-kagi-perc-value', 'kagiPercentageValue');

        const kagiMethod = this.chart.kagiBoxSizeMethod;
        const kagiAtrRow = document.getElementById('setting-kagi-atr-row');
        const kagiBoxRow = document.getElementById('setting-kagi-box-row');
        const kagiPercRow = document.getElementById('setting-kagi-perc-row');
        if (kagiAtrRow) kagiAtrRow.style.display = kagiMethod === 'atr' ? 'flex' : 'none';
        if (kagiBoxRow) kagiBoxRow.style.display = kagiMethod === 'traditional' ? 'flex' : 'none';
        if (kagiPercRow) kagiPercRow.style.display = kagiMethod === 'percentage' ? 'flex' : 'none';

        // Point & Figure
        sAdvanced('setting-pnf-up-body-advanced', { hexAlpha: this.chart.pnfUpColor });
        sAdvanced('setting-pnf-down-body-advanced', { hexAlpha: this.chart.pnfDownColor });
        sAdvanced('setting-pnf-proj-up-body-advanced', { hexAlpha: this.chart.pnfProjectionUpColor });
        sAdvanced('setting-pnf-proj-down-body-advanced', { hexAlpha: this.chart.pnfProjectionDownColor });
        s('setting-pnf-source', 'pnfSource', false);
        s('setting-pnf-box-method', 'pnfBoxSizeMethod', false);
        s('setting-pnf-box-size', 'pnfBoxSize');
        s('setting-pnf-atr-length', 'pnfAtRLength');
        s('setting-pnf-reversal', 'pnfReversal');
        s('setting-pnf-one-step-back', 'pnfOneStepBack', true);

        const pnfMethod = this.chart.pnfBoxSizeMethod;
        const pnfAtrRow = document.getElementById('setting-pnf-atr-row');
        const pnfBoxRow = document.getElementById('setting-pnf-box-row');
        if (pnfAtrRow) pnfAtrRow.style.display = pnfMethod === 'atr' ? 'flex' : 'none';
        if (pnfBoxRow) pnfBoxRow.style.display = pnfMethod === 'traditional' ? 'flex' : 'none';

        // Volume Footprint
        s('setting-footprint-row-size-method', 'footprintRowSizeMethod');
        s('setting-footprint-atr-length', 'footprintAtrLength');
        s('setting-footprint-row-size-manual', 'footprintRowSizeManual');
        s('setting-footprint-type', 'footprintType');
        s('setting-footprint-apply-gradient', 'footprintApplyGradient', true);
        s('setting-footprint-value-area', 'footprintValueArea', true);
        s('setting-footprint-value-area-percent', 'footprintValueAreaPercent');
        
        // NEW: Sync Labels & Imbalance
        s('setting-footprint-show-poc', 'footprintShowPOC', true);
        sAdvanced('setting-footprint-poc-color', { hexAlpha: this.chart.footprintPocColor });
        s('setting-footprint-show-summary', 'footprintShowSummary', true);
        s('setting-footprint-imbalance-percent', 'footprintImbalancePercent');
        s('setting-footprint-show-imbalance', 'footprintShowImbalance', true);
        sAdvanced('setting-footprint-imbalance-up-color', { hexAlpha: this.chart.footprintImbalanceUpColor });
        sAdvanced('setting-footprint-imbalance-down-color', { hexAlpha: this.chart.footprintImbalanceDownColor });
        s('setting-footprint-show-stacked-imbalance', 'footprintShowStackedImbalance', true);
        s('setting-footprint-stacked-levels', 'footprintStackedLevels');

        const fpMethod = this.chart.footprintRowSizeMethod;
        const fpAtrRow = document.getElementById('setting-footprint-atr-row');
        const fpManualRow = document.getElementById('setting-footprint-manual-row');
        if (fpAtrRow) fpAtrRow.style.display = fpMethod === 'atr' ? 'flex' : 'none';
        if (fpManualRow) fpManualRow.style.display = fpMethod === 'manual' ? 'flex' : 'none';

        for (let i = 1; i <= 4; i++) {
            sAdvanced(`setting-footprint-sell-bg-${i}`, { hexAlpha: this.chart.footprintSellBgColors[i-1] || '#000' });
            sAdvanced(`setting-footprint-buy-bg-${i}`, { hexAlpha: this.chart.footprintBuyBgColors[i-1] || '#000' });
        }

        const renkoMethod = this.chart.renkoBoxSizeMethod;
        const atrRow = document.getElementById('setting-renko-atr-row');
        const boxRow = document.getElementById('setting-renko-box-row');
        const percRow = document.getElementById('setting-renko-perc-row');
        if (atrRow) atrRow.style.display = renkoMethod === 'atr' ? 'flex' : 'none';
        if (boxRow) boxRow.style.display = renkoMethod === 'traditional' ? 'flex' : 'none';
        if (percRow) percRow.style.display = renkoMethod === 'percentage' ? 'flex' : 'none';


        // Line
        s('setting-line-source', 'lineChartSource');
        s('setting-line-color-type', 'lineChartColorType');

        const lineType = this.chart.lineChartColorType || 'solid';
        this.updateLineUI(lineType);

        sAdvanced('setting-line-advanced', {
            hexAlpha: this.chart.lineChartColor,
            thickness: this.chart.lineChartWidth
        });
        sAdvanced('setting-line-advanced-2', { hexAlpha: this.chart.lineChartColor2 });

        // Area
        s('setting-area-source', 'areaSource');

        sAdvanced('setting-area-line-advanced', {
            hexAlpha: this.chart.areaLineColor,
            thickness: this.chart.areaLineWidth,
            style: this.chart.areaLineStyle
        });

        sAdvanced('setting-area-fill-advanced-1', {
            hexAlpha: this.chart.areaFillColor1
        });

        sAdvanced('setting-area-fill-advanced-2', {
            hexAlpha: this.chart.areaFillColor2
        });

        // Handle visibility for line color 2
        const lineTypeEl = document.getElementById('setting-line-color-type');
        const color2 = document.getElementById('setting-line-advanced-2');
        if (lineTypeEl && color2) {
            color2.style.display = lineTypeEl.value === 'gradient' ? 'block' : 'none';
        }

        // Data Modification
        s('setting-precision', 'precision');
        s('setting-timezone', 'timezone');
    }

    updateLineUI(lineType) {
        const lineAdvanced2 = document.getElementById('setting-line-advanced-2');
        const lineWidthContainer = document.getElementById('setting-line-width-container');

        if (lineAdvanced2) {
            lineAdvanced2.style.display = lineType === 'gradient' ? 'block' : 'none';
        }

        if (lineWidthContainer) {
            lineWidthContainer.style.display = lineType === 'gradient' ? 'block' : 'none';
            const preview = lineWidthContainer.querySelector('#setting-line-width-preview');
            const options = lineWidthContainer.querySelectorAll('.custom-width-option');
            const currentWidth = this.chart.lineChartWidth || 2;

            if (preview) {
                preview.style.height = `${currentWidth}px`;
                preview.style.backgroundColor = '#787b86';
            }
            options.forEach(opt => {
                opt.classList.toggle('active', parseInt(opt.dataset.value) === currentWidth);
            });
        }

        const lineComp = this.advancedComponents['setting-line-advanced'];
        if (lineComp) {
            lineComp.updateOptions({
                showThickness: lineType === 'solid',
                showStyle: false,
                onChange: (val) => {
                    const propMap = lineType === 'solid'
                        ? { hexAlpha: 'lineChartColor', thickness: 'lineChartWidth' }
                        : { hexAlpha: 'lineChartColor' };

                    Object.keys(propMap).forEach(key => {
                        const chartProp = propMap[key];
                        const newVal = val[key];
                        if (newVal !== undefined) {
                            this.chart[chartProp] = newVal;
                            const mode = this.chart.chartMode;
                            if (this.chart.modeConfigs && this.chart.modeConfigs[mode]) {
                                this.chart.modeConfigs[mode][chartProp] = newVal;
                            }
                        }
                    });
                    this.chart.render(true);
                }
            });

            // Re-sync values into the component after option change
            lineComp.setValue({
                hexAlpha: this.chart.lineChartColor,
                thickness: this.chart.lineChartWidth
            });
        }
    }

    applySettings() {
        // Persistence can go here
        const settings = {
            backgroundColor: this.chart.backgroundColor,
            backgroundColor2: this.chart.backgroundColor2,
            backgroundType: this.chart.backgroundType,
            vertGridColor: this.chart.vertGridColor,
            vertGridWidth: this.chart.vertGridWidth,
            vertGridStyle: this.chart.vertGridStyle,
            horzGridColor: this.chart.horzGridColor,
            horzGridWidth: this.chart.horzGridWidth,
            horzGridStyle: this.chart.horzGridStyle,
            showWatermark: this.chart.showWatermark,
            candleBodyUpColor: this.chart.candleBodyUpColor,
            candleBodyDownColor: this.chart.candleBodyDownColor,
            candleBorderUpColor: this.chart.candleBorderUpColor,
            candleBorderDownColor: this.chart.candleBorderDownColor,
            candleWickUpColor: this.chart.candleWickUpColor,
            candleWickDownColor: this.chart.candleWickDownColor,
            showCandleBody: this.chart.showCandleBody,
            showCandleBorders: this.chart.showCandleBorders,
            showCandleWick: this.chart.showCandleWick,
            barUpColor: this.chart.barUpColor,
            barDownColor: this.chart.barDownColor,
            showHLCBars: this.chart.showHLCBars,
            showThinBars: this.chart.showThinBars,
            lineChartColor: this.chart.lineChartColor,
            lineChartColor2: this.chart.lineChartColor2,
            lineChartColorType: this.chart.lineChartColorType,
            lineChartSource: this.chart.lineChartSource,
            lineChartStyle: this.chart.lineChartStyle,
            lineChartWidth: this.chart.lineChartWidth,
            areaLineColor: this.chart.areaLineColor,
            areaLineStyle: this.chart.areaLineStyle,
            areaLineWidth: this.chart.areaLineWidth,
            areaFillColor1: this.chart.areaFillColor1,
            areaFillColor2: this.chart.areaFillColor2,
            areaSource: this.chart.areaSource,
            colorBarsBasedOnPrevClose: this.chart.colorBarsBasedOnPrevClose,
            precision: this.chart.precision,
            timezone: this.chart.timezone
        };

        localStorage.setItem('chart_global_settings', JSON.stringify(settings));
        this.chart.render(true);
        if (typeof window.saveCurrentLayout === 'function') {
            window.saveCurrentLayout();
        }
    }
}
