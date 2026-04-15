import {
    getDrawingTools,
    searchStock,
    findStock,
    findStockByTicker,
    bulkSyncDrawingTools,
    getLayouts,
    saveLayout,
    updateLayout,
    deleteLayout,
    touchLayout
} from './service.js';
import { DEFAULT_WATCHLIST_SYMBOLS } from './constants.js';

export let TF_SUPPORT_MAP = {};
const historyCache = new Map();

export async function fetchTimeframeConfigs(stockId = null) {
    try {
        let url = `${apiBase}/api/v1/market/timeframes`;
        if (stockId) url += `?id=${stockId}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch timeframe configs');
        const result = await response.json();

        if (stockId) {
            // Returns filtered list for specific ticker
            return result.data || [];
        } else {
            // Returns base map
            TF_SUPPORT_MAP = result;
        }
    } catch (error) {
        console.error('Error fetching timeframe configs:', error);
        return stockId ? [] : {};
    }
}

export function getEffectiveExchangeKey(exchange, isFutures) {
    const normalized = (exchange || 'BINANCE').toUpperCase();
    if (isFutures && TF_SUPPORT_MAP[`${normalized}_FUTURES`]) {
        return `${normalized}_FUTURES`;
    }
    if (!isFutures && TF_SUPPORT_MAP[`${normalized}_SPOT`]) {
        return `${normalized}_SPOT`;
    }
    return TF_SUPPORT_MAP[normalized] ? normalized : 'BINANCE_SPOT';
}

// ── Item C: Data Retrieval Logic ─────────────────────────────────────

// Fetch candles from API via backend proxy
export async function fetchStockData(stock, timeframe, endDateTs = null) {
    const ticker = stock.ticker;
    const cacheKey = `${ticker}:${timeframe}:${stock.market}:${stock.exchange || ''}:${endDateTs || 'latest'}`;

    if (historyCache.has(cacheKey)) {
        // console.log(`[Cache Hit] Serving ${cacheKey} from memory`);
        return historyCache.get(cacheKey);
    }

    try {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'block';

        let url = `${apiBase}/api/v1/market/history?symbol=${ticker}&timeframe=${timeframe}&market=${stock.market}&exchange=${stock.exchange || ''}&limit=1000`;
        if (endDateTs) url += `&endDateTs=${endDateTs}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);

        const data = await response.json();
        
        // Save to memory cache
        if (data && data.candles && data.candles.length > 0) {
            historyCache.set(cacheKey, data);
        }

        return data || { candles: [], meta: { marketStatus: 'REGULAR' } };
    } catch (error) {
        console.error('Error fetching data from backend:', error);
        return { candles: [], meta: { marketStatus: 'REGULAR' } };
    } finally {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
    }
}

export const apiBase = 'http://localhost:5000';

