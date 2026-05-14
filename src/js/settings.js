import { AdvancedLineSetting } from './components/AdvancedLineSetting.js';
export class ToolSettingsController {
    constructor(chart) {
        this.chart = chart;
        this.backdrop = document.getElementById('settings-dialog-backdrop');
        this.dialog = document.getElementById('settings-dialog');
        this.activeTool = null;
        this.tempStyle = {};
        this.backupStyle = {};
        this.backupText = '';

        // Dragging state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.initialDialogX = 0;
        this.initialDialogY = 0;
        this.hasBeenPositioned = false;

        this.init();
    }

    // ─── Dash helpers ────────────────────────────────────────────────────────
    _dashToKey(dash) {
        if (!dash || !dash.length) return 'solid';
        if (dash[0] <= 2) return 'dotted';
        return 'dashed';
    }
    _keyToDash(key) {
        if (key === 'dashed') return [5, 5];
        if (key === 'dotted') return [2, 2];
        return [];
    }

    _syncAdvancedLine(id, value, options = {}) {
        if (!this.advancedComps) this.advancedComps = {};
        
        const container = document.getElementById(id);
        if (!container) return;

        if (!this.advancedComps[id]) {
            this.advancedComps[id] = new AdvancedLineSetting(id, {
                ...options,
                onChange: (val) => {
                    if (options.onUpdate) options.onUpdate(val);
                    this.updatePreview();
                }
            });
        } else {
            // Update options in case they changed (e.g. switching between regular line and highlighter)
            this.advancedComps[id].updateOptions(options);
        }
        
        this.advancedComps[id].setValue(value);
    }
    _hexFromColor(color) {
        // Accept rgba/rgb or hex; return best hex approximation
        if (!color || typeof color !== 'string') return '#2962FF';
        if (color.startsWith('#')) return color.slice(0, 7);
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
        return '#2962FF';
    }

    _rgbaToHex(color, opacity) {
        const hex = this._hexFromColor(color);
        const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
        return hex + alpha;
    }

    _syncCustomWidthPicker(idOrEl, width, color) {
        const picker = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (picker) {
            const displayLine = picker.querySelector('.custom-width-picker-line');
            const colorHex = this._hexFromColor(color || '#2962FF');
            if (displayLine) {
                displayLine.style.height = (width || 1) + 'px';
                displayLine.style.backgroundColor = colorHex;
            }

            // For portaled dropdowns, find it via the reference we stored
            const dropdown = picker.__dropdown || picker.querySelector('.custom-width-dropdown');
            if (dropdown) {
                const hints = dropdown.querySelectorAll('.line-hint');
                hints.forEach(h => h.style.backgroundColor = colorHex);

                // Sync active class
                dropdown.querySelectorAll('.custom-width-option').forEach(opt => {
                    if (parseInt(opt.dataset.width) === (width || 1)) opt.classList.add('active');
                    else opt.classList.remove('active');
                });
            }
        }
    }

    _initCustomWidthPicker(idOrEl, onWidthChange, colorIdOrEl) {
        const picker = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!picker) return;

        let dropdown = picker.__dropdown || picker.querySelector('.custom-width-dropdown');
        if (!dropdown) return;

        const displayLine = picker.querySelector('.custom-width-picker-line');

        // Portal: Move dropdown to dialog level so it's not clipped by body overflow
        if (dropdown.parentNode === picker) {
            picker.__dropdown = dropdown; // Store reference before moving
            this.dialog.appendChild(dropdown);
        }

