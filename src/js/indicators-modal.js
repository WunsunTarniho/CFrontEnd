/**
 * IndicatorsModalController - Handles the UI for searching and managing indicators.
 */
export class IndicatorsModalController {
    constructor(chart) {
        this.chart = chart;
        this.modal = document.getElementById('indicator-modal-backdrop');
        this.openBtn = document.getElementById('open-indicators-modal');
        this.closeBtn = document.getElementById('close-indicators-modal');
        this.sidebarItems = document.querySelectorAll('.sidebar-item');
        this.searchInput = document.getElementById('indicator-search');
        this.listEmpty = document.getElementById('indicators-list-empty');
        this.listContainer = document.getElementById('indicators-list-container');
        this.createBtn = document.getElementById('create-new-script');
        
        this.currentTab = 'my-scripts';
        this.indicators = [];

        this.init();
    }

    init() {
        if (!this.modal) return;

        this.openBtn?.addEventListener('click', () => this.show());
        this.closeBtn?.addEventListener('click', () => this.hide());
        
        this.sidebarItems.forEach(item => {
            item.addEventListener('click', () => {
                this.setActiveTab(item.dataset.tab);
            });
        });

        this.searchInput?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        this.createBtn?.addEventListener('click', () => {
            this.handleCreateScript();
        });

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });
    }

    show() {
        this.modal.style.display = 'flex';
        this.fetchUserIndicators();
    }

    hide() {
        this.modal.style.display = 'none';
    }

    setActiveTab(tab) {
        this.currentTab = tab;
        this.sidebarItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        if (tab === 'my-scripts') {
            this.fetchUserIndicators();
        } else {
            this.renderEmptyState("Coming Soon", `The ${tab} library is under development.`);
        }
    }

    async fetchUserIndicators() {
        try {
            const response = await fetch('http://localhost:5000/api/v1/indicators?userId=1');
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                this.indicators = result.data;
                this.renderIndicators(this.indicators);
            } else {
                this.renderEmptyState("No personal scripts, yet", "Start creating your own indicators with ZenScript");
            }
        } catch (error) {
            console.error("Failed to fetch indicators:", error);
            this.renderEmptyState("Error", "Failed to connect to the backend.");
        }
    }

    renderIndicators(items) {
        this.listEmpty.style.display = 'none';
        this.listContainer.style.display = 'flex';
        this.listContainer.className = 'indicators-list';
        this.listContainer.innerHTML = '';

        items.forEach(ind => {
            const item = document.createElement('div');
            item.className = 'indicator-item';
            item.innerHTML = `
                <div class="favorite-btn" title="Add to favorites">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </div>
                <div class="indicator-name">${ind.name}</div>
                <div class="item-actions">
                    <div class="action-btn edit" title="Edit source code">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
                        </svg>
                    </div>
                    <div class="action-btn delete" title="Remove script">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </div>
                </div>
            `;

            // Click on row (anywhere except actions) -> Add to chart
            item.addEventListener('click', (e) => {
                if (e.target.closest('.item-actions') || e.target.closest('.favorite-btn')) return;
                this.chart.addIndicator(ind.name, ind.script, ind.id);
                this.hide();
            });

            // Edit button
            item.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                if (window.scriptEditorController) {
                    window.scriptEditorController.show(ind);
                }
            });

            // Delete button
            item.querySelector('.delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = ind.id;
                if (confirm(`Are you sure you want to delete "${ind.name}"?`)) {
                    await this.deleteIndicator(id);
                }
            });

            // Favorite button
            item.querySelector('.favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                e.currentTarget.classList.toggle('active');
            });

            this.listContainer.appendChild(item);
        });
    }

    async deleteIndicator(id) {
        try {
            const response = await fetch(`http://localhost:5000/api/v1/indicators/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                this.fetchUserIndicators();
            } else {
                alert("Error deleting script: " + result.message);
            }
        } catch (error) {
            console.error("Delete failed:", error);
        }
    }

    renderEmptyState(title, message) {
        this.listContainer.style.display = 'none';
        this.listEmpty.style.display = 'flex';
        this.listEmpty.querySelector('h3').textContent = title;
        this.listEmpty.querySelector('p').textContent = message;
        
        // Only show create button on my-scripts tab
        this.createBtn.style.display = (this.currentTab === 'my-scripts') ? 'block' : 'none';
    }

    handleSearch(query) {
        const filtered = this.indicators.filter(ind => 
            ind.name.toLowerCase().includes(query.toLowerCase())
        );
        this.renderIndicators(filtered);
    }

    handleCreateScript() {
        this.hide();
        if (window.scriptEditorController) {
            window.scriptEditorController.show();
        }
    }

    async saveScript(name, script) {
        try {
            const response = await fetch('http://localhost:5000/api/v1/indicators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, script, userId: "1" })
            });
            const result = await response.json();
            if (result.success) {
                this.fetchUserIndicators();
            }
        } catch (error) {
            alert("Failed to save script");
        }
    }
}