export async function loadStockData(layoutId = null, forcedStock = null) {
    if (!window.chart) return;
    window.chart.isLoading = true;

    const layouts = await getLayouts();
    let activeLayout = layoutId ? layouts.find(l => l.id === layoutId) : (window.chart.currentLayoutId ? layouts.find(l => l.id === window.chart.currentLayoutId) : layouts[0]);

    if (!activeLayout && layouts.length > 0) activeLayout = layouts[0];

    const searchInput = document.getElementById('stock-search');
    let stock_id;
    let selectedExchange = '';

    if (forcedStock) {
        stock_id = forcedStock._id || forcedStock.ticker;
        selectedExchange = forcedStock.primary_exchange || '';
    } else if (searchInput && searchInput.dataset.stockId) {
        stock_id = searchInput.dataset.stockId;
        selectedExchange = searchInput.dataset.exchange || '';
        delete searchInput.dataset.stockId;
        delete searchInput.dataset.exchange;
    } else if (activeLayout && activeLayout.lastTicker) {
        stock_id = activeLayout.lastTicker;
        if (typeof stock_id === 'object' && stock_id !== null) {
            stock_id = stock_id.ticker || stock_id.symbol || stock_id.id || String(stock_id);
        }
    } else {
        stock_id = window.chart.currentStockId || (DEFAULT_WATCHLIST_SYMBOLS[0] ? DEFAULT_WATCHLIST_SYMBOLS[0].ticker : null);
    }

    if (!selectedExchange || selectedExchange === 'undefined') {
        if (activeLayout && activeLayout.lastExchange) {
            selectedExchange = activeLayout.lastExchange;
        } else {
            const market = activeLayout?.lastTickerId?.market || '';
            if (market.toLowerCase().startsWith('stock') || market === 'commodities') {
                selectedExchange = 'YAHOO';
            } else {
                selectedExchange = 'BINANCE';
            }
        }
    }

    if (!stock_id || stock_id === 'undefined') {
        const fallbackStock = DEFAULT_WATCHLIST_SYMBOLS[0];
        stock_id = (fallbackStock ? (fallbackStock.id || fallbackStock._id || fallbackStock.ticker) : 'BTCUSDT');
    }

    let timeframe = window.chart?.timeframe || document.querySelector('.tf-option.active')?.dataset.tf || '1d';

    const isInitialLoad = !window.chart?.symbol;
    const isLayoutSwitch = layoutId && layoutId !== window.chart?.currentLayoutId;

    if ((isLayoutSwitch || isInitialLoad) && activeLayout?.chartState?.timeframe) {
        timeframe = activeLayout.chartState.timeframe;
    }

    if (window.setTfActive) window.setTfActive(timeframe);

    const response = await findStock(stock_id, selectedExchange);
    let stock = response?.data;

    if (!stock) {
        const fallbackTicker = (DEFAULT_WATCHLIST_SYMBOLS[0] ? DEFAULT_WATCHLIST_SYMBOLS[0].ticker : 'BTCUSDT');
        stock = { ticker: fallbackTicker, name: 'Default', market: 'crypto', primary_exchange: 'BINANCE' };
    }

    const currentIsFutures = stock.ticker?.endsWith('.P') || stock.type === 'FUTURES' || (window.chart && window.chart.type === 'FUTURES');
    
    // Fetch ticker-specific supported timeframes (Strict Core Pair rules)
    const tickerId = stock.id || stock._id || stock.ticker;
    const supported = await fetchTimeframeConfigs(tickerId);

    // Validate and fallback timeframe if not supported by this ticker
    if (supported && supported.length > 0 && !supported.includes(timeframe)) {
        const fallback = supported.includes('1m') ? '1m' : supported[0];
        timeframe = fallback;
    }

    updateTimeframeOptions(stock.market || 'crypto', selectedExchange || stock.primary_exchange, currentIsFutures, supported);

    const isSymbolChanged = window.chart.symbol !== stock.ticker;
    const isExchangeChanged = window.chart.exchange !== selectedExchange;

    if (isInitialLoad || isSymbolChanged || isExchangeChanged) {
        if (window.chart.symbol) {
            window.chart.unsubscribe(window.chart.symbol, window.chart.exchange);
        }
        window.chart.clearSymbol();
        window.chart.render();
    }

    const effectiveKeyForSeconds = getEffectiveExchangeKey(selectedExchange, currentIsFutures);
    const supportsSeconds = TF_SUPPORT_MAP[effectiveKeyForSeconds]?.some(tf => tf.endsWith('s'));

    if ((stock.market === 'stocks' || stock.market === 'commodities' || !supportsSeconds) && timeframe.endsWith('s')) {
        timeframe = '1m';
    }

    if (selectedExchange) stock.exchange = selectedExchange;

    const responseData = await fetchStockData(stock, timeframe);
    const data = responseData.candles || [];
    const meta = responseData.meta || { marketStatus: 'REGULAR' };

    window.chart.symbol = stock.ticker;
    window.chart.instrument = stock.name;
    window.chart.currency = stock.currency ?? (stock.currency ? stock.currency.toUpperCase() : '');
    window.chart.base_currency_symbol = stock.base_currency_symbol;
    window.chart.exchange = selectedExchange || stock.exchange || stock.primary_exchange;
    window.chart.market = stock.asset_type || stock.market;
    window.chart.asset_type = stock.asset_type || stock.market;
    window.chart.rawData = data;
    window.chart.setTimeframe(timeframe);

    if (data.length > 0) {
        await window.chart.syncWithDatabase();
    }

    window.chart.marketStatus = meta.marketStatus;

    window.chart.chartMode = 'candle'; // Always default to candle

    window.chart.currentStockId = stock_id;
    window.chart.drawingTools = [];
    window.chart.selectedTool = null;

    if (window.sidebarController) {
        window.sidebarController.currentLayouts = layouts;
    }

    window.chart.connectWebSocket(stock, DEFAULT_WATCHLIST_SYMBOLS);
    window.chart.currentStockId = stock.id || stock.ticker;

    await touchLayout(activeLayout.id);
    window.chart.currentLayoutId = activeLayout.id;
    window.chart.tickerId = stock.id || stock.ticker;

    window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: activeLayout.name } }));

    const result = await getDrawingTools({
        layoutId: activeLayout.id,
        symbol: stock.ticker,
        exchange: window.chart.exchange
    });

    if (result && result.data) {
        const mainPane = window.chart.panes.find(p => p.id === 'main');
        result.data.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        for (const d of result.data) {
            const tool = window.chart.createDrawingTool(d.toolType, d.points, d.style);
            if (tool) {
                tool.pane = mainPane;
                tool.requiredPoints = d.points.length;
                tool.id = d.id;
                tool.isHidden = !!d.isHidden;
                tool.isLocked = !!d.isLocked;
                if (d.name) tool.name = d.name;
                window.chart.drawingTools.push(tool);
            }
        }
    }

    if (activeLayout.indicators && activeLayout.indicators.length > 0) {
        if (window.chart && activeLayout.indicators) {
            window.chart.isRestoring = true;
            activeLayout.indicators.forEach(ind => {
                const doc = ind.indicator; // Access the populated indicator object
                if (doc && ind.isVisible !== false) {
                    const script = doc.script || '';
                    window.chart.addIndicator(doc.name, script, {
                        ...ind.settings,
                        indicatorId: doc.id,
                        isVisible: ind.isVisible
                    }, true);
                }
            });
            window.chart.isRestoring = false;
        }
    }


    if (window.setSearchTicker && window.chart.symbol) {
        window.setSearchTicker(window.chart.symbol);
    }
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('chartify:data-loaded', { detail: { chart: window.chart } }));
    }

    if (window.chart) window.chart.render();
    await autoSaveLayoutViewState();
    if (window.setTfActive) window.setTfActive(timeframe);
    if (window.chart) window.chart.clearDirtyState();
}