        picker.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-width-dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });

            dropdown.classList.toggle('show');

            if (dropdown.classList.contains('show')) {
                const pickerRect = picker.getBoundingClientRect();
                const dialogRect = this.dialog.getBoundingClientRect();
                dropdown.style.top = (pickerRect.bottom - dialogRect.top + 5) + 'px';
                dropdown.style.left = (pickerRect.left - dialogRect.left) + 'px';
            }
        };

        // Close dropdowns on scroll
        const body = document.querySelector('.settings-body');
        if (body && !body.hasDropdownScrollListener) {
            body.addEventListener('scroll', () => {
                document.querySelectorAll('.custom-width-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                });
            });
            body.hasDropdownScrollListener = true;
        }

        dropdown.querySelectorAll('.custom-width-option').forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                const w = parseInt(opt.dataset.width);

                if (typeof onWidthChange === 'function') {
                    onWidthChange(w);
                } else if (typeof onWidthChange === 'string') {
                    this.tempStyle[onWidthChange] = w;
                    // Special case for highlighter scaling
                    if (this.activeTool && this.activeTool.type === 'highlighter' && onWidthChange === 'width') {
                        this.tempStyle.highlighterWidth = w * 5;
                    }
                }

                displayLine.style.height = w + 'px';
                dropdown.querySelectorAll('.custom-width-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                dropdown.classList.remove('show');
                this.updatePreview();
            };
        });

        // Link with color picker if provided
        if (colorIdOrEl) {
            const cp = typeof colorIdOrEl === 'string' ? document.getElementById(colorIdOrEl) : colorIdOrEl;
            if (cp) {
                const originalInput = cp.oninput;
                cp.oninput = (e) => {
                    if (originalInput) originalInput.call(cp, e);
                    const lines = picker.querySelectorAll('.custom-width-picker-line, .line-hint');
                    lines.forEach(l => l.style.backgroundColor = e.target.value);
                };
            }
        }
    }

    makePitchforkLevelRow(lvlObj, idx, onVisibility, onColor, onWidth) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `
                    <input type="checkbox" id="pf-lvl-vis-${idx}" ${lvlObj.visibility !== false ? 'checked' : ''}>
                    <div style="font-size: 12px; color: #d1d4dc; flex: 1; white-space: nowrap;">${lvlObj.level}</div>
                    <input type="color" id="pf-lvl-color-${idx}" class="settings-color-picker" value="${this._hexFromColor(lvlObj.color)}">
                    <div id="pf-lvl-width-picker-${idx}" class="custom-width-picker">
                        <div class="custom-width-picker-line" style="background-color: ${this._hexFromColor(lvlObj.color)}; height: ${lvlObj.width || 1}px;"></div>
                        <div class="custom-width-dropdown">
                            ${[1, 2, 3, 4].map(w => `
                                <div class="custom-width-option" data-width="${w}">
                                    <div class="line-hint" style="height:${w}px; background-color: ${this._hexFromColor(lvlObj.color)};"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

        const visCb = row.querySelector(`#pf-lvl-vis-${idx}`);
        const colorInput = row.querySelector(`#pf-lvl-color-${idx}`);
        const widthPicker = row.querySelector(`#pf-lvl-width-picker-${idx}`);

        // Initial state dimming and disabling
        const updateState = (checked) => {
            row.style.opacity = checked ? '1' : '0.4';
            colorInput.disabled = !checked;
            if (widthPicker) {
                widthPicker.style.pointerEvents = checked ? 'auto' : 'none';
                widthPicker.style.opacity = checked ? '1' : '0.5';
            }
        };
        updateState(visCb.checked);
        row.style.transition = 'opacity 0.2s';

        visCb.onchange = (e) => {
            updateState(e.target.checked);
            onVisibility(e);
        };
        colorInput.oninput = onColor;
        this._initCustomWidthPicker(widthPicker, onWidth, colorInput);

        return row;
    }

    // ─── Category mapping ────────────────────────────────────────────────────
    getCategory(type) {
        const LINE_TOOLS = [
            'trend-line', 'horizontal-line', 'vertical-line', 'ray', 'horizontal-ray',
            'extended-line', 'info-line', 'trend-angle', 'cross-line',
            'arrow', 'arrow-mark-up', 'arrow-mark-down', 'arrow-marker',
            'brush', 'highlighter', 'path', 'curve', 'double-curve'
        ];
        const SHAPE_TOOLS = [
            'rectangle', 'circle', 'ellipse', 'triangle', 'rotated-rectangle',
            'arc', 'polyline', 'projection',
            'pin', 'sign-post', 'flag-mark',
            'comment', 'callout', 'price-label'
        ];
        const RANGE_TOOLS = ['price-range', 'time-range', 'price-time-range'];
        if (RANGE_TOOLS.includes(type)) return 'range';
        if (['long-position', 'short-position'].includes(type)) return 'position';
        const TEXT_TOOLS = [
            'text', 'anchored-text', 'comment'
        ];
        const TABLE_TOOLS = [
            'table'
        ];
        const FIBONACCI_TOOLS = [
            'fibonacci-retracement', 'fibonacci-extension', 'fibonacci-time', 'fibonacci-fan',
            'fibonacci-channel', 'fibonacci-circle', 'fibonacci-arcs',
            'fibonacci-spiral', 'fibonacci-wedge', 'pitch-fan'
        ];
        const PITCHFORK_TOOLS = [
            'pitchfork', 'schiff-pitchfork', 'modified-schiff-pitchfork', 'inside-pitchfork'
        ];
        if (LINE_TOOLS.includes(type)) return 'line';
        if (['forecast'].includes(type)) return 'forecast';
        if (SHAPE_TOOLS.includes(type)) return 'shape';
        if (TEXT_TOOLS.includes(type)) return 'text';
        if (TABLE_TOOLS.includes(type)) return 'table';
        if (FIBONACCI_TOOLS.includes(type)) return 'fibonacci';
        if (type === 'bars-pattern') return 'bars-pattern';

        const CHART_PATTERNS = [
            'xabcd-pattern', 'cypher-pattern', 'hs-pattern', 'abcd-pattern',
            'triangle-pattern', 'three-drives-pattern', 'five-points-pattern'
        ];
        if (CHART_PATTERNS.includes(type) || type.includes('pattern')) return 'chart-patterns';

        const ELLIOTT_WAVES = [
            'elliott-impulse', 'elliott-correction', 'elliott-triangle',
            'elliott-triple-combo', 'elliott-zigzag', 'elliott-flat', 'elliott-double-combo'
        ];
        if (ELLIOTT_WAVES.includes(type) || type.includes('elliott')) return 'elliott-waves';

        const GANN_TOOLS = ['gann-box', 'gann-square', 'gann-fan', 'gann-square-fixed'];

        if (GANN_TOOLS.includes(type)) return 'gann';
        if (PITCHFORK_TOOLS.includes(type)) return 'pitchfork';

        const CYCLES = ['cyclic-lines', 'time-cycles', 'sine-line'];
        if (CYCLES.includes(type)) return 'cycles';

        return 'line'; // default
    }

    init() {
        document.getElementById('settings-close').onclick = () => this.cancel();
        document.getElementById('settings-cancel').onclick = () => this.cancel();
        document.getElementById('settings-ok').onclick = () => this.apply();
        this.backdrop.onclick = (e) => { if (e.target === this.backdrop) this.cancel(); };

        // Handle closing custom width dropdowns on outside click
        window.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.custom-width-picker') && !e.target.closest('.custom-width-dropdown')) {
                document.querySelectorAll('.custom-width-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                });
            }
        });

        // ── Dragging Logic ──
        const header = this.dialog.querySelector('.settings-header');
        header.onmousedown = (e) => {
            // Don't drag if clicking the close button
            if (e.target.closest('.settings-close-btn') || e.target.id === 'settings-close') return;

            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            const rect = this.dialog.getBoundingClientRect();
            this.initialDialogX = rect.left;
            this.initialDialogY = rect.top;

            document.body.style.userSelect = 'none'; // Prevent text selection
        };

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;

            let newX = this.initialDialogX + dx;
            let newY = this.initialDialogY + dy;

            // Keep within viewport
            newX = Math.max(0, Math.min(window.innerWidth - this.dialog.offsetWidth, newX));
            newY = Math.max(0, Math.min(window.innerHeight - this.dialog.offsetHeight, newY));

            this.dialog.style.left = newX + 'px';
            this.dialog.style.top = newY + 'px';
            this.dialog.style.transform = 'none'; // Overwrite centering transform
            this.hasBeenPositioned = true;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            document.body.style.userSelect = '';
        });

        // ── Tab Switching Logic ──
        this.dialog.querySelectorAll('.settings-tab').forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });

        // ── Inline Title Editing ──
        const titleEditBtn = document.getElementById('settings-title-edit');
        const titleSpan = document.getElementById('settings-tool-name');
        const titleInput = document.getElementById('settings-tool-name-input');

        if (titleEditBtn && titleSpan && titleInput) {
            const header = this.dialog.querySelector('.settings-header');

            titleEditBtn.onclick = () => {
                header.classList.add('editing-title');
                titleSpan.style.display = 'none';
                titleInput.style.display = 'inline-block';
                titleInput.value = this.tempStyle.name || titleSpan.textContent;
                titleInput.focus();
                titleInput.select();
            };

            titleInput.onblur = () => {
                header.classList.remove('editing-title');
                this.tempStyle.name = titleInput.value;
                titleSpan.textContent = titleInput.value;
                titleSpan.style.display = 'inline-block';
                titleInput.style.display = 'none';
                if (window.sidebarController) {
                    window.sidebarController.updateObjectTree();
                }
            };

            titleInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    titleInput.blur();
                } else if (e.key === 'Escape') {
                    titleInput.value = this.tempStyle.name || titleSpan.textContent;
                    titleInput.blur();
                }
            };
        }

        // ── Opacity label updates ──
        const shapeOp = document.getElementById('shape-opacity');
        const shapeOpLabel = document.getElementById('shape-opacity-label');
        if (shapeOp) shapeOp.oninput = (e) => {
            const val = +e.target.value / 100;
            if (this.activeTool && this.activeTool.type === 'table') {
                this.tempStyle.backgroundOpacity = val;
            } else {
                this.tempStyle.opacity = val;
            }
            shapeOpLabel.textContent = e.target.value + '%';
            this.updatePreview();
        };

        // ── Line section ──
        // (Handled by AdvancedLineSetting)


        // ── Shape section ──
        // (Border handled by AdvancedLineSetting)
        // Shape section handled by AdvancedLineSetting in syncUIToState

        document.getElementById('shape-text-bold').onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontWeight = e.currentTarget.classList.contains('active') ? 'bold' : 'normal';
            this.updatePreview();
        };
        document.getElementById('shape-text-italic').onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontStyle = e.currentTarget.classList.contains('active') ? 'italic' : 'normal';
            this.updatePreview();
        };
        const globalVis = document.getElementById('global-visibility');
        if (globalVis) {
            globalVis.onchange = (e) => {
                this.tempStyle.visibility = e.target.checked;
                this.updatePreview();
            };
        }

        // Text section handled by AdvancedLineSetting in syncUIToState

        document.getElementById('text-bold').onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontWeight = e.currentTarget.classList.contains('active') ? 'bold' : 'normal';
            this.updatePreview();
        };
        document.getElementById('text-italic').onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontStyle = e.currentTarget.classList.contains('active') ? 'italic' : 'normal';
            this.updatePreview();
        };
        // (Handled by AdvancedLineSetting)


        // Grid
        const fibGridShow = document.getElementById('fib-grid-show');
        if (fibGridShow) fibGridShow.onchange = (e) => { this.tempStyle.gridShow = e.target.checked; this.updatePreview(); };
        const fibGridColor = document.getElementById('fib-grid-color');
        if (fibGridColor) fibGridColor.oninput = (e) => { this.tempStyle.gridColor = e.target.value; this.updatePreview(); };
        this._initCustomWidthPicker('fib-grid-width-picker', 'gridWidth', 'fib-grid-color');
        const fibGridDash = document.getElementById('fib-grid-dash');
        if (fibGridDash) fibGridDash.onchange = (e) => { this.tempStyle.gridDash = e.target.value; this.updatePreview(); };

        // Labels
        const fibPriceLabelsLeft = document.getElementById('fib-price-labels-left');
        if (fibPriceLabelsLeft) fibPriceLabelsLeft.onchange = (e) => { this.tempStyle.priceLabelsLeft = e.target.checked; this.updatePreview(); };
        const fibPriceLabelsRight = document.getElementById('fib-price-labels-right');
        if (fibPriceLabelsRight) fibPriceLabelsRight.onchange = (e) => { this.tempStyle.priceLabelsRight = e.target.checked; this.updatePreview(); };
        const fibTimeLabelsTop = document.getElementById('fib-time-labels-top');
        if (fibTimeLabelsTop) fibTimeLabelsTop.onchange = (e) => { this.tempStyle.timeLabelsTop = e.target.checked; this.updatePreview(); };
        const fibTimeLabelsBottom = document.getElementById('fib-time-labels-bottom');
        if (fibTimeLabelsBottom) fibTimeLabelsBottom.onchange = (e) => { this.tempStyle.timeLabelsBottom = e.target.checked; this.updatePreview(); };

        const fibBgShow = document.getElementById('fib-background-show');
        if (fibBgShow) fibBgShow.onchange = (e) => { this.tempStyle.backgroundShow = e.target.checked; this.updatePreview(); };
        // Fibonacci Background handled by AdvancedLineSetting in syncUIToState

        // Fibonacci Background handled by AdvancedLineSetting in syncUIToState

        const fibReverse = document.getElementById('fib-reverse');
        if (fibReverse) fibReverse.onchange = (e) => { this.tempStyle.reverse = e.target.checked; this.updatePreview(); };
        const fibFontSize = document.getElementById('fib-font-size');
        if (fibFontSize) fibFontSize.onchange = (e) => { this.tempStyle.fontSize = e.target.value + 'px'; this.updatePreview(); };

        // Trend Line
        const fibTrendShow = document.getElementById('fib-trendline-show');
        if (fibTrendShow) fibTrendShow.onchange = (e) => { this.tempStyle.trendLineShow = e.target.checked; this.updatePreview(); };
        
        const fibSpiralCCW = document.getElementById('fib-spiral-ccw');
        if (fibSpiralCCW) fibSpiralCCW.onchange = (e) => { this.tempStyle.counterClockwise = e.target.checked; this.updatePreview(); };

        // Levels Line
        this._initCustomWidthPicker('fib-line-width-picker', 'width', null); // Pass null if no specific color picker
        const fibLineDash = document.getElementById('fib-line-dash');
        if (fibLineDash) fibLineDash.onchange = (e) => { this.tempStyle.dash = this._keyToDash(e.target.value); this.updatePreview(); };


        // Gann Fan specific listeners
        const gannFanBgShow = document.getElementById('gann-fan-background-show');
        if (gannFanBgShow) gannFanBgShow.onchange = (e) => { this.tempStyle.backgroundShow = e.target.checked; this.updatePreview(); };
        const gannFanBgOp = document.getElementById('gann-fan-background-opacity');
        if (gannFanBgOp) gannFanBgOp.oninput = (e) => {
            this.tempStyle.backgroundOpacity = +e.target.value / 100;
            const label = document.getElementById('gann-fan-background-opacity-label');
            if (label) label.textContent = e.target.value + '%';
            this.updatePreview();
        };
        const gannFanLabelsShow = document.getElementById('gann-fan-labels-show');
        if (gannFanLabelsShow) gannFanLabelsShow.onchange = (e) => { this.tempStyle.labelsShow = e.target.checked; this.updatePreview(); };

        // Labels
        ['left', 'right', 'top', 'bottom'].forEach(side => {
            const el = document.getElementById(`gann-labels-${side}`);
            if (el) el.onchange = (e) => {
                const key = `labelsShow${side.charAt(0).toUpperCase() + side.slice(1)}`;
                this.tempStyle[key] = e.target.checked;
                this.updatePreview();
            };
        });

        // Gann backgrounds handled by AdvancedLineSetting in syncUIToState


        const gannFontSize = document.getElementById('gann-font-size');
        if (gannFontSize) gannFontSize.oninput = (e) => { this.tempStyle.fontSize = +e.target.value; this.updatePreview(); };

        // ── Range section ──
        // (Line settings handled by AdvancedLineSetting)

        const rangeFillColor = document.getElementById('range-fill-color');
        if (rangeFillColor) rangeFillColor.oninput = (e) => { this.tempStyle.fillColor = e.target.value; this.updatePreview(); };
        // Range background handled by AdvancedLineSetting in syncUIToState


        // Price Range text handled by AdvancedLineSetting in syncUIToState
        const rangeTextColor = document.getElementById('range-text-color');

        const rangeFontSize = document.getElementById('range-font-size');
        if (rangeFontSize) rangeFontSize.onchange = (e) => { this.tempStyle.fontSize = e.target.value; this.updatePreview(); };

        const rangeLabelBg = document.getElementById('range-label-bg-color');
        if (rangeLabelBg) rangeLabelBg.oninput = (e) => { this.tempStyle.labelBackgroundColor = e.target.value; this.updatePreview(); };

        // Stats toggles
        ['price', 'percent', 'time', 'bars', 'volume'].forEach(key => {
            const el = document.getElementById('range-stat-' + key);
            if (el) el.onchange = (e) => {
                if (!this.tempStyle.stats) {
                    this.tempStyle.stats = {
                        showPrice: document.getElementById('range-stat-price').checked,
                        showPercent: document.getElementById('range-stat-percent').checked,
                        showTime: document.getElementById('range-stat-time').checked,
                        showBars: document.getElementById('range-stat-bars').checked,
                        showVolume: document.getElementById('range-stat-volume').checked
                    };
                }
                const internalKey = 'show' + key.charAt(0).toUpperCase() + key.slice(1);
                this.tempStyle.stats[internalKey] = e.target.checked;
                this.updatePreview();
            };
        });

        // Extend
        const fibExtendLeft = document.getElementById('fib-extend-left');
        if (fibExtendLeft) fibExtendLeft.onchange = (e) => {
            const right = document.getElementById('fib-extend-right').checked;
            this.tempStyle.extend = e.target.checked ? (right ? 'both' : 'left') : (right ? 'right' : 'none');
            this.updatePreview();
        };
        const fibExtendRight = document.getElementById('fib-extend-right');
        if (fibExtendRight) fibExtendRight.onchange = (e) => {
            const left = document.getElementById('fib-extend-left').checked;
            this.tempStyle.extend = e.target.checked ? (left ? 'both' : 'right') : (left ? 'left' : 'none');
            this.updatePreview();
        };

        // Labels
        const fibLabelsShow = document.getElementById('fib-labels-show');
        if (fibLabelsShow) fibLabelsShow.onchange = (e) => { this.tempStyle.labelsShow = e.target.checked; this.updatePreview(); };
        const fibLabelsPos = document.getElementById('fib-labels-position');
        if (fibLabelsPos) fibLabelsPos.onchange = (e) => { this.tempStyle.labelsPosition = e.target.value; this.updatePreview(); };
        const fibLabelsVPos = document.getElementById('fib-labels-v-position');
        if (fibLabelsVPos) fibLabelsVPos.onchange = (e) => { this.tempStyle.labelsVerticalPosition = e.target.value; this.updatePreview(); };

        // ── Table section ──
        // ── Table section ──
        const getTargetCol = () => (this.activeTool && this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.col : this.activeTool.cols - 1;
        const getTargetRow = () => (this.activeTool && this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.row : this.activeTool.rows - 1;

        document.getElementById('table-add-col-left').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table') {
                const targetCol = (this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.col : 0;
                this.activeTool.cells.forEach(r => r.splice(targetCol, 0, ''));
                this.activeTool.manualColWidths.splice(targetCol, 0, 80);
                this.activeTool.colWidths.splice(targetCol, 0, 80);
                this.activeTool.cols++;
                if (this.activeTool._lastClickedCell && targetCol <= this.activeTool._lastClickedCell.col) this.activeTool._lastClickedCell.col++;
                this._syncTableStructuralStyle();
            }
        };

        document.getElementById('table-add-col-right').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table') {
                const targetCol = (this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.col + 1 : this.activeTool.cols;
                this.activeTool.cells.forEach(r => r.splice(targetCol, 0, ''));
                this.activeTool.manualColWidths.splice(targetCol, 0, 80);
                this.activeTool.colWidths.splice(targetCol, 0, 80);
                this.activeTool.cols++;
                this._syncTableStructuralStyle();
            }
        };

        document.getElementById('table-remove-col').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table' && this.activeTool.cols > 1) {
                const targetCol = getTargetCol();
                this.activeTool.cells.forEach(r => r.splice(targetCol, 1));
                this.activeTool.manualColWidths.splice(targetCol, 1);
                this.activeTool.colWidths.splice(targetCol, 1);
                this.activeTool.cols--;
                if (this.activeTool._lastClickedCell) {
                    if (this.activeTool._lastClickedCell.col === targetCol) this.activeTool._lastClickedCell = null;
                    else if (this.activeTool._lastClickedCell.col > targetCol) this.activeTool._lastClickedCell.col--;
                }
                this._syncTableStructuralStyle();
            }
        };

        document.getElementById('table-add-row-above').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table') {
                const targetRow = (this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.row : 0;
                this.activeTool.cells.splice(targetRow, 0, Array(this.activeTool.cols).fill(''));
                this.activeTool.manualRowHeights.splice(targetRow, 0, 30);
                this.activeTool.rowHeights.splice(targetRow, 0, 30);
                this.activeTool.rows++;
                if (this.activeTool._lastClickedCell && targetRow <= this.activeTool._lastClickedCell.row) this.activeTool._lastClickedCell.row++;
                this._syncTableStructuralStyle();
            }
        };

        document.getElementById('table-add-row-below').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table') {
                const targetRow = (this.activeTool._lastClickedCell) ? this.activeTool._lastClickedCell.row + 1 : this.activeTool.rows;
                this.activeTool.cells.splice(targetRow, 0, Array(this.activeTool.cols).fill(''));
                this.activeTool.manualRowHeights.splice(targetRow, 0, 30);
                this.activeTool.rowHeights.splice(targetRow, 0, 30);
                this.activeTool.rows++;
                this._syncTableStructuralStyle();
            }
        };

        document.getElementById('table-remove-row').onclick = () => {
            if (this.activeTool && this.activeTool.type === 'table' && this.activeTool.rows > 1) {
                const targetRow = getTargetRow();
                this.activeTool.cells.splice(targetRow, 1);
                this.activeTool.manualRowHeights.splice(targetRow, 1);
                this.activeTool.rowHeights.splice(targetRow, 1);
                this.activeTool.rows--;
                if (this.activeTool._lastClickedCell) {
                    if (this.activeTool._lastClickedCell.row === targetRow) this.activeTool._lastClickedCell = null;
                    else if (this.activeTool._editingCell.row > targetRow) this.activeTool._editingCell.row--;
                }
                this._syncTableStructuralStyle();
            }
        };
        // ── Position section ──
        const posAccountSize = document.getElementById('pos-account-size');
        if (posAccountSize) posAccountSize.oninput = (e) => { this.tempStyle.accountSize = Math.round((+e.target.value) * 100) / 100; this.updatePreview(); };
        const posAccountCurrency = document.getElementById('pos-account-currency');
        if (posAccountCurrency) posAccountCurrency.onchange = (e) => {
            const cur = e.target.value;
            this.tempStyle.accountCurrency = cur;
            const riskCurOpt = document.getElementById('pos-risk-type-currency');
            if (riskCurOpt) riskCurOpt.textContent = cur;
            this.updatePreview();
        };
        const posLotSize = document.getElementById('pos-lot-size');
        if (posLotSize) posLotSize.oninput = (e) => { this.tempStyle.lotSize = Math.round((+e.target.value) * 100) / 100; this.updatePreview(); };
        const posRisk = document.getElementById('pos-risk');
        if (posRisk) posRisk.oninput = (e) => { this.tempStyle.risk = Math.round((+e.target.value) * 100) / 100; this.updatePreview(); };
        const posRiskType = document.getElementById('pos-risk-type');
        if (posRiskType) posRiskType.onchange = (e) => { this.tempStyle.riskType = e.target.value; this.updatePreview(); };
        const posLeverage = document.getElementById('pos-leverage');
        if (posLeverage) posLeverage.oninput = (e) => { this.tempStyle.leverage = +e.target.value; this.updatePreview(); };
        const posQtyPrec = document.getElementById('pos-qty-precision');
        if (posQtyPrec) posQtyPrec.onchange = (e) => { this.tempStyle.qtyPrecision = +e.target.value; this.updatePreview(); };

        const updatePosLevels = () => {
            if (!this.activeTool) return;
            const tickSize = this.activeTool.chart.tickSize || 0.01;
            const entry = Math.round((+document.getElementById('pos-entry-price').value) * 100) / 100;
            const tpTicks = +document.getElementById('pos-tp-ticks').value;
            const slTicks = +document.getElementById('pos-sl-ticks').value;

            const isLong = this.activeTool.type === 'long-position';
            const tpPrice = Math.round((entry + (isLong ? (tpTicks * tickSize) : -(tpTicks * tickSize))) * 100) / 100;
            const slPrice = Math.round((entry + (isLong ? -(slTicks * tickSize) : (slTicks * tickSize))) * 100) / 100;

            document.getElementById('pos-tp-price').value = tpPrice.toFixed(2);
            document.getElementById('pos-sl-price').value = slPrice.toFixed(2);

            this.activeTool.points[0].price = entry;
            this.activeTool.points[1].price = tpPrice;
            this.activeTool.points[2].price = slPrice;

            if (this.activeTool.points[3]) {
                this.activeTool.points[3].price = entry;
            }

            this.updatePreview();
        };

        const updatePosTicks = () => {
            if (!this.activeTool) return;
            const tickSize = this.activeTool.chart.tickSize || 0.01;
            const entry = Math.round((+document.getElementById('pos-entry-price').value) * 100) / 100;
            const tpPrice = Math.round((+document.getElementById('pos-tp-price').value) * 100) / 100;
            const slPrice = Math.round((+document.getElementById('pos-sl-price').value) * 100) / 100;

            document.getElementById('pos-entry-price').value = entry.toFixed(2);
            document.getElementById('pos-tp-price').value = tpPrice.toFixed(2);
            document.getElementById('pos-sl-price').value = slPrice.toFixed(2);

            document.getElementById('pos-tp-ticks').value = Math.round(Math.abs(tpPrice - entry) / tickSize);
            document.getElementById('pos-sl-ticks').value = Math.round(Math.abs(slPrice - entry) / tickSize);

            this.activeTool.points[0].price = entry;
            this.activeTool.points[1].price = tpPrice;
            this.activeTool.points[2].price = slPrice;

            if (this.activeTool.points[3]) {
                this.activeTool.points[3].price = entry;
            }

            this.updatePreview();
        };

        ['pos-entry-price', 'pos-tp-price', 'pos-sl-price'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = updatePosTicks;
        });
        ['pos-tp-ticks', 'pos-sl-ticks'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = updatePosLevels;
        });

        // Colors handled by AdvancedLineSetting in syncUIToState

        const posFontSize = document.getElementById('pos-font-size');
        if (posFontSize) posFontSize.onchange = (e) => { this.tempStyle.fontSize = e.target.value; this.updatePreview(); };

        // Stats checkboxes
        const posStatKeys = ['tpPrice', 'tpPercent', 'tpTicks', 'tpAmount', 'tpPL', 'slPrice', 'slPercent', 'slTicks', 'slAmount', 'slPL', 'qty', 'rr', 'openClosePL', 'margin'];
        posStatKeys.forEach(k => {
            const el = document.getElementById('stat-' + k);
            if (el) el.onchange = (e) => {
                if (!this.tempStyle.stats) this.tempStyle.stats = JSON.parse(JSON.stringify(this.activeTool.style.stats || {}));
                this.tempStyle.stats[k] = e.target.checked;
                this.updatePreview();
            };
        });
        const posCompact = document.getElementById('pos-compact-stats');
        if (posCompact) posCompact.onchange = (e) => { this.tempStyle.compactStatsMode = e.target.checked; this.updatePreview(); };
        const posAlwaysShow = document.getElementById('pos-always-show');
        if (posAlwaysShow) posAlwaysShow.onchange = (e) => { this.tempStyle.alwaysShowStats = e.target.checked; this.updatePreview(); };

        // Forecast
        // (Line settings handled by AdvancedLineSetting)

        const fcSourceText = document.getElementById('fc-source-text');
        if (fcSourceText) fcSourceText.oninput = (e) => { this.tempStyle.sourceTextColor = e.target.value; this.updatePreview(); };
        const fcSourceBg = document.getElementById('fc-source-bg');
        if (fcSourceBg) fcSourceBg.oninput = (e) => { this.tempStyle.sourceBgColor = e.target.value; this.updatePreview(); };
        const fcSourceBorder = document.getElementById('fc-source-border');
        if (fcSourceBorder) fcSourceBorder.oninput = (e) => { this.tempStyle.sourceBorderColor = e.target.value; this.updatePreview(); };

        const fcTargetText = document.getElementById('fc-target-text');
        if (fcTargetText) fcTargetText.oninput = (e) => { this.tempStyle.targetTextColor = e.target.value; this.updatePreview(); };
        const fcTargetBg = document.getElementById('fc-target-bg');
        if (fcTargetBg) fcTargetBg.oninput = (e) => { this.tempStyle.targetBgColor = e.target.value; this.updatePreview(); };
        const fcTargetBorder = document.getElementById('fc-target-border');
        if (fcTargetBorder) fcTargetBorder.oninput = (e) => { this.tempStyle.targetBorderColor = e.target.value; this.updatePreview(); };

        const fcSuccessText = document.getElementById('fc-success-text');
        if (fcSuccessText) fcSuccessText.oninput = (e) => { this.tempStyle.successTextColor = e.target.value; this.updatePreview(); };
        const fcSuccessBg = document.getElementById('fc-success-bg');
        if (fcSuccessBg) fcSuccessBg.oninput = (e) => { this.tempStyle.successBgColor = e.target.value; this.updatePreview(); };

        const fcFailureText = document.getElementById('fc-failure-text');
        if (fcFailureText) fcFailureText.oninput = (e) => { this.tempStyle.failureTextColor = e.target.value; this.updatePreview(); };
        const fcFailureBg = document.getElementById('fc-failure-bg');
        if (fcFailureBg) fcFailureBg.oninput = (e) => { this.tempStyle.failureBgColor = e.target.value; this.updatePreview(); };

        // Bars Pattern handled by AdvancedLineSetting in syncUIToState

        const bpMode = document.getElementById('bp-mode');
        if (bpMode) bpMode.onchange = (e) => { this.tempStyle.mode = e.target.value; this.updatePreview(); };
        const bpMirrored = document.getElementById('bp-mirrored');
        if (bpMirrored) bpMirrored.onchange = (e) => { this.tempStyle.mirrored = e.target.checked; this.updatePreview(); };
        const bpFlipped = document.getElementById('bp-flipped');
        if (bpFlipped) bpFlipped.onchange = (e) => { this.tempStyle.flipped = e.target.checked; this.updatePreview(); };

        // ── Chart Patterns section ──
        // Chart Patterns handled by AdvancedLineSetting in syncUIToState

        const cpFontSize = document.getElementById('cp-font-size');
        if (cpFontSize) cpFontSize.onchange = (e) => { this.tempStyle.fontSize = e.target.value + 'px'; this.updatePreview(); };
        const cpBold = document.getElementById('cp-bold');
        if (cpBold) cpBold.onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontWeight = e.currentTarget.classList.contains('active') ? 'bold' : 'normal';
            this.updatePreview();
        };
        const cpItalic = document.getElementById('cp-italic');
        if (cpItalic) cpItalic.onclick = (e) => {
            e.currentTarget.classList.toggle('active');
            this.tempStyle.fontStyle = e.currentTarget.classList.contains('active') ? 'italic' : 'normal';
            this.updatePreview();
        };
        // (Border handled by AdvancedLineSetting)
        const cpBgShow = document.getElementById('cp-background-show');
        if (cpBgShow) cpBgShow.onchange = (e) => { this.tempStyle.backgroundShow = e.target.checked; this.updatePreview(); };
        const cpBgColor = document.getElementById('cp-background-color');
        if (cpBgColor) cpBgColor.oninput = (e) => { this.tempStyle.fillColor = e.target.value; this.updatePreview(); };
        const cpBgOpacity = document.getElementById('cp-background-opacity');
        const cpBgOpacityLabel = document.getElementById('cp-background-opacity-label');
        if (cpBgOpacity) cpBgOpacity.oninput = (e) => {
            const val = +e.target.value / 100;
            this.tempStyle.opacity = val;
            if (cpBgOpacityLabel) cpBgOpacityLabel.textContent = e.target.value + '%';
            this.updatePreview();
        };

        // ── Elliott Waves section ──
        // Elliott Waves handled by AdvancedLineSetting in syncUIToState


        // ── Cycles section ──
        // (Line handled by AdvancedLineSetting)

        // ── Pitchfork section ──
        const pfExtend = document.getElementById('pitchfork-extend');
        if (pfExtend) pfExtend.onchange = (e) => { this.tempStyle.extendLines = e.target.checked; this.updatePreview(); };

        // (Median handled by AdvancedLineSetting)

        const pfBgShow = document.getElementById('pitchfork-background-show');
        if (pfBgShow) pfBgShow.onchange = (e) => { this.tempStyle.backgroundShow = e.target.checked; this.updatePreview(); };
        const pfBgOp = document.getElementById('pitchfork-background-opacity');
        if (pfBgOp) pfBgOp.oninput = (e) => {
            this.tempStyle.backgroundOpacity = +e.target.value / 100;
            document.getElementById('pitchfork-background-opacity-label').textContent = e.target.value + '%';
            this.updatePreview();
        };

        const pfMode = document.getElementById('pitchfork-mode');
        if (pfMode) pfMode.onchange = (e) => {
            this.activeTool.type = e.target.value;
            this.updatePreview();
        };
    }

    _syncTableStructuralStyle() {
        const t = this.activeTool;
        t.style.rows = t.rows;
        t.style.cols = t.cols;
        t.style.cells = t.cells.map(r => [...r]);
        t.style.rowHeights = [...t.manualRowHeights];
        t.style.colWidths = [...t.manualColWidths];

        // Update tempStyle to reflect changes for backup/apply mechanism
        this.tempStyle.rows = t.rows;
        this.tempStyle.cols = t.cols;
        this.tempStyle.cells = t.cells.map(r => [...r]);
        this.tempStyle.rowHeights = [...t.manualRowHeights];
        this.tempStyle.colWidths = [...t.manualColWidths];

        t.chart.markToolDirty(t, 'update');
        this.updatePreview();
    }

    switchTab(tabId) {
        // Toggle active tab class
        this.dialog.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        // Toggle active view class
        this.dialog.querySelectorAll('.settings-view').forEach(v => {
            v.classList.toggle('active', v.id === `settings-view-${tabId}`);
        });
    }

    applyCategory(category) {
        // Style tab internal sections
        ['line', 'shape', 'fibonacci', 'gann', 'pitchfork', 'table', 'position', 'range', 'forecast', 'bars-pattern', 'chart-patterns', 'elliott-waves', 'cycles'].forEach(s => {
            const el = document.getElementById(`settings-section-${s}`);
            if (el) el.style.display = (s === category) ? '' : 'none';
        });

        // For pin, sign-post, flag-mark: hide Border UI (Price label now has border)
        const NO_BORDER_TOOLS = ['pin', 'sign-post', 'flag-mark'];
        const isNoBorderTool = NO_BORDER_TOOLS.includes(this.activeTool.type);
        const borderTitle = document.getElementById('shape-border-title');
        const borderRow = document.getElementById('shape-border-row');
        if (borderTitle) borderTitle.style.display = isNoBorderTool ? 'none' : '';
        if (borderRow) borderRow.style.display = isNoBorderTool ? 'none' : '';


        // Specialize SignPost: hide Background too
        const shapeBackgroundRow = document.getElementById('shape-background-row');
        if (shapeBackgroundRow) {
            shapeBackgroundRow.style.display = this.activeTool.type === 'sign-post' ? 'none' : '';
        }

        // Hide border width for specific tools (e.g. Price Label)
        const shapeBorderWidth = document.getElementById('shape-border-width');
        if (shapeBorderWidth) {
            shapeBorderWidth.style.display = this.activeTool.type === 'price-label' ? 'none' : '';
        }

        // For comment and callout: hide Bold/Italic font options (Price label now has font styles)
        const NO_FONT_STYLE_TOOLS = ['comment', 'callout'];
        const isNoFontStyleTool = NO_FONT_STYLE_TOOLS.includes(this.activeTool.type);
        const textStyleToggles = document.getElementById('text-style-toggles');
        const shapeTextStyleToggles = document.getElementById('shape-text-style-toggles');
        if (textStyleToggles) textStyleToggles.style.display = isNoFontStyleTool ? 'none' : '';
        if (shapeTextStyleToggles) shapeTextStyleToggles.style.display = isNoFontStyleTool ? 'none' : '';

        // Hide Opacity for specific text tools (Except Table)
        const NO_OPACITY_TOOLS = ['sign-post', 'flag-mark'];
        const isNoOpacityTool = NO_OPACITY_TOOLS.includes(this.activeTool.type);
        const shapeOpacity = document.getElementById('shape-opacity');
        const shapeOpacityLabel = document.getElementById('shape-opacity-label');
        if (shapeOpacity) shapeOpacity.style.display = isNoOpacityTool ? 'none' : '';
        if (shapeOpacityLabel) shapeOpacityLabel.style.display = isNoOpacityTool ? 'none' : '';

        // Hide Width for arrow-mark-up and arrow-mark-down (fixed sizes, no width setting)
        const NO_WIDTH_TOOLS = ['arrow-mark-up', 'arrow-mark-down'];
        const lineWidthRow = document.getElementById('line-width-row');
        if (lineWidthRow) lineWidthRow.style.display = NO_WIDTH_TOOLS.includes(this.activeTool.type) ? 'none' : '';

        // Show opacity for highlighter in line section
        const lineOpacity = document.getElementById('line-opacity');
        const lineOpacityLabel = document.getElementById('line-opacity-label');
        if (lineOpacity && lineOpacityLabel) {
            const isHighlighter = this.activeTool.type === 'highlighter';
            lineOpacity.style.display = isHighlighter ? '' : 'none';
            lineOpacityLabel.style.display = isHighlighter ? '' : 'none';
        }

        // Chart Patterns: hide background for specific tools
        const cpBackgroundRow = document.getElementById('cp-background-row');
        if (cpBackgroundRow) {
            const noBgTools = ['abcd-pattern', 'three-drives-pattern'];
            cpBackgroundRow.style.display = noBgTools.includes(this.activeTool.type) ? 'none' : '';
        }

        // Internal text sections
        const textSection = document.getElementById('settings-section-text');
        if (textSection) textSection.style.display = (category === 'text' || category === 'table') ? '' : 'none';

        const textContentArea = document.getElementById('settings-text-content');
        if (textContentArea) {
            textContentArea.style.display = (this.activeTool.type === 'table') ? 'none' : '';
        }

        const shapeTextSub = document.getElementById('settings-shape-text-subsection');
        if (shapeTextSub) shapeTextSub.style.display = (category === 'shape') ? '' : 'none';

        const shapeTextContent = document.getElementById('shape-text-content');
        if (shapeTextContent) {
            shapeTextContent.style.display = (this.activeTool.type === 'price-label') ? 'none' : '';
        }

        const textLineSub = document.getElementById('settings-text-line-subsection');
        if (textLineSub) {
            // Only callout and price-label have an actual "line" property worth styling in the Text tab
            const hasLine = category === 'text' && ['callout', 'price-label'].includes(this.activeTool.type);
            textLineSub.style.display = hasLine ? '' : 'none';
        }

        // Show/hide specific range stats groups
        if (category === 'range') {
            const priceGroup = document.getElementById('range-stats-price-group');
            const timeGroup = document.getElementById('range-stats-time-group');
            const type = this.activeTool.type;
            if (priceGroup) priceGroup.style.display = (type === 'price-range' || type === 'price-time-range') ? 'flex' : 'none';
            if (timeGroup) timeGroup.style.display = (type === 'time-range' || type === 'price-time-range') ? 'flex' : 'none';
        }

        // --- Global tabs visibility ---
        const styleTab = this.dialog.querySelector('.settings-tab[data-tab="style"]');
        const hasStyle = ['line', 'shape', 'fibonacci', 'gann', 'pitchfork', 'table', 'position', 'range', 'forecast', 'bars-pattern', 'chart-patterns', 'elliott-waves', 'cycles'].includes(category);
        if (styleTab) styleTab.style.display = hasStyle ? '' : 'none';

        const inputsTab = document.getElementById('tab-inputs');
        const isPosition = category === 'position';
        if (inputsTab) inputsTab.style.display = isPosition ? '' : 'none';

        const textTab = document.getElementById('tab-text');
        const supportsText = [
            'text', 'anchored-text', 'callout', 'pin', 'comment', 'sign-post',
            'rectangle', 'circle', 'ellipse', 'triangle', 'rotated-rectangle', 'price-label', 'table'
        ].includes(this.activeTool.type);
        if (textTab) textTab.style.display = supportsText ? '' : 'none';

        const coordsTab = this.dialog.querySelector('.settings-tab[data-tab="coords"]');
        const hasCoords = this.activeTool.points && this.activeTool.points.length > 0;
        if (coordsTab) coordsTab.style.display = hasCoords ? '' : 'none';

        const visTab = this.dialog.querySelector('.settings-tab[data-tab="visibility"]');
        if (visTab) visTab.style.display = '';

        // Default tab logic: if 'style' is hidden, find the first visible tab
        if (!hasStyle) {
            const firstVisibleTab = Array.from(this.dialog.querySelectorAll('.settings-tab'))
                .find(t => t.style.display !== 'none');
            if (firstVisibleTab) {
                this.switchTab(firstVisibleTab.dataset.tab);
            }
        } else {
            if (category === 'position') this.switchTab('inputs');
            else this.switchTab('style');
        }
    }

    show(tool) {
        this.activeTool = tool;
        // Backup original state
        this.backupStyle = JSON.parse(JSON.stringify(tool.style || {}));
        this.backupText = tool.text || tool.style?.text || '';
        this.backupName = tool.name || tool.constructor.name.replace('Tool', '');
        this.backupVisibility = JSON.parse(JSON.stringify(tool.visibility || {}));
        this.backupPoints = JSON.parse(JSON.stringify(tool.points || []));

        this.tempStyle = JSON.parse(JSON.stringify(this.backupStyle));
        this.tempStyle.text = this.backupText;
        this.tempStyle.name = this.backupName;
        this.tempStyle.visibilitySettings = JSON.parse(JSON.stringify(this.backupVisibility));

        const category = this.getCategory(tool.type);

        const titleSpan = document.getElementById('settings-tool-name');
        const titleInput = document.getElementById('settings-tool-name-input');
        if (titleSpan) titleSpan.textContent = this.tempStyle.name;
        if (titleSpan) titleSpan.style.display = 'inline-block';
        if (titleInput) titleInput.style.display = 'none';

        this.applyCategory(category);
        this.syncUIToState(category);

        // Show backdrop first to get dimensions
        this.backdrop.style.display = 'block';

        // Center dialog if not yet positioned
        if (!this.hasBeenPositioned) {
            const x = (window.innerWidth - this.dialog.offsetWidth) / 2;
            const y = (window.innerHeight - this.dialog.offsetHeight) / 2;
            this.dialog.style.left = x + 'px';
            this.dialog.style.top = y + 'px';
            this.dialog.style.transform = 'none';
            this.hasBeenPositioned = true;
        }
        this.isOpen = true;
    }

    syncUIToState(category) {
        const s = this.tempStyle;
        const fSize = parseInt(s.fontSize) || parseInt(s.font) || 12;
        // --- Specialized sync for specific tool types ---
        if (category === 'position') {
            // Inputs
            document.getElementById('pos-account-size').value = (s.accountSize !== undefined ? s.accountSize : 1000).toFixed(2).replace(/\.?0+$/, "");
            const cur = s.accountCurrency || 'USD';
            document.getElementById('pos-account-currency').value = cur;
            const riskCurOpt = document.getElementById('pos-risk-type-currency');
            if (riskCurOpt) riskCurOpt.textContent = cur;
            document.getElementById('pos-lot-size').value = (s.lotSize !== undefined ? s.lotSize : 1).toFixed(2).replace(/\.?0+$/, "");
            document.getElementById('pos-risk').value = (s.risk !== undefined ? s.risk : 25).toFixed(2).replace(/\.?0+$/, "");
            document.getElementById('pos-risk-type').value = s.riskType || 'percentage';
            document.getElementById('pos-leverage').value = s.leverage || 1;
            document.getElementById('pos-qty-precision').value = s.qtyPrecision !== undefined ? s.qtyPrecision : 3;

            const entry = this.activeTool.points[0].price;
            document.getElementById('pos-entry-price').value = entry.toFixed(2);

            const tpPrice = this.activeTool.points[1].price;
            const slPrice = this.activeTool.points[2].price;
            document.getElementById('pos-tp-price').value = tpPrice.toFixed(2);
            document.getElementById('pos-sl-price').value = slPrice.toFixed(2);

            const tickSize = this.activeTool.chart.tickSize || 0.01;
            document.getElementById('pos-tp-ticks').value = Math.round(Math.abs(tpPrice - entry) / tickSize);
            document.getElementById('pos-sl-ticks').value = Math.round(Math.abs(slPrice - entry) / tickSize);

            // Style
            const fillProfit = s.fillColor?.profit || '#22AB94';
            const fillLoss = s.fillColor?.loss || '#F23645';
            const tOp = s.targetOpacity !== undefined ? s.targetOpacity : 0.2;
            const sOp = s.stopOpacity !== undefined ? s.stopOpacity : 0.2;

            this._syncAdvancedLine('pos-target-color-container', { hexAlpha: this._rgbaToHex(fillProfit, tOp) }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                onUpdate: (val) => {
                    if (!this.tempStyle.fillColor) this.tempStyle.fillColor = JSON.parse(JSON.stringify(this.activeTool.style.fillColor || {}));
                    this.tempStyle.fillColor.profit = val.color;
                    this.tempStyle.targetOpacity = val.opacity;
                }
            });

            this._syncAdvancedLine('pos-stop-color-container', { hexAlpha: this._rgbaToHex(fillLoss, sOp) }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                onUpdate: (val) => {
                    if (!this.tempStyle.fillColor) this.tempStyle.fillColor = JSON.parse(JSON.stringify(this.activeTool.style.fillColor || {}));
                    this.tempStyle.fillColor.loss = val.color;
                    this.tempStyle.stopOpacity = val.opacity;
                }
            });

            this._syncAdvancedLine('pos-text-color-container', { hexAlpha: this._hexFromColor(s.textColor || '#ffffff') }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                showOpacity: false,
                onUpdate: (val) => {
                    this.tempStyle.textColor = val.color;
                }
            });
            document.getElementById('pos-font-size').value = parseInt(fSize);

            // Stats
            const stats = s.stats || {};
            const statKeys = ['tpPrice', 'tpPercent', 'tpTicks', 'tpAmount', 'tpPL', 'slPrice', 'slPercent', 'slTicks', 'slAmount', 'slPL', 'qty', 'rr', 'openClosePL', 'margin'];
            statKeys.forEach(k => {
                const el = document.getElementById('stat-' + k);
                if (el) el.checked = stats[k] !== false;
            });
            document.getElementById('pos-compact-stats').checked = !!s.compactStatsMode;
            document.getElementById('pos-always-show').checked = s.alwaysShowStats !== false;
        }

        if (category === 'gann-fan') {
            const bgOp = s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.2;
            this._syncAdvancedLine('gann-fan-background-container', { hexAlpha: this._rgbaToHex(s.fillColor || s.color || '#2962FF', bgOp) }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.fillColor = val.color;
                    this.tempStyle.backgroundOpacity = val.opacity;
                }
            });
            document.getElementById('gann-fan-background-show').checked = s.backgroundShow !== false;
            document.getElementById('gann-fan-labels-show').checked = s.labelsShow !== false;
        }

        if (category === 'gann-box' || category === 'gann-square') {
            ['h', 'v'].forEach(axis => {
                const bgShow = s[axis + 'BackgroundShow'] !== false;
                const bgOp = s[axis + 'BackgroundOpacity'] !== undefined ? s[axis + 'BackgroundOpacity'] : 0.2;
                const bgCol = s[axis + 'BackgroundFillColor'] || s.color || '#2962FF';
                
                this._syncAdvancedLine(`gann-${axis}-background-container`, { hexAlpha: this._rgbaToHex(bgCol, bgOp) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle[axis + 'BackgroundFillColor'] = val.color;
                        this.tempStyle[axis + 'BackgroundOpacity'] = val.opacity;
                    }
                });
                const showEl = document.getElementById(`gann-${axis}-background-show`);
                if (showEl) showEl.checked = bgShow;
            });

            // Specific background for Gann Square if it exists (some versions use shared h/v, some have a global one)
            const sqBgCont = document.getElementById('gann-square-background-container');
            if (sqBgCont) {
                const bgOp = s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.2;
                this._syncAdvancedLine('gann-square-background-container', { hexAlpha: this._rgbaToHex(s.fillColor || s.color || '#2962FF', bgOp) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle.fillColor = val.color;
                        this.tempStyle.backgroundOpacity = val.opacity;
                    }
                });
                const sqShowEl = document.getElementById('gann-square-background-show');
                if (sqShowEl) sqShowEl.checked = s.backgroundShow !== false;
            }
        }
        if (category === 'forecast') {
            this._syncAdvancedLine('fc-line-advanced', {
                hexAlpha: s.color || '#2962FF',
                thickness: s.width || 1,
                style: this._dashToKey(s.dash || [])
            }, {
                onUpdate: (val) => {
                    this.tempStyle.color = val.hexAlpha;
                    this.tempStyle.width = val.thickness;
                    this.tempStyle.dash = this._keyToDash(val.style);
                }
            });

            const fcStates = [
                { id: 'fc-source-text', prop: 'sourceTextColor', def: '#ffffff' },
                { id: 'fc-source-bg', prop: 'sourceBgColor', def: '#2962FF' },
                { id: 'fc-source-border', prop: 'sourceBorderColor', def: '#2962FF' },
                { id: 'fc-target-text', prop: 'targetTextColor', def: '#ffffff' },
                { id: 'fc-target-bg', prop: 'targetBgColor', def: '#2962FF' },
                { id: 'fc-target-border', prop: 'targetBorderColor', def: '#2962FF' },
                { id: 'fc-success-text', prop: 'successTextColor', def: '#ffffff' },
                { id: 'fc-success-bg', prop: 'successBgColor', def: '#22AB94' },
                { id: 'fc-failure-text', prop: 'failureTextColor', def: '#ffffff' },
                { id: 'fc-failure-bg', prop: 'failureBgColor', def: '#F23645' }
            ];

            fcStates.forEach(state => {
                this._syncAdvancedLine(state.id + '-container', { hexAlpha: this._hexFromColor(s[state.prop] || state.def) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    showOpacity: false,
                    onUpdate: (val) => {
                        this.tempStyle[state.prop] = val.color;
                    }
                });
            });
        }

        if (category === 'bars-pattern') {
            this._syncAdvancedLine('bp-color-container', { hexAlpha: this._hexFromColor(s.color || '#2962FF') }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                showOpacity: false,
                onUpdate: (val) => {
                    this.tempStyle.color = val.color;
                }
            });
            document.getElementById('bp-mode').value = s.mode || 'hl-bars';
            document.getElementById('bp-mirrored').checked = !!s.mirrored;
            document.getElementById('bp-flipped').checked = !!s.flipped;
        }

        // Name is now handled via the title inline editor
        const titleSpan = document.getElementById('settings-tool-name');
        if (titleSpan) titleSpan.textContent = s.name || this.activeTool.constructor.name.replace('Tool', '');

        if (category === 'line') {
            const isHighlighter = this.activeTool && this.activeTool.type === 'highlighter';
            const isArrowMarkup = this.activeTool && ['arrow-mark-up', 'arrow-mark-down', 'arrow-marker'].includes(this.activeTool.type);

            this._syncAdvancedLine('line-advanced', {
                hexAlpha: isHighlighter ? (s.highlighterColor || s.color) : s.color,
                thickness: isHighlighter ? Math.round((s.highlighterWidth || 20) / 5) : (s.width || 1),
                style: this._dashToKey(s.dash || [])
            }, {
                showThickness: !isHighlighter && !isArrowMarkup,
                showStyle: !isHighlighter && !isArrowMarkup,
                showOpacity: isHighlighter || isArrowMarkup,
                onUpdate: (val) => {
                    if (isHighlighter) {
                        this.tempStyle.highlighterColor = val.hexAlpha;
                        this.tempStyle.highlighterWidth = val.thickness * 5;
                    } else {
                        this.tempStyle.color = val.hexAlpha;
                        this.tempStyle.width = val.thickness;
                    }
                    this.tempStyle.dash = this._keyToDash(val.style);
                }
            });
        }

        if (category === 'range') {
            this._syncAdvancedLine('range-line-advanced', {
                hexAlpha: s.color || '#2962FF',
                thickness: s.width || 1,
                style: this._dashToKey(s.dash || [])
            }, {
                onUpdate: (val) => {
                    this.tempStyle.color = val.hexAlpha;
                    this.tempStyle.width = val.thickness;
                    this.tempStyle.dash = this._keyToDash(val.style);
                }
            });

            const fillCol = s.fillColor || '#2962FF';
            const bgOp = s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.2;

            this._syncAdvancedLine('range-fill-color-container', { hexAlpha: this._rgbaToHex(fillCol, bgOp) }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.fillColor = val.color;
                    this.tempStyle.backgroundOpacity = val.opacity;
                }
            });


            this._syncAdvancedLine('range-text-color-container', { hexAlpha: this._hexFromColor(s.textColor || '#ffffff') }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                showOpacity: false,
                onUpdate: (val) => {
                    this.tempStyle.textColor = val.color;
                }
            });
            document.getElementById('range-label-bg-color').value = this._hexFromColor(s.labelBackgroundColor || '#2962FF');

            // Stats selection
            const stats = s.stats || {
                showPrice: true, showPercent: true,
                showBars: true, showTime: true, showVolume: true
            };
            document.getElementById('range-stat-price').checked = stats.showPrice !== false;
            document.getElementById('range-stat-percent').checked = stats.showPercent !== false;

            document.getElementById('range-stat-time').checked = stats.showTime !== false;
            document.getElementById('range-stat-bars').checked = stats.showBars !== false;
            document.getElementById('range-stat-volume').checked = stats.showVolume !== false;
        }

        if (category === 'table') {
            // Show shape settings on table category
            const shapeSection = document.getElementById('settings-section-shape');
            if (shapeSection) shapeSection.style.display = '';
        }

        if (category === 'shape' || category === 'table') {
            const isNoBorderTool = ['pin', 'sign-post', 'flag-mark'].includes(this.activeTool.type);
            const fillColorEl = document.getElementById('shape-fill-color');
            const opacityEl = document.getElementById('shape-opacity');
            const opacityLabel = document.getElementById('shape-opacity-label');
            const textColorEl = document.getElementById('shape-text-color');
            const fontSizeEl = document.getElementById('shape-font-size');
            const textContentEl = document.getElementById('shape-text-content');
            const boldEl = document.getElementById('shape-text-bold');
            const italicEl = document.getElementById('shape-text-italic');

            if (!isNoBorderTool) {
                this._syncAdvancedLine('shape-border-advanced', {
                    hexAlpha: s.color || '#2962FF',
                    thickness: s.width || 1
                }, {
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle.color = val.hexAlpha;
                        this.tempStyle.width = val.thickness;
                    }
                });
            }

            const fillColorCont = document.getElementById('shape-fill-color-container');
            if (fillColorCont) {
                let defaultFill = undefined;
                if (this.activeTool.type === 'table') defaultFill = '#131722';
                let defaultOp = 1; // Default to 100% for annotation tools
                if (this.activeTool.type === 'table') defaultOp = 1;
                const bgOpTools = ['callout', 'comment', 'pin', 'price-label', 'table'];
                const useBgOp = bgOpTools.includes(this.activeTool.type) || s.backgroundOpacity !== undefined;
                const opVal = s.opacity !== undefined ? s.opacity : (s.backgroundOpacity !== undefined ? s.backgroundOpacity : defaultOp);

                this._syncAdvancedLine('shape-fill-color-container', { hexAlpha: this._rgbaToHex(s.fillColor || defaultFill, opVal) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle.fillColor = val.color;
                        if (useBgOp) {
                            this.tempStyle.backgroundOpacity = val.opacity;
                        } else {
                            this.tempStyle.opacity = val.opacity;
                        }
                        this.updatePreview();
                    }
                });
            }

            // Opacity & labels are now handled inside AdvancedLineSetting

            if (textColorEl) {
                this._syncAdvancedLine('shape-text-color-container', { hexAlpha: this._hexFromColor(s.textColor || s.color) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    showOpacity: false,
                    onUpdate: (val) => {
                        this.tempStyle.textColor = val.color;
                    }
                });
            }
            if (fontSizeEl) fontSizeEl.value = fSize;
            if (boldEl) boldEl.classList.toggle('active', s.fontWeight === 'bold');
            if (italicEl) italicEl.classList.toggle('active', s.fontStyle === 'italic');
            if (textContentEl) {
                textContentEl.value = s.text || '';
                textContentEl.oninput = (e) => {
                    this.tempStyle.text = e.target.value;
                    this.updatePreview();
                };
            }
        }

        if (category === 'text' || category === 'table') {
            const textColorEl_Text = document.getElementById('text-color-container');
            const fontSizeEl = document.getElementById('text-font-size');
            const boldEl = document.getElementById('text-bold');
            const italicEl = document.getElementById('text-italic');
            const textAlignEl = document.getElementById('text-align');
            const textContentEl = document.getElementById('settings-text-content');

            if (textColorEl_Text) {
                this._syncAdvancedLine('text-color-container', { hexAlpha: this._hexFromColor(s.textColor || s.color) }, {
                    compact: true,
                    showThickness: false,
                    showStyle: false,
                    showOpacity: false,
                    onUpdate: (val) => {
                        this.tempStyle.textColor = val.color;
                    }
                });
            }
            if (fontSizeEl) fontSizeEl.value = fSize;
            if (boldEl) boldEl.classList.toggle('active', s.fontWeight === 'bold');
            if (italicEl) italicEl.classList.toggle('active', s.fontStyle === 'italic');
            if (textAlignEl) textAlignEl.value = s.textAlign || 'center';
            if (textContentEl) {
                textContentEl.value = s.text || '';
                textContentEl.oninput = (e) => {
                    this.tempStyle.text = e.target.value;
                    this.updatePreview();
                };
            }
            if (category === 'text') {
                this._syncAdvancedLine('text-line-advanced', {
                    hexAlpha: s.color || '#2962FF',
                    thickness: s.width || 1
                }, {
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle.color = val.hexAlpha;
                        this.tempStyle.width = val.thickness;
                    }
                });
            }
        }

        if (category === 'fibonacci') {
            const levelsTitle = document.getElementById('fib-levels-title');
            if (levelsTitle) {
                levelsTitle.textContent = this.activeTool.type === 'fibonacci-fan' ? 'Price Levels' : 'Levels';
            }

            if (this.activeTool.type === 'fibonacci-fan') {
                // Specialized Fan UI
                const sectionTitle = document.getElementById('settings-section-fibonacci-title');
                if (sectionTitle) sectionTitle.textContent = 'Fibonacci Fan';
                const fanOnly = document.getElementById('fib-fan-settings');
                if (fanOnly) fanOnly.style.display = '';
                const fanOnly2 = document.getElementById('fib-fan-settings-price-labels');
                if (fanOnly2) fanOnly2.style.display = '';
                const fanTimeOnly = document.getElementById('fib-fan-time-settings');
                if (fanTimeOnly) fanTimeOnly.style.display = '';
                const regOnly = document.getElementById('fib-reg-settings');
                if (regOnly) regOnly.style.display = 'none';

                const gridShowEl = document.getElementById('fib-grid-show');
                if (gridShowEl) gridShowEl.checked = s.gridShow !== false;
                
                this._syncAdvancedLine('fib-grid-advanced', {
                    hexAlpha: s.gridColor || '#2962ff',
                    thickness: s.gridWidth || 1,
                    style: this._dashToKey(s.gridDash || 'solid')
                }, {
                    onUpdate: (val) => {
                        this.tempStyle.gridColor = val.hexAlpha;
                        this.tempStyle.gridWidth = val.thickness;
                        this.tempStyle.gridDash = this._keyToDash(val.style);
                    }
                });

                const labelsLeftEl = document.getElementById('fib-price-labels-left');
                const labelsRightEl = document.getElementById('fib-price-labels-right');
                const timeTopEl = document.getElementById('fib-time-labels-top');
                const timeBottomEl = document.getElementById('fib-time-labels-bottom');

                if (labelsLeftEl) labelsLeftEl.checked = (s.priceLabelsLeft !== undefined) ? !!s.priceLabelsLeft : true;
                if (labelsRightEl) labelsRightEl.checked = (s.priceLabelsRight !== undefined) ? !!s.priceLabelsRight : true;
                if (timeTopEl) timeTopEl.checked = (s.timeLabelsTop !== undefined) ? !!s.timeLabelsTop : true;
                if (timeBottomEl) timeBottomEl.checked = (s.timeLabelsBottom !== undefined) ? !!s.timeLabelsBottom : true;

                const bgShowEl = document.getElementById('fib-background-show');
                const bgColorEl = document.getElementById('fib-background-color');
                const opEl = document.getElementById('fib-opacity');
                const opLabel = document.getElementById('fib-opacity-label');

                if (bgShowEl) bgShowEl.checked = s.backgroundShow !== false;
                if (bgColorEl) bgColorEl.style.display = 'none';
                const opVal = Math.round((s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.1) * 100);
                if (opEl) opEl.value = opVal;
                if (opLabel) opLabel.textContent = opVal + '%';

                // Ensure levels are present
                if (!s.priceLevels && this.activeTool.getDefaultFanStyle) {
                    s.priceLevels = JSON.parse(JSON.stringify(this.activeTool.getDefaultFanStyle().priceLevels));
                }
                if (!s.timeLevels && this.activeTool.getDefaultFanStyle) {
                    s.timeLevels = JSON.parse(JSON.stringify(this.activeTool.getDefaultFanStyle().timeLevels));
                }

                // Price Levels List
                const priceContainer = document.getElementById('fib-price-levels');
                priceContainer.innerHTML = '';
                const priceLevels = s.priceLevels || [];
                const pHalf = Math.ceil(priceLevels.length / 2);
                const pGroupA = priceLevels.slice(0, pHalf);
                const pGroupB = priceLevels.slice(pHalf);

                const pColA = document.createElement('div');
                pColA.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';
                const pColB = document.createElement('div');
                pColB.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';

                const makePriceRow = (lvlObj, idxOffset) => {
                    const actualIdx = idxOffset;
                    const row = document.createElement('div');
                    row.className = 'settings-row';
                    const useAdvanced = ['fibonacci-circle', 'fibonacci-arcs', 'fibonacci-wedge', 'pitch-fan'].includes(this.activeTool.type);
                    
                    if (useAdvanced) {
                        const cpContainerId = `fib-level-color-${actualIdx}-${Math.random().toString(36).substr(2, 9)}`;
                    row.innerHTML = `
                                    <input type="checkbox" ${lvlObj.visibility !== false ? 'checked' : ''}>
                                    <div style="font-size: 12px; color: #d1d4dc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lvlObj.level}</div>
                                    <div id="${cpContainerId}"></div>
                                `;
                        const cb = row.querySelector('input[type="checkbox"]');
                        const cpContainer = row.querySelector(`#${cpContainerId}`);

                        const isFan = ['pitch-fan'].includes(this.activeTool.type);
                        const adv = new AdvancedLineSetting(cpContainer, {
                            compact: true,
                            showOpacity: false,
                            showStyle: isFan,
                            defaultColor: lvlObj.color || s.color,
                            defaultThickness: lvlObj.width || s.width || 1,
                            defaultStyle: lvlObj.dash || 'solid',
                            onChange: (val) => {
                                if (!this.tempStyle.priceLevels) this.tempStyle.priceLevels = JSON.parse(JSON.stringify(s.priceLevels));
                                this.tempStyle.priceLevels[actualIdx].color = val.hexAlpha;
                                this.tempStyle.priceLevels[actualIdx].width = val.thickness;
                                this.tempStyle.priceLevels[actualIdx].dash = val.style;
                                this.updatePreview();
                            }
                        });

                        cb.onchange = (e) => {
                            row.style.opacity = e.target.checked ? '1' : '0.4';
                            if (adv.container) adv.container.style.pointerEvents = e.target.checked ? 'auto' : 'none';
                            if (!this.tempStyle.priceLevels) this.tempStyle.priceLevels = JSON.parse(JSON.stringify(s.priceLevels));
                            this.tempStyle.priceLevels[actualIdx].visibility = e.target.checked;
                            this.updatePreview();
                        };
                    } else {
                        row.style.margin = '0';
                        row.style.gap = '4px';
                        row.innerHTML = `
                                    <input type="checkbox" ${lvlObj.visibility !== false ? 'checked' : ''}>
                                    <div style="font-size: 12px; color: #d1d4dc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lvlObj.level}</div>
                                    <input type="color" class="settings-color-picker" value="${this._hexFromColor(lvlObj.color)}">
                                `;
                        const cb = row.querySelector('input[type="checkbox"]');
                        const cp = row.querySelector('input[type="color"]');

                        cb.onchange = (e) => {
                            row.style.opacity = e.target.checked ? '1' : '0.4';
                            cp.disabled = !e.target.checked;
                            if (!this.tempStyle.priceLevels) this.tempStyle.priceLevels = JSON.parse(JSON.stringify(s.priceLevels));
                            this.tempStyle.priceLevels[actualIdx].visibility = e.target.checked;
                            this.updatePreview();
                        };
                        cp.oninput = (e) => {
                            if (!this.tempStyle.priceLevels) this.tempStyle.priceLevels = JSON.parse(JSON.stringify(s.priceLevels));
                            this.tempStyle.priceLevels[actualIdx].color = e.target.value;
                            this.updatePreview();
                        };
                    }
                    return row;
                };

                pGroupA.forEach((lvl, i) => pColA.appendChild(makePriceRow(lvl, i)));
                pGroupB.forEach((lvl, i) => pColB.appendChild(makePriceRow(lvl, i + pHalf)));

                priceContainer.style.display = 'flex';
                priceContainer.style.gap = '8px';
                priceContainer.appendChild(pColA);
                priceContainer.appendChild(pColB);

                // Time Levels List
                const timeContainer = document.getElementById('fib-time-levels');
                timeContainer.innerHTML = '';
                const timeLevels = s.timeLevels || [];

                // Split into two groups for compact display
                const tHalf = Math.ceil(timeLevels.length / 2);
                const tGroupA = timeLevels.slice(0, tHalf);
                const tGroupB = timeLevels.slice(tHalf);

                const tColA = document.createElement('div');
                tColA.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';
                const tColB = document.createElement('div');
                tColB.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';

                const makeTimeRow = (lvlObj, idxOffset) => {
                    const actualIdx = idxOffset;
                    const row = document.createElement('div');
                    row.className = 'settings-row';
                    row.style.margin = '0';
                    row.style.gap = '4px';
                    row.innerHTML = `
                                <input type="checkbox" ${lvlObj.visibility !== false ? 'checked' : ''}>
                                <div style="font-size: 12px; color: #d1d4dc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lvlObj.level}</div>
                                <input type="color" class="settings-color-picker" value="${this._hexFromColor(lvlObj.color)}">
                            `;
                    const cb = row.querySelector('input[type="checkbox"]');

                    const cp = row.querySelector('input[type="color"]');
                    cb.onchange = (e) => {
                        row.style.opacity = e.target.checked ? '1' : '0.4';
                        cp.disabled = !e.target.checked;
                        if (!this.tempStyle.timeLevels) this.tempStyle.timeLevels = JSON.parse(JSON.stringify(s.timeLevels));
                        this.tempStyle.timeLevels[actualIdx].visibility = e.target.checked;
                        this.updatePreview();
                    };
                    cp.oninput = (e) => {
                        if (!this.tempStyle.timeLevels) this.tempStyle.timeLevels = JSON.parse(JSON.stringify(s.timeLevels));
                        this.tempStyle.timeLevels[actualIdx].color = e.target.value;
                        this.updatePreview();
                    };
                    return row;
                };

                tGroupA.forEach((lvl, i) => tColA.appendChild(makeTimeRow(lvl, i)));
                tGroupB.forEach((lvl, i) => tColB.appendChild(makeTimeRow(lvl, i + tHalf)));

                timeContainer.style.display = 'flex';
                timeContainer.style.gap = '8px';
                timeContainer.appendChild(tColA);
                timeContainer.appendChild(tColB);

            } else {
                // Regular Fibonacci UI logic (fallback for other fib tools)
                const fanOnly = document.getElementById('fib-fan-settings');
                if (fanOnly) fanOnly.style.display = 'none';
                const fanOnly2 = document.getElementById('fib-fan-settings-price-labels');
                if (fanOnly2) fanOnly2.style.display = 'none';
                const fanTimeOnly = document.getElementById('fib-fan-time-settings');
                if (fanTimeOnly) fanTimeOnly.style.display = 'none';
                const regOnly = document.getElementById('fib-reg-settings');
                if (regOnly) regOnly.style.display = '';

                const isSpiral = this.activeTool.type === 'fibonacci-spiral';
                const isPitchFan = this.activeTool.type === 'pitch-fan';
                document.getElementById('fib-main-color-row').style.display = isSpiral ? '' : 'none';
                document.getElementById('fib-main-color').value = this._hexFromColor(s.color);
                document.getElementById('fib-spiral-ccw-row').style.display = isSpiral ? '' : 'none';
                document.getElementById('fib-spiral-ccw').checked = !!s.counterClockwise;


                const levelsTitle = document.getElementById('fib-levels-title');
                const levelContainer = document.getElementById('fib-price-levels');
                const defaultColors = {
                    0: '#ff0000', 0.236: '#ff9800', 0.25: '#ff9800', 0.382: '#4caf50', 0.5: '#00bcd4', 0.618: '#2196f3',
                    0.707: '#009688', 0.75: '#8bc34a', 0.786: '#9c27b0', 1: '#f44336', 1.5: '#2196f3', 1.618: '#e91e63', 1.75: '#673ab7', 2: '#8e24aa',
                    2.618: '#673ab7', 3.618: '#3f51b5', 4.236: '#009688'
                };
                if (levelsTitle) levelsTitle.style.display = isSpiral ? 'none' : '';
                if (levelContainer) levelContainer.style.display = isSpiral ? 'none' : 'flex';

                const dashKey = this._dashToKey(s.dash);
                const levelColors = s.levelColors || {};
                const visibleLevels = s.visibleLevels !== undefined ? s.visibleLevels : (typeof this.activeTool.getDefaultVisibleLevels === 'function' ? this.activeTool.getDefaultVisibleLevels() : (this.activeTool.levels || []).map(l => l.level));

                const isSpecializedFib = this.activeTool.type === 'fibonacci-wedge' || this.activeTool.type === 'fibonacci-arcs' || this.activeTool.type === 'fibonacci-time' || this.activeTool.type === 'fibonacci-circle' || isPitchFan;
                const isWedgeOrArcs = this.activeTool.type === 'fibonacci-wedge' || this.activeTool.type === 'fibonacci-arcs' || this.activeTool.type === 'fibonacci-circle' || isPitchFan;

                const currentLevels = (this.tempStyle.levels || this.activeTool.levels || [])
                    .filter(l => !isWedgeOrArcs || l.level !== 0);

                levelContainer.innerHTML = '';
                // Split into two groups for compact display
                const half = Math.ceil(currentLevels.length / 2);
                const groupA = currentLevels.slice(0, half);
                const groupB = currentLevels.slice(half);

                const colA = document.createElement('div');
                colA.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';
                const colB = document.createElement('div');
                colB.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';

                const makeRow = (lvlObj) => {
                    const level = lvlObj.level;
                    const row = document.createElement('div');
                    row.className = 'settings-row';
                    const isVisible = visibleLevels.includes(level);
                    const currentColor = levelColors[level] || defaultColors[level] || s.color;
                    const currentWidth = (this.tempStyle.levelWidths && this.tempStyle.levelWidths[level] !== undefined)
                        ? this.tempStyle.levelWidths[level]
                        : (s.levelWidths && s.levelWidths[level] !== undefined ? s.levelWidths[level] : 1);
                    const useAdvanced = ['fibonacci-circle', 'fibonacci-arcs', 'fibonacci-wedge', 'pitch-fan', 'fibonacci-retracement', 'fibonacci-extension', 'fibonacci-time', 'fibonacci-fan'].includes(this.activeTool.type);

                    if (useAdvanced) {
                        const cpContainerId = `fib-row-color-${level.toString().replace('.', '-')}-${Math.random().toString(36).substr(2, 9)}`;
                        row.innerHTML = `
                                       <input type="checkbox" ${isVisible ? 'checked' : ''}>
                                       <div style="font-size: 12px; color: #d1d4dc; flex: 1; white-space: nowrap;">${lvlObj.value || level}</div>
                                       <div id="${cpContainerId}"></div>
                                   `;
                        const cb = row.querySelector('input[type="checkbox"]');
                        const cpContainer = row.querySelector(`#${cpContainerId}`);

                        const isFan = ['pitch-fan', 'fibonacci-fan'].includes(this.activeTool.type);
                        const isRetracement = ['fibonacci-retracement', 'fibonacci-extension'].includes(this.activeTool.type);
                        const isFibTime = this.activeTool.type === 'fibonacci-time';
                        
                        const adv = new AdvancedLineSetting(cpContainer, {
                            compact: true,
                            showOpacity: true,
                            showThickness: !isRetracement || isFibTime,
                            showStyle: isFan,
                            defaultColor: currentColor,
                            defaultThickness: currentWidth,
                            defaultStyle: (this.tempStyle.levelDashes && this.tempStyle.levelDashes[level]) || (s.levelDashes && s.levelDashes[level]) || 'solid',
                            onChange: (val) => {
                                if (!this.tempStyle.levelColors) this.tempStyle.levelColors = { ...levelColors };
                                this.tempStyle.levelColors[level] = val.hexAlpha;
                                if (!this.tempStyle.levelWidths) this.tempStyle.levelWidths = s.levelWidths ? { ...s.levelWidths } : {};
                                this.tempStyle.levelWidths[level] = val.thickness;
                                if (!this.tempStyle.levelDashes) this.tempStyle.levelDashes = s.levelDashes ? { ...s.levelDashes } : {};
                                this.tempStyle.levelDashes[level] = val.style;
                                this.updatePreview();
                            }
                        });

                        const updateState = (checked) => {
                            row.style.opacity = checked ? '1' : '0.4';
                            if (adv.container) adv.container.style.pointerEvents = checked ? 'auto' : 'none';
                        };
                        updateState(cb.checked);

                        cb.onchange = (e) => {
                            updateState(e.target.checked);
                            if (this.tempStyle.visibleLevels === undefined) this.tempStyle.visibleLevels = [...visibleLevels];
                            if (e.target.checked) { if (!this.tempStyle.visibleLevels.includes(level)) this.tempStyle.visibleLevels.push(level); }
                            else { this.tempStyle.visibleLevels = this.tempStyle.visibleLevels.filter(l => l !== level); }
                            this.updatePreview();
                        };
                    } else {
                        row.innerHTML = `
                                       <input type="checkbox" ${isVisible ? 'checked' : ''}>
                                       <div style="font-size: 12px; color: #d1d4dc; flex: 1; white-space: nowrap;">${lvlObj.value || level}</div>
                                       <input type="color" class="settings-color-picker" value="${this._hexFromColor(currentColor)}">
                                       ${isSpecializedFib ? `
                                       <div class="custom-width-picker">
                                           <div class="custom-width-picker-line" style="height: ${currentWidth}px; background-color: ${this._hexFromColor(currentColor)};"></div>
                                           <div class="custom-width-dropdown">
                                               ${[1, 2, 3, 4].map(w => `
                                                   <div class="custom-width-option ${w === currentWidth ? 'active' : ''}" data-width="${w}">
                                                       <div class="line-hint" style="height: ${w}px; background-color: ${this._hexFromColor(currentColor)};"></div>
                                                   </div>
                                               `).join('')}
                                           </div>
                                       </div>` : ''}
                                   `;
                        const cb = row.querySelector('input[type="checkbox"]');
                        const cp = row.querySelector('input[type="color"]');
                        const picker = row.querySelector('.custom-width-picker');

                        const updateState = (checked) => {
                            row.style.opacity = checked ? '1' : '0.4';
                            cp.disabled = !checked;
                            if (picker) {
                                picker.style.pointerEvents = checked ? 'auto' : 'none';
                                picker.style.opacity = checked ? '1' : '0.5';
                            }
                        };
                        updateState(cb.checked);

                        cb.onchange = (e) => {
                            updateState(e.target.checked);
                            if (this.tempStyle.visibleLevels === undefined) this.tempStyle.visibleLevels = [...visibleLevels];
                            if (e.target.checked) { if (!this.tempStyle.visibleLevels.includes(level)) this.tempStyle.visibleLevels.push(level); }
                            else { this.tempStyle.visibleLevels = this.tempStyle.visibleLevels.filter(l => l !== level); }
                            this.updatePreview();
                        };
                        cp.oninput = (e) => {
                            if (!this.tempStyle.levelColors) this.tempStyle.levelColors = { ...levelColors };
                            this.tempStyle.levelColors[level] = e.target.value;
                            if (picker) {
                                const lines = picker.querySelectorAll('.custom-width-picker-line, .line-hint');
                                lines.forEach(l => l.style.backgroundColor = e.target.value);
                            }
                            this.updatePreview();
                        };

                        if (picker) {
                            const dropdown = picker.querySelector('.custom-width-dropdown');
                            const displayLine = picker.querySelector('.custom-width-picker-line');

                            picker.onclick = (e) => {
                                e.stopPropagation();
                                document.querySelectorAll('.custom-width-dropdown.show').forEach(d => {
                                    if (d !== dropdown) d.classList.remove('show');
                                });
                                dropdown.classList.toggle('show');
                            };

                            dropdown.querySelectorAll('.custom-width-option').forEach(opt => {
                                opt.onclick = (e) => {
                                    e.stopPropagation();
                                    const w = parseInt(opt.dataset.width);
                                    if (!this.tempStyle.levelWidths) {
                                        this.tempStyle.levelWidths = s.levelWidths ? { ...s.levelWidths } : {};
                                    }
                                    this.tempStyle.levelWidths[level] = w;
                                    displayLine.style.height = w + 'px';
                                    dropdown.querySelectorAll('.custom-width-option').forEach(o => o.classList.remove('active'));
                                    opt.classList.add('active');
                                    dropdown.classList.remove('show');
                                    this.updatePreview();
                                };
                            });
                        }
                    }
                    return row;
                };

                groupA.forEach(lvl => colA.appendChild(makeRow(lvl)));
                groupB.forEach(lvl => colB.appendChild(makeRow(lvl)));

                levelContainer.appendChild(colA);
                levelContainer.appendChild(colB);

                const isChannel = this.activeTool.type === 'fibonacci-channel';
                const isCircle = this.activeTool.type === 'fibonacci-circle';
                const isFibFan = this.activeTool.type === 'fibonacci-fan';
                // Median Row Logic
                const medianRow = document.getElementById('fib-median-row');
                if (medianRow) {
                    medianRow.style.display = isPitchFan ? '' : 'none';
                    if (isPitchFan) {
                        const mShow = document.getElementById('fib-median-show');
                        mShow.checked = true; mShow.style.display = 'none';

                        this._syncAdvancedLine('fib-median-advanced', {
                            hexAlpha: s.medianColor || '#ffffff',
                            thickness: s.medianWidth !== undefined ? s.medianWidth : 2
                        }, {
                            showStyle: false,
                            onUpdate: (val) => {
                                this.tempStyle.medianColor = val.hexAlpha;
                                this.tempStyle.medianWidth = val.thickness;
                            }
                        });
                    }
                }

                document.getElementById('fib-trendline-row').style.display = (isChannel || isSpiral || isPitchFan) ? 'none' : '';
                document.getElementById('fib-trendline-show').checked = s.trendLineShow !== false;
                
                this._syncAdvancedLine('fib-trendline-advanced', {
                    hexAlpha: s.trendLineColor || s.color
                }, {
                    showThickness: false,
                    showStyle: false,
                    onUpdate: (val) => {
                        this.tempStyle.trendLineColor = val.hexAlpha;
                    }
                });

                const levelsLineRow = document.getElementById('fib-levels-line-row');
                if (levelsLineRow) levelsLineRow.style.display = isSpecializedFib ? 'none' : '';
                
                this._syncCustomWidthPicker('fib-line-width-picker', s.width || 1, s.color || '#2962FF');
                const fibLineDashEl = document.getElementById('fib-line-dash');
                if (fibLineDashEl) fibLineDashEl.value = this._dashToKey(s.dash || 'solid');

                const extendRow = document.getElementById('fib-extend-row');
                if (extendRow) extendRow.style.display = (isCircle || isSpiral || isWedgeOrArcs || this.activeTool.type === 'fibonacci-time' || isPitchFan) ? 'none' : '';
                
                const extLeftLabel = document.getElementById('fib-extend-left-label');
                const extRightLabel = document.getElementById('fib-extend-right-label');
                if (extLeftLabel) extLeftLabel.textContent = (this.activeTool.type === 'fibonacci-time') ? 'Top' : 'Left';
                if (extRightLabel) extRightLabel.textContent = (this.activeTool.type === 'fibonacci-time') ? 'Bottom' : 'Right';

                const labelsRow = document.getElementById('fib-labels-row');
                if (labelsRow) labelsRow.style.display = (isCircle || isSpiral || isPitchFan) ? 'none' : '';
                
                const labelsPos = document.getElementById('fib-labels-position');
                const labelsVPos = document.getElementById('fib-labels-v-position');
                if (labelsPos) labelsPos.style.display = (isWedgeOrArcs || isPitchFan) ? 'none' : '';
                if (labelsVPos) labelsVPos.style.display = (this.activeTool.type === 'fibonacci-time') ? '' : 'none';

                const labelsShowEl = document.getElementById('fib-labels-show');
                if (labelsShowEl) labelsShowEl.checked = s.labelsShow !== false;
                if (labelsPos) labelsPos.value = s.labelsPosition || 'left';
                
                const vPos = document.getElementById('fib-labels-v-position');
                if (vPos) vPos.value = s.labelsVerticalPosition || 'bottom';

                const bgColorRow = document.getElementById('fib-background-row');
                if (bgColorRow) {
                    if (isSpiral || this.activeTool.type === 'cyclic-lines') {
                        bgColorRow.style.display = 'none';
                    } else {
                        bgColorRow.style.display = '';
                    }
                }
                
                const backgroundShowEl = document.getElementById('fib-background-show');
                if (backgroundShowEl) {
                    backgroundShowEl.checked = s.backgroundShow !== false;
                    backgroundShowEl.onchange = (e) => {
                        this.tempStyle.backgroundShow = e.target.checked;
                        this.updatePreview();
                    };
                }

                const opVal = s.opacity !== undefined ? s.opacity : (s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.2);
                const opSlider = document.getElementById('fib-background-opacity');
                const opLabel = document.getElementById('fib-background-opacity-label');
                if (opSlider && opLabel) {
                    const pct = Math.round(opVal * 100);
                    opSlider.value = pct;
                    opLabel.textContent = pct + '%';
                    opSlider.oninput = (e) => {
                        const val = parseInt(e.target.value);
                        opLabel.textContent = val + '%';
                        this.tempStyle.opacity = val / 100;
                        this.tempStyle.backgroundOpacity = val / 100;
                        this.updatePreview();
                    };
                }


                const fontSizeRow = document.getElementById('fib-font-size-row');
                if (fontSizeRow) fontSizeRow.style.display = (isSpiral || isPitchFan) ? 'none' : '';

            }

            document.getElementById('fib-reverse').onchange = (e) => {
                this.tempStyle.reverse = e.target.checked;
                this.updatePreview();
            };
            document.getElementById('fib-font-size').value = fSize;
        }

        if (category === 'chart-patterns') {
            this._syncAdvancedLine('cp-text-color-container', { hexAlpha: this._hexFromColor(s.textColor || '#ffffff') }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                showOpacity: false,
                onUpdate: (val) => {
                    this.tempStyle.textColor = val.color;
                }
            });

            const cpBgOp = s.opacity !== undefined ? s.opacity : (s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.3);
            this._syncAdvancedLine('cp-background-color-container', { hexAlpha: this._rgbaToHex(s.fillColor || s.color, cpBgOp) }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.fillColor = val.color;
                    this.tempStyle.opacity = val.opacity;
                    this.tempStyle.backgroundOpacity = val.opacity;
                }
            });

            document.getElementById('cp-font-size').value = parseInt(fSize);
            document.getElementById('cp-bold').classList.toggle('active', s.fontWeight === 'bold');
            document.getElementById('cp-italic').classList.toggle('active', s.fontStyle === 'italic');

            this._syncAdvancedLine('cp-border-advanced', {
                hexAlpha: s.color || '#2962FF',
                thickness: s.width || 1
            }, {
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.color = val.hexAlpha;
                    this.tempStyle.width = val.thickness;
                }
            });

            document.getElementById('cp-background-show').checked = s.backgroundShow !== false;

        }

        if (category === 'elliott-waves') {
            this._syncAdvancedLine('ew-advanced', {
                hexAlpha: s.color || '#2962FF',
                thickness: s.width || 2
            }, {
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.color = val.hexAlpha;
                    this.tempStyle.width = val.thickness;
                }
            });

            this._syncAdvancedLine('ew-text-color-container', { hexAlpha: this._hexFromColor(s.textColor || '#ffffff') }, {
                compact: true,
                showThickness: false,
                showStyle: false,
                showOpacity: false,
                onUpdate: (val) => {
                    this.tempStyle.textColor = val.color;
                }
            });
        }

        if (category === 'cycles') {
            const cyColorEl = document.getElementById('cy-color');
            this._syncAdvancedLine('cy-advanced', {
                hexAlpha: s.color || '#2962FF',
                thickness: s.width || 1
            }, {
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.color = val.hexAlpha;
                    this.tempStyle.width = val.thickness;
                }
            });
        }

        if (category === 'pitchfork') {
            const pfExtendEl = document.getElementById('pitchfork-extend');
            if (pfExtendEl) pfExtendEl.checked = !!s.extendLines;

            // LEGACY FALLBACK: Ensure levels are present for UI
            if (!s.levels) {
                if (this.activeTool.type === 'inside-pitchfork') {
                    s.levels = [
                        { level: -1.0, color: '#2962FF', visibility: true },
                        { level: -0.5, color: '#089981', visibility: true },
                        { level: 0, color: '#f23645', visibility: true },
                        { level: 0.5, color: '#089981', visibility: true },
                        { level: 1.0, color: '#2962FF', visibility: true }
                    ];
                } else {
                    s.levels = [
                        { level: 0, color: '#f23645', visibility: true },
                        { level: 0.5, color: '#089981', visibility: true },
                        { level: 1.0, color: '#2962FF', visibility: true }
                    ];
                }
            }
            document.getElementById('pitchfork-extend').onchange = (e) => {
                this.tempStyle.extendLines = e.target.checked;
                this.updatePreview();
            };

            const medianColor = s.levels?.find(l => l.level === 0)?.color || s.color || '#f23645';
            const medianWidth = s.levels?.find(l => l.level === 0)?.width || s.width || 1;

            this._syncAdvancedLine('pitchfork-median-advanced', {
                hexAlpha: medianColor,
                thickness: medianWidth,
                style: this._dashToKey(s.dash)
            }, {
                onUpdate: (val) => {
                    if (!this.tempStyle.levels) this.tempStyle.levels = JSON.parse(JSON.stringify(s.levels || []));
                    const idx = this.tempStyle.levels.findIndex(l => l.level === 0);
                    if (idx !== -1) {
                        this.tempStyle.levels[idx].color = val.hexAlpha;
                        this.tempStyle.levels[idx].width = val.thickness;
                    }
                    this.tempStyle.dash = this._keyToDash(val.style);
                }
            });

            const levels = s.levels || [];
            const filtered = levels.filter(l => l.level !== 0);
            const half = Math.ceil(filtered.length / 2);
            const groupA = filtered.slice(0, half);
            const groupB = filtered.slice(half);

            const colA = document.createElement('div');
            colA.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';
            const colB = document.createElement('div');
            colB.style.cssText = 'display:flex;flex-direction:column;gap:0;flex:1;';

            const levelsContainer = document.getElementById('pitchfork-levels-container');
            levelsContainer.innerHTML = '';

            const addRow = (container, lvl) => {
                const originalIdx = levels.indexOf(lvl);
                const row = this.makePitchforkLevelRow(lvl, originalIdx,
                    (e) => {
                        if (!this.tempStyle.levels) this.tempStyle.levels = JSON.parse(JSON.stringify(s.levels));
                        this.tempStyle.levels[originalIdx].visibility = e.target.checked;
                        this.updatePreview();
                    },
                    (e) => {
                        if (!this.tempStyle.levels) this.tempStyle.levels = JSON.parse(JSON.stringify(s.levels));
                        this.tempStyle.levels[originalIdx].color = e.target.value;
                        this.updatePreview();
                    },
                    (w) => {
                        if (!this.tempStyle.levels) this.tempStyle.levels = JSON.parse(JSON.stringify(s.levels));
                        this.tempStyle.levels[originalIdx].width = w;
                        this.updatePreview();
                    }
                );
                container.appendChild(row);
            };

            groupA.forEach(lvl => addRow(colA, lvl));
            groupB.forEach(lvl => addRow(colB, lvl));

            levelsContainer.appendChild(colA);
            levelsContainer.appendChild(colB);

            document.getElementById('pitchfork-background-show').checked = s.backgroundShow !== false;
            document.getElementById('pitchfork-background-show').onchange = (e) => {
                this.tempStyle.backgroundShow = e.target.checked;
                this.updatePreview();
            };

            const bgOp = Math.round((s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.08) * 100);
            document.getElementById('pitchfork-background-opacity').value = bgOp;
            document.getElementById('pitchfork-background-opacity-label').textContent = bgOp + '%';
            document.getElementById('pitchfork-background-opacity').oninput = (e) => {
                const val = parseInt(e.target.value);
                this.tempStyle.backgroundOpacity = val / 100;
                document.getElementById('pitchfork-background-opacity-label').textContent = val + '%';
                this.updatePreview();
            };

            const modeSelect = document.getElementById('pitchfork-mode');
            modeSelect.value = this.activeTool.type;
            modeSelect.onchange = (e) => {
                const newType = e.target.value;
                if (newType !== this.activeTool.type) {
                    this.activeTool.type = newType;
                    // Reset levels if switching to/from inside-pitchfork to ensure correct count
                    if (newType === 'inside-pitchfork' || this.activeTool.constructor.name === 'InsidePitchforkTool') {
                        this.tempStyle.levels = undefined;
                        // Re-sync UI to show new default levels
                        setTimeout(() => this.syncUIToState(), 0);
                    } else {
                        this.updatePreview();
                    }
                }
            };
        }


        if (category === 'gann') {
            const isFan = this.activeTool.type === 'gann-fan';
            const isSquare = this.activeTool.type === 'gann-square';
            const isSquareFixed = this.activeTool.type === 'gann-square-fixed';
            const isGannBox = this.activeTool.type === 'gann-box';

            const gannBoxEl = document.getElementById('gann-box-settings');
            const gannFanEl = document.getElementById('gann-fan-settings');
            const gannSquareEl = document.getElementById('gann-square-shared-settings');

            if (gannBoxEl) gannBoxEl.style.display = isGannBox ? 'flex' : 'none';
            if (gannFanEl) gannFanEl.style.display = isFan ? 'flex' : 'none';
            if (gannSquareEl) gannSquareEl.style.display = (isSquare || isSquareFixed) ? 'flex' : 'none';

            // Multiple labels sync
            const labelsLeftEl = document.getElementById('gann-labels-left');
            const labelsRightEl = document.getElementById('gann-labels-right');
            const labelsTopEl = document.getElementById('gann-labels-top');
            const labelsBottomEl = document.getElementById('gann-labels-bottom');

            if (labelsLeftEl) labelsLeftEl.checked = !!s.labelsShowLeft;
            if (labelsRightEl) labelsRightEl.checked = !!s.labelsShowRight;
            if (labelsTopEl) labelsTopEl.checked = !!s.labelsShowTop;
            if (labelsBottomEl) labelsBottomEl.checked = !!s.labelsShowBottom;

            const hBgShowEl = document.getElementById('gann-h-background-show');
            if (hBgShowEl) {
                hBgShowEl.checked = s.hBackgroundShow !== false;
                hBgShowEl.onchange = (e) => { this.tempStyle.hBackgroundShow = e.target.checked; this.updatePreview(); };
            }

            const hOp = Math.round((s.hBackgroundOpacity !== undefined ? s.hBackgroundOpacity : 0.2) * 100);
            const hOpEl = document.getElementById('gann-h-opacity');
            const hOpLabel = document.getElementById('gann-h-opacity-label');
            if (hOpEl && hOpLabel) {
                hOpEl.value = hOp;
                hOpLabel.textContent = hOp + '%';
                hOpEl.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    hOpLabel.textContent = val + '%';
                    this.tempStyle.hBackgroundOpacity = val / 100;
                    this.updatePreview();
                };
            }

            const vBgShowEl = document.getElementById('gann-v-background-show');
            if (vBgShowEl) {
                vBgShowEl.checked = s.vBackgroundShow !== false;
                vBgShowEl.onchange = (e) => { this.tempStyle.vBackgroundShow = e.target.checked; this.updatePreview(); };
            }

            const vOp = Math.round((s.vBackgroundOpacity !== undefined ? s.vBackgroundOpacity : 0.2) * 100);
            const vOpEl = document.getElementById('gann-v-opacity');
            const vOpLabel = document.getElementById('gann-v-opacity-label');
            if (vOpEl && vOpLabel) {
                vOpEl.value = vOp;
                vOpLabel.textContent = vOp + '%';
                vOpEl.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    vOpLabel.textContent = val + '%';
                    this.tempStyle.vBackgroundOpacity = val / 100;
                    this.updatePreview();
                };
            }

            // Reverse settings
            const revEl = document.getElementById('gann-reverse');
            if (revEl) {
                revEl.checked = !!s.reverse;
                revEl.onchange = (e) => { this.tempStyle.reverse = e.target.checked; this.updatePreview(); };
            }

            // Angle settings
            const anglesShowEl = document.getElementById('gann-angles-show');
            if (anglesShowEl) {
                anglesShowEl.checked = !!s.anglesShow;
                anglesShowEl.onchange = (e) => { this.tempStyle.anglesShow = e.target.checked; this.updatePreview(); };
            }
            const currentAngleColor = s.anglesColor || s.color || '#2962FF';
            
            this._syncAdvancedLine('gann-angles-advanced', {
                hexAlpha: currentAngleColor,
                thickness: s.anglesWidth || 1
            }, {
                showStyle: false,
                onUpdate: (val) => {
                    this.tempStyle.anglesColor = val.hexAlpha;
                    this.tempStyle.anglesWidth = val.thickness;
                }
            });

            // Removed obsolete font size sync to fix null error after UI simplification

            const makeLevelRow = (val, isVisible, levelColor, levelWidth, onToggle, onColor, onWidth) => {
                const row = document.createElement('div');
                row.className = 'settings-row';

                const sanitizedVal = val.toString().replace(/[^a-z0-9]/gi, '-');
                const cpContainerId = `gann-level-color-${sanitizedVal}-${Math.random().toString(36).substr(2, 9)}`;
                row.innerHTML = `
                            <input type="checkbox" ${isVisible ? 'checked' : ''}>
                            <div style="font-size: 11px; color: #d1d4dc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${val}</div>
                            <div id="${cpContainerId}"></div>
                        `;
                const cb = row.querySelector('input[type="checkbox"]');
                const cpContainer = row.querySelector(`[id="${cpContainerId}"]`);

                const isGannFan = this.activeTool.type === 'gann-fan';
                const adv = new AdvancedLineSetting(cpContainer, {
                    compact: true,
                    showOpacity: true,
                    showStyle: isGannFan,
                    defaultColor: levelColor,
                    defaultThickness: levelWidth,
                    defaultStyle: 'solid',
                    onChange: (v) => {
                        onColor({ target: { value: v.hexAlpha } });
                        if (onWidth) onWidth(v.thickness);
                    }
                });

                const updateState = (checked) => {
                    row.style.opacity = checked ? '1' : '0.4';
                    if (adv.container) adv.container.style.pointerEvents = checked ? 'auto' : 'none';
                };
                updateState(isVisible);

                cb.onchange = (e) => {
                    updateState(e.target.checked);
                    onToggle(e);
                };

                return row;
            };

            if (isFan) {
                const container = document.getElementById('gann-fan-levels');
                container.innerHTML = '';
                const defaultRatios = [
                    { ratio: '1/8', color: '#ff0000', visibility: true },
                    { ratio: '1/4', color: '#ff4500', visibility: true },
                    { ratio: '1/3', color: '#ffa500', visibility: true },
                    { ratio: '1/2', color: '#ffff00', visibility: true },
                    { ratio: '1/1', color: '#00ff00', visibility: true },
                    { ratio: '2/1', color: '#00ced1', visibility: true },
                    { ratio: '3/1', color: '#1e90ff', visibility: true },
                    { ratio: '4/1', color: '#8a2be2', visibility: true },
                    { ratio: '8/1', color: '#ff1493', visibility: true }
                ];
                const ratios = s.ratios || defaultRatios;

                // Split into two columns for cleaner layout
                const half = Math.ceil(ratios.length / 2);
                const groupA = ratios.slice(0, half);
                const groupB = ratios.slice(half);

                const colA = document.createElement('div');
                colA.style.cssText = 'display:flex; flex-direction:column; gap:0; flex:1;';
                const colB = document.createElement('div');
                colB.style.cssText = 'display:flex; flex-direction:column; gap:0; flex:1;';

                const addRow = (parent, r, idxOffset) => {
                    const idx = idxOffset;
                    parent.appendChild(makeLevelRow(r.ratio, r.visibility !== false, r.color || s.color, r.width || s.width || 1,
                        (e) => {
                            if (!this.tempStyle.ratios) this.tempStyle.ratios = JSON.parse(JSON.stringify(ratios));
                            this.tempStyle.ratios[idx].visibility = e.target.checked;
                            this.updatePreview();
                        },
                        (e) => {
                            if (!this.tempStyle.ratios) this.tempStyle.ratios = JSON.parse(JSON.stringify(ratios));
                            this.tempStyle.ratios[idx].color = e.target.value;
                            this.updatePreview();
                        },
                        (val) => {
                            if (!this.tempStyle.ratios) this.tempStyle.ratios = JSON.parse(JSON.stringify(ratios));
                            this.tempStyle.ratios[idx].width = val;
                            this.updatePreview();
                        }
                    ));
                };

                groupA.forEach((r, i) => addRow(colA, r, i));
                groupB.forEach((r, i) => addRow(colB, r, i + half));

                container.appendChild(colA);
                container.appendChild(colB);

                // Sync background and labels
                const bgShowEl = document.getElementById('gann-fan-background-show');
                bgShowEl.checked = s.backgroundShow !== false;
                bgShowEl.onchange = (e) => { this.tempStyle.backgroundShow = e.target.checked; this.updatePreview(); };

                const bgOp = Math.round((s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.2) * 100);
                const bgOpEl = document.getElementById('gann-fan-background-opacity');
                const bgOpLabel = document.getElementById('gann-fan-background-opacity-label');
                bgOpEl.value = bgOp;
                bgOpLabel.textContent = bgOp + '%';
                bgOpEl.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    bgOpLabel.textContent = val + '%';
                    this.tempStyle.backgroundOpacity = val / 100;
                    this.updatePreview();
                };

                document.getElementById('gann-fan-labels-show').checked = s.labelsShow !== false;
                document.getElementById('gann-fan-labels-show').onchange = (e) => { this.tempStyle.labelsShow = e.target.checked; this.updatePreview(); };

            } else {
                const populateLevels = (containerId, levelsKey, visibleKey, colorsKey) => {
                    const container = document.getElementById(containerId);
                    container.innerHTML = '';
                    const levels = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
                    const visibility = s[visibleKey] || levels;
                    const colors = s[colorsKey] || {};
                    const widths = s[colorsKey + 'Widths'] || {}; // fallback for older box style
                    levels.forEach(lvl => {
                        container.appendChild(makeLevelRow(lvl, visibility.includes(lvl), colors[lvl] || s.color, widths[lvl] || s.width || 1,
                            (e) => {
                                if (this.tempStyle[visibleKey] === undefined) this.tempStyle[visibleKey] = [...visibility];
                                if (e.target.checked) { if (!this.tempStyle[visibleKey].includes(lvl)) this.tempStyle[visibleKey].push(lvl); }
                                else { this.tempStyle[visibleKey] = this.tempStyle[visibleKey].filter(v => v !== lvl); }
                                this.updatePreview();
                            },
                            (e) => {
                                if (!this.tempStyle[colorsKey]) this.tempStyle[colorsKey] = { ...colors };
                                this.tempStyle[colorsKey][lvl] = e.target.value;
                                this.updatePreview();
                            },
                            (val) => {
                                const wKey = colorsKey + 'Widths';
                                if (!this.tempStyle[wKey]) this.tempStyle[wKey] = { ...widths };
                                this.tempStyle[wKey][lvl] = val;
                                this.updatePreview();
                            }
                        ));
                    });
                };
                populateLevels('gann-price-levels', 'hLevels', 'visibleHLevels', 'hLevelColors');
                populateLevels('gann-time-levels', 'vLevels', 'visibleVLevels', 'vLevelColors');
            }

            if (isSquare || isSquareFixed) {
                const populateSquareGrid = (containerId, key, items) => {
                    const container = document.getElementById(containerId);
                    container.innerHTML = '';
                    const data = s[key] || items;
                    data.forEach((item, idx) => {
                        container.appendChild(makeLevelRow(item.val, item.visible !== false, item.color || s.color, item.width || s.width || 1,
                            (e) => {
                                if (!this.tempStyle[key]) this.tempStyle[key] = JSON.parse(JSON.stringify(data));
                                this.tempStyle[key][idx].visible = e.target.checked;
                                this.updatePreview();
                            },
                            (e) => {
                                if (!this.tempStyle[key]) this.tempStyle[key] = JSON.parse(JSON.stringify(data));
                                this.tempStyle[key][idx].color = e.target.value;
                                this.updatePreview();
                            },
                            (val) => {
                                if (!this.tempStyle[key]) this.tempStyle[key] = JSON.parse(JSON.stringify(data));
                                this.tempStyle[key][idx].width = val;
                                this.updatePreview();
                            }
                        ));
                    });
                };

                populateSquareGrid('gann-square-levels', 'squareLevels', [
                    { val: 0, color: '#888888', visible: true }, { val: 1, color: '#ff9800', visible: true },
                    { val: 2, color: '#00bcd4', visible: true }, { val: 3, color: '#4caf50', visible: true },
                    { val: 4, color: '#009688', visible: true }, { val: 5, color: '#787b86', visible: true }
                ]);

                populateSquareGrid('gann-square-fans', 'squareFans', [
                    { val: '2x1', color: '#2196F3', visible: true }, { val: '1x1', color: '#4CAF50', visible: true },
                    { val: '1x2', color: '#FF9800', visible: true }
                ]);

                populateSquareGrid('gann-square-arcs', 'squareArcs', [
                    { val: '1x0', color: '#f23645', visible: true }, { val: '1x1', color: '#FF9800', visible: true },
                    { val: '2x0', color: '#FFEB3B', visible: true }, { val: '2x1', color: '#4CAF50', visible: true },
                    { val: '3x0', color: '#00BCD4', visible: true }, { val: '3x1', color: '#2196F3', visible: true },
                    { val: '4x0', color: '#3F51B5', visible: true }, { val: '4x1', color: '#673AB7', visible: true },
                    { val: '5x0', color: '#E91E63', visible: true }, { val: '5x1', color: '#9C27B0', visible: true }
                ]);

                document.getElementById('gann-square-reverse').checked = !!s.squareReverse;
                document.getElementById('gann-square-reverse').onchange = (e) => { this.tempStyle.squareReverse = e.target.checked; this.updatePreview(); };

                const bgShow = document.getElementById('gann-square-background-show');
                bgShow.checked = s.squareBackgroundShow !== false;
                bgShow.onchange = (e) => { this.tempStyle.squareBackgroundShow = e.target.checked; this.updatePreview(); };

                const currentArcOp = Math.round((s.squareBackgroundOpacity ?? 0.2) * 100);
                document.getElementById('gann-square-background-opacity').value = currentArcOp;
                document.getElementById('gann-square-background-opacity-label').textContent = currentArcOp + '%';
                document.getElementById('gann-square-background-opacity').oninput = (e) => {
                    const val = parseInt(e.target.value);
                    this.tempStyle.squareBackgroundOpacity = val / 100;
                    document.getElementById('gann-square-background-opacity-label').textContent = val + '%';
                    this.updatePreview();
                };
            }
        }

        // detailed Visibility Sync

        const visRows = document.querySelectorAll('#settings-view-visibility .visibility-row[data-category]');
        const toolVis = this.activeTool.visibility || {
            seconds: { enabled: true, min: 1, max: 59 },
            minutes: { enabled: true, min: 1, max: 59 },
            hours: { enabled: true, min: 1, max: 24 },
            days: { enabled: true, min: 1, max: 366 },
            weeks: { enabled: true, min: 1, max: 52 },
            months: { enabled: true, min: 1, max: 12 }
        };

        visRows.forEach(row => {
            const cat = row.dataset.category;
            const settings = toolVis[cat] || {};
            const cb = row.querySelector('input[type="checkbox"]');

            const inputs = row.querySelectorAll('.visibility-input-small');
            const slider = row.querySelector('.visibility-slider');

            if (cb) cb.checked = settings.enabled !== false;

            if (inputs.length === 2 && slider) {
                const minVal = settings.min !== undefined ? settings.min : parseInt(inputs[0].min);
                const maxVal = settings.max !== undefined ? settings.max : parseInt(inputs[1].max);

                inputs[0].value = minVal;
                inputs[1].value = maxVal;
                slider.value = minVal; // Just a visual sync for the slider handle

                // Set up live sync for these specific elements
                const updateTempVis = () => {
                    if (!this.tempStyle.visibilitySettings) {
                        this.tempStyle.visibilitySettings = JSON.parse(JSON.stringify(toolVis));
                    }
                    this.tempStyle.visibilitySettings[cat] = {
                        enabled: cb.checked,
                        min: parseInt(inputs[0].value),
                        max: parseInt(inputs[1].value)
                    };
                    this.updatePreview();
                };

                cb.onchange = updateTempVis;
                inputs[0].oninput = (e) => {
                    slider.value = e.target.value;
                    updateTempVis();
                };
                inputs[1].oninput = updateTempVis;
                slider.oninput = (e) => {
                    inputs[0].value = e.target.value;
                    updateTempVis();
                };
            } else if (cb) {
                // For Ticks/Ranges which only have checkbox
                cb.onchange = () => {
                    if (!this.tempStyle.visibilitySettings) {
                        this.tempStyle.visibilitySettings = JSON.parse(JSON.stringify(toolVis));
                    }
                    this.tempStyle.visibilitySettings[cat] = { enabled: cb.checked };
                    this.updatePreview();
                };
            }
        });



        // Coordinates always
        const coordsBody = document.getElementById('settings-coords-body');
        coordsBody.innerHTML = '';
        this.activeTool.points.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'settings-coords-grid';
            const barIndex = this.chart.timeToBar(p.timestamp);
            row.innerHTML = `
                        <div style="font-size: 11px; color: #d1d4dc;">#${i + 1}</div>
                        <input type="text" class="settings-input-small" value="${this.chart.formatPrice ? this.chart.formatPrice(p.price) : p.price.toFixed(2)}" data-idx="${i}" data-type="price">
                        <input type="text" class="settings-input-small" value="${barIndex}" data-idx="${i}" data-type="bar">
                    `;

            // Add listeners for manual coordinate entry
            const inputs = row.querySelectorAll('input');
            inputs[0].onchange = (e) => {
                const val = parseFloat(e.target.value.replace(/,/g, ''));
                if (!isNaN(val)) {
                    this.activeTool.points[i].price = val;

                    // Sync entry points for position tools
                    const type = this.activeTool.type;
                    if (type === 'long-position' || type === 'short-position') {
                        if (i === 0 && this.activeTool.points[3]) {
                            this.activeTool.points[3].price = val;
                        } else if (i === 3 && this.activeTool.points[0]) {
                            this.activeTool.points[0].price = val;
                        }
                    }
                    this.updatePreview();
                }
            };
            inputs[1].onchange = (e) => {
                const barIndex = parseInt(e.target.value);
                if (!isNaN(barIndex)) {
                    this.activeTool.points[i].timestamp = this.chart.barToTime(barIndex);
                    this.updatePreview();
                }
            };

            coordsBody.appendChild(row);
        });
    }

    _dashToString(dash) {
        if (!dash || dash.length === 0) return 'solid';
        if (dash[0] === 5) return 'dashed';
        if (dash[0] === 2) return 'dotted';
        return 'solid';
    }

    _dashFromString(str) {
        if (str === 'dashed') return [5, 5];
        if (str === 'dotted') return [2, 2];
        return [];
    }

    updatePreview() {
        if (!this.activeTool) return;

        // Merge tempStyle into tool for immediate visualization
        this.activeTool.style = { ...this.activeTool.style, ...this.tempStyle };

        // Directly attach visibility to tool for isVisible() check
        if (this.tempStyle.visibilitySettings) {
            this.activeTool.visibility = JSON.parse(JSON.stringify(this.tempStyle.visibilitySettings));
        }

        if (this.tempStyle.text !== undefined) {
            this.activeTool.text = this.tempStyle.text;
            this.activeTool.style.text = this.tempStyle.text;
        }

        this.chart.render();
    }

    hide() {
        this.backdrop.style.display = 'none';
        this.activeTool = null;
        this.isOpen = false;
    }

    cancel() {
        if (this.activeTool) {
            // Restore from backup
            this.activeTool.style = this.backupStyle;
            this.activeTool.text = this.backupText;
            this.activeTool.name = this.backupName;
            this.activeTool.visibility = this.backupVisibility;
            this.activeTool.points = JSON.parse(JSON.stringify(this.backupPoints));
            this.chart.render();
        }
        if (this.chart.stateManager.undoStack.length > 0) this.chart.stateManager.undoStack.pop();
        this.hide();
    }

    apply() {
        if (!this.activeTool) return;

        // Save history of the state BEFORE the settings were changed
        // Temporarily revert to backup to capture the clean state
        const currentStyle = JSON.parse(JSON.stringify(this.activeTool.style || {}));
        const currentText = this.activeTool.text;
        const currentName = this.activeTool.name;

        this.activeTool.style = this.backupStyle;
        this.activeTool.text = this.backupText;
        this.activeTool.name = this.backupName;

        this.chart.saveHistory();

        // Re-apply the previewed/temp changes
        this.activeTool.style = currentStyle;
        this.activeTool.text = currentText;
        this.activeTool.name = currentName;

        // Sync custom name directly to the tool object (not style)
        if (this.tempStyle.name !== undefined) {
            this.activeTool.name = this.tempStyle.name;
        }

        // Sync Visibility Settings (already lekat via updatePreview, but let's be explicit)
        if (this.tempStyle.visibilitySettings) {
            this.activeTool.visibility = JSON.parse(JSON.stringify(this.tempStyle.visibilitySettings));
            // Also sync to the root style for cross-session persistence
            this.activeTool.style.visibilitySettings = this.activeTool.visibility;
        }

        // Final sync check
        this.updatePreview();

        const isIndicator = !!this.activeTool.isIndicator;

        // Update chart defaults so next tool of this type uses these settings
        if (this.chart.styles && this.chart.styles.tools) {
            const type = this.activeTool.type;

            // Helper to determine which style key to update
            const getStyleKey = (toolType) => {
                const styleMap = {
                    'horizontal-line': 'trend-line', 'vertical-line': 'trend-line',
                    'ray': 'trend-line', 'horizontal-ray': 'trend-line', 'extended-line': 'trend-line',
                    'info-line': 'trend-line', 'trend-angle': 'trend-line', 'cross-line': 'trend-line',
                    'ellipse': 'circle', 'triangle': 'rectangle',
                    'rotated-rectangle': 'rectangle', 'arc': 'circle', 'polyline': 'path',
                    'long-position': 'position', 'short-position': 'position',
                    'arrow-mark-up': 'arrow', 'arrow-mark-down': 'arrow', 'arrow-marker': 'arrow',
                    'highlighter': 'brush',
                    'schiff-pitchfork': 'pitchfork', 'modified-schiff-pitchfork': 'pitchfork', 'inside-pitchfork': 'pitchfork'
                };
                return styleMap[toolType] || toolType;
            };

            const styleKey = getStyleKey(type);
            if (this.chart.styles.tools[styleKey]) {
                // Persist standard style updates, but exclude specific content-related properties like 'text' and 'name'
                const updatedStyle = JSON.parse(JSON.stringify(this.tempStyle));
                delete updatedStyle.text;
                delete updatedStyle.name;

                // Ensure highlighter specific properties are kept if updating highlighter
                if (type === 'highlighter') {
                    updatedStyle.highlighterColor = updatedStyle.highlighterColor || updatedStyle.color;
                    updatedStyle.highlighterWidth = updatedStyle.highlighterWidth || (updatedStyle.width * 5);
                }

                // For tools that use 'fillColor' as their primary background (pin, sign-post, etc.)
                // ensure it's saved correctly in the defaults
                this.chart.styles.tools[styleKey] = {
                    ...this.chart.styles.tools[styleKey],
                    ...updatedStyle
                };
            }
        }

        // AUTO-SAVE POLICY:
        // Jika ini indikator, simpan layout state secara otomatis.
        // Jika ini gambar, panggil syncWithDatabase agar langsung tersimpan ke server (Auto-save).
        if (isIndicator) {
            this.chart.isLayoutDirty = true;
            if (this.chart._notifyDirtyChange) this.chart._notifyDirtyChange();
        } else {
            this.chart.markToolDirty(this.activeTool, 'update');
            // this.chart.syncWithDatabase(); // DISABLED AUTO-SYNC
        }

        this.chart.render();
        if (window.sidebarController) {
            window.sidebarController.updateObjectTree();
        }
        this.backdrop.style.display = 'none';
        this.activeTool = null;
    }
}

