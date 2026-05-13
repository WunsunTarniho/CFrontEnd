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
import { IndicatorSettingsController } from './indicator-settings.js';

import {
    changeTimeframe,
    fetchMarketHistory,
    initMarketSession,
    saveCurrentLayout
} from './data-service.js';
import {
    updateClock,
    setupNumericConstraints,
    toggleTfPopup,
    closeTfPopup,
    setTfActive,
    setChartModeActive,
    setSearchTicker,
    getTickerLogo,
    getExchangeLogo
} from './utils.js';

// Global state / Legacy support
window.changeTimeframe = changeTimeframe;
window.fetchMarketHistory = fetchMarketHistory;
window.initMarketSession = initMarketSession;
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
            const marketInfo = {
                symbol: window.chart.symbol,
                exchange: window.chart.exchange,
            };
            const timeframe = window.chart.timeframe;
            const response = await fetchMarketHistory(marketInfo, timeframe, earliestTs);
            const olderBaseData = response.candles || [];

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
            // Indicator removed from chart
        },
        onTimeframeChange: (tf, v, u) => {
            if (window.changeTimeframe) {
                return window.changeTimeframe(tf, v, u, true);
            }
        },
        onSymbolChange: (symbol, exchange, originalSymbol) => {
            if (window.initMarketSession) {
                return window.initMarketSession(null, { symbol, exchange, original_symbol: originalSymbol }, true, true);
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
    window.indicatorSettingsController = new IndicatorSettingsController(window.chart);


    // Link indicator actions to controllers
    window.chart.onIndicatorSource = (id, script) => {
        const ind = window.chart.indicators.find(i => i.id === id || i.indicatorId === id);
        window.scriptEditorController.show({
            id: id,
            name: ind ? ind.name : "Indicator",
            script: script
        });
    };

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
    await initMarketSession();

    // FINAL RESET: Ensure initial load doesn't trigger "unsaved changes" and starts with clean history
    if (window.chart) {
        window.chart.isLayoutDirty = false;
        window.chart.clearHistory();
        if (window.chart._notifyDirtyChange) window.chart._notifyDirtyChange();
    }
});

// Undo / Redo Button Listeners
document.getElementById('undo-btn')?.addEventListener('click', () => {
    if (window.chart) window.chart.undo();
});
document.getElementById('redo-btn')?.addEventListener('click', () => {
    if (window.chart) window.chart.redo();
});
document.getElementById('top-bar-save-btn')?.addEventListener('click', async () => {
    if (window.chart) {
        await window.chart.syncWithDatabase();
        if (typeof window.saveCurrentLayout === 'function') {
            await window.saveCurrentLayout();
        }
    }
});

// Global Shortcuts
document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (window.chart) {
            await window.chart.syncWithDatabase();
            if (typeof window.saveCurrentLayout === 'function') {
                await window.saveCurrentLayout();
            }
        }
    }
});

// Dirty State / Unsaved Changes UI Listener
window.addEventListener('chartify:dirty-change', (e) => {
    const saveBtn = document.getElementById('top-bar-save-btn');
    if (saveBtn) {
        if (e.detail.isDirty) {
            saveBtn.classList.add('unsaved-changes');
        } else {
            saveBtn.classList.remove('unsaved-changes');
        }
    }
});

