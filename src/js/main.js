import Chartify from '../../Chartify/lib/Chartify.js';
import { bulkSyncDrawingTools, getDrawingTools, searchStock, findStock } from './service.js';
import { ToolbarManager } from './toolbar.js';
import { SidebarController } from './sidebar.js';
import { ContextMenuController } from './context-menu.js';
import { GlobalContextMenuController } from './global-context-menu.js';
import { ToolSettingsController } from './settings.js';
import { TableViewController } from './table-view.js';
import { IndicatorsModalController } from './indicators-modal.js';
import { ScriptEditorController } from './script-editor.js';
import { LayoutMenuController } from './layout-menu-controller.js';
import { ChartSettingsController } from './chart-settings.js';
import { 
    TF_CONFIG, 
    candleCache, 
    handleTimeframeChange, 
    fetchStockData, 
    loadStockData, 
    saveCurrentLayout,
    setDateRangeAndInterval 
} from './data-service.js';
import { 
    updateClock, 
    setupNumericConstraints, 
    toggleTfPopup, 
    closeTfPopup, 
    setTfActive,
    setChartModeActive,
    setSearchTicker
} from './utils.js';

// Global state / Legacy support
window.TF_CONFIG = TF_CONFIG;
window.candleCache = candleCache;
window.handleTimeframeChange = handleTimeframeChange;
window.fetchStockData = fetchStockData;
window.loadStockData = loadStockData;
window.setDateRangeAndInterval = setDateRangeAndInterval;
window.toggleTfPopup = toggleTfPopup;
window.closeTfPopup = closeTfPopup;
window.setTfActive = setTfActive;
window.setChartModeActive = setChartModeActive;
window.saveCurrentLayout = saveCurrentLayout;
window.searchStock = searchStock;
window.setSearchTicker = setSearchTicker;

// Initialize the managers when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Instantiate core chart
    window.chart = new Chartify('chart-container', {
        timeframe: '1d',
        isShowDrawing: true,
        onSync: bulkSyncDrawingTools,
        onLoadMore: async (earliestTs) => {
            const stock = { ticker: window.chart.symbol };
            const timeframe = window.chart.timeframe;
            const olderBaseData = await fetchStockData(stock, timeframe, earliestTs);

            if (olderBaseData && olderBaseData.length > 0) {
                window.chart.prependData(olderBaseData);
            } else {
                window.chart.isLoadingMore = false;
                window.chart.isHistoryExhausted = true; // Stop asking for more
            }
        },
        onSelectionChange: (tool) => {
            if (window.sidebarController && !window.sidebarController.isEditingName) {
                window.sidebarController.updateObjectTree();
            }
            if (!tool && window.toolSettingsController) {
                window.toolSettingsController.hide();
            }
        },
        onRemoveIndicator: (indicator) => {
            const activeScript = localStorage.getItem('activeZenScript');
            if (activeScript) {
                try {
                    const stored = JSON.parse(activeScript);
                    if (stored.code === indicator.script) {
                        localStorage.removeItem('activeZenScript');
                        console.log("Deactivated script persistent state removed.");
                    }
                } catch(e) {}
            }
        }
    });

    // Instantiate controllers
    new ToolbarManager();
    window.sidebarController = new SidebarController();

    // Context menu and tool settings depend on window.chart being fully initialized
    // (though Chartify constructor is sync, some internals might not be ready)
    window.contextMenuController = new ContextMenuController(window.chart);
    window.globalContextMenuController = new GlobalContextMenuController(window.chart);
    window.toolSettingsController = new ToolSettingsController(window.chart);
    window.tableViewController = new TableViewController(window.chart);
    window.indicatorsModalController = new IndicatorsModalController(window.chart);
    window.scriptEditorController = new ScriptEditorController(window.chart);
    window.layoutMenuController = new LayoutMenuController(window.chart);
    window.chartSettingsController = new ChartSettingsController(window.chart);

    // Load global settings
    const savedGlobalSettings = localStorage.getItem('chart_global_settings');
    if (savedGlobalSettings) {
        try {
            const settings = JSON.parse(savedGlobalSettings);
            Object.assign(window.chart, settings);
            window.chart.render(true);
        } catch (e) {
            console.error('Error loading global settings:', e);
        }
    }

    // Initial tool setup and logic
    setupNumericConstraints();
    setInterval(updateClock, 1000);
    updateClock();
    
    // Search Modal and Stock List Logic
    setupSearchModal();
    setupChartTypeSelector();

    // Initial data load
    await loadStockData();

    // Load active ZenScript if exists
    const activeScript = localStorage.getItem('activeZenScript');
    if (activeScript) {
        try {
            const { name, code } = JSON.parse(activeScript);
            if (window.chart && code) {
                window.chart.addIndicator(name, code);
            }
        } catch (e) {
            console.error("Error loading active script:", e);
        }
    }
});

// Undo / Redo Button Listeners
document.getElementById('undo-btn')?.addEventListener('click', () => {
    if (window.chart) window.chart.undo();
});
document.getElementById('redo-btn')?.addEventListener('click', () => {
    if (window.chart) window.chart.redo();
});

