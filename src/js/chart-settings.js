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

        hAdvanced('setting-area-fill-advanced-1', {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false
        }, { hexAlpha: 'areaFillColor1' });

        hAdvanced('setting-area-fill-advanced-2', {
            showColor: true, showOpacity: true, showThickness: false, showStyle: false
        }, { hexAlpha: 'areaFillColor2' });

        // Show/Hide second color picker for line gradient
        const lineTypeEl = document.getElementById('setting-line-color-type');
        if (lineTypeEl) {
            lineTypeEl.addEventListener('change', () => {
                const color2 = document.getElementById('setting-line-advanced-2');
                if (color2) color2.style.display = lineTypeEl.value === 'gradient' ? 'block' : 'none';
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
        const candleModes = ['candle', 'candlestick', 'hollow-candle', 'heikin-ashi', 'renko', 'line-break', 'kagi', 'pnf'];

        if (candleModes.includes(mode)) {
            targetId = 'symbol-section-candles';
        } else if (mode === 'bars') {
            targetId = 'symbol-section-bars';
        } else if (mode === 'area') {
            targetId = 'symbol-section-area';
        } else if (['line', 'line-marker', 'step-line'].includes(mode)) {
            targetId = 'symbol-section-line';
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

        // Line
        s('setting-line-source', 'lineChartSource');
        s('setting-line-color-type', 'lineChartColorType');

        const lineType = this.chart.lineChartColorType || 'solid';
        const lineAdvanced2 = document.getElementById('setting-line-advanced-2');
        const lineWidthContainer = document.getElementById('setting-line-width-container');
        const lineWidthSelect = document.getElementById('setting-line-width');

        if (lineAdvanced2) {
            lineAdvanced2.style.display = lineType === 'gradient' ? 'block' : 'none';
        }

        if (lineWidthContainer) {
            lineWidthContainer.style.display = lineType === 'gradient' ? 'block' : 'none';
            const preview = lineWidthContainer.querySelector('#setting-line-width-preview');
            const options = lineWidthContainer.querySelectorAll('.custom-width-option');
            const currentWidth = this.chart.lineChartWidth || 2;

            if (preview) preview.style.height = `${currentWidth}px`;
            options.forEach(opt => {
                opt.classList.toggle('active', parseInt(opt.dataset.value) === currentWidth);
            });
        }

        // Re-init Line component options based on type
        const lineComp = this.advancedComponents['setting-line-advanced'];
        if (lineComp) {
            lineComp.updateOptions({
                showThickness: lineType === 'solid',
                showStyle: false,
                onChange: (val) => {
                    // Manually handle the update with the correct propMap
                    const propMap = lineType === 'solid'
                        ? { hexAlpha: 'lineChartColor', thickness: 'lineChartWidth' }
                        : { hexAlpha: 'lineChartColor' };

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
                    this.chart.render(true);
                }
            });
        }

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