// Search Modal functions
function setupSearchModal() {
    const searchInput = document.getElementById('stock-search');
    const searchResults = document.getElementById('search-results');
    const searchModalBackdrop = document.getElementById('search-modal-backdrop');
    const openSearchBtn = document.getElementById('open-search-modal');
    const closeSearchBtn = document.getElementById('close-search-modal');
    const exchangeFilterTrigger = document.getElementById('exchange-filter-trigger');
    const exchangeFilterDropdown = document.getElementById('exchange-filter-dropdown');
    const currentExchangeLabel = document.getElementById('current-exchange-filter');
    let currentExchange = 'all';
    const topBarObBtn = document.getElementById('top-bar-orderbook-btn');

    if (topBarObBtn) {
        topBarObBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.sidebarController) {
                window.sidebarController.switchTab('orderbook-view');
            }
        });
    }

    if (!searchInput || !searchModalBackdrop) return;

    function openSearchModal() {
        searchModalBackdrop.style.display = 'flex';
        searchInput.value = '';
        currentExchange = 'all';
        currentExchangeLabel.textContent = 'All sources';
        document.querySelectorAll('.filter-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === 'all');
        });
        renderRecentStocks();
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeSearchModal() {
        searchModalBackdrop.style.display = 'none';
    }




    function renderRecentStocks() {
        const recent = JSON.parse(localStorage.getItem('recent_stocks') || '[]');
        const noResultsHtml = `
            <div class="search-no-results">
                <div class="search-no-results-icon">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M12 2L4 7h16l-8-5zM3 8h18v2H3V8zm2 3h14c0 4-3 7-7 7s-7-3-7-7z" />
                        <path d="M12 18v4m-3-2l3 2 3-2" />
                    </svg>
                </div>
                <div class="search-no-results-text">No symbols match your criteria</div>
            </div>
        `;

        if (recent.length === 0) {
            searchResults.innerHTML = noResultsHtml;
            searchResults.style.display = 'block';
            return;
        }

        searchResults.innerHTML = '';
        
        let filteredRecent = recent;
        if (currentExchange !== 'all') {
            filteredRecent = recent.filter(t => 
                (t.primary_exchange || t.exchange || '').toUpperCase() === currentExchange.toUpperCase()
            );
        }

        if (filteredRecent.length === 0 && currentExchange !== 'all') {
            searchResults.innerHTML = noResultsHtml;
            searchResults.style.display = 'block';
            return;
        }

        filteredRecent.forEach(ticker => {
            const div = document.createElement('div');
            div.className = 'search-item';
            const displayTicker = ticker.symbol;
            const exch = ticker.primary_exchange || ticker.exchange || '';
            const market = ticker.market;
            const type = ticker.type;
            const logoUrl = getTickerLogo(ticker.base || displayTicker, ticker.originalSymbol || ticker.original_symbol, market);

            div.innerHTML = `
                <div class="search-item-left">
                    <div class="search-item-icon">
                        <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.parentElement.innerHTML='${(displayTicker || '?')[0]}'">
                    </div>
                    <span class="search-ticker">${displayTicker}</span>
                </div>
                <div class="search-item-description">${ticker.name}</div>
                <div class="search-item-right">
                    <div class="search-item-tags">
                        <span class="search-tag">${type}</span>
                        <span class="search-tag">${market}</span>
                    </div>
                    <div class="search-exchange-group">
                        <span class="search-exchange-name">${exch}</span>
                        <div class="search-exchange-logo">
                            ${(() => {
                                const exLogo = getExchangeLogo(exch, ticker.mic_code);
                                return exLogo ? `<img src="${exLogo}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">` : '';
                            })()}
                        </div>
                    </div>
                </div>
            `;
            div.dataset.symbol = ticker.symbol;
            div.dataset.base = ticker.base || '';
            div.dataset.quote = ticker.quote || '';
            div.dataset.exchange = exch;
            div.dataset.market = market;
            div.dataset.type = type;
            div.dataset.originalSymbol = ticker.originalSymbol || ticker.original_symbol || '';
            searchResults.appendChild(div);
        });
        searchResults.style.display = 'block';
    }

    function saveRecentStock(ticker) {
        let recent = JSON.parse(localStorage.getItem('recent_stocks') || '[]');
        // Remove if exists to re-insert at top (check BOTH symbol and exchange)
        recent = recent.filter(s => s.symbol !== ticker.symbol || s.primary_exchange !== ticker.primary_exchange);
        recent.unshift({
            id: ticker.id,
            symbol: ticker.symbol,
            name: ticker.name,
            base: ticker.base,
            quote: ticker.quote,
            primary_exchange: ticker.primary_exchange || ticker.exchange,
            market: ticker.market,
            type: ticker.type,
            originalSymbol: ticker.originalSymbol || ticker.original_symbol || ''
        });
        // Limit to 10
        if (recent.length > 10) recent.pop();
        console.log(recent);
        localStorage.setItem('recent_stocks', JSON.stringify(recent));
    }

    openSearchBtn?.addEventListener('click', openSearchModal);
    closeSearchBtn?.addEventListener('click', closeSearchModal);

    exchangeFilterTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        exchangeFilterDropdown?.classList.toggle('show');
    });

    exchangeFilterDropdown?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent modal from closing if backdrop has a listener
        const opt = e.target.closest('.filter-option');
        if (opt) {
            currentExchange = opt.dataset.value;
            currentExchangeLabel.textContent = opt.textContent;
            
            document.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            exchangeFilterDropdown.classList.remove('show');
            console.log("Dropdown closed for", currentExchange);
            
            // Trigger search again with new filter
            const searchTerm = searchInput.value.trim();
            if (searchTerm) {
                searchInput.dispatchEvent(new Event('input'));
            } else {
                renderRecentStocks();
            }
        }
    });

    document.addEventListener('click', () => {
        exchangeFilterDropdown?.classList.remove('show');
    });

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
        let filteredTickers = response.data || [];
        
        if (currentExchange !== 'all') {
            filteredTickers = filteredTickers.filter(t => 
                (t.primary_exchange || t.exchange || '').toUpperCase() === currentExchange.toUpperCase()
            );
        }

        if (filteredTickers.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    <div class="search-no-results-icon">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M12 2L4 7h16l-8-5zM3 8h18v2H3V8zm2 3h14c0 4-3 7-7 7s-7-3-7-7z" />
                            <path d="M12 18v4m-3-2l3 2 3-2" />
                        </svg>
                    </div>
                    <div class="search-no-results-text">No symbols match your criteria</div>
                </div>
            `;
            searchResults.style.display = 'block';
            return;
        }

        filteredTickers.forEach(ticker => {
            const div = document.createElement('div');
            div.className = 'search-item';

            const displayTicker = ticker.symbol;
            const exch = ticker.primary_exchange || ticker.exchange || '';
            const market = ticker.market;
            const type = ticker.type;
            const logoUrl = getTickerLogo(ticker.base || displayTicker, ticker.originalSymbol || ticker.original_symbol, market);

            div.innerHTML = `
                <div class="search-item-left">
                    <div class="search-item-icon">
                        <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.parentElement.innerHTML='${(displayTicker || '?')[0]}'">
                    </div>
                    <span class="search-ticker">${displayTicker}</span>
                </div>
                <div class="search-item-description">${ticker.name}</div>
                <div class="search-item-right">
                    <div class="search-item-tags">
                        <span class="search-tag">${type}</span>
                        <span class="search-tag">${market}</span>
                    </div>
                    <div class="search-exchange-group">
                        <span class="search-exchange-name">${exch}</span>
                        <div class="search-exchange-logo">
                            ${(() => {
                                const exLogo = getExchangeLogo(exch, ticker.mic_code);
                                return exLogo ? `<img src="${exLogo}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">` : '';
                            })()}
                        </div>
                    </div>
                </div>
            `;
            div.dataset.symbol = ticker.symbol;
            div.dataset.exchange = exch;
            div.dataset.base = ticker.base;
            div.dataset.quote = ticker.quote;
            div.dataset.market = market;
            div.dataset.type = type;
            div.dataset.originalSymbol = ticker.originalSymbol || ticker.original_symbol || '';
            searchResults.appendChild(div);
        });

        searchResults.style.display = filteredTickers.length > 0 ? 'block' : 'none';
    });


    searchResults.addEventListener('click', async (e) => {
        const item = e.target.closest('.search-item');
        if (item) {
            const symbol = item.dataset.symbol || '';
            const name = item.querySelector('.search-item-description')?.textContent || '';
            const exchange = item.dataset.exchange || '';
            const originalSymbol = item.dataset.originalSymbol || '';

            // Save to recent
            saveRecentStock({ 
                symbol, 
                name,
                base: item.dataset.base,
                quote: item.dataset.quote,
                primary_exchange: exchange, 
                type: item.dataset.type,
                market: item.dataset.market,
                original_symbol: originalSymbol
            });

            searchInput.value = symbol;
            searchInput.dataset.symbol = symbol;
            searchInput.dataset.exchange = exchange;
            searchInput.dataset.type = item.dataset.type;
            searchInput.dataset.market = item.dataset.market;
            searchInput.dataset.base = item.dataset.base;
            searchInput.dataset.quote = item.dataset.quote;
            searchInput.dataset.originalSymbol = originalSymbol;
            closeSearchModal();

            // Capture current state in history before moving to new symbol
            if (window.chart) window.chart.saveHistory();

            await initMarketSession(null, { 
                symbol: symbol,
                exchange: exchange,
                original_symbol: originalSymbol,
                market: item.dataset.market,
                type: item.dataset.type
            });
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

    const updateUI = (mode) => {
        const item = Array.from(chartTypeItems).find(i => i.dataset.mode === mode);
        if (!item) return;

        const svgContent = item.querySelector('svg').cloneNode(true);
        svgContent.id = 'current-chart-icon';
        const labelText = item.textContent.trim();

        const currentIcon = document.getElementById('current-chart-icon');
        if (currentIcon) currentIcon.replaceWith(svgContent);
        if (currentChartLabel) currentChartLabel.textContent = labelText;

        chartTypeItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    };

    window.updateChartModeUI = updateUI;

    chartTypeItems.forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.dataset.mode;
            updateUI(mode);

            chartTypeDropdown.classList.remove('show');
            chartTypeBtn.classList.remove('active');

            if (window.chart) {
                window.chart.setMode(mode);
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
    const v = opt.dataset.v;
    const u = opt.dataset.u;
    if (!tf) return;
    closeTfPopup();
    await changeTimeframe(tf, v, u);
});
