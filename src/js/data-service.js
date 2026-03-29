import {
    getDrawingTools,
    searchStock,
    findStockByTicker,
    bulkSyncDrawingTools,
    getLayouts,
    saveLayout,
    updateLayout,
    deleteLayout,
    touchLayout,
    saveTickerPreference,
    getAllTickerPreferences
} from './service.js';
import { DEFAULT_WATCHLIST_SYMBOLS } from './constants.js';

// ── Item C: Smart Base Resolution ─────────────────────────────────────
export const TF_CONFIG = {
    '1s': { apiInterval: '1s', cacheKey: '1s', minutes: 1 / 60 },
    '5s': { apiInterval: '1s', cacheKey: '1s', minutes: 5 / 60 },
    '10s': { apiInterval: '1s', cacheKey: '1s', minutes: 10 / 60 },
    '15s': { apiInterval: '1s', cacheKey: '1s', minutes: 15 / 60 },
    '30s': { apiInterval: '1s', cacheKey: '1s', minutes: 30 / 60 },
    '45s': { apiInterval: '1s', cacheKey: '1s', minutes: 45 / 60 },
    '1m': { apiInterval: '1m', cacheKey: '1m', minutes: 1 },
    '2m': { apiInterval: '1m', cacheKey: '1m', minutes: 2 },
    '3m': { apiInterval: '3m', cacheKey: '3m', minutes: 3 },
    '5m': { apiInterval: '5m', cacheKey: '5m', minutes: 5 },
    '10m': { apiInterval: '5m', cacheKey: '5m', minutes: 10 },
    '15m': { apiInterval: '15m', cacheKey: '15m', minutes: 15 },
    '30m': { apiInterval: '30m', cacheKey: '30m', minutes: 30 },
    '45m': { apiInterval: '15m', cacheKey: '15m', minutes: 45 },
    '90m': { apiInterval: '30m', cacheKey: '30m', minutes: 90 },
    '1h': { apiInterval: '1h', cacheKey: '1h', minutes: 60 },
    '2h': { apiInterval: '2h', cacheKey: '2h', minutes: 120 },
    '4h': { apiInterval: '4h', cacheKey: '4h', minutes: 240 },
    '6h': { apiInterval: '6h', cacheKey: '6h', minutes: 360 },
    '12h': { apiInterval: '12h', cacheKey: '12h', minutes: 720 },
    '1d': { apiInterval: '1d', cacheKey: '1d', minutes: 1440 },
    '1w': { apiInterval: '1d', cacheKey: '1d', special: 'week' },
    '1mo': { apiInterval: '1d', cacheKey: '1d', special: 'month', months: 1 },
    '3mo': { apiInterval: '1d', cacheKey: '1d', special: 'quarter', months: 3 },
    '6mo': { apiInterval: '1d', cacheKey: '1d', special: 'halfyear', months: 6 },
    '12mo': { apiInterval: '1d', cacheKey: '1d', special: 'year', months: 12 },
};

export const candleCache = {};

