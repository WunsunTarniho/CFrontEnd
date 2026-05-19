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

export async function initMarketSession(layoutId = null, forcedMarket = null, skipLayoutRestore = false, skipDirty = false) {
    if (!window.chart) return;
    window.chart.isLoading = true;
    window.chart.isRestoring = true;

    try {
        // 1. Identify which layout and symbol to load
        const layouts = await getLayouts();
        const activeLayout = resolveActiveLayout(layouts, layoutId);
        const isInitialLoad = !window.chart.symbol;

        const { symbol, exchange, originalSymbol, market, type } = determineTargetSymbol(activeLayout, forcedMarket);
        const marketData = await resolveMarketMetadata(symbol, exchange, originalSymbol, market, type);
        
        // Use database timeframe on first load, else preserve session timeframe
        const timeframe = isInitialLoad ? resolveTimeframe(activeLayout) : (window.chart.timeframe || '1d');
        const chartMode = isInitialLoad ? (activeLayout?.chartState?.chartMode || 'candle') : (window.chart.chartMode || 'candle');

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
        window.chart.chartMode = chartMode; // Preserve current mode during switch

        // 5. Restore Session State (Indicators, Drawings, etc)
        if (activeLayout && !skipLayoutRestore) {
            // A. ALWAYS restore Drawing Tools for the new symbol
            await restoreDrawingTools(activeLayout.id, marketData.symbol, marketData.exchange, marketData.id);

            // B. ONLY restore Indicators and general Layout state if it's the FIRST load
            if (isInitialLoad) {
                if (activeLayout.id) {
                    touchLayout(activeLayout.id).catch(() => { });
                    window.chart.currentLayoutId = activeLayout.id;
                }

                window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: activeLayout.name } }));

                if (activeLayout.chartState && window.chart) {
                    window.chart.applyChartState(activeLayout.chartState);
                    const mode = window.chart.chartMode;
                    if (window.updateChartModeUI) window.updateChartModeUI(mode);
                    if (window.chartSettingsController) window.chartSettingsController.syncInputsWithChart();
                }

                if (window.chart.clearIndicators) window.chart.clearIndicators();
                await restoreIndicators(activeLayout.indicators);
            }
        }
    } catch (error) {
        console.error('[DataService] Critical error during initMarketSession:', error);
    } finally {
        // Only reset isRestoring if we are NOT in a skipDirty (undo/redo) flow.
        // If we ARE in undo/redo, the restoreState method will handle resetting it.
        if (!skipDirty) {
            window.chart.isRestoring = false;
        }
        // Ensure a fallback marketData object exists for finalizeSessionLoad if everything crashed
        const fallbackData = forcedMarket || { symbol: window.chart?.symbol || 'BTCUSDT' };
        finalizeSessionLoad(fallbackData, skipDirty);
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
    if (window.chart._indicatorCalcDebounce !== undefined) {
        window.chart._indicatorCalcDebounce = false; // Disable debounce for major reload
    }
    window.chart.setTimeframe(timeframe, true); // Force processing for new rawData

    window.chart.marketStatus = history.meta?.marketStatus || 'REGULAR';
    window.chart.connectWebSocket();
}

function finalizeSessionLoad(marketData, skipDirty = false) {
    if (window.setSearchTicker) window.setSearchTicker(marketData.symbol);
    window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
    window.chart.isLoading = false;
    window.chart.render(true); // Forced sync render to eliminate frame lag
    // window.chart.clearDirtyState(); // REMOVED: Do not clear unsaved drawings during symbol switch!
    // window.chart.clearHistory(); // DISABLED: Keep history across symbols for Undo/Redo
    if (!skipDirty) {
        window.chart.isLayoutDirty = true;
        if (window.chart._notifyDirtyChange) window.chart._notifyDirtyChange();
    }
}

/**
 * --------------------------------------------------------------------------
 * UTILITIES & RE-EXPORTS
 * --------------------------------------------------------------------------
 */

export async function saveCurrentLayout() {
    if (!window.chart?.currentLayoutId || window.chart.isRestoring) return;
    try {
        // Best Practice: First sync all drawings (pending actions) across all symbols 
        // to ensure we don't lose any unsaved drawings from previous symbols.
        if (window.chart.syncWithDatabase) {
            await window.chart.syncWithDatabase();
        }

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
        console.log('[LayoutSave] Success, drawings synced and dirty state cleared.');
    } catch (e) {
        console.error('[LayoutSave] Failed:', e);
    }
}
export async function changeTimeframe(timeframe, value = null, unit = null, skipDirty = false) {
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
    if (!skipDirty) {
        window.chart.isLayoutDirty = true;
        if (window.chart._notifyDirtyChange) window.chart._notifyDirtyChange();
    }
}

async function restoreDrawingTools(layoutId, symbol, exchange, symbolId) {
    if (!layoutId || !window.chart) return;
    const result = await getDrawingTools({ layoutId, symbol, exchange, symbolId });
    if (!result?.data) return;

    const mainPane = window.chart.panes.find(p => p.id === 'main');
    const targetSymbol = (symbol || '').toUpperCase();
    const targetExchange = (exchange || '').toUpperCase();
    
    // Best Practice: Multi-symbol persistence.
    // 1. Filter out only the tools that belong to the TARGET context AND are NOT dirty (saved).
    // This preserves:
    // - Unsaved drawings for the current symbol.
    // - All drawings (saved or unsaved) for other symbols.
    window.chart.drawingTools = window.chart.drawingTools.filter(t => {
        const toolIdStr = t.id ? t.id.toString() : null;
        
        // Priority 1: Keep if it's a local drawing (no DB ID yet) OR in unsaved states
        const isLocal = !t.id || (typeof t.id === 'string' && t.id.startsWith('local_'));
        if (isLocal || (toolIdStr && (window.chart.pendingActions.has(toolIdStr) || window.chart.inFlightSync.has(toolIdStr) || (window.chart.deferredUpdates && window.chart.deferredUpdates.has(toolIdStr))))) {
            return true;
        }

        // Priority 2: Keep if it belongs to a DIFFERENT symbol/exchange
        const tSymbol = (t.symbol || '').toUpperCase();
        const tExchange = (t.exchange || '').toUpperCase();
        const isSameContext = (tSymbol === targetSymbol) && 
                             (tExchange === targetExchange) && 
                             (t.symbolId === symbolId || !t.symbolId || !symbolId);

        return !isSameContext;
    });

    // 2. Add tools from database that are NOT already in pendingActions (to avoid overwrite)
    result.data.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)).forEach(d => {
        const dbIdStr = d.id ? d.id.toString() : null;
        if (dbIdStr && (window.chart.pendingActions.has(dbIdStr) || window.chart.inFlightSync.has(dbIdStr) || (window.chart.deferredUpdates && window.chart.deferredUpdates.has(dbIdStr)))) return;

        const tool = window.chart.createDrawingTool(d.toolType, d.points, d.style, d.id);
        if (tool) {
            Object.assign(tool, { 
                pane: mainPane, 
                isHidden: !!d.isHidden, 
                isLocked: !!d.isLocked,
                symbol: d.symbol || symbol,
                exchange: d.exchange || exchange,
                symbolId: d.symbolId || symbolId
            });
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
