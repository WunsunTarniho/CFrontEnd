export class GlobalContextMenuController {
    constructor(chart) {
        this.chart = chart;
        this.menu = document.getElementById('global-chart-context-menu');
        this.clickPos = null;
        this.clickPrice = null;
        this.clickTimestamp = null;
        this.init();
    }

    init() {
        if (!this.chart || !this.menu) return;

        // Hide menu on click outside
        document.addEventListener('mousedown', (e) => {
            if (this.menu && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Action Listeners
        const getEl = (id) => document.getElementById(id);
        
        if (getEl('global-menu-reset')) getEl('global-menu-reset').onclick = () => this.executeAction('reset');
        if (getEl('global-menu-copy-price')) getEl('global-menu-copy-price').onclick = () => this.executeAction('copy-price');
        if (getEl('global-menu-paste')) getEl('global-menu-paste').onclick = () => this.executeAction('paste');
        if (getEl('global-menu-add-alert')) getEl('global-menu-add-alert').onclick = () => this.executeAction('add-alert');
        if (getEl('global-menu-lock-cursor')) getEl('global-menu-lock-cursor').onclick = () => this.executeAction('lock-cursor');
        if (getEl('global-menu-table-view')) getEl('global-menu-table-view').onclick = () => this.executeAction('table-view');
        
        if (getEl('global-menu-object-tree')) {
            getEl('global-menu-object-tree').onclick = () => {
                if (window.sidebarController) {
                    window.sidebarController.switchTab('diagram-view');
                }
                this.hide();
            };
        }

        if (getEl('global-menu-remove-drawings')) {
             getEl('global-menu-remove-drawings').onclick = () => {
                 if (this.chart) {
                    this.chart.drawingTools.forEach(tool => this.chart.markToolDirty(tool, 'delete'));
                    this.chart.drawingTools = [];
                    this.chart.selectedTool = null;
                    this.chart.render();
                    if (window.sidebarController) {
                        window.sidebarController.updateObjectTree();
                    }
                 }
                 this.hide();
             };
        }
        
        if (getEl('global-menu-settings')) {
            getEl('global-menu-settings').onclick = () => {
                if (window.chartSettingsController) {
                    window.chartSettingsController.show();
                }
                this.hide();
            };
        }
    }

    show(x, y, price, timestamp) {
        if (!this.menu) return;
        this.clickPos = { x, y };
        this.clickPrice = price;
        this.clickTimestamp = timestamp;

        // Update dynamic text
        const formattedPrice = this.formatPrice(price);
        const symbol = this.chart.currentSymbol || 'Symbol'; // Assuming the chart stores the current symbol
        const drawingCount = this.chart.drawingTools.length;

        const setElText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setElText('global-menu-price-text', formattedPrice);
        setElText('global-menu-alert-text', `${symbol} at ${formattedPrice}`);
        setElText('global-menu-drawing-count', drawingCount);

        this.menu.style.display = 'block';

        // Flip menu if it goes off screen
        const menuRect = this.menu.getBoundingClientRect();
        if (x + menuRect.width > window.innerWidth) x -= menuRect.width;
        if (y + menuRect.height > window.innerHeight) y -= menuRect.height;

        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
    }

    hide() {
        if (this.menu) this.menu.style.display = 'none';
        this.clickPos = null;
        this.clickPrice = null;
        this.clickTimestamp = null;
    }

    formatPrice(price) {
        if (price === null || price === undefined) return '---';
        return price.toFixed(2); // Format as needed based on instrument precision
    }

    executeAction(action) {
        if (!this.chart) return;

        switch (action) {
            case 'reset': 
                if (this.chart.autoScalePrice !== undefined) this.chart.autoScalePrice = true;
                if (this.chart.autoShift !== undefined) this.chart.autoShift = true;
                this.chart.setInitialView();
                this.chart.render();
                break;
            case 'copy-price':
                if (navigator.clipboard && this.clickPrice) {
                    navigator.clipboard.writeText(this.formatPrice(this.clickPrice));
                }
                break;
            case 'paste':
                console.log('Paste clicked');
                break;
            case 'add-alert':
                console.log(`Add alert for ${this.clickPrice}`);
                break;
            case 'lock-cursor':
                console.log('Lock cursor clicked');
                break;
            case 'table-view':
                if (window.tableViewController) {
                    window.tableViewController.show();
                }
                break;
        }

        this.hide();
    }
}
