export class AdvancedLineSetting {
    static instances = new Set();
    static customColors = JSON.parse(localStorage.getItem('chart_custom_colors') || '[]');

    constructor(containerId, options = {}) {
        AdvancedLineSetting.instances.add(this);
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.options = {
            showColor: true,
            showOpacity: true,
            showThickness: true,
            showStyle: true,
            defaultColor: '#2962ff',
            defaultOpacity: 1,
            defaultThickness: 2,
            defaultStyle: 'solid',
            onChange: () => { },
            ...options
        };

        this.state = {
            color: this.options.defaultColor,
            opacity: this.options.defaultOpacity,
            thickness: this.options.defaultThickness,
            style: this.options.defaultStyle,
            isOpen: false
        };

        this.colors = [
            // Row 1: Grayscale
            '#ffffff', '#d1d4dc', '#b2b5be', '#868993', '#5d606b', '#434651', '#363a45', '#2a2e39', '#131722', '#000000',
            // Row 2: Vivid
            '#ff5252', '#ff9800', '#ffeb3b', '#4caf50', '#009688', '#00bcd4', '#2196f3', '#311b92', '#9c27b0', '#e91e63',
            // Row 3: Light Tints
            '#ffebee', '#fff3e0', '#fffde7', '#e8f5e9', '#e0f2f1', '#e0f7fa', '#e3f2fd', '#ede7f6', '#f3e5f5', '#fce4ec',
            // Row 4: Pastel
            '#ffcdd2', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2dfdb', '#b2ebf2', '#bbdefb', '#d1c4e9', '#e1bee7', '#f8bbd0',
            // Row 5: Medium
            '#ef9a9a', '#ffcc80', '#fff59d', '#a5d6a7', '#80cbc4', '#80deea', '#90caf9', '#b39ddb', '#ce93d8', '#f48fb1',
            // Row 6: Strong
            '#e57373', '#ffb74d', '#fff176', '#81c784', '#4db6ac', '#4dd0e1', '#64b5f6', '#9575cd', '#ba68c8', '#f06292',
            // Row 7: Dark
            '#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#26a69a', '#26c6da', '#42a5f5', '#7e57c2', '#ab47bc', '#ec407a',
            // Row 8: Deep
            '#d32f2f', '#f57c00', '#fbc02d', '#388e3c', '#00796b', '#0097a7', '#1976d2', '#512da8', '#7b1fa2', '#c2185b'
        ];

        this.popoverId = `popover-${containerId}`;
        this.init();
    }