export async function saveCurrentLayout() {
    if (!window.chart?.currentLayoutId) return;

    try {
        const layouts = await getLayouts();
        const activeLayout = layouts.find(l => l.id === window.chart.currentLayoutId);
        if (!activeLayout) return;

        const currentTf = window.chart.timeframe;

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
            chartState: {
                timeframe: currentTf,
                chartMode: window.chart.chartMode || 'candle'
            },
            indicators,
            lastTicker: window.chart.symbol,
            lastExchange: window.chart.exchange
        });
        window.chart.clearDirtyState();
        console.log(`Layout saved.`);
    } catch (error) {
        console.error('Failed to save layout:', error);
    }
}

export async function autoSaveLayoutViewState() {
    if (!window.chart?.currentLayoutId || !window.chart.symbol) return;

    try {
        const currentTf = window.chart.timeframe;

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
            chartState: {
                timeframe: currentTf,
                chartMode: window.chart.chartMode || 'candle'
            },
            indicators,
            lastTicker: window.chart.symbol,
            lastExchange: window.chart.exchange
        });
    } catch (error) {
        console.warn('[AutoSave] Failed:', error);
    }
}

export async function handleTimeframeChange(timeframe) {
    if (!window.chart) return;

    if (window.setTfActive) window.setTfActive(timeframe);

    const ticker = window.chart.symbol;
    if (!ticker) {
        window.chart.setTimeframe(timeframe);
        return;
    }

    const exchange = window.chart.exchange || 'BINANCE';
    const market = window.chart.market || 'crypto';

    let effectiveTf = timeframe;
    const effectiveKeyForTf = getEffectiveExchangeKey(exchange, window.chart?.type === 'FUTURES');
    const supportsSeconds = TF_SUPPORT_MAP[effectiveKeyForTf]?.some(tf => tf.endsWith('s'));

    if ((market === 'stocks' || market === 'commodities' || !supportsSeconds) && timeframe.endsWith('s')) {
        effectiveTf = '1m';
    }

    try {
        const responseData = await fetchStockData({ ticker, market, exchange }, effectiveTf);
        const data = responseData.candles || [];
        const meta = responseData.meta || { marketStatus: 'REGULAR' };

        window.chart.rawData = data;
        window.chart.marketStatus = meta.marketStatus;
        window.chart.setTimeframe(timeframe);

        if (data && data.length > 0) {
            // NO RESTORE POSITION - FULL FIT INSTEAD
            if (typeof window.chart.fullFit === 'function') {
                window.chart.fullFit();
            } else if (typeof window.chart.goToLastCandle === 'function') {
                window.chart.goToLastCandle();
            }
        }
        window.chart.render();
        if (data && data.length > 0) {
            await autoSaveLayoutViewState();
        }
    } catch (error) {
        console.error(`[handleTimeframeChange] Fetch failed:`, error);
        window.chart.setTimeframe(timeframe);
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

export function updateTimeframeOptions(market, exchange = 'BINANCE', isFutures = false, supportedOverride = null) {
    const secondsLabel = document.getElementById('tf-seconds-label');
    const secondsGroup = document.getElementById('tf-seconds-group');

    if (!secondsLabel || !secondsGroup) return;

    const effectiveExchange = getEffectiveExchangeKey(exchange, isFutures);
    const supported = supportedOverride || TF_SUPPORT_MAP[effectiveExchange] || [];
    
    const supportsSeconds = supported.some(tf => tf.endsWith('s'));
    const shouldHideSeconds = (market === 'stocks' || market === 'commodities' || !supportsSeconds);

    if (shouldHideSeconds) {
        secondsLabel.style.display = 'none';
        secondsGroup.style.display = 'none';
    } else {
        secondsLabel.style.display = 'block';
        secondsGroup.style.display = 'grid';
    }

    document.querySelectorAll('.tf-option').forEach(opt => {
        const tf = opt.dataset.tf;
        // If we have a specific list, hide everything not in it
        if (supported.length > 0 && !supported.includes(tf)) {
            opt.style.display = 'none';
        } else {
            opt.style.display = 'flex';
        }
    });

    document.querySelectorAll('.tf-popup > .tf-group-label').forEach(label => {
        if (label.id === 'tf-seconds-label') return;
        const nextGroup = label.nextElementSibling;
        if (nextGroup && nextGroup.classList.contains('tf-group')) {
            const hasVisible = Array.from(nextGroup.children).some(child => child.style.display !== 'none');
            label.style.display = hasVisible ? 'block' : 'none';
            nextGroup.style.display = hasVisible ? 'grid' : 'none';
        }
    });
}
