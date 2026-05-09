import {
    getDrawingTools,
    findStockByTicker,
    getLayouts,
    updateLayout,
    touchLayout,
    API_BASE
} from './service.js';
import { DEFAULT_WATCHLIST_SYMBOLS } from './constants.js';

const historyCache = new Map();

/**
 * --------------------------------------------------------------------------
 * CORE DATA FETCHING
 * --------------------------------------------------------------------------
 */

export async function fetchMarketHistory(marketInfo, timeframe, endTime = null, value = null, unit = null) {
    const symbol = marketInfo.symbol || 'BTCUSDT';
    const exchange = marketInfo.exchange || 'BINANCE';
    const isLatest = !endTime;

    // Use stored value/unit if not provided (for pagination)
    if (!value && window.chart?.tfValue) value = window.chart.tfValue;
    if (!unit && window.chart?.tfUnit) unit = window.chart.tfUnit;

    const cacheKey = `${symbol}:${timeframe}:${exchange}:${endTime || 'latest'}`;

    // Cache policy (Daily segments only)
    if (timeframe === '1d' && !isLatest && historyCache.has(cacheKey)) {
        return historyCache.get(cacheKey);
    }

    try {
        const params = new URLSearchParams({
            symbol,
            exchange,
            limit: (unit === 't' || unit === 'r') ? 50 : 1000,
            _: Date.now()
        });

        let url;
        if (unit === 't') {
            params.set('ticksPerCandle', value);
            url = `${API_BASE}/api/v1/market/ticks?${params}`;
        } else if (unit === 'r') {
            params.set('rangePerCandle', value);
            url = `${API_BASE}/api/v1/market/range?${params}`;
        } else {
            params.set('timeframe', timeframe);
            if (endTime) params.set('endTime', endTime);
            url = `${API_BASE}/api/v1/market/history?${params}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`History fetch failed: ${response.status}`);

        const data = await response.json();
        if (timeframe === '1d' && !isLatest && data?.candles?.length > 0) {
            historyCache.set(cacheKey, data);
        }

        return data || { candles: [], meta: {} };
    } catch (error) {
        console.error('[DataService] History Error:', error);
        return { candles: [], meta: {} };
    }
}

/**
 * --------------------------------------------------------------------------
 * MAIN SESSION INITIALIZATION
 * --------------------------------------------------------------------------
 */

export async function initMarketSession(layoutId = null, forcedMarket = null) {
    if (!window.chart) return;
    window.chart.isLoading = true;
    window.chart.isRestoring = true;

    try {
        // 1. Identify which layout and symbol to load
        const layouts = await getLayouts();
        const activeLayout = resolveActiveLayout(layouts, layoutId);
        console.log(`[DataService] determineTargetSymbol start with forced:`, forcedMarket);
        const { symbol, exchange, originalSymbol, market, type } = determineTargetSymbol(activeLayout, forcedMarket);
        console.log(`[DataService] Resolved from determineTargetSymbol:`, { symbol, exchange, originalSymbol, market, type });

        // 2. Resolve full market metadata (type, name, etc)
        const marketData = await resolveMarketMetadata(symbol, exchange, originalSymbol, market, type);
        console.log(`[DataService] Resolved marketData:`, marketData);
        const timeframe = resolveTimeframe(activeLayout);

        console.log(`[DataService] Loading: ${marketData.symbol} @ ${marketData.exchange} [${timeframe}]`, marketData);

        // 3. Prepare Chart for new data
        prepareChartForSwitch(marketData);
        updateMarketUI(marketData.market, marketData.exchange);

        // 4. Fetch and Load Data
        console.log(`[DataService] Calling fetchMarketHistory for ${marketData.symbol}...`);

        // One-time parse during restoration to set the initial structured state
        const match = timeframe.match(/^(\d+)([trsmhdw]|mo)$/);
        window.chart.tfValue = match ? match[1] : timeframe;
        window.chart.tfUnit = match ? match[2] : '';

        const history = await fetchMarketHistory(marketData, timeframe);
        applyDataToChart(marketData, history, timeframe);

        // 5. Restore Session State (Indicators, Drawings, etc)
        if (activeLayout) {
            // Note: activeLayout.id might be undefined based on backend response
            if (activeLayout.id) {
                touchLayout(activeLayout.id).catch(() => { });
                window.chart.currentLayoutId = activeLayout.id;
            }

            window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: activeLayout.name } }));

            // Restore Full Chart State (Colors, Grids, Mode, etc.)
            if (activeLayout.chartState && window.chart) {
                window.chart.applyChartState(activeLayout.chartState);

                // Sync UI elements
                const mode = window.chart.chartMode;
                if (window.updateChartModeUI) window.updateChartModeUI(mode);
                if (window.chartSettingsController) window.chartSettingsController.syncInputsWithChart();
            }

            await restoreDrawingTools(activeLayout.id, marketData.symbol, marketData.exchange, marketData.id);
            if (window.chart.clearIndicators) window.chart.clearIndicators();
            await restoreIndicators(activeLayout.indicators);
        }
    } catch (error) {
        console.error('[DataService] Critical error during initMarketSession:', error);
    } finally {
        window.chart.isRestoring = false;
        // Ensure a fallback marketData object exists for finalizeSessionLoad if everything crashed
        const fallbackData = forcedMarket || { symbol: window.chart?.symbol || 'BTCUSDT' };
        finalizeSessionLoad(fallbackData);
    }
}

/**
 * --------------------------------------------------------------------------
 * HELPER LOGIC (Private)
 * --------------------------------------------------------------------------
 */

function resolveActiveLayout(layouts, requestedId) {
    if (!layouts || layouts.length === 0) return null;
    if (requestedId) return layouts.find(l => l.id === requestedId) || layouts[0];
    if (window.chart?.currentLayoutId) return layouts.find(l => l.id === window.chart.currentLayoutId) || layouts[0];
    return layouts[0];
}

function determineTargetSymbol(layout, forced) {
    const searchInput = document.getElementById('stock-search');
    const fallback = DEFAULT_WATCHLIST_SYMBOLS[0] || { symbol: 'BTCUSDT', exchange: 'BINANCE' };

    let symbol, exchange, originalSymbol;

    if (forced) {
        symbol = forced.symbol;
        exchange = forced.exchange || forced.primary_exchange;
        originalSymbol = forced.original_symbol;
    } else if (searchInput?.dataset.symbol) {
        symbol = searchInput.dataset.symbol;
        exchange = searchInput.dataset.exchange;
        originalSymbol = searchInput.dataset.originalSymbol;
        forced = {
            symbol,
            exchange,
            original_symbol: originalSymbol,
            market: searchInput.dataset.market,
            type: searchInput.dataset.type
        };
        clearSearchDataset(searchInput);
    } else if (layout?.lastSymbol) {
        symbol = layout.lastSymbol;
        exchange = layout.lastExchange;
    } else {
        symbol = window.chart?.symbol || fallback.symbol;
        exchange = window.chart?.exchange || fallback.exchange;
    }

    return {
        symbol: symbol || 'BTCUSDT',
        exchange: (exchange || 'BINANCE').toUpperCase(),
        originalSymbol: originalSymbol || symbol,
        market: forced?.market,
        type: forced?.type
    };
}

async function resolveMarketMetadata(symbol, exchange, originalSymbol, forcedMarket, forcedType) {
    const response = await findStockByTicker(symbol, exchange);
    const data = response?.data;
    return {
        symbol: data?.symbol || symbol,
        exchange: exchange,
        name: data?.name || symbol,
        market: forcedMarket || data?.market || 'crypto',
        type: forcedType || data?.type || (symbol.endsWith('.P') ? 'perpetual' : 'spot'),
        base: data?.base || '',
        quote: data?.quote || '',
        original_symbol: data?.originalSymbol || originalSymbol,
        id: data?.id,
        tickSize: data?.tickSize || 0
    };
}

function resolveTimeframe(layout) {
    let tf = '1d';
    if (layout?.chartState?.timeframe) tf = layout.chartState.timeframe;
    if (window.setTfActive) window.setTfActive(tf);
    return tf;
}

function prepareChartForSwitch(marketData) {
    const isNew = window.chart.symbol !== marketData.symbol ||
        window.chart.exchange !== marketData.exchange ||
        window.chart.market !== marketData.market ||
        window.chart.type !== marketData.type;
    if (isNew && window.chart.symbol) {
        window.chart.unsubscribe(window.chart.symbol, window.chart.exchange);
        window.chart.clearSymbol();
        window.chart.render();
    }
}

function applyDataToChart(marketData, history, timeframe) {
    const candles = history.candles || [];

    window.chart.symbol = marketData.symbol;
    window.chart.name = marketData.name;
    window.chart.exchange = marketData.exchange;
    window.chart.type = marketData.type;
    window.chart.market = marketData.market;
    window.chart.base = marketData.base;
    window.chart.quote = marketData.quote;
    window.chart.original_symbol = marketData.original_symbol;
    window.chart.symbolId = marketData.id;
    window.chart.tickSize = marketData.tickSize || 0;
    window.chart.rawData = candles;
    window.chart.setTimeframe(timeframe);
    window.chart.marketStatus = history.meta?.marketStatus || 'REGULAR';

    if (candles.length > 0) {
        window.chart.syncWithDatabase().catch(() => { });
    }

    window.chart.connectWebSocket();
}

function finalizeSessionLoad(marketData) {
    if (window.setSearchTicker) window.setSearchTicker(marketData.symbol);
    window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
    window.chart.isLoading = false;
    window.chart.render();
    window.chart.clearDirtyState();
    autoSaveLayoutViewState();
}

/**
 * --------------------------------------------------------------------------
 * UTILITIES & RE-EXPORTS
 * --------------------------------------------------------------------------
 */

export async function saveCurrentLayout() {
    if (!window.chart?.currentLayoutId || window.chart.isRestoring) return;
    try {
        const fullState = window.chart.getChartState();
        await updateLayout(window.chart.currentLayoutId, {
            chartState: fullState,
            lastSymbol: window.chart.symbol,
            lastExchange: window.chart.exchange,
            lastSymbolId: window.chart.symbolId,
            indicators: (window.chart.indicators || []).map(ind => ({
                indicatorId: ind.indicatorId || (ind.id?.startsWith('ind_') ? null : ind.id),
                settings: {
                    ...(ind.settings || {}),
                    collapsed: !!ind.collapsed,
                    position: ind.position || 'below',
                    orderIndex: window.chart.paneOrder ? window.chart.paneOrder.indexOf(ind.id) : -1,
                    paneShare: window.chart.paneProportions[ind.id] || 0.25
                }
            }))
        });
        if (window.chart.clearDirtyState) {
            window.chart.clearDirtyState();
        }
        console.log('[LayoutSave] Success, dirty state cleared.');
    } catch (e) {
        console.error('[AutoSave] Failed:', e);
    }
}

export const autoSaveLayoutViewState = () => saveCurrentLayout();
window.autoSaveLayoutViewState = autoSaveLayoutViewState;

export async function changeTimeframe(timeframe, value = null, unit = null) {
    if (!window.chart?.symbol) return;
    if (window.setTfActive) window.setTfActive(timeframe);

    // Persist structured state
    window.chart.tfValue = value;
    window.chart.tfUnit = unit;

    window.chart.isLoading = true;
    const history = await fetchMarketHistory(window.chart, timeframe, null, value, unit);
    window.chart.rawData = history.candles || [];
    window.chart.marketStatus = history.meta?.marketStatus || 'REGULAR';
    if (history.meta?.tickSize) window.chart.tickSize = history.meta.tickSize;
    window.chart.setTimeframe(timeframe);

    if (window.chart.rawData.length > 0 && window.chart.fullFit) window.chart.fullFit();
    window.chart.isLoading = false;
    window.chart.render();
    autoSaveLayoutViewState();
}

async function restoreDrawingTools(layoutId, symbol, exchange, symbolId) {
    if (!layoutId) return;
    const result = await getDrawingTools({ layoutId, symbol, exchange, symbolId });
    if (!result?.data) return;

    const mainPane = window.chart.panes.find(p => p.id === 'main');
    window.chart.drawingTools = [];

    result.data.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)).forEach(d => {
        const tool = window.chart.createDrawingTool(d.toolType, d.points, d.style);
        if (tool) {
            Object.assign(tool, { pane: mainPane, id: d.id, isHidden: !!d.isHidden, isLocked: !!d.isLocked });
            window.chart.drawingTools.push(tool);
        }
    });
}

async function restoreIndicators(indicators) {
    if (!indicators?.length) return;
    window.chart.isRestoring = true;

    // Sort by orderIndex to preserve sequence during restoration
    const sortedIndicators = [...indicators].sort((a, b) => {
        const orderA = a.settings?.orderIndex ?? 999;
        const orderB = b.settings?.orderIndex ?? 999;
        return orderA - orderB;
    });

    sortedIndicators.forEach(ind => {
        if (ind.indicator) {
            window.chart.addIndicator(ind.indicator.name, ind.indicator.script || '', {
                ...ind.settings,
                indicatorId: ind.indicator.id
            }, true);
        }
    });
    // Note: isRestoring is now managed by initMarketSession for better coverage
    if (window.chart.calculateIndicators) {
        window.chart.indicatorsDirty = true;
        window.chart.calculateIndicators(false);
    }
}

export function updateMarketUI(market, exchange) {
    const isCrypto = market === 'crypto' || !market;

    // Toggle seconds visibility based on market type
    const secondsDisplay = isCrypto ? 'grid' : 'none';
    const secondsLabelDisplay = isCrypto ? 'block' : 'none';

    const secondsLabel = document.getElementById('tf-seconds-label');
    const secondsGroup = document.getElementById('tf-seconds-group');

    if (secondsLabel) secondsLabel.style.display = secondsLabelDisplay;
    if (secondsGroup) secondsGroup.style.display = secondsDisplay;

    // Reset all options to their default flex display
    document.querySelectorAll('.tf-option').forEach(el => {
        el.style.display = 'flex';
    });
}



function clearSearchDataset(el) {
    delete el.dataset.symbol;
    delete el.dataset.exchange;
    delete el.dataset.originalSymbol;
}