    updateOptions(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions
        };
        // Re-render trigger to reflect new combined/simple state
        this.renderTrigger();
        // Re-bind only the trigger-specific events
        this.bindTriggerEvents();
        // Re-create popover with new options
        this.createPopover();
        // Re-bind events to the new popover elements
        this.bindPopoverEvents();
        // Trigger might also need background update
        this.updateUI();
    }

    init() {
        // Build the popover ID early so we can use it for cleanup
        this.popoverId = `line-setting-popover-${this.container.id}`;

        // Cleanup existing popover from the DOM if it exists
        const oldPopover = document.getElementById(this.popoverId);
        if (oldPopover) {
            oldPopover.remove();
        }

        this.renderTrigger();
        this.bindTriggerEvents();
        this.createPopover();
        this.setupEventListeners();
        this.updateUI(); // Final sync for initial state
    }

    renderTrigger() {
        // Clear container to prevent duplicate triggers
        this.container.innerHTML = '';

        const triggerWrapper = document.createElement('div');
        triggerWrapper.className = 'line-setting-container';

        const isCombined = this.options.showThickness || this.options.showStyle;
        triggerWrapper.innerHTML = `
            <div class="line-setting-trigger ${isCombined ? 'combined-trigger' : ''}" title="Settings">
                <div class="line-setting-trigger-color checkerboard"></div>
                ${isCombined ? `<div class="trigger-line-preview"></div>` : ''}
            </div>
        `;
        this.container.appendChild(triggerWrapper);
    }

    createPopover() {
        // We already have this.popoverId from init()
        let popover = document.createElement('div');
        popover.id = this.popoverId;
        popover.className = 'line-setting-popover';
        document.body.appendChild(popover);

        popover.innerHTML = `
            ${this.options.showColor ? `
                <div class="color-palette-grid">
                    ${this.renderColorGrid()}
                </div>
            ` : ''}
            ${this.options.showColor ? `
                <div class="line-setting-section" style="margin-top: 12px; border-top: 1px solid #2a2e39; padding-top: 12px;">
                    <div class="line-setting-label" style="margin-bottom: 8px;">Custom Colors</div>
                    <div class="color-palette-grid" id="${this.popoverId}-custom-grid">
                        ${AdvancedLineSetting.customColors.map(c => `
                            <div class="color-palette-item ${this.state.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}" 
                                 style="background: ${c}" 
                                 data-color="${c}"></div>
                        `).join('')}
                        <div class="color-palette-item add-custom-color" style="display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #363a45; position: relative;">
                            <span style="font-size: 16px; color: #787b86;">+</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            ${this.options.showOpacity ? this.renderOpacitySlider() : ''}
            ${this.options.showThickness ? this.renderThicknessSelector() : ''}
            ${this.options.showStyle ? this.renderStyleSelector() : ''}
        `;

        this.popover = popover;

        // Create separate Picker Popover
        if (this.options.showColor) {
            this.createPickerPopover();
        }

        this.bindPopoverEvents();
    }

    createPickerPopover() {
        this.pickerPopupId = `${this.popoverId}-picker-popup`;
        let pickerPopup = document.getElementById(this.pickerPopupId);
        const isVisible = pickerPopup && pickerPopup.style.display === 'block';

        if (!pickerPopup) {
            pickerPopup = document.createElement('div');
            pickerPopup.id = this.pickerPopupId;
            pickerPopup.className = 'line-setting-popover custom-picker-popup';
            pickerPopup.style.width = '200px';
            pickerPopup.style.display = 'none'; // Initially hidden
            document.body.appendChild(pickerPopup);
        }

        pickerPopup.innerHTML = `
            <div class="picker-top-bar" style="display: flex; align-items: center; gap: 4px; margin-bottom: 12px; height: 24px;">
                <div class="picker-preview checkerboard" id="${this.popoverId}-picker-preview" style="width: 24px; height: 100%; border-radius: 4px; border: 1px solid #363a45; flex-shrink: 0;"></div>
                <input type="text" class="picker-hex-input" id="${this.popoverId}-picker-hex" placeholder="FFFFFF" style="width: 70px; flex-shrink: 0; background: #2a2e39; border: 1px solid #363a45; color: #d1d4dc; padding: 4px; border-radius: 4px; font-size: 11px; font-family: monospace; height: 100%; box-sizing: border-box;" value="FFFFFF">
                <button class="picker-add-btn" id="${this.popoverId}-picker-add" style="flex: 1; background: #f0f3fa; color: #131722; border: none; padding: 0 4px; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; height: 100%; white-space: nowrap;">Add</button>
            </div>
            <div class="picker-main" style="display: flex; gap: 12px; height: 140px;">
                <div class="picker-sv-square" id="${this.popoverId}-picker-sv" style="flex: 1; position: relative; border-radius: 4px; overflow: hidden; cursor: crosshair;">
                    <div class="picker-sv-white" style="width: 100%; height: 100%; background: linear-gradient(to right, #fff, rgba(255,255,255,0));">
                        <div class="picker-sv-black" style="width: 100%; height: 100%; background: linear-gradient(to top, #000, rgba(0,0,0,0));"></div>
                    </div>
                    <div class="picker-sv-handle" id="${this.popoverId}-picker-sv-handle"></div>
                </div>
                <div class="picker-hue-slider" id="${this.popoverId}-picker-hue" style="width: 10px; height: 100%; position: relative; border-radius: 5px; background: linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); cursor: ns-resize;">
                    <div class="picker-hue-handle" id="${this.popoverId}-picker-hue-handle"></div>
                </div>
            </div>
        `;

        this.pickerPopup = pickerPopup;
        if (isVisible) {
            pickerPopup.style.display = 'block';
            this.updatePickerPosition();
        }
        this.setupPickerEvents();
    }

    renderColorGrid() {
        return this.colors.map((c, i) => {
            let html = `
                <div class="color-palette-item checkerboard ${this.state.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}" 
                     style="--checkerboard-color: ${c}" 
                     data-color="${c}"></div>
            `;
            if (i === 19) {
                // Add gap after the 2nd row (index 19 is the 20th item)
                html += '<div style="grid-column: 1 / -1; height: 10px;"></div>';
            }
            return html;
        }).join('');
    }

    renderOpacitySlider() {
        return `
            <div class="line-setting-section">
                <div class="line-setting-label">Opacity</div>
                <div class="opacity-slider-row">
                    <input type="range" class="opacity-slider" min="0" max="100" value="${this.state.opacity * 100}">
                    <div class="opacity-value">${Math.round(this.state.opacity * 100)}%</div>
                </div>
            </div>
        `;
    }

    renderThicknessSelector() {
        const widths = [1, 2, 3, 4];
        return `
            <div class="line-setting-section">
                <div class="line-setting-label">Thickness</div>
                <div class="toggle-group">
                    ${widths.map(w => `
                        <button class="toggle-btn ${this.state.thickness === w ? 'active' : ''}" data-thickness="${w}">
                            <div class="thickness-line" style="height: ${w}px"></div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderStyleSelector() {
        const styles = [
            { id: 'solid', label: '—————', spacing: '-1px' },
            { id: 'dashed', label: '-----', spacing: '5px' },
            { id: 'dotted', label: '•••••', spacing: '5px' }
        ];
        return `
            <div class="line-setting-section">
                <div class="line-setting-label">Line Style</div>
                <div class="toggle-group">
                    ${styles.map(s => `
                        <button class="toggle-btn ${this.state.style === s.id ? 'active' : ''}" 
                                data-style="${s.id}" 
                                style="letter-spacing: ${s.spacing}; font-weight: bold;">
                            ${s.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    bindTriggerEvents() {
        const trigger = this.container.querySelector('.line-setting-trigger');
        if (!trigger) return;

        trigger.onclick = (e) => {
            e.stopPropagation();
            this.togglePopover();
        };
    }

    setupEventListeners() {
        this.bindTriggerEvents();

        // Re-bind listeners on popover
        this.bindPopoverEvents();

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.state.isOpen) {
                const isInsideTrigger = this.container.contains(e.target);
                const isInsidePopover = this.popover.contains(e.target);
                const isInsidePicker = this.pickerPopup && this.pickerPopup.contains(e.target);
                const isAddBtn = e.target.closest('.add-custom-color');

                if (!isInsideTrigger && !isInsidePopover && !isInsidePicker && !isAddBtn) {
                    this.closePopover();
                }
            }
        }, true);

        // Bind global optimized resize/scroll listeners once
        if (!AdvancedLineSetting.globalScrollBound) {
            window.addEventListener('resize', () => {
                AdvancedLineSetting.instances.forEach(instance => {
                    if (instance.state.isOpen) instance.updatePopoverPosition();
                });
            });
            
            window.addEventListener('scroll', (e) => {
                AdvancedLineSetting.instances.forEach(instance => {
                    if (instance.state.isOpen && (e.target === document || (e.target.contains && e.target.contains(instance.container)))) {
                        instance.updatePopoverPosition();
                    }
                });
            }, true);
            
            AdvancedLineSetting.globalScrollBound = true;
        }
    }

    bindPopoverEvents() {
        this.popover.querySelectorAll('.color-palette-item:not(.add-custom-color)').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                this.state.color = item.dataset.color;
                this.updateUI();
                this.options.onChange(this.getValue());
            };
        });

        const addBtn = this.popover.querySelector('.add-custom-color');
        if (addBtn) {
            addBtn.onclick = (e) => {
                e.stopPropagation();
                this.togglePickerPopup();
            };
        }

        const slider = this.popover.querySelector('.opacity-slider');
        if (slider) {
            slider.oninput = (e) => {
                this.state.opacity = e.target.value / 100;
                this.popover.querySelector('.opacity-value').textContent = `${e.target.value}%`;
                this.updateTriggerColor();
                this.options.onChange(this.getValue());
            };
            slider.onclick = (e) => e.stopPropagation();
        }

        this.popover.querySelectorAll('[data-thickness]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.state.thickness = parseInt(btn.dataset.thickness);
                this.updateUI();
                this.options.onChange(this.getValue());
            };
        });

        this.popover.querySelectorAll('[data-style]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.state.style = btn.dataset.style;
                this.updateUI();
                this.options.onChange(this.getValue());
            };
        });
    }

    togglePickerPopup() {
        const isVisible = this.pickerPopup.style.display === 'block';
        if (isVisible) {
            this.pickerPopup.style.display = 'none';
            this.addCustomColor(this.state.color);
        } else {
            this.updatePickerPosition();
            this.initCustomPicker();
            this.pickerPopup.style.display = 'block';
        }
    }

    updatePickerPosition() {
        const rect = this.popover.getBoundingClientRect();
        const pickerWidth = 224; // Width + padding estimate

        let left = rect.right + 8;
        let top = rect.top;

        // If no room on right, show on left
        if (left + pickerWidth > window.innerWidth) {
            left = rect.left - pickerWidth - 8;
        }

        // Window bounds safety
        left = Math.max(10, Math.min(window.innerWidth - pickerWidth - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - 250, top)); // 250 is max height approx

        this.pickerPopup.style.position = 'fixed';
        this.pickerPopup.style.left = `${left}px`;
        this.pickerPopup.style.top = `${top}px`;
        this.pickerPopup.style.zIndex = '10000';
    }

    initCustomPicker() {
        const hex = this.state.color.substring(0, 7);
        const hsv = this.hexToHsv(hex);
        this.pickerState = { ...hsv };
        this.updateCustomPickerUI();
        this.setupPickerEvents();
    }

    setupPickerEvents() {
        const svSquare = document.getElementById(`${this.popoverId}-picker-sv`);
        const hueSlider = document.getElementById(`${this.popoverId}-picker-hue`);
        const hexInput = document.getElementById(`${this.popoverId}-picker-hex`);
        const addBtn = document.getElementById(`${this.popoverId}-picker-add`);

        const handleSv = (e) => {
            const rect = svSquare.getBoundingClientRect();
            let x = (e.clientX - rect.left) / rect.width;
            let y = (e.clientY - rect.top) / rect.height;
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));
            this.pickerState.s = x;
            this.pickerState.v = 1 - y;
            this.onPickerChange();
        };

        const handleHue = (e) => {
            const rect = hueSlider.getBoundingClientRect();
            let y = (e.clientY - rect.top) / rect.height;
            y = Math.max(0, Math.min(1, y));
            this.pickerState.h = y * 360;
            this.onPickerChange();
        };

        const setupDrag = (el, fn) => {
            if (!el) return;
            const onMouseMove = (e) => fn(e);
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            el.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fn(e);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
        };

        setupDrag(svSquare, handleSv);
        setupDrag(hueSlider, handleHue);

        if (hexInput) {
            hexInput.oninput = (e) => {
                let val = e.target.value;
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    const hsv = this.hexToHsv(val);
                    this.pickerState = { ...hsv };
                    this.onPickerChange();
                }
            };
            hexInput.onmousedown = (e) => e.stopPropagation();
        }

        if (addBtn) {
            addBtn.onclick = (e) => {
                e.stopPropagation();
                const color = this.hsvToHex(this.pickerState.h, this.pickerState.s, this.pickerState.v);
                this.addCustomColor(color);
                if (this.pickerPopup) {
                    this.pickerPopup.style.display = 'none';
                }
            };
        }

        this.pickerPopup.onmousedown = (e) => e.stopPropagation();
    }

    onPickerChange() {
        const hex = this.hsvToHex(this.pickerState.h, this.pickerState.s, this.pickerState.v);
        this.state.color = hex;
        this.updateCustomPickerUI();
        this.updateTriggerColor();
        this.options.onChange(this.getValue());
    }

    updateCustomPickerUI() {
        const { h, s, v } = this.pickerState;
        const hex = this.hsvToHex(h, s, v);
        const hueHex = this.hsvToHex(h, 1, 1);

        const svSquare = document.getElementById(`${this.popoverId}-picker-sv`);
        const svHandle = document.getElementById(`${this.popoverId}-picker-sv-handle`);
        const hueHandle = document.getElementById(`${this.popoverId}-picker-hue-handle`);
        const preview = document.getElementById(`${this.popoverId}-picker-preview`);
        const hexInput = document.getElementById(`${this.popoverId}-picker-hex`);

        if (svSquare) svSquare.style.backgroundColor = hueHex;
        if (svHandle) {
            svHandle.style.left = `${s * 100}%`;
            svHandle.style.top = `${(1 - v) * 100}%`;
        }
        if (hueHandle) hueHandle.style.top = `${(h / 360) * 100}%`;
        if (preview) preview.style.setProperty('--checkerboard-color', hex);
        if (hexInput) {
            // Only update hex input if user is not typing in it
            if (document.activeElement !== hexInput) {
                hexInput.value = hex.startsWith('#') ? hex.slice(1).toUpperCase() : hex.toUpperCase();
            }
        }
    }

    addCustomColor(color) {
        if (!color) return;
        let c = color.toLowerCase();
        if (!c.startsWith('#')) c = '#' + c;
        if (AdvancedLineSetting.customColors.indexOf(c) === -1) {
            AdvancedLineSetting.customColors.unshift(c);
            if (AdvancedLineSetting.customColors.length > 20) {
                AdvancedLineSetting.customColors.pop();
            }
            localStorage.setItem('chart_custom_colors', JSON.stringify(AdvancedLineSetting.customColors));

            // Sync all instances
            AdvancedLineSetting.instances.forEach(instance => {
                instance.updateUI();
            });
        }
    }

    hexToHsv(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s, v };
    }

    hsvToHex(h, s, v) {
        h /= 360;
        let r, g, b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    togglePopover() {
        this.state.isOpen = !this.state.isOpen;
        if (this.state.isOpen) {
            this.updatePopoverPosition();
            this.popover.classList.add('active');
        } else {
            this.popover.classList.remove('active');
            if (this.pickerPopup) this.pickerPopup.style.display = 'none';
        }
    }

    closePopover() {
        if (this.state.isOpen) {
            // Auto-add current color to custom colors if it's new
            if (this.options.showColor) {
                this.addCustomColor(this.state.color);
            }
        }
        this.state.isOpen = false;
        this.popover.classList.remove('active');
        if (this.pickerPopup) this.pickerPopup.style.display = 'none';
    }

    updatePopoverPosition() {
        const rect = this.container.getBoundingClientRect();
        const popoverWidth = 240;

        let left = rect.left;
        let top = rect.bottom + 8;

        if (left + popoverWidth > window.innerWidth) {
            left = window.innerWidth - popoverWidth - 10;
        }

        const popoverHeight = this.popover.offsetHeight || 250;
        if (top + popoverHeight > window.innerHeight) {
            top = rect.top - popoverHeight - 8;
        }

        this.popover.style.position = 'fixed';
        this.popover.style.left = `${left}px`;
        this.popover.style.top = `${top}px`;

        if (this.pickerPopup && this.pickerPopup.style.display === 'block') {
            this.updatePickerPosition();
        }
    }

    updateUI() {
        if (this.options.showColor) {
            const mainGrid = this.popover.querySelector('.color-palette-grid');
            if (mainGrid) mainGrid.innerHTML = this.renderColorGrid();

            const gridId = `${this.popoverId}-custom-grid`;
            const customGrid = document.getElementById(gridId);
            if (customGrid) {
                const customColorsHtml = AdvancedLineSetting.customColors.map(c => `
                    <div class="color-palette-item checkerboard ${this.state.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}" 
                         style="--checkerboard-color: ${c}" 
                         data-color="${c}"></div>
                `).join('') + `
                    <div class="color-palette-item add-custom-color" style="display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #363a45; position: relative;">
                        <span style="font-size: 16px; color: #787b86;">+</span>
                    </div>
                `;
                customGrid.innerHTML = customColorsHtml;
            }
            this.bindPopoverEvents();
        }

        this.popover.style.setProperty('--active-color', this.state.color);

        this.popover.querySelectorAll('[data-thickness]').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.thickness) === this.state.thickness);
        });

        this.popover.querySelectorAll('[data-style]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.style === this.state.style);
        });

        if (this.options.showOpacity) {
            const slider = this.popover.querySelector('.opacity-slider');
            const valueText = this.popover.querySelector('.opacity-value');
            if (slider) slider.value = this.state.opacity * 100;
            if (valueText) valueText.textContent = `${Math.round(this.state.opacity * 100)}%`;
        }

        this.updateTriggerColor();
    }

    updateTriggerColor() {
        const triggerColor = this.container.querySelector('.line-setting-trigger-color');
        if (triggerColor) {
            triggerColor.style.setProperty('--checkerboard-color', this.getColorWithOpacity());
        }

        const linePreview = this.container.querySelector('.trigger-line-preview');
        if (linePreview) {
            linePreview.style.backgroundColor = this.getColorWithOpacity();
            linePreview.style.height = `${this.state.thickness}px`;
        }
    }

    getColorWithOpacity() {
        let hex = this.state.color;
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${this.state.opacity})`;
    }

    getValue() {
        return {
            color: this.state.color,
            opacity: this.state.opacity,
            thickness: this.state.thickness,
            style: this.state.style,
            rgba: this.getColorWithOpacity(),
            hexAlpha: this.getHexAlpha()
        };
    }

    getHexAlpha() {
        let hex = this.state.color;
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        const alpha = Math.round(this.state.opacity * 255).toString(16).padStart(2, '0');
        return hex + alpha;
    }

    setValue(values) {
        if (values.color) this.state.color = values.color;
        if (values.opacity !== undefined) this.state.opacity = values.opacity;
        if (values.thickness) this.state.thickness = values.thickness;
        if (values.style) this.state.style = values.style;

        // Support both #RRGGBB and #RRGGBBAA
        if (values.hexAlpha) {
            if (values.hexAlpha.length === 9) {
                this.state.color = values.hexAlpha.slice(0, 7);
                this.state.opacity = parseInt(values.hexAlpha.slice(7, 9), 16) / 255;
            } else if (values.hexAlpha.length === 7) {
                this.state.color = values.hexAlpha;
                this.state.opacity = 1;
            } else if (values.hexAlpha.startsWith('rgba')) {
                const match = values.hexAlpha.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (match) {
                    const r = parseInt(match[1]).toString(16).padStart(2, '0');
                    const g = parseInt(match[2]).toString(16).padStart(2, '0');
                    const b = parseInt(match[3]).toString(16).padStart(2, '0');
                    const a = match[4] ? parseFloat(match[4]) : 1;
                    this.state.color = `#${r}${g}${b}`;
                    this.state.opacity = a;
                }
            }
        }

        this.updateTriggerColor();
        if (this.popover) {
            this.updateUI();
        }
    }
}