// Search Modal functions
function setupSearchModal() {
    const searchInput = document.getElementById('stock-search');
    const searchResults = document.getElementById('search-results');
    const searchModalBackdrop = document.getElementById('search-modal-backdrop');
    const openSearchBtn = document.getElementById('open-search-modal');
    const closeSearchBtn = document.getElementById('close-search-modal');

    if (!searchInput || !searchModalBackdrop) return;

    function openSearchModal() {
        searchModalBackdrop.style.display = 'flex';
        searchInput.value = '';
        renderRecentStocks();
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeSearchModal() {
        searchModalBackdrop.style.display = 'none';
    }

    function renderRecentStocks() {
        const recent = JSON.parse(localStorage.getItem('recent_stocks') || '[]');
        if (recent.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No recent searches</div>';
            searchResults.style.display = 'block';
            return;
        }

        searchResults.innerHTML = '<div class="search-category-title">Recent Searches</div>';
        recent.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'search-item';
            const displayTicker = stock.ticker.includes('.') ? stock.ticker.split('.')[0] : stock.ticker;
            div.innerHTML = `
                <span class="search-ticker">${displayTicker}</span>
                <span class="search-name">${stock.name}</span>
            `;
            div.dataset.id = stock.ticker;
            searchResults.appendChild(div);
        });
        searchResults.style.display = 'block';
    }

    function saveRecentStock(stock) {
        let recent = JSON.parse(localStorage.getItem('recent_stocks') || '[]');
        // Remove if exists to re-insert at top
        recent = recent.filter(s => s.ticker !== stock.ticker);
        recent.unshift(stock);
        // Limit to 10
        if (recent.length > 10) recent.pop();
        localStorage.setItem('recent_stocks', JSON.stringify(recent));
    }

    openSearchBtn?.addEventListener('click', openSearchModal);
    closeSearchBtn?.addEventListener('click', closeSearchModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModalBackdrop.style.display === 'flex') {
            closeSearchModal();
        }
    });

    searchModalBackdrop.addEventListener('click', (e) => {
        if (e.target === searchModalBackdrop) {
            closeSearchModal();
        }
    });

    searchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim();
        if (!searchTerm) {
            renderRecentStocks();
            return;
        }

        searchResults.innerHTML = '';
        const response = await searchStock(searchTerm);
        const filteredStocks = response.data;

        filteredStocks.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'search-item';
            
            // Clean ticker: if it has '.' (Yahoo), only show the first part
            const displayTicker = stock.ticker.includes('.') ? stock.ticker.split('.')[0] : stock.ticker;
            
            div.innerHTML = `
                <span class="search-ticker">${displayTicker}</span>
                <span class="search-name">${stock.name}</span>
            `;
            div.dataset.id = stock.ticker;
            searchResults.appendChild(div);
        });

        searchResults.style.display = filteredStocks.length > 0 ? 'block' : 'none';
    });

    searchResults.addEventListener('click', async (e) => {
        const item = e.target.closest('.search-item');
        if (item) {
            const tickerSpan = item.querySelector('.search-ticker');
            const nameSpan = item.querySelector('.search-name');
            const ticker = tickerSpan ? tickerSpan.textContent : '';
            const name = nameSpan ? nameSpan.textContent : '';
            
            // Save to recent
            saveRecentStock({ ticker: item.dataset.id, name });

            searchInput.value = ticker;
            searchInput.dataset.stockId = item.dataset.id;
            closeSearchModal();
            await loadStockData();
        }
    });
}

// Chart Type Selector functions
function setupChartTypeSelector() {
    const chartTypeBtn = document.getElementById('chart-type-trigger');
    const chartTypeDropdown = document.getElementById('chart-type-dropdown');
    const chartTypeItems = document.querySelectorAll('.chart-type-item');
    const currentChartLabel = document.getElementById('current-chart-label');

    if (!chartTypeBtn || !chartTypeDropdown) return;

    chartTypeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chartTypeDropdown.classList.toggle('show');
        chartTypeBtn.classList.toggle('active');
    });

    chartTypeItems.forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.dataset.mode;
            const svgContent = item.querySelector('svg').cloneNode(true);
            svgContent.id = 'current-chart-icon';
            const labelText = item.textContent.trim();

            const currentIcon = document.getElementById('current-chart-icon');
            if (currentIcon) currentIcon.replaceWith(svgContent);
            if (currentChartLabel) currentChartLabel.textContent = labelText;

            chartTypeItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            chartTypeDropdown.classList.remove('show');
            chartTypeBtn.classList.remove('active');

            if (window.chart) {
                window.chart.setMode(mode);
                if (typeof window.saveCurrentLayout === 'function') {
                    window.saveCurrentLayout();
                }
            }
            if (window.chartSettingsController) window.chartSettingsController.showSymbolSection(mode);
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#chart-type-container')) {
            chartTypeDropdown.classList.remove('show');
            chartTypeBtn.classList.remove('active');
        }
    });
}

// Handle option clicks for timeframe popup
document.addEventListener('click', async (e) => {
    const opt = e.target.closest('.tf-option');
    if (!opt) return;
    const tf = opt.dataset.tf;
    if (!tf) return;
    closeTfPopup();
    await handleTimeframeChange(tf);
});
