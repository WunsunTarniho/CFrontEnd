
import { 
    getLayouts, 
    saveLayout, 
    updateLayout, 
    deleteLayout, 
    touchLayout,
    setDefaultLayout 
} from './service.js';
import { saveCurrentLayout, loadStockData } from './data-service.js';

export class LayoutMenuController {
    constructor(chart) {
        this.chart = chart;
        this.trigger = document.getElementById('layout-menu-trigger');
        this.dropdown = document.getElementById('layout-dropdown');
        this.nameLabel = document.getElementById('current-layout-name');
        this.listContainer = document.getElementById('layout-list-quick-switch');
        
        this.init();
    }

    init() {
        if (!this.trigger || !this.dropdown) return;

        // Toggle dropdown
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.dropdown.classList.contains('show') && !this.dropdown.contains(e.target)) {
                this.dropdown.classList.remove('show');
            }
        });

        // Setup individual actions
        this.setupActions();
        
        // Listen for layout changes to update the label
        window.addEventListener('layout-changed', (e) => {
            if (e.detail && e.detail.name) {
                this.nameLabel.textContent = e.detail.name;
            }
        });


    }

    toggleDropdown() {
        this.dropdown.classList.toggle('show');
        if (this.dropdown.classList.contains('show')) {
            this.renderLayoutList();
        }
    }

    async renderLayoutList() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '<div style="padding: 10px; color: #787b86; font-size: 12px;">Loading layouts...</div>';

        try {
            const layouts = await getLayouts();
            this.listContainer.innerHTML = '';

            if (layouts.length === 0) {
                this.listContainer.innerHTML = '<div style="padding: 10px; color: #787b86; font-size: 12px;">No layouts found</div>';
                return;
            }

            layouts.forEach(layout => {
                const isActive = layout.id === this.chart.currentLayoutId;
                const item = document.createElement('div');
                item.className = `layout-list-item ${isActive ? 'active' : ''}`;
                item.innerHTML = `
                    <span>${layout.name}</span>
                    <div class="item-check">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                `;

                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (isActive) return;

                    try {
                        // Warn if unsaved changes exist
                        if (this.chart.isLayoutDirty || this.chart.pendingActions.size > 0) {
                            if (confirm('You have unsaved changes. Save current layout before switching?')) {
                                await this.chart.syncWithDatabase();
                                await saveCurrentLayout();
                            }
                        }
                        
                        // 2. Switch layout
                        await loadStockData(layout.id);
                        this.dropdown.classList.remove('show');
                    } catch (err) {
                        console.error('Failed to switch layout:', err);
                    }
                });

                this.listContainer.appendChild(item);
            });
        } catch (error) {
            this.listContainer.innerHTML = '<div style="padding: 10px; color: #f7525f; font-size: 12px;">Failed to load</div>';
        }
    }

    setupActions() {
        // Save
        document.getElementById('layout-save')?.addEventListener('click', async () => {
            if (this.chart) {
                await this.chart.syncWithDatabase();
                await saveCurrentLayout();
                this.dropdown.classList.remove('show');
                // alert('Layout saved');
            }
        });

        // Rename
        document.getElementById('layout-rename')?.addEventListener('click', async () => {
            const currentName = this.nameLabel.textContent;
            const newName = prompt('Enter new layout name:', currentName);
            if (newName && newName !== currentName) {
                try {
                    await updateLayout(this.chart.currentLayoutId, { name: newName });
                    this.nameLabel.textContent = newName;
                    this.dropdown.classList.remove('show');
                    
                    // Refresh sidebar if it's open
                    if (window.sidebarController) {
                        const layouts = await getLayouts();
                        window.sidebarController.currentLayouts = layouts;
                    }
                } catch (e) {
                    alert('Failed to rename layout');
                }
            }
        });

        // Make a Copy
        document.getElementById('layout-make-copy')?.addEventListener('click', async () => {
            const currentName = this.nameLabel.textContent;
            const newName = prompt('Enter copy name:', `${currentName} (Copy)`);
            if (newName) {
                try {
                    // Sync current state before copying
                    if (this.chart) {
                        await this.chart.syncWithDatabase();
                        await saveCurrentLayout();
                    }

                    const chartState = this.chart.getChartState();
                    const indicators = this.chart.indicators.map(ind => ({
                        indicatorId: ind.indicatorId || ind.id,
                        settings: ind.settings,
                        isVisible: ind.isVisible !== false
                    }));

                    const newLayout = await saveLayout({
                        name: newName,
                        userId: "1",
                        sourceLayoutId: this.chart.currentLayoutId,
                        lastTicker: this.chart.symbol,
                        lastExchange: this.chart.exchange,
                        chartState,
                        indicators
                    });
                    
                    // 2. Switch to it
                    if (typeof loadStockData === 'function') {
                        await loadStockData(newLayout.id);
                    }
                    this.dropdown.classList.remove('show');
                } catch (e) {
                    alert('Failed to copy layout');
                }
            }
        });

        // Create New
        document.getElementById('layout-new')?.addEventListener('click', () => {
            if (window.sidebarController) {
                this.dropdown.classList.remove('show');
                window.sidebarController.createNewLayout();
            }
        });

        // Open Layout
        document.getElementById('layout-open')?.addEventListener('click', () => {
            if (window.sidebarController) {
                this.dropdown.classList.remove('show');
                window.sidebarController.toggleLayoutManager();
            }
        });


    }
}