// Fetch candles from API via backend proxy
export async function fetchStockData(stock, timeframe, endDateTs = null) {
    try {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'block';

        const ticker = stock.ticker;
        const apiBase = 'http://localhost:5000';
        let url = `${apiBase}/api/market/history?symbol=${ticker}&timeframe=${timeframe}&market=${stock.market}&exchange=${stock.exchange || ''}&limit=1000`;
        if (endDateTs) url += `&endDateTs=${endDateTs}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);

        const data = await response.json();
        // data is { candles: [], meta: { marketStatus: '...' } }
        return data || { candles: [], meta: { marketStatus: 'REGULAR' } };
    } catch (error) {
        console.error('Error fetching data from backend:', error);
        return { candles: [], meta: { marketStatus: 'REGULAR' } };
    } finally {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
    }
}

export async function loadStockData(layoutId = null, forcedStock = null) {
    if (!window.chart) return;
    window.chart.isLoading = true;

    // --- 1. Layout Logic First ---
    const BTC_ID = 'cb05e2be67f3d035ad46ec72';
    const layouts = await getLayouts();
    let activeLayout = layoutId ? layouts.find(l => l._id === layoutId) : layouts[0];

    // --- 2. Resolve Stock ID ---
    const searchInput = document.getElementById('stock-search');
    let stock_id;
    let selectedExchange = '';

    if (forcedStock) {
        stock_id = forcedStock._id || forcedStock.ticker;
        selectedExchange = forcedStock.primary_exchange || '';
    } else if (searchInput && searchInput.dataset.stockId) {
        // High priority: what the user just clicked in search modal
        stock_id = searchInput.dataset.stockId;
        selectedExchange = searchInput.dataset.exchange || '';
        // Clear it so it doesn't "stick" on subsequent timeframe/layout calls
        delete searchInput.dataset.stockId;
        delete searchInput.dataset.exchange;
    } else if (activeLayout && activeLayout.lastTickerId) {
        // Use last ticker from layout (covers initial load and layout switch)
        stock_id = activeLayout.lastTickerId.ticker || activeLayout.lastTickerId;
    } else {
        stock_id = window.chart.currentStockId || 'BTCUSDT';
    }

    // Resolve from Local Cache/DB Sync (last used for this ticker)
    if (!selectedExchange || selectedExchange === 'undefined') {
        const savedExch = localStorage.getItem(`last_exchange_${stock_id}`);
        if (savedExch) {
            selectedExchange = savedExch;
        } else {
            selectedExchange = 'BINANCE';
        }
    }
    console.log(`[loadStockData] Resolved Exchange for ${stock_id}: ${selectedExchange}`);

    // Final safety check for stock_id
    if (!stock_id || stock_id === 'undefined') {
        stock_id = 'BTCUSDT';
    }

    let timeframe = document.querySelector('.tf-option.active')?.dataset.tf || '1d';

    // Logic: Only override UI timeframe if:
    // 1. Initial page load (window.chart.symbol is null)
    // 2. We are explicitly switching to a DIFFERENT layout (layoutId exists and is new)
    const isInitialLoad = !window.chart?.symbol;
    const isLayoutSwitch = layoutId && layoutId !== window.chart?.currentLayoutId;

    if ((isLayoutSwitch || isInitialLoad) && activeLayout?.chartState?.timeframe) {
        timeframe = activeLayout.chartState.timeframe;
    }

    const response = await findStockByTicker(stock_id);
    let stock = response?.data;

    // Fallback if stock search fails completely
    if (!stock) {
        console.warn(`Stock ID ${stock_id} not found, falling back to BTCUSDT`);
        const fallbackRes = await findStockByTicker('BTCUSDT');
        stock = fallbackRes?.data || { ticker: 'BTCUSDT', _id: BTC_ID, name: 'Bitcoin', primary_exchange: 'BINANCE' };
    }

    // --- 3. Safety Check if Layout doesn't exist ---
    if (!activeLayout) {
        activeLayout = await saveLayout({
            name: 'Default Workspace',
            userId: "1",
            lastSymbol: stock?.ticker || 'BTCUSDT',
            lastTickerId: stock?._id || BTC_ID
        });
        layouts.unshift(activeLayout);
    }

    if (window.chart.symbol && window.chart.symbol !== stock.ticker) {
        // Unsubscribe from old symbol if it's not a default watchlist item
        if (!DEFAULT_WATCHLIST_SYMBOLS.some(s => s.ticker === window.chart.symbol)) {
            window.chart.unsubscribe(window.chart.symbol);
        }
        for (let key in candleCache) delete candleCache[key];
        window.chart.clearSymbol();
        window.chart.render();
    }

    // --- 3. Market-Based Timeframe Adjustment ---
    updateTimeframeOptions(stock.market);
    if ((stock.market === 'stocks' || stock.market === 'commodities') && timeframe.endsWith('s')) {
        timeframe = '1m';
        // Sync UI + Top Bar Label
        if (window.setTfActive) window.setTfActive(timeframe);
    }

    if (selectedExchange) stock.exchange = selectedExchange;

    if (selectedExchange) stock.exchange = selectedExchange;

    const responseData = await fetchStockData(stock, timeframe);

    const data = responseData.candles || [];
    const meta = responseData.meta || { marketStatus: 'REGULAR' };

    if (data.length > 0) {
        candleCache[stock.ticker + '_' + timeframe] = data;
        await window.chart.syncWithDatabase();

        window.chart.symbol = stock.ticker;
        window.chart.instrument = stock.name;
        window.chart.currency = stock.currency_symbol ?? (stock.currency_name ? stock.currency_name.toUpperCase() : '');
        window.chart.exchange = selectedExchange || stock.exchange || stock.primary_exchange;
        window.chart.market = stock.market;

        // Persist Choice (Local + DB)
        if (window.chart.exchange) {
            localStorage.setItem(`last_exchange_${stock.ticker}`, window.chart.exchange);
            if (stock._id) localStorage.setItem(`last_exchange_${stock._id}`, window.chart.exchange);
            saveTickerPreference(stock.ticker, window.chart.exchange).catch(e => console.error("DB save error:", e));
        }
        window.chart.marketStatus = meta.marketStatus;

        window.chart.rawData = data;

        // Apply chart mode early to avoid flicker (fallback to candle if missing)
        window.chart.chartMode = activeLayout.chartState?.chartMode || 'candle';

        window.chart.currentStockId = stock_id;
        window.chart.drawingTools = [];
        window.chart.selectedTool = null;

        // Sync with sidebar UI
        if (window.sidebarController) {
            window.sidebarController.currentLayouts = layouts;
        }

        // --- Data Loading ---
        window.chart.setTimeframe(timeframe);
        window.chart.connectWebSocket(stock, DEFAULT_WATCHLIST_SYMBOLS);
        window.chart.currentStockId = stock._id;

        await touchLayout(activeLayout._id);
        window.chart.currentLayoutId = activeLayout._id;
        window.chart.tickerId = stock._id; // New: Pass stock DB ID for drawing persistence

        // Emit layout change for top bar UI
        window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: activeLayout.name } }));

        // Load drawings for THIS layout AND THIS symbol/ticker
        const result = await getDrawingTools({
            layoutId: activeLayout._id,
            symbol: stock.ticker
        });
        if (result && result.data) {
            result.data.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
            for (const d of result.data) {
                const tool = window.chart.createDrawingTool(d.toolType, d.points, d.style);
                if (tool) {
                    tool.requiredPoints = d.points.length;
                    tool.id = d._id;
                    tool.isHidden = !!d.isHidden;
                    tool.isLocked = !!d.isLocked;
                    if (d.name) tool.name = d.name;
                    window.chart.drawingTools.push(tool);
                }
            }
        }

        // Apply Indicators from Layout
        if (activeLayout.indicators && activeLayout.indicators.length > 0) {
            if (window.chart && activeLayout.indicators) {
                // Batch add indicators without triggering individual renders
                activeLayout.indicators.forEach(ind => {
                    const doc = ind.indicatorId;
                    if (doc && ind.isVisible !== false) {
                        const script = doc.script || '';
                        window.chart.addIndicator(doc.name, script, {
                            ...ind.settings,
                            indicatorId: doc._id,
                            isVisible: ind.isVisible
                        }, true); // Pass true to skip internal render
                    }
                });
            }
        }


        // [CHART STATE RESTORATION] - Restore zoom, scroll, etc.
        if (window.chart && activeLayout.chartState) {
            window.chart.applyChartState(activeLayout.chartState);

            // Sync UI Timeframe and Chart Mode
            if (activeLayout.chartState.timeframe && window.setTfActive) {
                window.setTfActive(activeLayout.chartState.timeframe);
            }
            if (activeLayout.chartState.chartMode && window.setChartModeActive) {
                window.setChartModeActive(activeLayout.chartState.chartMode);
            }
        }
        if (window.setSearchTicker && window.chart.symbol) {
            window.setSearchTicker(window.chart.symbol);
        }
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
        }

        if (window.chart) window.chart.render();
    }
}

export async function saveCurrentLayout() {
    if (!window.chart?.currentLayoutId) return;

    try {
        const layouts = await getLayouts();
        const activeLayout = layouts.find(l => l._id === window.chart.currentLayoutId);
        if (!activeLayout) return;

        const chartState = window.chart.getChartState();

        // --- 1. Merge timeframe-specific state ---
        const currentTf = window.chart.timeframe;
        const oldChartState = activeLayout.chartState || {};
        const oldTimeframeStates = oldChartState.timeframeStates || {};

        // Construct a CLEAN but COMPLETE chart state
        activeLayout.chartState = {
            ...oldChartState, // Preserve existing global fields (like paneProportions)
            timeframe: chartState.timeframe,
            chartMode: chartState.chartMode,
            modeConfigs: chartState.modeConfigs || oldChartState.modeConfigs,
            paneProportions: chartState.paneProportions || oldChartState.paneProportions,
            timeframeStates: {
                ...oldTimeframeStates
            }
        };

        // Update the state for the ACTIVE timeframe
        if (chartState.currentTimeframeState) {
            activeLayout.chartState.timeframeStates[currentTf] = chartState.currentTimeframeState;
        }

        const indicators = (window.chart.indicators || []).map(ind => ({
            indicatorId: ind.indicatorId || ind.id,
            isVisible: ind.isVisible !== false,
            settings: {
                position: ind.position,
                collapsed: ind.collapsed,
                ...(ind.settings || {})
            }
        }));

        await updateLayout(window.chart.currentLayoutId, {
            chartState: activeLayout.chartState,
            indicators,
            lastSymbol: window.chart.symbol,
            lastTickerId: window.chart.tickerId
        });
        window.chart.isLayoutDirty = false;
        console.log(`Layout saved successfully (Timeframe: ${currentTf})`);
    } catch (error) {
        console.error('Failed to save layout:', error);
    }
}

export async function handleTimeframeChange(timeframe) {
    if (!window.chart) return;
    window.setTfActive(timeframe);
    window.setChartModeActive(window.chart.chartMode || 'candle');

    const searchInput = document.getElementById('stock-search');
    const stockId = window.chart.currentStockId || (searchInput && searchInput.dataset.stockId);
    const ticker = window.chart.symbol;

    window.chart.marketStatus = 'REGULAR';

    if (!stockId || !ticker) {
        window.chart.setTimeframe(timeframe);
        return;
    }

    const cacheKey = ticker + '_' + timeframe;

    // 1. Save current view BEFORE switching timeframe
    await saveCurrentLayout();

    const layouts = await getLayouts();
    const activeLayout = layouts.find(l => l._id === window.chart.currentLayoutId);

    if (candleCache[cacheKey]) {
        window.chart.rawData = candleCache[cacheKey];
        window.chart.setTimeframe(timeframe);

        // 2. Restore state for the NEW timeframe
        if (activeLayout && activeLayout.chartState) {
            window.chart.applyChartState(activeLayout.chartState);
            if (activeLayout.chartState.chartMode && window.setChartModeActive) {
                window.setChartModeActive(activeLayout.chartState.chartMode);
            }
        }

        window.chart.render();
        if (window.setSearchTicker && window.chart.symbol) {
            window.setSearchTicker(window.chart.symbol);
        }
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
        }
        return;
    }

    const responseData = await fetchStockData({ ticker, market: window.chart.market }, timeframe);
    const data = responseData.candles || [];
    const meta = responseData.meta || { marketStatus: 'REGULAR' };

    if (data && data.length > 0) {
        window.chart.marketStatus = meta.marketStatus;
        candleCache[cacheKey] = data;
        window.chart.rawData = data;
        window.chart.setTimeframe(timeframe);

        // 2. Restore state for the NEW timeframe
        if (activeLayout && activeLayout.chartState) {
            window.chart.applyChartState(activeLayout.chartState);
            if (activeLayout.chartState.chartMode && window.setChartModeActive) {
                window.setChartModeActive(activeLayout.chartState.chartMode);
            }
        }

        window.chart.render();
        if (window.setSearchTicker && window.chart.symbol) {
            window.setSearchTicker(window.chart.symbol);
        }
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
        }
    }
}

export async function setDateRangeAndInterval(rangeLabel, defaultTimeframe, btnElement) {
    document.querySelectorAll('.date-ranges button').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    if (window.setTfActive) window.setTfActive(defaultTimeframe);

    await loadStockData();

    if (window.chart) {
        let chartRange = rangeLabel.toLowerCase();
        window.chart.setDateRange(chartRange === 'all' ? 'all' : chartRange);
    }
}

export function updateTimeframeOptions(market) {
    const secondsLabel = document.getElementById('tf-seconds-label');
    const secondsGroup = document.getElementById('tf-seconds-group');

    if (secondsLabel && secondsGroup) {
        if (market === 'stocks' || market === 'commodities') {
            secondsLabel.style.display = 'none';
            secondsGroup.style.display = 'none';
        } else {
            secondsLabel.style.display = 'block';
            secondsGroup.style.display = 'grid';
        }
    }
}

export async function syncTickerPreferences() {
    try {
        const res = await getAllTickerPreferences();
        // Backend returns a direct array of preferences
        if (Array.isArray(res)) {
            res.forEach(pref => {
                localStorage.setItem(`last_exchange_${pref.ticker}`, pref.lastExchange);
            });
            console.log("Ticker preferences synced from DB");
        }
    } catch (e) {
        console.error("Sync error:", e);
    }
}
