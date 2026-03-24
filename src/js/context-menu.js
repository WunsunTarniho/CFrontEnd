export class ContextMenuController {
    constructor(chart) {
        this.chart = chart;
        this.menu = document.getElementById('chart-context-menu');
        this.activeTool = null;
        this.init();
    }

    init() {
        if (!this.chart || !this.chart.container) return;

        // Prevent context menu on chart container
        this.chart.container.addEventListener('contextmenu', (e) => {
            const pos = this.getMousePos(e);
            const tool = this.chart.findDrawingAtPos(pos);

            if (tool) {
                e.preventDefault();
                this.show(e.clientX, e.clientY, tool);
            } else {
                this.hide();
            }
        });

        // Hide menu on click outside
        document.addEventListener('mousedown', (e) => {
            if (this.menu && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Action Listeners
        const getEl = (id) => document.getElementById(id);
        
        if (getEl('order-front')) getEl('order-front').onclick = () => this.executeAction('front');
        if (getEl('order-forward')) getEl('order-forward').onclick = () => this.executeAction('forward');
        if (getEl('order-backward')) getEl('order-backward').onclick = () => this.executeAction('backward');
        if (getEl('order-back')) getEl('order-back').onclick = () => this.executeAction('back');
        if (getEl('menu-clone')) getEl('menu-clone').onclick = () => this.executeAction('clone');
        if (getEl('menu-lock')) getEl('menu-lock').onclick = () => this.executeAction('lock');
        if (getEl('menu-hide')) getEl('menu-hide').onclick = () => this.executeAction('hide');
        if (getEl('menu-remove')) getEl('menu-remove').onclick = () => this.executeAction('remove');
        
        if (getEl('menu-settings')) {
            getEl('menu-settings').onclick = () => {
                if (window.toolSettingsController) {
                    window.toolSettingsController.show(this.activeTool);
                }
                this.hide();
            };
        }
        
        if (getEl('menu-object-tree')) {
            getEl('menu-object-tree').onclick = () => {
                if (window.sidebarController) {
                    window.sidebarController.switchTab('diagram-view');
                }
                this.hide();
            };
        }
    }

    getMousePos(e) {
        if (!this.chart || !this.chart.canvas) return { x: 0, y: 0 };
        const rect = this.chart.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    show(x, y, tool) {
        if (!this.menu) return;
        this.activeTool = tool;
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
        this.activeTool = null;
    }

    executeAction(action) {
        if (!this.activeTool || !this.chart) return;

        switch (action) {
            case 'front': this.chart.bringToFront(this.activeTool); break;
            case 'forward': this.chart.bringForward(this.activeTool); break;
            case 'backward': this.chart.sendBackward(this.activeTool); break;
            case 'back': this.chart.sendToBack(this.activeTool); break;
            case 'clone': this.chart.cloneDrawing(this.activeTool); break;
            case 'lock': this.activeTool.isLocked = !this.activeTool.isLocked; break;
            case 'hide': this.activeTool.isHidden = !this.activeTool.isHidden; break;
            case 'remove':
                this.chart.drawingTools = this.chart.drawingTools.filter(t => t !== this.activeTool);
                if (this.chart.selectedTool === this.activeTool) this.chart.selectedTool = null;
                this.chart.markToolDirty(this.activeTool, 'delete');
                break;
        }

        // Trigger sync for state changes
        if (['lock', 'hide', 'remove'].includes(action)) {
            if (action !== 'remove') {
                this.chart.markToolDirty(this.activeTool, 'update');
            }
        } else if (['front', 'forward', 'backward', 'back'].includes(action)) {
            // Visual order changed, sync all tools to update their orderIndex
            this.chart.drawingTools.forEach(tool => {
                this.chart.markToolDirty(tool, 'update');
            });
        }

        this.chart.render();
        if (window.sidebarController) {
            window.sidebarController.updateObjectTree();
        }
        this.hide();
    }
}
