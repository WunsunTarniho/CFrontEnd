import * as Icons from './icons.js';
import { getLayouts, saveLayout, updateLayout, deleteLayout, touchLayout } from './service.js';
import { fetchStockData, loadStockData, saveCurrentLayout } from './data-service.js';
import { DEFAULT_WATCHLIST_SYMBOLS } from './constants.js';
import { getTickerLogo, extractSymbol } from './utils.js';

export class SidebarController {
    constructor() {
        this.watchlistData = DEFAULT_WATCHLIST_SYMBOLS.map(s => ({
            symbol: s.ticker, market: s.market, price: '...', change: '...', up: true, currency: s.currency,
        }));

        this.watchlistContainer = document.getElementById('watchlist-items');
        this.sidebar = document.getElementById('right-sidebar');
        this.detailPanel = document.getElementById('detail-panel');
        this.resizeHandle = document.getElementById('panel-resize-handle');
        this.isSeasonalsHoverSetup = false;
        this.currentMarket = 'crypto';
        this.objectTreeContainer = document.getElementById('object-tree-container');

        this.isResizing = false;
        this.isCollapsed = false;
        this.isEditingName = false;
        this.draggedItemIndex = null;
        this._lastInteractionTime = 0;
        this._lastStateKey = '';
        this.sessionOpenPrice = null;
        this.lastDetailedPrice = null;
        this.isSeasonalsHoverSetup = false;

        this.fullSeasonalsResults = null;
        this.fullSeasonalsInitialized = false;
        this.showSeasonalAverage = false;
        this.seasonalViewMode = 'percentage'; // 'percentage' | 'regular'
        this.currentStartYear = 2017;
        this.currentEndYear = 2026;
        this.lastSeasonalSyncTime = 0;
        this.lastDetailedPrice = null;
        this.sessionOpenPrice = null; // Used for Today's Change calculation
        this.todayVolume = 0; // Cumulative Today's Volume (from 00:00 UTC)
        this.lastVolumeSyncTs = 0;
        this.performanceBasePrices = {};
        this.lastPerformanceSyncTime = 0;
        this.currentLayouts = [];
        this.activeLayoutId = null;
        this.watchlistPrevClose = {}; // symbol -> prevClose price for correct % calculation

        // Hover States for persistence (separated to avoid cross-triggers)
        this.sidebarHoverDay = null;
        this.sidebarHoverPos = null;
        this.fullHoverDay = null;
        this.fullHoverPos = null;

        this.lastSeasonalUpdateTime = 0; // For throttling fetches/renders
        this.currentSeasonalSymbol = null;

        // New Orderbook Settings
        this.orderbookSettings = {
            precision: 0.1,
            visualizationMode: 'cumulative', // 'individual' or 'cumulative'
            animationsEnabled: true
        };
        this.orderbookState = { bids: new Map(), asks: new Map() };
        this._obRenderPending = false;
        this._lastObSymbol = null;
        this._lastBasePrecision = null;

        // Seasonal Lazy-Loading State
        this.seasonalCandles = [];
        this.earliestSeasonalTs = null;
        this.isFetchingMoreSeasonals = false;
        this.minAllowedYear = 2010; // Default floor for Crypto

        this.init();
    }

    init() {
        this.renderWatchlist();
        this.fetchInitialWatchlistPrices();
        this.setupResizeLogic();
        this.setupTabLogic();
        this.setupResponsiveLogic();

        // Listen for real-time ticker updates from Chartify
        window.addEventListener('chartify:ticker-update', (e) => {
            const { symbol, data, exchange } = e.detail;
            this.handleTickerUpdate(symbol, data, exchange);
        });

        // Listen for real-time individual trades for volume accumulation
        window.addEventListener('chartify:trade', (e) => {
            const { symbol, exchange, trades } = e.detail;
            this.handleTradeUpdate(symbol, exchange, trades);
        });

        // Listen for orderbook updates
        window.addEventListener('chartify:orderbook', (e) => {
            const { symbol, exchange, type, bids, asks } = e.detail;
            this.handleOrderbookUpdate(symbol, exchange, type, bids, asks);
        });

        // Listen for when chart loads new data (e.g. via search modal)
        window.addEventListener('chartify:data-loaded', (e) => {
            const chart = e.detail.chart;
            if (chart && chart.symbol) {
                // Pass full info to sync sidebar UI correctly
                this.selectSymbol({
                    symbol: chart.symbol,
                    name: chart.instrument,
                    market: chart.market,
                    exchange: chart.exchange,
                    currency: chart.currency,
                    base_currency_symbol: chart.base_currency_symbol,
                    asset_type: chart.asset_type
                }, null, true);

                // Sync Orderbook Settings from Layout ChartState
                const layoutId = chart.currentLayoutId || chart.layoutId || this.activeLayoutId;
                if (layoutId) {
                    this.syncSettingsFromChart(chart);
                }
            }
        });

        // Add button logic
        const addWatchlistBtn = document.getElementById('add-watchlist-btn');
        if (addWatchlistBtn) {
            addWatchlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const openSearchModal = document.getElementById('open-search-modal');
                if (openSearchModal) openSearchModal.click();
            });
        }

        // Periodically sync object tree if on that tab
        setInterval(() => {
            const diagramView = document.getElementById('diagram-view');
            if (diagramView && diagramView.classList.contains('active') && !this.isEditingName) {
                this.updateObjectTree();
            }
        }, 1000);

        // More Seasonals button
        document.addEventListener('click', (e) => {
            if (e.target.closest('.more-seasonals-btn')) {
                this.openSeasonalsView();
            }
            if (e.target.closest('#seasonals-view-close')) {
                this.closeSeasonalsView();
            }
            // Layout Action Button
            if (e.target.closest('.action-btn[title="Layout"]')) {
                this.toggleLayoutManager();
            }
        });

        // Initialize Orderbook Controls
        this.initOrderbookControls();

        // Check if chart is already loaded and sync if so
        if (window.chart && (window.chart.currentLayoutId || window.chart.layoutId)) {
            this.syncSettingsFromChart(window.chart);
        }
    }

    syncSettingsFromChart(chart) {
        if (!chart) return;
        const layoutId = chart.currentLayoutId || chart.layoutId || this.activeLayoutId;
        if (layoutId) {
            this.activeLayoutId = layoutId;
        }

        // We specifically DO NOT load orderbook settings from chartState anymore 
        // to keep them transient as per user request.
        // console.log('[Sidebar] syncSettingsFromChart: Orderbook settings are now transient (memory-only).');

        // Ensure UI matches current memory state
        this.applySettingsToUI();
    }

    initOrderbookControls() {
        const precisionSelect = document.getElementById('orderbook-precision-select');
        const moreBtn = document.getElementById('orderbook-more-btn');
        const dropdown = document.getElementById('orderbook-settings-dropdown');
        const animationToggle = document.getElementById('orderbook-animation-toggle');
        const settingsOptions = document.querySelectorAll('.ob-settings-option');

        if (precisionSelect) {
            precisionSelect.addEventListener('change', (e) => {
                this.orderbookSettings.precision = parseFloat(e.target.value);
                this.renderOrderbook();
                this.saveOrderbookSettings();
            });
        }

        if (moreBtn && dropdown) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            document.addEventListener('click', () => dropdown.classList.remove('active'));
            dropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        if (animationToggle) {
            animationToggle.addEventListener('change', (e) => {
                this.orderbookSettings.animationsEnabled = e.target.checked;
                this.saveOrderbookSettings();
            });
        }

        settingsOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const mode = opt.dataset.mode;
                this.orderbookSettings.visualizationMode = mode;

                // Update UI state
                settingsOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                this.renderOrderbook();
                this.saveOrderbookSettings();
            });
        });

        // Ensure UI matches current settings on initialization
        this.applySettingsToUI();
    }

    applySettingsToUI() {
        const precisionSelect = document.getElementById('orderbook-precision-select');
        const animationToggle = document.getElementById('orderbook-animation-toggle');
        const settingsOptions = document.querySelectorAll('.ob-settings-option');

        // console.log('[Sidebar] Applying UI settings:', JSON.parse(JSON.stringify(this.orderbookSettings)));

        if (precisionSelect) {
            precisionSelect.value = String(this.orderbookSettings.precision);
        }

        if (animationToggle) {
            animationToggle.checked = !!this.orderbookSettings.animationsEnabled;
        }

        settingsOptions.forEach(opt => {
            if (opt.dataset.mode === this.orderbookSettings.visualizationMode) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });

        this.renderOrderbook();
    }

    async saveOrderbookSettings() {
        if (!window.chart) return;

        // 1. Update the global chart object for the current session
        window.chart.orderbook = { ...this.orderbookSettings };

        // 2. PERSISTENCE REMOVED: We no longer trigger Auto Save or DB updates 
        // for orderbook settings to keep them transient.
        // console.log('[Sidebar] Orderbook settings updated in memory (transient).');
    }

    async loadOrderbookSettings() {
        // This is usually called when init or when a layout is selected
        // For simplicity, we can also listen for chartify:data-loaded which usually carries layout info
    }

    handleTradeUpdate(symbol, exchange, trades) {
        if (!Array.isArray(trades)) return;

        const detailSymbol = document.getElementById('detail-symbol');
        // Normalize: remove delimiters AND .P suffix for comparison if needed, 
        // but the most reliable way is exact match of processed tickers.
        const currentSelected = (detailSymbol ? detailSymbol.textContent : '').toUpperCase();
        const incomingSymbol = (symbol || '').toUpperCase();
        const currentExchange = (window.chart?.exchange || '').toUpperCase();
        const incomingExchange = (exchange || '').toUpperCase();

        if (detailSymbol && (currentSelected === incomingSymbol || currentSelected.replace(/[/_]/g, '') === incomingSymbol.replace(/[/_]/g, '')) &&
            (!currentExchange || incomingExchange === currentExchange)) {

            const volumeEl = document.getElementById('detail-volume');
            if (volumeEl) {
                // Accumulate volume from this batch of trades
                const batchVol = trades.reduce((sum, t) => sum + (t.volume || 0), 0);
                this.todayVolume += batchVol;

                // Throttled UI Update: Only update DOM if it hasn't been updated in the last 100ms
                const now = Date.now();
                if (!this._lastVolumeUiUpdate || now - this._lastVolumeUiUpdate > 100) {
                    volumeEl.textContent = this.formatNumber(this.todayVolume);
                    this._lastVolumeUiUpdate = now;
                }
            }
        }
    }

    handleOrderbookUpdate(symbol, exchange, type, bids, asks) {
        // --- DYNAMIC PRECISION DETECTION ---
        if (type === 'snapshot' && bids && bids.length > 0) {
            const basePrecision = this.detectBasePrecision(bids, asks);
            const currentSymbol = (symbol || '').toUpperCase();

            // Re-build options if symbol changed or base precision is different
            if (this._lastObSymbol !== currentSymbol || this._lastBasePrecision !== basePrecision) {
                this.updatePrecisionSelect(basePrecision);
                this._lastObSymbol = currentSymbol;
                this._lastBasePrecision = basePrecision;

                // Reset current active precision to base on symbol change
                this.orderbookSettings.precision = basePrecision;
            }
        }
        const detailSymbol = document.getElementById('detail-symbol');
        const currentSelected = (detailSymbol ? detailSymbol.textContent : '').replace(/[/_-]/g, '').toUpperCase();
        const incomingSymbol = (symbol || '').replace(/[/_-]/g, '').toUpperCase();

        // console.log(`[Sidebar] Orderbook Event: ${incomingSymbol} (Target: ${currentSelected}) Type: ${type}`);

        if (!detailSymbol || currentSelected !== incomingSymbol) return;

        // Verify active chart exchange matches
        const currentExchange = (window.chart?.exchange || '').toUpperCase();
        const incomingExchange = (exchange || '').toUpperCase();
        if (currentExchange && incomingExchange !== currentExchange) return;

        if (!this.orderbookState) {
            this.orderbookState = { bids: new Map(), asks: new Map() };
        }

        if (type === 'snapshot') {
            this.orderbookState.bids.clear();
            this.orderbookState.asks.clear();
        }

        // Apply deltas
        if (bids && Array.isArray(bids)) {
            bids.forEach(b => {
                const price = typeof b[0] === 'string' ? parseFloat(b[0]) : b[0];
                const qty = typeof b[1] === 'string' ? parseFloat(b[1]) : b[1];
                if (qty === 0) this.orderbookState.bids.delete(price);
                else this.orderbookState.bids.set(price, qty);
            });
        }

        if (asks && Array.isArray(asks)) {
            asks.forEach(a => {
                const price = typeof a[0] === 'string' ? parseFloat(a[0]) : a[0];
                const qty = typeof a[1] === 'string' ? parseFloat(a[1]) : a[1];
                if (qty === 0) this.orderbookState.asks.delete(price);
                else this.orderbookState.asks.set(price, qty);
            });
        }

        // Debounce render using requestAnimationFrame for smooth 60FPS updates
        if (!this._obRenderPending) {
            this._obRenderPending = true;
            requestAnimationFrame(() => {
                this.renderOrderbook();
                this._obRenderPending = false;
            });
        }
    }

    detectBasePrecision(bids, asks) {
        let maxDecimals = 0;
        const sample = [...(bids || []).slice(0, 10), ...(asks || []).slice(0, 10)];

        sample.forEach(entry => {
            const priceStr = entry[0].toString();
            if (priceStr.includes('.')) {
                // Ignore extremely small differences that represent jitter
                const parts = priceStr.split('.');
                const decimals = parts[1].length;
                if (decimals > maxDecimals && decimals < 10) maxDecimals = decimals;
            }
        });

        // Use a clean power of 10
        return Number(Math.pow(10, -maxDecimals).toFixed(maxDecimals));
    }

    updatePrecisionSelect(base) {
        const select = document.getElementById('orderbook-precision-select');
        if (!select) return;

        // Clear existing
        select.innerHTML = '';

        // Generate 4 levels: 1 finer, 1 native, 2 coarser
        const levels = [0.1, 1, 10, 100];

        levels.forEach(multiplier => {
            // Round to avoid floating point jitter (e.g. 0.1 * 0.1 = 0.010000000000000002)
            const val = Number((base * multiplier).toFixed(10));

            // Format for display
            let displayVal;
            if (val < 1) {
                const decimals = Math.max(0, -Math.round(Math.log10(val)));
                displayVal = val.toFixed(decimals);
            } else {
                displayVal = val.toString();
            }

            const option = document.createElement('option');
            option.value = val.toString();
            option.textContent = displayVal;

            if (multiplier === 1) {
                option.selected = true;
            }

            select.appendChild(option);
        });
    }

    renderOrderbook() {
        if (!this.orderbookState) return;

        const maxDisplayLevels = 10;
        const precision = this.orderbookSettings.precision;

        // --- PRECISE AGGREGATION LOGIC ---
        const aggregate = (entries, isBid) => {
            const map = new Map();
            entries.forEach(([price, qty]) => {
                // Grouping: Bids round down (lower price), Asks round up (higher price) to maintain spread gap
                const factor = 1 / precision;
                const roundedPrice = isBid
                    ? Math.floor(price * factor) / factor
                    : Math.ceil(price * factor) / factor;

                map.set(roundedPrice, (map.get(roundedPrice) || 0) + parseFloat(qty));
            });
            return Array.from(map.entries());
        };

        let bidEntries = aggregate(Array.from(this.orderbookState.bids.entries()), true);
        let askEntries = aggregate(Array.from(this.orderbookState.asks.entries()), false);

        bidEntries.sort((a, b) => b[0] - a[0]); // Descending
        askEntries.sort((a, b) => a[0] - b[0]); // Ascending

        bidEntries = bidEntries.slice(0, maxDisplayLevels);
        askEntries = askEntries.slice(0, maxDisplayLevels);

        const formatDec = (v) => {
            if (v === 0) return '0';
            if (v >= 1000000) return (v / 1000000).toFixed(3) + 'M';
            if (v >= 1000) return Math.floor(v).toLocaleString();
            if (v >= 1) return v.toFixed(3);
            if (v >= 0.0001) return v.toFixed(4);
            const s = v.toFixed(12);
            const match = s.match(/0\.0*[1-9]/);
            return match ? match[0] : v.toString();
        };

        let cumulativeBid = 0;
        const bidRows = bidEntries.map(b => {
            const amount = parseFloat(b[1] || 0);
            cumulativeBid += amount;

            const isCumulative = this.orderbookSettings.visualizationMode === 'cumulative';
            const displayValue = isCumulative ? cumulativeBid : amount;

            return {
                priceStr: this.formatPriceStr(b[0]),
                qtyStr: formatDec(amount),
                totalStr: formatDec(displayValue),
                amount: amount,
                cumulative: cumulativeBid
            };
        });

        // Pad Bids
        while (bidRows.length < maxDisplayLevels) {
            bidRows.push({ priceStr: '-', qtyStr: '-', totalStr: '-', amount: 0, cumulative: 0, pct: 0 });
        }

        let cumulativeAsk = 0;
        const askRows = askEntries.map(a => {
            const amount = parseFloat(a[1] || 0);
            cumulativeAsk += amount;

            const isCumulative = this.orderbookSettings.visualizationMode === 'cumulative';
            const displayValue = isCumulative ? cumulativeAsk : amount;

            return {
                priceStr: this.formatPriceStr(a[0]),
                qtyStr: formatDec(amount),
                totalStr: formatDec(displayValue),
                amount: amount,
                cumulative: cumulativeAsk
            };
        });

        // Pad Asks
        while (askRows.length < maxDisplayLevels) {
            askRows.push({ priceStr: '-', qtyStr: '-', totalStr: '-', amount: 0, cumulative: 0, pct: 0 });
        }

        // Max for bar scale depends on mode
        const isCumulative = this.orderbookSettings.visualizationMode === 'cumulative';
        const bidMax = isCumulative ? cumulativeBid : Math.max(...bidRows.map(r => r.amount), 0);
        const askMax = isCumulative ? cumulativeAsk : Math.max(...askRows.map(r => r.amount), 0);
        const maxVal = Math.max(bidMax, askMax);

        // Calculate % based on either cumulative depth or individual amount
        bidRows.forEach(r => {
            const val = isCumulative ? r.cumulative : r.amount;
            r.pct = maxVal ? (val / maxVal) * 100 : 0;
        });
        askRows.forEach(r => {
            const val = isCumulative ? r.cumulative : r.amount;
            r.pct = maxVal ? (val / maxVal) * 100 : 0;
        });

        const asksContainer = document.getElementById('orderbook-asks');
        const bidsContainer = document.getElementById('orderbook-bids');
        const spreadEl = document.getElementById('orderbook-spread-price');

        const updateDOM = (container, rowsData, type) => {
            if (!container) return;
            const currentNodes = Array.from(container.children);

            while (currentNodes.length < rowsData.length) {
                const el = document.createElement('div');
                el.className = `orderbook-row ${type}`;
                el.innerHTML = `
                    <div class="bg-bar" style="width: 0%"></div>
                    <div class="price-col"></div>
                    <div class="amount-col"></div>
                    <div class="total-col"></div>
                `;
                container.appendChild(el);
                currentNodes.push(el);
            }

            while (currentNodes.length > rowsData.length) {
                const el = currentNodes.pop();
                container.removeChild(el);
            }

            rowsData.forEach((r, i) => {
                const node = currentNodes[i];
                const bgBar = node.children[0];
                const priceCol = node.children[1];
                const amountCol = node.children[2];
                const totalCol = node.children[3];

                // Toggle animation class based on settings
                if (this.orderbookSettings.animationsEnabled) {
                    bgBar.classList.add('animated');
                } else {
                    bgBar.classList.remove('animated');
                }

                bgBar.style.width = r.pct + '%';
                if (priceCol.textContent !== r.priceStr) priceCol.textContent = r.priceStr;
                if (amountCol.textContent !== r.qtyStr) amountCol.textContent = r.qtyStr;
                if (totalCol.textContent !== r.totalStr) totalCol.textContent = r.totalStr;
            });
        };

        updateDOM(asksContainer, askRows, 'ask');
        updateDOM(bidsContainer, bidRows, 'bid');

        // Update Pressure Bar (Market Imbalance)
        const bidPressurePctEl = document.getElementById('bid-pressure-pct');
        const askPressurePctEl = document.getElementById('ask-pressure-pct');
        const bidPressureBar = document.getElementById('bid-pressure-bar');
        const askPressureBar = document.getElementById('ask-pressure-bar');

        if (bidPressurePctEl && askPressurePctEl && bidPressureBar && askPressureBar) {
            const totalVolume = cumulativeBid + cumulativeAsk;
            if (totalVolume > 0) {
                const bidRatio = (cumulativeBid / totalVolume) * 100;
                const askRatio = (cumulativeAsk / totalVolume) * 100;

                bidPressurePctEl.textContent = bidRatio.toFixed(1) + '%';
                askPressurePctEl.textContent = askRatio.toFixed(1) + '%';
                bidPressureBar.style.width = bidRatio + '%';
                askPressureBar.style.width = askRatio + '%';
            }
        }

        if (spreadEl && this.orderbookState.bids.size > 0 && this.orderbookState.asks.size > 0) {
            // Use raw (unaggregated) prices for color logic to keep it responsive
            const rawBids = Array.from(this.orderbookState.bids.keys()).sort((a, b) => b - a);
            const rawAsks = Array.from(this.orderbookState.asks.keys()).sort((a, b) => a - b);

            const bestRawAsk = rawAsks[0];
            const bestRawBid = rawBids[0];
            const currentPrice = window.chart?.lastTradePrice || bestRawAsk;

            // Calculate decimals based on price threshold: 3+ if < 1, 2 if >= 1
            const precision = this.orderbookSettings?.precision || 0.1;
            const precisionDecimals = precision < 1 ? Math.abs(Math.floor(Math.log10(precision))) : 0;

            let spreadDecimals = 2;
            if (currentPrice < 1) {
                spreadDecimals = Math.max(3, precisionDecimals);
            }

            const formattedSpread = currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: spreadDecimals,
                maximumFractionDigits: spreadDecimals
            });
            this.updateRollingPrice(spreadEl, formattedSpread, 'spread');

            if (currentPrice >= bestRawAsk) {
                spreadEl.className = 'spread-price change-down';
            } else if (currentPrice <= bestRawBid) {
                spreadEl.className = 'spread-price change-up';
            } else {
                // If it's in the real spread gap, we keep current color or default
                // Usually it's better to keep it based on the last side if possible, 
                // but comparison to RAW best is the safest for responsive color.
                spreadEl.className = 'spread-price';
            }
        }
    }

    formatPriceStr(p) {
        if (p == null || isNaN(p)) return '0.00';

        const precision = this.orderbookSettings?.precision || 0.1;

        // Calculate decimals based on precision (supports scientific notation e.g. 1e-8)
        let decimals = 0;
        if (precision < 1) {
            decimals = Math.abs(Math.floor(Math.log10(precision)));
        }

        return p.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    handleTickerUpdate(symbol, data, exchange) {
        // Detailed Panel Refresh (Top Right)
        const detailSymbol = document.getElementById('detail-symbol');
        const currentSelected = (detailSymbol ? detailSymbol.textContent : '').replace(/[/_-]/g, '').toUpperCase();
        const incomingSymbol = (symbol || '').replace(/[/_-]/g, '').toUpperCase();

        // Verify that this update matches our ACTIVE chart's ticker AND exchange
        const currentExchange = (window.chart?.exchange || '').toUpperCase();
        const incomingExchange = (exchange || data?.exchange || '').toUpperCase();

        if (detailSymbol && currentSelected === incomingSymbol &&
            (!currentExchange || incomingExchange === currentExchange)) {
            const priceEl = document.getElementById('detail-price');
            const changeAbsEl = document.getElementById('detail-change-abs');
            const changePctEl = document.getElementById('detail-change-pct');
            const volumeEl = document.getElementById('detail-volume');

            if (priceEl) {
                // Tick-by-tick coloring
                if (this.lastDetailedPrice !== null && data.price !== this.lastDetailedPrice) {
                    priceEl.className = data.price > this.lastDetailedPrice ? 'change-up' : 'change-down';
                }
                const decimals = data.price < 1 ? 6 : 2;
                const formattedPrice = data.price.toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                this.updateRollingPrice(priceEl, formattedPrice);
                this.lastDetailedPrice = data.price;
            }

            if (this.sessionOpenPrice) {
                const diff = data.price - this.sessionOpenPrice;
                const pct = (diff / this.sessionOpenPrice) * 100;
                const sign = diff >= 0 ? '+' : '';
                const sessionColorClass = diff >= 0 ? 'change-up' : 'change-down';

                // Note: priceEl class is handled by tick logic above, 
                // but we keep change labels on session-based coloring
                if (changeAbsEl) {
                    const decimals = data.price < 1 ? 6 : 2;
                    changeAbsEl.textContent = `${sign}${diff.toFixed(decimals)}`;
                    changeAbsEl.className = sessionColorClass;
                }
                if (changePctEl) {
                    changePctEl.textContent = `${sign}${pct.toFixed(2)}%`;
                    changePctEl.className = sessionColorClass;
                }
            } else {
                // Fallback to 24h data if sessionOpen is not yet available
                if (data.change !== undefined && data.changePercent !== undefined) {
                    const colorClass = data.change >= 0 ? 'change-up' : 'change-down';
                    if (changeAbsEl) {
                        const sign = data.change >= 0 ? '+' : '';
                        const decimals = data.price < 1 ? 6 : 2;
                        changeAbsEl.textContent = `${sign}${data.change.toFixed(decimals)}`;
                        changeAbsEl.className = colorClass;
                    }
                    if (changePctEl) {
                        const sign = data.changePercent >= 0 ? '+' : '';
                        changePctEl.textContent = `${sign}${data.changePercent.toFixed(2)}%`;
                        changePctEl.className = colorClass;
                    }
                } else {
                    if (changeAbsEl) changeAbsEl.textContent = '...';
                    if (changePctEl) changePctEl.textContent = '...';
                }
            }

            // if (volumeEl) {
            //     // DISABLED: Stop using 24h rolling volume from ticker to avoid "shifting" Today's Volume
            //     // volumeEl.textContent = this.formatNumber(data.volume);
            // }

            // Real-time Seasonals Sync
            const now = Date.now();
            if (now - this.lastSeasonalSyncTime > 1500) {
                const currentYear = new Date().getUTCFullYear();
                let updated = false;

                // 1. Update Sidebar Seasonals
                if (this.seasonalData && this.sidebarYearStartPrice > 0) {
                    // Match check to prevent -99% bug during transition
                    const detailSymbol = document.getElementById('detail-symbol');
                    const sidebarSymbol = (detailSymbol ? detailSymbol.textContent : '').replace(/[/_-]/g, '').toUpperCase();
                    if (incomingSymbol === sidebarSymbol) {
                        const currentYearResults = this.seasonalData[currentYear];
                        if (currentYearResults && currentYearResults.data) {
                            const sData = currentYearResults.data;
                            if (sData.length > 0) {
                                const lastP = sData[sData.length - 1];
                                const doy = this.getSeasonalDayIndex(new Date(now), currentYear);
                                const pct = ((data.price - this.sidebarYearStartPrice) / this.sidebarYearStartPrice) * 100;
                                const points = data.price - this.sidebarYearStartPrice;
                                const newPoint = { day: doy, percentage: pct, regular: points };

                                if (doy > lastP.day) {
                                    // Fill any gaps (e.g. over weekends) to ensure "one day one point"
                                    for (let d = lastP.day + 1; d <= doy; d++) {
                                        if (d === doy) {
                                            sData.push(newPoint);
                                        } else {
                                            // Carry over last point
                                            sData.push({ ...lastP, day: d });
                                        }
                                    }
                                } else if (doy === lastP.day) {
                                    sData[sData.length - 1] = newPoint;
                                }
                                this.renderSeasonalsChart(this.seasonalData, this.seasonalColors);
                                updated = true;
                            }
                        }
                    }

                    // 2. Update Full Seasonals
                    if (this.fullSeasonalsResults && this.fullYearStartPrice > 0) {
                        const detailSymbol = document.getElementById('detail-symbol');
                        const sidebarSymbol = (detailSymbol ? detailSymbol.textContent : '').replace(/[/_-]/g, '').toUpperCase();

                        if (incomingSymbol === sidebarSymbol && this.fullSeasonalsResults[currentYear]) {
                            const fData = this.fullSeasonalsResults[currentYear].data;
                            if (fData.length > 0) {
                                const doy = this.getSeasonalDayIndex(new Date(now), currentYear);
                                const pct = ((data.price - this.fullYearStartPrice) / this.fullYearStartPrice) * 100;
                                const points = data.price - this.fullYearStartPrice; // This is for sidebar if needed
                                const lastP = fData[fData.length - 1];
                                const newPoint = {
                                    day: doy,
                                    percentage: pct,
                                    regular: data.price
                                };
                                if (doy > lastP.day) {
                                    fData.push(newPoint);
                                } else {
                                    fData[fData.length - 1] = newPoint;
                                }
                                this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
                                updated = true;
                            }
                        }
                    }

                    if (updated) {
                        this.lastSeasonalSyncTime = now;
                        // If table is visible, refresh it too
                        const tableWrapper = document.getElementById('seasonals-full-table');
                        if (tableWrapper && tableWrapper.style.display === 'block') {
                            this.renderSeasonalTable(this.fullSeasonalsResults);
                        }
                    }
                }

                // 3. Update Real-time Performance Metrics (Throttled 1s)
                if (this.performanceBasePrices && now - this.lastPerformanceSyncTime > 1000) {
                    Object.entries(this.performanceBasePrices).forEach(([key, startPrice]) => {
                        const pctChange = ((data.price - startPrice) / startPrice) * 100;
                        const el = document.getElementById(`perf-${key}`);
                        const box = document.getElementById(`perf-box-${key}`);
                        if (el) {
                            el.textContent = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%';
                            el.className = `perf-value ${pctChange >= 0 ? 'bg-up' : 'bg-down'}`;
                        }
                        if (box) {
                            box.className = `perf-box ${pctChange >= 0 ? 'bg-up' : 'bg-down'}`;
                        }
                    });
                    this.lastPerformanceSyncTime = now;
                }
            }

            // Also update watchlist items if present
            const watchlistItems = document.querySelectorAll('.watchlist-item');
            const normalizedIncoming = incomingSymbol.replace(/[/_-]/g, '').toUpperCase();

            watchlistItems.forEach(item => {
                const itemSymbol = (item.dataset.symbol || '').replace(/[/_-]/g, '').toUpperCase();
                if (itemSymbol === normalizedIncoming) {
                    const priceEl = item.querySelector('.symbol-price');
                    const changeEl = item.querySelector('.symbol-change');
                    if (priceEl) {
                        const prevPrice = parseFloat(priceEl.textContent.replace(/,/g, ''));
                        if (!isNaN(prevPrice) && data.price !== prevPrice) {
                            priceEl.className = `symbol-price ${data.price > prevPrice ? 'change-up' : 'change-down'}`;
                        }
                        priceEl.textContent = data.price.toLocaleString();
                    }
                    if (changeEl) {
                        // Use stored prevClose for correct % (not Gate.io's raw changePercent)
                        const normalizedSym = incomingSymbol.toUpperCase();
                        const prevClose = this.watchlistPrevClose[normalizedSym];
                        if (prevClose) {
                            const pct = ((data.price - prevClose) / prevClose) * 100;
                            changeEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                            changeEl.className = `symbol-change ${pct >= 0 ? 'change-up' : 'change-down'}`;
                        } else {
                            // Fallback to WebSocket data if prevClose not yet loaded
                            changeEl.textContent = (data.changePercent >= 0 ? '+' : '') + data.changePercent.toFixed(2) + '%';
                            changeEl.className = `symbol-change ${data.changePercent >= 0 ? 'change-up' : 'change-down'}`;
                        }
                    }
                }
            });
        }
    }

    async fetchInitialWatchlistPrices() {
        // const apiBase = 'http://localhost:5000/api/v1';
        // for (const item of this.watchlistData) {
        //     try {
        //         // Determine ID (Resolve from ticker if missing)
        //         let targetId = item.id || item._id;
        //         const ticker = item.symbol.toUpperCase();

        //         if (!targetId || targetId === ticker) {
        //             const stockRes = await fetch(`${apiBase}/stock/${ticker}?exchange=${item.exchange || ''}`);
        //             const stockJson = await stockRes.json();
        //             if (stockJson.status && stockJson.data) {
        //                 targetId = stockJson.data.id || stockJson.data._id;
        //                 item.id = targetId; // Cache for next time
        //             }
        //         }

        //         if (!targetId) continue;

        //         const res = await fetch(`${apiBase}/market/history?id=${targetId}&timeframe=1d&limit=2`);
        //         const responseData = await res.json();
        //         const candles = responseData.candles || [];

        //         if (Array.isArray(candles) && candles.length > 0) {
        //             const last = candles[candles.length - 1];
        //             const prev = candles.length >= 2 ? candles[candles.length - 2] : last;
        //             const prevClose = prev.close;       // previous day's close = baseline
        //             const close = last.close;
        //             const change = close - prevClose;
        //             const changePercent = (change / prevClose) * 100;

        //             // Store for real-time updates
        //             this.watchlistPrevClose[ticker] = prevClose;

        //             item.price = close.toLocaleString(undefined, { minimumFractionDigits: 2 });
        //             item.change = (change >= 0 ? '+' : '') + changePercent.toFixed(2) + '%';
        //             item.up = change >= 0;

        //             // Update UI immediately
        //             this.updateWatchlistItemUI(item.symbol, close, changePercent);
        //         }
        //     } catch (e) {
        //         // console.warn(`[Sidebar] Failed initial fetch for ${item.symbol}:`, e.message);
        //     }
        // }
    }

    async subscribeToRealTime(symbol) {
        // Redirect individual subscriptions to the chart's worker if needed
        if (window.chart && window.chart.wsWorker) {
            window.chart.wsWorker.postMessage({ type: 'subscribe', symbols: [symbol] });
        }
    }

    updateWatchlistItemUI(symbol, price, changePercent) {
        const normalizedIncoming = symbol.replace(/[/_]/g, '').toUpperCase();
        const watchlistItems = document.querySelectorAll('.watchlist-item');
        watchlistItems.forEach(item => {
            const itemSymbol = (item.dataset.symbol || '').replace(/[/_]/g, '').toUpperCase();
            if (itemSymbol === normalizedIncoming) {
                const priceEl = item.querySelector('.symbol-price');
                const changeEl = item.querySelector('.symbol-change');
                if (priceEl) {
                    priceEl.textContent = price.toLocaleString(undefined, { minimumFractionDigits: 2 });
                }
                if (changeEl) {
                    changeEl.textContent = (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%';
                    changeEl.className = `symbol-change ${changePercent >= 0 ? 'change-up' : 'change-down'}`;
                }
            }
        });
    }

    formatNumber(num) {
        if (num === null || num === undefined) return '0.00';
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    updateRollingPrice(container, newPriceString, type = 'main') {
        if (!container) return;

        const rollerClass = type === 'spread' ? 'spread-roller' : 'price-roller';
        const digitHeight = type === 'spread' ? 18 : 38;

        // Ensure container has the roller structure
        let roller = container.querySelector('.' + rollerClass);
        if (!roller) {
            container.innerHTML = `<div class="${rollerClass}"></div>`;
            roller = container.querySelector('.' + rollerClass);
        }

        const chars = newPriceString.split('');
        const currentStrips = Array.from(roller.children);

        // Adjust number of strips
        if (currentStrips.length > chars.length) {
            for (let i = currentStrips.length - 1; i >= chars.length; i--) {
                currentStrips[i].remove();
            }
        }

        chars.forEach((char, i) => {
            let strip = roller.children[i];
            const isDigit = /\d/.test(char);

            if (!strip) {
                strip = document.createElement('div');
                roller.appendChild(strip);
            }

            if (isDigit) {
                if (!strip.classList.contains('digit-strip')) {
                    strip.className = 'digit-strip';
                    strip.innerHTML = '0123456789'.split('').map(d => `<span class="digit-char">${d}</span>`).join('');
                }
                const digit = parseInt(char);
                strip.style.transform = `translateY(-${digit * digitHeight}px)`;
            } else {
                if (!strip.classList.contains('digit-static') || strip.textContent !== char) {
                    strip.className = 'digit-static';
                    strip.innerHTML = `<span class="digit-char">${char}</span>`;
                    strip.style.transform = 'none';
                }
            }
        });
    }

    setupTabLogic() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        const clickedBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const isAlreadyActive = clickedBtn ? clickedBtn.classList.contains('active') : false;

        if (isAlreadyActive) {
            // Deactivate everything
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.sidebar-view').forEach(view => view.classList.remove('active'));

            // Collapse sidebar if not already collapsed
            if (!this.isCollapsed) {
                this.toggleSidebar();
            }
        } else {
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
            });

            // Update views
            document.querySelectorAll('.sidebar-view').forEach(view => {
                view.classList.toggle('active', view.id === tabId);
            });

            if (tabId === 'diagram-view') {
                this.updateObjectTree();
            }

            // Expand sidebar if collapsed
            if (this.isCollapsed) {
                this.toggleSidebar();
            }
        }
    }

    updateObjectTree(force = false) {
        // Guards to prevent destructive rebuilds during active interaction
        if (this.isEditingName || this.draggedItemIndex !== null) return;

        // Delay rebuilds if user recently interacted (except for forced updates)
        if (!force && Date.now() - this._lastInteractionTime < 800) return;

        if (!window.chart || !window.chart.drawingTools) return;

        const tools = window.chart.drawingTools;

        // Robust check to avoid flickering: compare state instead of force-rebuilding
        const selectedId = window.chart.selectedTool ? (window.chart.selectedTool.id || 'selected') : 'none';
        const hiddenCount = tools.filter(t => t.isHidden).length;
        const stateKey = `${tools.length}-${selectedId}-${hiddenCount}`;

        if (!force && this._lastStateKey === stateKey) return;
        this._lastStateKey = stateKey;

        this.objectTreeContainer.innerHTML = '';

        if (tools.length === 0) {
            this.objectTreeContainer.innerHTML = '<div style="padding: 20px; color: #787b86; text-align: center; font-size: 13px;">No objects on chart</div>';
            return;
        }

        tools.forEach((tool, index) => {
            const item = document.createElement('div');
            item.className = 'object-item';
            item.dataset.itemIndex = index;
            if (tool.isHidden) item.classList.add('hidden');
            if (window.chart.selectedTool === tool) item.classList.add('active');

            const name = tool.name || tool.constructor.name.replace('Tool', '');
            const visibilityIcon = tool.isHidden
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

            item.innerHTML = `
                <div class="object-icon">
                    ${this._getToolIcon(tool)}
                </div>
                <div class="object-name">${name}</div>
                <input type="text" class="object-name-input" autocomplete="off" draggable="false">
                <div class="object-visibility ${tool.isHidden ? 'hidden' : ''}" title="${tool.isHidden ? 'Show' : 'Hide'}">
                    <span style="pointer-events: none; display: flex;">${visibilityIcon}</span>
                </div>
                <div class="object-delete" title="Delete">
                    <span style="pointer-events: none; display: flex;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        </svg>
                    </span>
                </div>
            `;

            // Renaming Logic (Double-click)
            const nameInput = item.querySelector('.object-name-input');
            const nameSpan = item.querySelector('.object-name');

            if (nameInput && nameSpan) {
                item.onmousedown = () => {
                    this._lastInteractionTime = Date.now();
                };
                item.ondblclick = (e) => {
                    this._lastInteractionTime = Date.now();
                    e.stopPropagation();
                    if (this.isEditingName) return;

                    this.isEditingName = true;
                    item.classList.add('editing-name');
                    item.setAttribute('draggable', 'false');
                    item.draggable = false;

                    nameInput.value = tool.name || tool.constructor.name.replace('Tool', '');
                    nameInput.focus();
                    nameInput.select();
                };

                // Protect focus: clicking icon or padding shouldn't blur the input
                item.addEventListener('mousedown', (e) => {
                    if (item.classList.contains('editing-name') && !e.target.closest('.object-name-input')) {
                        e.preventDefault();
                    }
                });

                // Block all events to parent while editing to ensure native input behavior
                const inputsEvents = ['click', 'mousedown', 'mouseup', 'dblclick', 'dragstart'];
                inputsEvents.forEach(evtType => {
                    nameInput.addEventListener(evtType, (e) => e.stopPropagation());
                });

                nameInput.onblur = () => {
                    const newName = nameInput.value.trim();
                    if (newName) {
                        tool.name = newName;
                        nameSpan.textContent = newName; // Local update
                        window.chart.markToolDirty(tool, 'update');
                    }
                    item.classList.remove('editing-name');
                    item.setAttribute('draggable', 'true');
                    item.draggable = true;
                    this.isEditingName = false;

                    window.chart.render();
                };

                nameInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        nameInput.blur();
                    } else if (e.key === 'Escape') {
                        nameInput.value = tool.name || tool.constructor.name.replace('Tool', '');
                        nameInput.blur();
                    }
                };
            }

            // Visibility Toggle
            const visibilityBtn = item.querySelector('.object-visibility');
            if (visibilityBtn) {
                visibilityBtn.addEventListener('pointerdown', (e) => {
                    if (this.isEditingName) return;
                    e.stopPropagation();
                    e.preventDefault();
                    tool.isHidden = !tool.isHidden;
                    window.chart.markToolDirty(tool, 'update');
                    window.chart.render();
                    this.updateObjectTree(true);
                });
            }

            // Delete Logic
            const deleteBtn = item.querySelector('.object-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('pointerdown', (e) => {
                    if (this.isEditingName) return;
                    e.stopPropagation();
                    e.preventDefault();
                    window.chart.removeDrawing(tool);
                    this.updateObjectTree(true);
                });
            }

            // Selection
            item.addEventListener('click', (e) => {
                if (this.isEditingName) return;
                if (window.chart.selectedTool === tool) return; // Prevent rebuild if already active

                window.chart.selectedTool = tool;
                window.chart.render();

                // Smart update: just toggle classes instead of full rebuild
                this.objectTreeContainer.querySelectorAll('.object-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
            });

            // Custom Drag and Drop reordering
            item.setAttribute('draggable', 'false');
            let dragOffsetX = 0, dragOffsetY = 0;

            item.addEventListener('mousedown', (e) => {
                if (item.classList.contains('editing-name')) return;
                if (e.button !== 0) return;
                if (e.target.closest('.object-visibility, .object-settings, .object-delete')) return;
                const startX = e.clientX;
                const startY = e.clientY;
                const itemRect = item.getBoundingClientRect();
                dragOffsetX = e.clientX - itemRect.left;
                dragOffsetY = e.clientY - itemRect.top;
                let dragStarted = false;
                let ghost = null;

                const onMouseMove = (me) => {
                    const dx = me.clientX - startX;
                    const dy = me.clientY - startY;

                    if (!dragStarted && Math.abs(dx) + Math.abs(dy) > 5) {
                        dragStarted = true;
                        this.draggedItemIndex = index;
                        this._lastInteractionTime = Date.now();

                        // Create solid floating ghost
                        ghost = item.cloneNode(true);
                        ghost.style.cssText = `
                            position: fixed;
                            width: ${itemRect.width}px;
                            left: ${itemRect.left}px;
                            top: ${itemRect.top}px;
                            background: #2a2e39;
                            border: 1px solid #2962ff;
                            border-radius: 6px;
                            box-shadow: 0 12px 32px rgba(0,0,0,0.7);
                            opacity: 1;
                            pointer-events: none;
                            z-index: 9999;
                            transform: rotate(-3deg);
                            transition: none;
                        `;
                        document.body.appendChild(ghost);
                        this._dragGhost = ghost;

                        // Style original as a placeholder
                        item.style.opacity = '0.25';
                        item.style.background = 'rgba(41,98,255,0.04)';
                        item.style.border = '1px dashed #363a45';
                        item.style.borderRadius = '6px';

                        // Deselect active tool on drag start
                        if (window.chart.selectedTool) {
                            window.chart.selectedTool = null;
                            window.chart.render();
                        }

                        document.body.style.userSelect = 'none';
                    }

                    if (dragStarted && ghost) {
                        ghost.style.left = `${me.clientX - dragOffsetX}px`;
                        ghost.style.top = `${me.clientY - dragOffsetY}px`;

                        // Detect which item we're over
                        ghost.style.display = 'none';
                        const elUnder = document.elementFromPoint(me.clientX, me.clientY);
                        ghost.style.display = '';
                        const overItem = elUnder?.closest('[data-item-index]');

                        this.objectTreeContainer.querySelectorAll('.object-item').forEach(el => {
                            el.classList.remove('drag-over-top', 'drag-over-bottom');
                        });

                        if (overItem && overItem !== item) {
                            const overRect = overItem.getBoundingClientRect();
                            const localY = me.clientY - overRect.top;
                            if (localY < overRect.height / 2) {
                                overItem.classList.add('drag-over-top');
                            } else {
                                overItem.classList.add('drag-over-bottom');
                            }
                        }
                    }
                };

                const onMouseUp = (ue) => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.userSelect = '';

                    // Restore placeholder item
                    item.style.opacity = '';
                    item.style.background = '';
                    item.style.border = '';
                    item.style.borderRadius = '';

                    // Cleanup ghost
                    if (this._dragGhost) {
                        this._dragGhost.remove();
                        this._dragGhost = null;
                    }

                    if (dragStarted) {
                        // Find drop target
                        const elUnder = document.elementFromPoint(ue.clientX, ue.clientY);
                        const overItem = elUnder?.closest('[data-item-index]');

                        this.objectTreeContainer.querySelectorAll('.object-item').forEach(el => {
                            el.classList.remove('drag-over-top', 'drag-over-bottom');
                        });

                        if (overItem && overItem !== item) {
                            const targetIndex = parseInt(overItem.dataset.itemIndex);
                            const overRect = overItem.getBoundingClientRect();
                            const isTop = (ue.clientY - overRect.top) < overRect.height / 2;

                            if (this.draggedItemIndex !== targetIndex) {
                                let newIndex = isTop ? targetIndex : targetIndex + 1;
                                const movedTool = window.chart.drawingTools.splice(this.draggedItemIndex, 1)[0];
                                if (newIndex > this.draggedItemIndex) newIndex--;
                                window.chart.drawingTools.splice(newIndex, 0, movedTool);
                                window.chart.drawingTools.forEach(t => window.chart.markToolDirty(t, 'update'));
                                window.chart.render();
                            }
                        }

                        this.draggedItemIndex = null;
                        this._lastInteractionTime = 0;
                        setTimeout(() => this.updateObjectTree(), 0);
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            this.objectTreeContainer.appendChild(item);
        });

        this._lastUpdateTick = tools.length;
    }

    _getToolIcon(tool) {
        const className = tool.constructor.name;
        let svg = '';

        switch (className) {
            case 'TrendLineTool': svg = Icons.svgLine; break;
            case 'GannSquareTool': svg = Icons.svgGannSquare; break;
            case 'GannSquareFixedTool': svg = Icons.svgGannSquareFixed; break;
            case 'GannFanTool': svg = Icons.svgGannFan; break;
            case 'HorizontalLineTool': svg = Icons.svgHLine; break;
            case 'VerticalLineTool': svg = Icons.svgVLine; break;
            case 'RayTool': svg = Icons.svgRay; break;
            case 'HorizontalRayTool': svg = Icons.svgHRay; break;
            case 'ExtendedLineTool': svg = Icons.svgExtended; break;
            case 'InfoLineTool': svg = Icons.svgInfo; break;
            case 'TrendAngleTool': svg = Icons.svgAngle; break;
            case 'CrossLineTool': svg = Icons.svgCross; break;
            case 'FibonacciRetracementTool': svg = Icons.svgFib; break;
            case 'FibonacciFanTool': svg = Icons.svgFibFan; break;
            case 'FibonacciChannelTool': svg = Icons.svgFibChan; break;
            case 'FibonacciCirclesTool': svg = Icons.svgFibCirc; break;
            case 'FibonacciSpiralTool': svg = Icons.svgFibSpiral; break;
            case 'FibonacciArcsTool': svg = Icons.svgFibArcs; break;
            case 'FibonacciWedgeTool': svg = Icons.svgFibWedge; break;
            case 'PitchFanTool': svg = Icons.svgPitchFan; break;
            case 'RectangleTool': svg = Icons.svgRect; break;
            case 'CircleTool': svg = Icons.svgCircle; break;
            case 'EllipseTool': svg = Icons.svgEllipse; break;
            case 'TriangleTool': svg = Icons.svgTriangle; break;
            case 'RotatedRectangleTool': svg = Icons.svgRotRect; break;
            case 'PathTool': svg = Icons.svgPathIcon; break;
            case 'PolylineTool': svg = Icons.svgPoly; break;
            case 'ArcTool': svg = Icons.svgArc; break;
            case 'CurveTool': svg = Icons.svgCurve; break;
            case 'DoubleCurveTool': svg = Icons.svgDoubleCurve; break;
            case 'BrushTool': svg = Icons.svgBrush; break;
            case 'HighlighterTool': svg = Icons.svgHighlighter; break;
            case 'LongPositionTool': svg = Icons.svgLong; break;
            case 'ShortPositionTool': svg = Icons.svgShort; break;
            case 'ForecastTool': svg = Icons.svgForecast; break;
            case 'ProjectionTool': svg = Icons.svgProj; break;
            case 'PriceRangeTool': svg = Icons.svgMeasPrice; break;
            case 'TimeRangeTool': svg = Icons.svgMeasTime; break;
            case 'PriceTimeRangeTool': svg = Icons.svgMeasPriceTime; break;
            case 'ArrowTool': svg = Icons.svgArrowRight; break;
            case 'ArrowMarkUpTool': svg = Icons.svgArrowUp; break;
            case 'ArrowMarkDownTool': svg = Icons.svgArrowDown; break;
            case 'ArrowMarkerTool': svg = Icons.svgArrowMarker; break;
            case 'XABCDPatternTool': svg = Icons.svgXABCD; break;
            case 'CypherPatternTool': svg = Icons.svgCypher; break;
            case 'HSPatternTool': svg = Icons.svgHS; break;
            case 'ABCDPatternTool': svg = Icons.svgABCD; break;
            case 'TrianglePatternTool': svg = Icons.svgTriangle; break;
            case 'ThreeDrivesPatternTool': svg = Icons.svgThreeDrives; break;
            case 'ElliottImpulseTool': svg = Icons.svgElliottImpulse; break;
            case 'ElliottCorrectionTool': svg = Icons.svgElliottCorrection; break;
            case 'ElliottTriangleTool': svg = Icons.svgElliottTriangle; break;
            case 'ElliottTripleComboTool': svg = Icons.svgElliottImpulse; break;
            case 'CyclicLinesTool': svg = Icons.svgCyclicLines; break;
            case 'TimeCyclesTool': svg = Icons.svgTimeCycles; break;
            case 'SineLineTool': svg = Icons.svgSineLine; break;
            case 'TextTool': svg = Icons.svgText; break;
            case 'AnchoredTextTool': svg = Icons.svgAnchoredText; break;
            case 'TableTool': svg = Icons.svgTable; break;
            case 'CalloutTool': svg = Icons.svgCallout; break;
            case 'CommentTool': svg = Icons.svgComment; break;
            case 'PriceLabelTool': svg = Icons.svgPriceLabel; break;
            case 'SignPostTool': svg = Icons.svgSignpost; break;
            case 'PinTool': svg = Icons.svgPin; break;
            case 'FlagMarkTool': svg = Icons.svgFlag; break;
            default:
                svg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
        }

        // Adjust SVG size for sidebar (using width/height 14 for compact look)
        return svg.replace('width="18"', 'width="14"').replace('height="18"', 'height="14"');
    }

    renderWatchlist() {
        if (!this.watchlistContainer) return;
        this.watchlistContainer.innerHTML = '';
        if (this.watchlistData.length === 0) {
            this.watchlistContainer.innerHTML = '<div style="padding: 20px; color: #787b86; text-align: center; font-size: 13px;">Watchlist is empty</div>';
            return;
        }
        this.watchlistData.forEach(item => {
            const row = document.createElement('div');
            row.className = 'watchlist-item';
            row.dataset.symbol = item.symbol;
            const displayTicker = extractSymbol(item.symbol);

            const logoUrl = getTickerLogo(item.base_currency_symbol || displayTicker, item.asset_type || item.market);
            row.innerHTML = `
                <div class="watchlist-item-left">
                    <div class="watchlist-item-icon">
                        <img src="${logoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
                        <div class="icon-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${displayTicker[0]}</div>
                    </div>
                    <div class="symbol-name">${displayTicker}</div>
                </div>
                <div class="watchlist-item-right">
                    <div class="symbol-price">${item.price}</div>
                    <div class="symbol-change ${item.up ? 'change-up' : 'change-down'}">${item.change}</div>
                </div>
            `;
            row.addEventListener('click', (e) => this.selectSymbol(item, e));
            this.watchlistContainer.appendChild(row);
        });
    }

    async selectSymbol(item, event, skipLoadOnChart = false) {
        const symbol = item.symbol.toUpperCase();
        const name = item.name || item.symbol;
        const market = item.market || 'crypto';
        const exchange = (item.exchange || window.chart?.exchange || '').toUpperCase();

        // Anti-flicker: If it's the same symbol and it's just a background sync (like timeframe change), 
        // skip everything to keep the current sidebar data intact.
        const isNewSymbol = this._lastSidebarSymbol !== symbol || this._lastSidebarExchange !== exchange;
        if (!isNewSymbol && skipLoadOnChart) return;

        // Clear seasonal state on new symbol to prevent mismatched -99% pulse dot bug
        if (isNewSymbol) {
            this.seasonalData = null;
            this.fullSeasonalsResults = null;
            this.sidebarYearStartPrice = null;
            this.fullYearStartPrice = null;
            this.currentSeasonalSymbol = symbol;
        }

        this.currentMarket = market;

        // Always update basic Detail Panel header (Name/Symbol/Logo)
        const detailSymbol = document.getElementById('detail-symbol');
        const detailName = document.getElementById('detail-full-name');
        const detailLogo = document.getElementById('detail-logo');
        console.log(item)
        if (detailSymbol) detailSymbol.textContent = item.symbol;
        if (detailName) detailName.textContent = name;

        // Update Market Type label early
        const dSpotTypeShort = document.getElementById('detail-spot-type');
        if (dSpotTypeShort) {
            if (symbol.endsWith('.P')) {
                dSpotTypeShort.textContent = 'Futures';
            } else if (market === 'stocks') {
                dSpotTypeShort.textContent = 'Common Stock';
            } else {
                dSpotTypeShort.textContent = 'Spot';
            }
        }

        if (detailLogo) {
            const logoSymbol = extractSymbol(item.symbol);
            const logoUrl = getTickerLogo(item.base_currency_symbol || logoSymbol, item.asset_type || item.market);
            detailLogo.innerHTML = `
                <img src="${logoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
                <div class="icon-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${logoSymbol[0]}</div>
            `;
            detailLogo.style.background = 'none';
        }

        // Update Exchange and Currency labels
        const detailExch = document.getElementById('detail-exchange');
        if (detailExch) {
            detailExch.textContent = exchange || 'BINANCE';
        }
        const currencyLabels = document.querySelectorAll('.currency-label');
        currencyLabels.forEach(el => {
            el.textContent = item.currency || window.chart?.currency || 'USDT';
        });

        // Only Reset secondary labels and Re-fetch if it's actually a NEW symbol.
        // This prevents the sidebar from going "loading..." when you just change timeframe.
        if (isNewSymbol) {
            this._lastSidebarSymbol = symbol;
            this._lastSidebarExchange = exchange;

            const dPrice = document.getElementById('detail-price');
            const dChgAbs = document.getElementById('detail-change-abs');
            const dChgPct = document.getElementById('detail-change-pct');
            const dVol = document.getElementById('detail-volume');
            const dStatus = document.getElementById('detail-market-status');

            if (dPrice) {
                const initialPrice = item.price || '0.00';
                this.updateRollingPrice(dPrice, initialPrice);
            }
            if (dChgAbs) dChgAbs.textContent = item.changeAbs || (item.change ? item.change.split(' ')[0] : '...');
            if (dChgPct) dChgPct.textContent = item.changePercent || (item.change ? item.change.split(' ')[1] : '...');
            if (dVol) dVol.textContent = '...';
            if (dStatus) dStatus.textContent = 'loading...';

            this.updatePerformanceData(symbol, market);
            this.updateSeasonals(symbol, market);
        }

        if (skipLoadOnChart) return;

        const layoutId = window.chart ? window.chart.currentLayoutId : null;
        loadStockData(layoutId, { _id: item.symbol, ticker: item.symbol, primary_exchange: item.exchange, market: item.market });
    }

    async updatePerformanceData(symbol, market = 'crypto') {
        this.sessionOpenPrice = null; // Reset
        this.performanceBasePrices = {}; // Reset
        const detailAvgVol = document.getElementById('detail-avg-volume');
        if (detailAvgVol) detailAvgVol.textContent = 'loading...';

        const perfs = ['1w', '1m', '3m', '6m', 'ytd', '1y'];
        perfs.forEach(p => {
            const el = document.getElementById(`perf-${p}`);
            if (el) {
                el.textContent = '...';
                el.style.opacity = '0.5';
            }
            const box = document.getElementById(`perf-box-${p}`);
            if (box) box.className = 'perf-box loading';
        });

        try {
            const apiBase = 'http://localhost:5000/api/v1';
            const ticker = symbol.toUpperCase();
            const marketParam = market === 'stock' ? 'stocks' : market;
            const activeExch = window.chart?.exchange || '';

            // Fetch daily history for performance and volume via backend
            const historyRes = await fetch(`${apiBase}/market/history?symbol=${ticker}&timeframe=1d&market=${marketParam}&exchange=${activeExch}`);
            const responseData = await historyRes.json();
            const candles = responseData.candles || [];

            if (!Array.isArray(candles) || candles.length === 0) return;

            const lastCandle = candles[candles.length - 1];
            const currentPrice = lastCandle.close;
            const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : candles[0];
            this.sessionOpenPrice = prevCandle.close;

            // Update Detail Panel with fixed data from history (important for CLOSED markets)
            const dPrice = document.getElementById('detail-price');
            const dChgAbs = document.getElementById('detail-change-abs');
            const dChgPct = document.getElementById('detail-change-pct');
            const dVol = document.getElementById('detail-volume');
            const dStatus = document.getElementById('detail-market-status');

            if (dPrice) {
                const formatted = currentPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                this.updateRollingPrice(dPrice, formatted);
            }

            // Sync "Today's Volume" with the latest Daily (1D) Candle
            this.todayVolume = lastCandle.volume || 0;
            if (dVol) dVol.textContent = this.formatNumber(this.todayVolume);

            const diff = currentPrice - this.sessionOpenPrice;
            const diffPct = (diff / this.sessionOpenPrice) * 100;
            const colorClass = diff >= 0 ? 'up' : 'down';

            if (dChgAbs) {
                const sign = diff >= 0 ? '+' : '';
                dChgAbs.textContent = `${sign}${diff.toFixed(2)}`;
                dChgAbs.className = `change-container ${colorClass}`;
                dChgAbs.style.color = diff >= 0 ? '#26a69a' : '#ef5350';
            }
            if (dChgPct) {
                const sign = diff >= 0 ? '+' : '';
                dChgPct.textContent = `${sign}${diffPct.toFixed(2)}%`;
                dChgPct.className = `change-container ${colorClass}`;
                dChgPct.style.color = diff >= 0 ? '#26a69a' : '#ef5350';
            }
            if (dStatus && responseData.meta) {
                const ms = (responseData.meta.marketStatus || 'REGULAR').toUpperCase();
                let statusText = '';
                let statusColor = '';

                if (ms === 'REGULAR') {
                    statusText = 'Market Open';
                    statusColor = '#089981'; // Green
                } else if (ms === 'PRE' || ms === 'PREPRE') {
                    statusText = 'Pre-market';
                    statusColor = '#FF9800'; // Orange
                } else if (ms === 'POST' || ms === 'POSTPOST') {
                    statusText = 'After-hours';
                    statusColor = '#FF9800'; // Orange
                } else {
                    statusText = 'Market Closed';
                    statusColor = '#F23645'; // Red
                }

                dStatus.textContent = statusText;
                dStatus.style.color = statusColor;

                const dot = dStatus.previousElementSibling;
                if (dot) {
                    dot.className = 'status-dot';
                    dot.style.backgroundColor = statusColor;
                }
            }

            // Update Dynamic Categories (Common Stock vs Crypto, etc.)
            const dSpotType = document.getElementById('detail-spot-type');
            const dAssetType = document.getElementById('detail-asset-type');
            if (responseData.meta) {
                const iType = responseData.meta.instrumentType;
                const isFutures = ticker.endsWith('.P');

                if (iType === 'EQUITY') {
                    if (dSpotType) dSpotType.textContent = 'Common Stock';
                    if (dAssetType) dAssetType.textContent = responseData.meta.exchangeName || 'Stock';
                } else if (iType === 'CRYPTOCURRENCY' || isFutures) {
                    if (dSpotType) dSpotType.textContent = isFutures ? 'Futures' : 'Spot';
                    if (dAssetType) dAssetType.textContent = 'Crypto';
                } else {
                    if (dSpotType) dSpotType.textContent = isFutures ? 'Futures' : (iType || 'Spot');
                    if (dAssetType) dAssetType.textContent = market === 'stocks' ? 'Stock' : 'Crypto';
                }
            }

            // 1. Avg Vol (30d)
            const last30 = candles.slice(-30);
            const avgVol = last30.reduce((sum, c) => sum + (c.volume || 0), 0) / last30.length;
            if (detailAvgVol) detailAvgVol.textContent = this.formatNumber(avgVol);

            // 2. Performance Metrics
            const periods = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 'ytd' };

            for (const [key, days] of Object.entries(periods)) {
                let startTs;
                if (days === 'ytd') {
                    startTs = new Date(new Date().getUTCFullYear(), 0, 1).getTime();
                } else {
                    startTs = Date.now() - (days * 24 * 60 * 60 * 1000);
                }

                // Find closest candle at or after startTs
                const startCandle = candles.find(c => c.timestamp >= startTs) || candles[0];
                if (!startCandle) continue;

                const startPrice = startCandle.open;
                this.performanceBasePrices[key] = startPrice;
                const pctChange = ((currentPrice - startPrice) / startPrice) * 100;

                const el = document.getElementById(`perf-${key}`);
                const box = document.getElementById(`perf-box-${key}`);
                if (el) {
                    el.textContent = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(2) + '%';
                    el.className = `perf-value ${pctChange >= 0 ? 'bg-up' : 'bg-down'}`;
                }
                if (box) {
                    box.className = `perf-box ${pctChange >= 0 ? 'bg-up' : 'bg-down'}`;
                }
            }
        } catch (e) {
            console.error("Error fetching performance/avg volume:", e);
        } finally {
            // Ensure loading indicator is removed even if fetch fails or returns empty
            if (detailAvgVol && detailAvgVol.textContent === 'loading...') {
                detailAvgVol.textContent = 'n/a';
            }
            perfs.forEach(p => {
                const el = document.getElementById(`perf-${p}`);
                const box = document.getElementById(`perf-box-${p}`);
                if (el) {
                    el.style.opacity = '1';
                    if (el.textContent === '...') el.textContent = 'n/a';
                }
                if (box && box.classList.contains('loading')) {
                    box.classList.remove('loading');
                }
            });
        }
    }

    async updateLayouts(tickerId) {
        if (!tickerId) return;
        try {
            this.currentLayouts = await getLayouts(tickerId);
            this.renderLayoutManager();
        } catch (e) {
            console.error('Error fetching layouts:', e);
        }
    }

    toggleLayoutManager() {
        let mgr = document.getElementById('layout-manager-popup');
        if (!mgr) {
            mgr = document.createElement('div');
            mgr.id = 'layout-manager-popup';
            mgr.className = 'context-menu active'; // Reuse context menu styling
            mgr.style.cssText = `position: fixed; top: 100px; right: 320px; width: 220px; z-index: 1000; background: #131722; border: 1px solid #363a45; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);`;
            document.body.appendChild(mgr);
        } else {
            mgr.remove();
            return;
        }
        this.renderLayoutManager();
    }

    renderLayoutManager() {
        const mgr = document.getElementById('layout-manager-popup');
        if (!mgr) return;

        mgr.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #363a45; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; color: #d1d4dc;">
                Chart Layouts
                <button id="add-layout-btn" title="Create New Layout" style="background: none; border: none; color: #2962ff; cursor: pointer; font-size: 18px; padding: 0 4px;">+</button>
            </div>
            <div id="layout-list-container" style="max-height: 300px; overflow-y: auto; padding: 4px 0;"></div>
        `;

        const container = mgr.querySelector('#layout-list-container');
        if (this.currentLayouts.length === 0) {
            container.innerHTML = '<div style="padding: 15px; color: #787b86; font-size: 12px; text-align: center;">No layouts found</div>';
        } else {
            this.currentLayouts.forEach(layout => {
                const item = document.createElement('div');
                item.className = `context-menu-item ${layout.id === window.chart?.currentLayoutId ? 'active' : ''}`;
                item.style.cssText = `display: flex; align-items: center; padding: 8px 12px; cursor: pointer; transition: background 0.2s;`;
                item.innerHTML = `
                    <span style="flex: 1; font-size: 13px;">${layout.name}</span>
                    ${layout.isDefault ? '<span style="font-size: 10px; color: #f7931a; background: rgba(247,147,26,0.1); padding: 1px 4px; border-radius: 2px; margin-right: 8px;">DEF</span>' : ''}
                    <div class="layout-actions" style="display: none; align-items: center; gap: 8px;">
                         <button class="delete-layout-btn" data-id="${layout.id}" style="background:none; border:none; color: #f7525f; cursor:pointer; padding: 2px;">&times;</button>
                    </div>
                `;

                item.onmouseenter = () => { item.querySelector('.layout-actions').style.display = 'flex'; };
                item.onmouseleave = () => { item.querySelector('.layout-actions').style.display = 'none'; };

                item.onclick = (e) => {
                    if (e.target.classList.contains('delete-layout-btn')) {
                        e.stopPropagation();
                        this.handleDeleteLayout(layout.id);
                    } else {
                        this.switchLayout(layout);
                    }
                };
                container.appendChild(item);
            });
        }

        mgr.querySelector('#add-layout-btn').onclick = () => this.createNewLayout();
    }

    async handleDeleteLayout(id) {
        if (!confirm('Are you sure you want to delete this layout and all its drawings?')) return;
        try {
            await deleteLayout(id);
            this.currentLayouts = this.currentLayouts.filter(l => l.id !== id);
            this.renderLayoutManager();
        } catch (e) {
            alert('Failed to delete layout');
        }
    }

    async createNewLayout() {
        if (!window.chart?.currentStockId) return;
        const name = prompt('Enter layout name:', `Setup ${this.currentLayouts.length + 1}`);
        if (!name) return;

        try {
            // Check for unsaved changes before creating new layout
            if (window.chart && (window.chart.isLayoutDirty || (window.chart.pendingActions && window.chart.pendingActions.size > 0))) {
                const save = confirm('You have unsaved changes. Save before creating a new layout?');
                if (save) {
                    await window.chart.syncWithDatabase();
                    await saveCurrentLayout();
                }
            }

            const chartState = window.chart.getChartState();
            const newLayout = await saveLayout({
                name,
                lastTicker: window.chart.symbol,
                lastExchange: window.chart.exchange,
                chartState,
                userId: "1"
            });
            this.currentLayouts.push(newLayout);
            this.switchLayout(newLayout);
        } catch (e) {
            alert('Failed to create layout');
        }
    }

    async switchLayout(layout) {
        if (!window.chart) return;

        // Check for unsaved changes before switching
        if (window.chart.isLayoutDirty || (window.chart.pendingActions && window.chart.pendingActions.size > 0)) {
            const save = confirm('You have unsaved changes. Save before switching layouts?');
            if (save) {
                await window.chart.syncWithDatabase();
                await saveCurrentLayout();
            }
        }

        // Set the active layout ID for Chartify
        window.chart.currentLayoutId = layout.id;

        // Emit layout change for top bar UI
        window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: layout.name } }));

        // Re-load stock data with this specific layout
        if (typeof loadStockData === 'function') {
            await loadStockData(layout.id);
        }

        this.toggleLayoutManager(); // Close popup
    }

    async loadOnChart(ticker) {
        const searchInput = document.getElementById('stock-search');
        if (!searchInput) return;
        try {
            if (typeof window.searchStock === 'function') {
                const response = await window.searchStock(ticker);
                const results = response.data;
                if (results && results.length > 0) {
                    const stock = results[0];
                    searchInput.dataset.stockId = stock.id;
                    searchInput.value = stock.ticker;
                    if (typeof window.loadStockData === 'function') {
                        await window.loadStockData();
                    }
                }
            }
        } catch (e) {
            console.error("Error loading for watchlist:", e);
        }
    }

    async updateSeasonals(symbol, market = 'crypto') {
        const now = Date.now();
        const isNewSymbol = symbol !== this.currentSeasonalSymbol;
        const isTimeForUpdate = now - this.lastSeasonalUpdateTime > 300000; // 5 min throttle

        if (!isNewSymbol && !isTimeForUpdate && this.seasonalData) {
            // Even if we don't fetch, we might need to re-render if the view was just opened
            this.renderSeasonalsChart(this.seasonalData, this.seasonalColors);
            return;
        }

        this.currentSeasonalSymbol = symbol;
        this.lastSeasonalUpdateTime = now;

        const svg = document.getElementById('seasonals-svg');
        if (!svg) return;

        // Show loading only if we don't have old data to show
        if (!this.seasonalData || isNewSymbol) {
            svg.innerHTML = '<text x="200" y="75" text-anchor="middle" fill="#787b86" font-size="12">Loading Seasonals...</text>';
        }

        try {
            const currentYear = new Date().getUTCFullYear();
            const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
            const colors = { [currentYear]: '#2962ff', [currentYear - 1]: '#089981', [currentYear - 2]: '#f7931a', [currentYear - 3]: '#f23645' };

            const results = {};
            const apiBase = 'http://localhost:5000/api/v1';
            const marketParam = market === 'stock' ? 'stocks' : market;
            const activeExch = window.chart?.exchange || '';

            // Fetch bulk data for the last 4 years in one request (approx 1500 days)
            const res = await fetch(`${apiBase}/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&market=${marketParam}&limit=1500&exchange=${activeExch}`);
            const responseData = await res.json();
            const candles = responseData.candles || [];

            if (Array.isArray(candles) && candles.length > 0) {
                for (const year of years) {
                    const currentYearIdx = candles.findIndex(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (currentYearIdx === -1) continue;

                    const yearCandles = candles.slice(currentYearIdx).filter(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (yearCandles.length < 2) continue;

                    // Anchor 0% to the close of the PREVIOUS year's last candle if available
                    let firstPrice;
                    if (currentYearIdx > 0) {
                        firstPrice = candles[currentYearIdx - 1].close;
                    } else {
                        firstPrice = yearCandles[0].open || yearCandles[0].close;
                    }

                    const rawResults = yearCandles.map(c => {
                        const d = new Date(c.timestamp);
                        const monthOffsets = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
                        const doy = monthOffsets[d.getUTCMonth()] + d.getUTCDate();
                        return { day: doy, percentage: ((c.close - firstPrice) / firstPrice) * 100, regular: c.close - firstPrice };
                    });

                    // Pad missing days (Interpolation) for 100% daily resolution
                    const seasonalResults = [];
                    const hasPrevYear = currentYearIdx > 0;
                    const startDay = hasPrevYear ? 0 : rawResults[0].day;
                    const endDay = rawResults[rawResults.length - 1].day;

                    let lastVal = hasPrevYear ? { percentage: 0, regular: 0 } : { percentage: rawResults[0].percentage, regular: rawResults[0].regular };

                    if (hasPrevYear) {
                        seasonalResults.push({ day: 0, percentage: 0, regular: 0 });
                    } else {
                        // Start exactly where the data starts
                        seasonalResults.push({ day: startDay, percentage: lastVal.percentage, regular: lastVal.regular });
                    }

                    const dayMap = {};
                    rawResults.forEach(r => dayMap[r.day] = r);

                    for (let d = startDay + 1; d <= endDay; d++) {
                        if (dayMap[d]) {
                            lastVal = { percentage: dayMap[d].percentage, regular: dayMap[d].regular };
                        }
                        seasonalResults.push({ day: d, percentage: lastVal.percentage, regular: lastVal.regular });
                    }

                    results[year] = seasonalResults;
                    if (year === currentYear) this.sidebarYearStartPrice = firstPrice;
                }
            }

            this.seasonalData = results;
            this.seasonalMaxDays = {}; // Store max real day per year
            Object.keys(results).forEach(yr => {
                const yrCandles = candles.filter(c => new Date(c.timestamp).getUTCFullYear() == yr);
                if (yrCandles.length > 0) {
                    const d = new Date(yrCandles[yrCandles.length - 1].timestamp);
                    const monthOffsets = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
                    const maxD = monthOffsets[d.getUTCMonth()] + d.getUTCDate();
                    this.seasonalMaxDays[yr] = maxD;
                }
            });

            this.seasonalColors = colors;
            this.renderSeasonalsChart(results, colors);
            this.setupSeasonalsHover();

            // Final fallback: if no data was rendered, clear the loading message
            if (Object.keys(results).length === 0 && svg && svg.innerHTML.includes('Loading')) {
                svg.innerHTML = '<text x="200" y="75" text-anchor="middle" fill="#787b86" font-size="12">No data available for seasonals</text>';
            }
        } catch (e) {
            console.error("Error updating seasonals:", e);
            if (svg && svg.innerHTML.includes('Loading')) {
                svg.innerHTML = '<text x="200" y="75" text-anchor="middle" fill="#787b86" font-size="12">Error loading seasonals</text>';
            }
        }
    }

    renderSeasonalsChart(results, colors) {
        const svg = document.getElementById('seasonals-svg');
        if (!svg) return;

        // Use dynamic dimensions to prevent stretching (lonjong)
        const width = svg.clientWidth || 400;
        const height = svg.clientHeight || 150;
        const padding = 20;
        const paddingBottom = 30; // Perfect balance for 180px container

        // Sync viewBox with actual dimensions
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Filter to latest 3 years by default for sidebar
        const availYearsList = Object.keys(results).map(Number).sort((a, b) => b - a);
        const endY = availYearsList[0];
        const startY = availYearsList[Math.min(2, availYearsList.length - 1)];

        const filteredResults = {};
        availYearsList.forEach(y => {
            if (y >= startY && y <= endY) filteredResults[y] = results[y];
        });

        // Find min/max for Y axis scaling
        let allValues = [];
        Object.values(filteredResults).forEach(arr => {
            allValues = allValues.concat(arr.map(d => d.percentage || 0));
        });
        if (allValues.length === 0) return;

        // Sync viewBox with actual dimensions
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const maxVal = Math.max(...allValues, 10);
        const minVal = Math.min(...allValues, -10);
        const range = maxVal - minVal;
        this._lastSidebarSeasonalMin = minVal;
        this._lastSidebarSeasonalRange = range;

        const getY = (val) => height - paddingBottom - (((val - minVal) / (range || 1)) * (height - padding - paddingBottom));
        const getX = (index) => padding + (index / 366) * (width - 2 * padding);

        if (!results || !colors) return;

        const currentYear = new Date().getUTCFullYear();
        let bgContent = '';
        const zeroY = getY(0);
        bgContent += `<line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" class="seasonal-zero-line" />`;

        // Specific months: Feb, May, Aug, Nov (Normalized 366-day scale)
        const labels = [
            { d: 31, n: 'Feb' },
            { d: 121, n: 'May' },
            { d: 213, n: 'Aug' },
            { d: 305, n: 'Nov' }
        ];

        labels.forEach(q => {
            const x = getX(q.d);
            bgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height - paddingBottom}" class="seasonal-grid" />`;
            bgContent += `<text x="${x}" y="${height - 5}" fill="#787b86" font-size="10" font-weight="500" text-anchor="middle">${q.n}</text>`;
        });
        svg.innerHTML = bgContent;

        // Draw Paths
        Object.keys(filteredResults).sort().forEach(year => {
            const data = filteredResults[year];
            if (data.length < 2) return;

            let pathD = `M ${getX(data[0].day)} ${getY(data[0].percentage || 0)}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${getX(data[i].day)} ${getY(data[i].percentage || 0)}`;
            }

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathD);
            path.setAttribute("class", "seasonal-path");
            path.setAttribute("stroke", colors[year]);

            if (year == currentYear) {
                path.setAttribute("stroke-width", "1.5");
                const lastIdx = data.length - 1;
                const lx = getX(data[lastIdx].day);
                const ly = getY(data[lastIdx].percentage || 0);

                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", lx);
                dot.setAttribute("cy", ly);
                dot.setAttribute("r", "3");
                dot.setAttribute("class", "live-pulse-dot");
                dot.setAttribute("fill", colors[year]);
                svg.appendChild(dot);

                const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ring.setAttribute("cx", lx);
                ring.setAttribute("cy", ly);
                ring.setAttribute("r", "4");
                ring.setAttribute("class", "live-pulse-ring");
                ring.setAttribute("stroke", colors[year]);
                svg.appendChild(ring);
                path.setAttribute("opacity", "1");
            } else {
                path.setAttribute("opacity", "0.8");
            }
            svg.appendChild(path);
        });

        // Restore hover if active
        if (this.sidebarHoverDay !== null) {
            this.refreshSeasonalHover(true); // isSidebar = true
        }
    }

    setupSeasonalsHover() {
        const svg = document.getElementById('seasonals-svg');
        const tooltip = document.getElementById('seasonal-tooltip');
        if (!svg || !tooltip || !this.seasonalData) return;

        tooltip.style.pointerEvents = 'none';

        if (this.isSeasonalsHoverSetup) return; // Only setup once
        this.isSeasonalsHoverSetup = true;

        const width = 400;
        const height = 150;
        const padding = 10;

        const onMouseMove = (e) => {
            const rect = svg.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;

            // Calculate day (0-366)
            let day = Math.round(((relX - padding) / (width - 2 * padding)) * 366);
            day = Math.max(0, Math.min(366, day));

            this.sidebarHoverDay = day;
            this.sidebarHoverPos = { clientX: e.clientX, clientY: e.clientY };
            this.refreshSeasonalHover(true);
        };

        const onMouseLeave = () => {
            this.sidebarHoverDay = null;
            this.sidebarHoverPos = null;
            tooltip.style.display = 'none';
            const hoverLine = svg.querySelector('.seasonal-hover-line');
            if (hoverLine) hoverLine.remove();
            svg.querySelectorAll('.seasonal-sidebar-hover-dot').forEach(d => d.remove());
        };

        svg.addEventListener('mousemove', onMouseMove);
        svg.addEventListener('mouseleave', onMouseLeave);
    }

    async openSeasonalsView() {
        const container = document.getElementById('seasonals-view-container');
        const detailSymbol = document.getElementById('detail-symbol');
        if (!container || !detailSymbol) return;

        const symbol = detailSymbol.textContent;
        const market = this.currentMarket || 'crypto';
        container.style.display = 'flex';

        // Hide chart legend and trading panel if they exist
        if (window.chart) {
            if (window.chart.legendOverlay) window.chart.legendOverlay.style.display = 'none';
            if (window.chart.tradingPanel) window.chart.tradingPanel.style.display = 'none';
        }

        // Update header
        const title = document.getElementById('seasonals-view-title');
        const logo = document.getElementById('seasonals-view-logo');
        const fullName = document.getElementById('detail-full-name');
        if (title && fullName) title.textContent = fullName.textContent;

        if (logo) {
            const baseSymbol = extractSymbol(symbol);
            const assetType = this.currentMarket || 'crypto';
            const logoUrl = getTickerLogo(baseSymbol, assetType);
            logo.innerHTML = `
                <img src="${logoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
                <div class="icon-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${symbol.charAt(0)}</div>
            `;
        }

        // Hide left toolbar
        const sideToolbar = document.querySelector('.side-toolbar');
        if (sideToolbar) sideToolbar.style.display = 'none';

        // Reset chart hover states to prevent bleedthrough (Phase 1.7)
        if (window.chart) {
            window.chart.hoveringBoundaryIdx = -1;
            window.chart.hoverX = null;
            window.chart.hoverY = null;
            window.chart.canvas.style.cursor = 'default';
            window.chart.render();
        }

        // Clear and show loading
        const svg = document.getElementById('seasonals-full-svg');
        const labelCol = document.getElementById('seasonals-full-labels');
        if (svg) {
            const w = svg.clientWidth || 1000;
            const h = svg.clientHeight || 500;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            svg.innerHTML = `<text x="${w / 2}" y="${h / 2}" fill="#787b86" text-anchor="middle" dominant-baseline="middle" font-size="16px">Loading historical data...</text>`;
        }
        if (labelCol) labelCol.innerHTML = '';

        try {
            const apiBase = 'http://localhost:5000/api/v1';
            const marketParam = market === 'stock' ? 'stocks' : market;
            const activeExch = window.chart?.exchange || '';
            const symbolKey = symbol.toUpperCase();

            // Reset or Reuse cached candles
            if (this.currentSeasonalSymbol !== symbolKey) {
                this.seasonalCandles = [];
                this.earliestSeasonalTs = null;
                this.currentSeasonalSymbol = symbolKey;
                this.currentStartYear = null;
                this.currentEndYear = null;
            }

            if (this.seasonalCandles.length === 0) {
                // INITIAL LOAD: Fetch last 1100 candles (approx 3 years)
                const currentEndTs = Date.now();
                const res = await fetch(`${apiBase}/market/history?symbol=${symbolKey}&timeframe=1d&endDateTs=${currentEndTs}&market=${marketParam}&limit=1100&exchange=${activeExch}`);
                const responseData = await res.json();
                const candles = (responseData && responseData.candles) || [];
                const meta = (responseData && responseData.meta) || {};

                if (Array.isArray(candles) && candles.length > 0) {
                    this.seasonalCandles = [...candles];
                    this.seasonalCandles.sort((a, b) => a.timestamp - b.timestamp);
                    this.earliestSeasonalTs = this.seasonalCandles[0].timestamp;
                }

                // Set PRECISION bounds from backend metadata
                const listingYear = (meta && meta.listingYear && meta.listingYear > 0) ? meta.listingYear : 2017;
                this.minAllowedYear = listingYear;
            }

            if (this.seasonalCandles.length === 0) {
                if (svg) svg.innerHTML = `<text x="${svg.clientWidth / 2}" y="${svg.clientHeight / 2}" fill="#787b86" text-anchor="middle">No historical data available</text>`;
                return;
            }

            // Group candles by year for processing
            this.fullSeasonalsResults = this.processSeasonalData(this.seasonalCandles);

            const currentYear = new Date().getUTCFullYear();
            this.currentEndYear = currentYear;

            // Default view to 3 years, but don't go before listing year
            this.currentStartYear = Math.max(currentYear - 2, this.minAllowedYear);

            // Slider Range: Locked strictly to the exchange's history
            this.seasonalSliderMax = currentYear;
            this.seasonalSliderMin = this.minAllowedYear;

            this.initFullSeasonals();
            this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
        } catch (e) {
            console.error("Error opening seasonals view:", e);
        }
    }

    getSeasonalDayIndex(date, year) {
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        const offsets = isLeap
            ? [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
            : [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

        let doy = offsets[date.getUTCMonth()] + date.getUTCDate();
        // If non-leap, shift days after Feb 28 forward by 1 to align with leap-year 366 scale
        if (!isLeap && doy >= 60) doy++;
        return doy;
    }

    processSeasonalData(allCandles) {
        if (!allCandles || allCandles.length === 0) return {};

        const results = {};
        const palette = ['#2962ff', '#089981', '#f7931a', '#f23645', '#bb86fc', '#ffeb3b', '#00bcd4', '#e91e63', '#4caf50', '#ff9800'];
        const currentYear = new Date().getUTCFullYear();

        // Ensure sorted Earliest to Latest
        const sorted = [...allCandles].sort((a, b) => a.timestamp - b.timestamp);

        // Group by year - Reverse sort so the CURRENT year is first (Index 0 = Blue)
        const yearsFound = [...new Set(sorted.map(k => new Date(k.timestamp).getUTCFullYear()))].sort((a, b) => b - a);

        yearsFound.forEach((y, i) => {
            const yearIdx = sorted.findIndex(k => new Date(k.timestamp).getUTCFullYear() == y);
            const yearData = sorted.filter(k => new Date(k.timestamp).getUTCFullYear() == y);
            if (yearData.length < 2) return;

            // Anchor 0% to the close of the PREVIOUS year's last candle if available
            let firstPrice;
            if (yearIdx > 0) {
                firstPrice = sorted[yearIdx - 1].close;
            } else {
                firstPrice = yearData[0].open || yearData[0].close;
            }

            const rawData = yearData.map(k => {
                const d = new Date(k.timestamp);
                const doy = this.getSeasonalDayIndex(d, y);
                return { day: doy, percentage: ((k.close - firstPrice) / firstPrice) * 100, regular: k.close };
            });

            const seasonalData = [];
            const hasPrevYear = yearIdx > 0;
            const startDay = hasPrevYear ? 0 : rawData[0].day;
            const endDay = rawData[rawData.length - 1].day;

            let lastPoint = hasPrevYear ? { percentage: 0, regular: 0 } : { percentage: rawData[0].percentage, regular: rawData[0].regular };
            if (hasPrevYear) {
                seasonalData.push({ day: 0, percentage: 0, regular: firstPrice });
            } else {
                seasonalData.push({ day: startDay, percentage: lastPoint.percentage, regular: lastPoint.regular + firstPrice });
            }

            const fullDayMap = {};
            rawData.forEach(r => fullDayMap[r.day] = r);

            for (let d = startDay + 1; d <= endDay; d++) {
                if (fullDayMap[d]) {
                    lastPoint = { percentage: fullDayMap[d].percentage, regular: fullDayMap[d].regular - firstPrice };
                }
                seasonalData.push({ day: d, percentage: lastPoint.percentage, regular: lastPoint.regular + firstPrice });
            }

            results[y] = {
                data: seasonalData,
                maxDay: Math.max(...seasonalData.map(r => r.day)),
                color: palette[i % palette.length]
            };
            if (y === currentYear) {
                this.fullYearStartPrice = firstPrice;
                this.sidebarYearStartPrice = firstPrice; // Keep both synced
            }
        });

        return results;
    }

    async loadMoreSeasonalHistory() {
        if (this.isFetchingMoreSeasonals || !this.earliestSeasonalTs) return;

        // Don't fetch past 1970
        if (new Date(this.earliestSeasonalTs).getUTCFullYear() <= this.minAllowedYear) return;

        this.isFetchingMoreSeasonals = true;
        const symbol = this.currentSeasonalSymbol;
        const exchange = window.chart?.exchange || '';
        const market = this.currentMarket || 'crypto';
        const marketParam = market === 'stock' ? 'stocks' : market;
        const apiBase = 'http://localhost:5000/api/v1';

        // Set absolute floor
        const absoluteFloor = (market === 'stock') ? 1970 : 2010;

        // Show loading indicator on chart
        const svg = document.getElementById('seasonals-full-svg');
        let loadingText;
        if (svg) {
            loadingText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            loadingText.setAttribute("x", "20");
            loadingText.setAttribute("y", "30");
            loadingText.setAttribute("fill", "#2962ff");
            loadingText.setAttribute("font-size", "12px");
            loadingText.textContent = "Loading more history...";
            svg.appendChild(loadingText);
        }

        try {
            const nextEndTs = this.earliestSeasonalTs - 1;
            const res = await fetch(`${apiBase}/market/history?symbol=${symbol}&timeframe=1d&endDateTs=${nextEndTs}&market=${marketParam}&limit=1500&exchange=${exchange}`);
            const responseData = await res.json();
            const candles = responseData.candles || [];

            if (Array.isArray(candles) && candles.length > 0) {
                // Merge and Re-sort
                const combined = [...candles, ...this.seasonalCandles];
                combined.sort((a, b) => a.timestamp - b.timestamp);
                this.seasonalCandles = combined;
                this.earliestSeasonalTs = this.seasonalCandles[0].timestamp;

                // Re-process all data
                this.fullSeasonalsResults = this.processSeasonalData(this.seasonalCandles);

                // Update slider min to the earliest year we found, 
                // but don't let it jump to 1970 unless we actually HAVE data there.
                const availYears = Object.keys(this.fullSeasonalsResults).map(Number).sort((a, b) => a - b);
                if (availYears.length > 0) {
                    const oldestYearFound = availYears[0];
                    // Expand the slider floor as we load more data
                    this.seasonalSliderMin = Math.min(this.seasonalSliderMin, oldestYearFound);
                }

                // Re-render
                this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
                const tableWrapper = document.getElementById('seasonals-full-table');
                if (tableWrapper && tableWrapper.style.display === 'block') {
                    this.renderSeasonalTable(this.fullSeasonalsResults);
                }
            }
        } catch (e) {
            console.error("Error loading more seasonal history:", e);
        } finally {
            if (loadingText && loadingText.parentNode) loadingText.parentNode.removeChild(loadingText);
            this.isFetchingMoreSeasonals = false;
        }
    }

    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    calculateSeasonalAverage(filteredResults, valProp) {
        if (!this.showSeasonalAverage) return [];
        const years = Object.keys(filteredResults);
        if (years.length === 0) return [];

        const numYears = years.length;
        const averageData = [];

        const yearMaps = {};
        let maxOverallDay = 0;
        years.forEach(y => {
            const data = filteredResults[y].data;
            if (!data || data.length === 0) return;
            const map = {};
            data.forEach(p => map[p.day] = p);

            const startDay = data[0].day;
            const endDay = data[data.length - 1].day;
            if (endDay > maxOverallDay) maxOverallDay = endDay;

            yearMaps[y] = { map, startDay, endDay, lastVal: data[data.length - 1] };
        });

        // FIXED-DENOMINATOR CURVE AVERAGING
        // For every day up to the maximum available day, sum the specific day's value across ALL years.
        for (let d = 0; d <= maxOverallDay; d++) {
            let sum = 0;
            years.forEach(y => {
                const info = yearMaps[y];
                if (!info) return;

                let val = 0; // Default 0 before the asset existed in that year
                if (d >= info.startDay && d <= info.endDay) {
                    const point = info.map[d];
                    if (point) {
                        val = (point[valProp] !== undefined) ? point[valProp] : (point.val || 0);
                    } else if (d > info.startDay) {
                        // Fallback in case of tiny internal gaps
                        let prev = d - 1;
                        while (prev >= info.startDay && !info.map[prev]) prev--;
                        const prevPoint = info.map[prev] || info.lastVal;
                        val = (prevPoint[valProp] !== undefined) ? prevPoint[valProp] : (prevPoint.val || 0);
                    }
                } else if (d > info.endDay) {
                    const point = info.lastVal;
                    val = (point[valProp] !== undefined) ? point[valProp] : (point.val || 0);
                }

                sum += val;
            });
            averageData.push({ day: d, percentage: sum / numYears, regular: sum / numYears, val: sum / numYears }); // populate all common props safely
        }
        return averageData;
    }

    getMonthBoundaries(year) {
        if (this.isLeapYear(year)) {
            return [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
        }
        return [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    }

    renderFullSeasonalsChart(results, startYear, endYear, overrideWidth, overrideHeight) {
        const svg = document.getElementById('seasonals-full-svg');
        const labelCol = document.getElementById('seasonals-full-labels');
        if (!svg || !labelCol || !results) return;

        // Use override dimensions if provided (for Export) or client dimensions (for UI)
        const width = overrideWidth || svg.clientWidth || 1000;
        const height = overrideHeight || svg.clientHeight || 600;
        const paddingLeft = 50;
        const paddingTop = 20;
        const paddingBottom = 60; // Tighter bottom for professional look 

        // Sync viewBox with actual dimensions
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        svg.innerHTML = ''; // Clear

        const rawStart = startYear || this.currentStartYear;
        const rawEnd = endYear || this.currentEndYear;
        const sYear = Math.min(rawStart, rawEnd);
        const eYear = Math.max(rawStart, rawEnd);

        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';

        // Filter results by year range
        const filteredResults = {};
        const yearsFound = [];
        Object.keys(results).forEach(year => {
            const y = parseInt(year);
            if (y >= sYear && y <= eYear) {
                filteredResults[year] = results[year];
                yearsFound.push(y);
            }
        });

        // Save for export metadata
        this.selectedYears = yearsFound.sort((a, b) => a - b);

        // Calculate Average if enabled (ACCUMULATE DAILY RETURNS TO PREVENT SPIKES)
        this.fullSeasonalsAverage = this.calculateSeasonalAverage(filteredResults, valProp);
        let averageData = this.fullSeasonalsAverage;


        let allValuesRaw = [];
        Object.values(filteredResults).forEach(obj => {
            allValuesRaw = allValuesRaw.concat(obj.data.map(d => {
                const v = d[valProp];
                return (v !== undefined) ? v : (d.val || 0);
            }));
        });
        if (averageData.length > 0) {
            allValuesRaw = allValuesRaw.concat(averageData.map(d => d.val));
        }

        // SAFETY: Filter out non-numeric values
        const allValues = allValuesRaw.filter(v => typeof v === 'number' && !isNaN(v));
        if (allValues.length === 0) {
            svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" fill="#787b86" text-anchor="middle" font-size="14">No data for selected range (${sYear}-${eYear})</text>`;
            return;
        }

        const dataMax = Math.max(...allValues);
        const dataMin = Math.min(...allValues);
        const dataRange = dataMax - dataMin;

        // Calculate Nice Interval
        const interval = this.getNiceInterval(dataRange);
        const roundedMin = Math.floor(dataMin / interval) * interval;
        const roundedMax = Math.ceil(dataMax / interval) * interval;
        const range = roundedMax - roundedMin;
        this._lastFullSeasonalsMin = roundedMin;
        this._lastFullSeasonalsMax = roundedMax;
        this._lastFullSeasonalsRange = range;

        const getY = (val) => {
            const y = height - paddingBottom - (((val - roundedMin) / (range || 1)) * (height - paddingTop - paddingBottom));
            return isNaN(y) ? 0 : y;
        };
        const formatVal = (v) => {
            if (v === undefined || v === null || isNaN(v)) return '0.00';
            // User requested: No '+' for positive values
            return isPercent ? `${v.toFixed(2)}%` : `${v.toFixed(2)}`;
        };

        // 0. Dynamic Ruler Width Calculation (Now includes Year Tags for perfect fit)
        const longestLabelCharCount = Object.keys(filteredResults).reduce((max, year) => {
            const val = filteredResults[year].data[filteredResults[year].data.length - 1][valProp];
            const labelStr = `${year} (${formatVal(val)})`; // "2024 (121.3%)"
            return Math.max(max, labelStr.length);
        }, 0);

        // Also check ruler scale labels (e.g. "-120.0%")
        const scaleMaxChar = Math.max(formatVal(roundedMin).length, formatVal(roundedMax).length);
        const finalCharCount = Math.max(longestLabelCharCount, scaleMaxChar);

        // Dynamic padding with a safe multiplier for different font widths
        const paddingRight = Math.max(70, (finalCharCount * 7.5) + 20);

        // Save for hover logic synchronization
        this._lastFullSeasonalsPaddingRight = paddingRight;
        this._lastFullSeasonalsPaddingBottom = paddingBottom;
        this._lastFullSeasonalsPaddingLeft = paddingLeft;
        this._lastFullSeasonalsPaddingTop = paddingTop;
        this._lastFullSeasonalsMin = roundedMin;
        this._lastFullSeasonalsRange = range;

        const getX = (index) => {
            const day = Math.min(366, Math.max(0, index));
            return paddingLeft + (day / 366) * (width - paddingLeft - paddingRight);
        };

        let bgContent = '';
        // Zero Line (Only show if range covers zero - mostly for percentage mode)
        const zeroY = getY(0);
        if (roundedMin <= 0 && roundedMax >= 0) {
            // Zero Line (Subtle: 0.8 width, 4 4 dash)
            bgContent += `<line x1="0" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="#434651" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.8" />`;
        }

        // Accurate Monthly Grid & Labels (Normalized 366-day scale)
        const monthStarts = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        monthStarts.forEach((day, i) => {
            const x = getX(day);
            // Grid line
            bgContent += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${height - paddingBottom}" stroke="#2a2e39" stroke-width="1" />`;
            // Label (Centered) - User requested white text
            bgContent += `<text x="${x}" y="${height - paddingBottom + 20}" fill="#ffffff" font-size="11" font-weight="500" text-anchor="middle">${monthNames[i]}</text>`;
        });

        // End line
        bgContent += `<line x1="${width - paddingRight}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#2a2e39" stroke-width="1" />`;

        // Percentage Labels on the Right Inside SVG (Professional Ruler at the edge)
        for (let lvl = roundedMin; lvl <= roundedMax; lvl += interval) {
            const y = getY(lvl);
            // Draw Ruler Labels (White and slightly offset from the line ends for clarity)
            // Add Tick Label (Ruler Scale) - User requested: Add a small gap between text and chart edge
            // Increased +5 to +12 for a better professional gap in live UI
            bgContent += `<text x="${width - paddingRight + 12}" y="${y + 4}" fill="#ffffff" font-size="10" font-weight="600" text-anchor="start" opacity="0.9">${formatVal(lvl)}</text>`;
            // Horizontal grid lines stop at the chart area boundary
            bgContent += `<line x1="0" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#2a2e39" stroke-width="0.5" opacity="0.3" />`;
        }
        svg.innerHTML = bgContent; // Set background once

        // Paths and Labels Batching (Performance Fix)
        let chartContent = bgContent;
        const tagFragment = document.createDocumentFragment();
        const currentYear = new Date().getUTCFullYear();
        const sortedYears = Object.keys(filteredResults).sort((a, b) => a - b);

        sortedYears.forEach(year => {
            const { data, color, maxDay } = filteredResults[year];
            if (data.length < 2) return;

            // 1. Build Path String
            let pathD = `M ${getX(data[0].day)} ${getY(data[0][valProp])}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${getX(data[i].day)} ${getY(data[i][valProp])}`;
            }

            const isCurr = year == currentYear;
            const strokeWidth = isCurr ? "1.5" : "1.2";
            const opacity = isCurr ? "1" : "0.9";

            chartContent += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" class="seasonal-path" />`;

            // 2. Build HTML Year Tag (Fragment)
            const lastPoint = data[data.length - 1];
            const lastVal = lastPoint[valProp];
            const tag = document.createElement('div');
            tag.className = 'year-tag';
            tag.style.background = color;
            tag.style.color = this.getContrastColor(color);
            tag.innerHTML = `
                <span class="year-num">${year}</span>
                <span class="year-pct">${formatVal(lastVal)}</span>
            `;
            const yPerc = (getY(lastVal) / height) * 100;
            tag.style.position = 'absolute';
            tag.style.top = `${yPerc}%`;
            const xPerc = ((width - paddingRight) / width) * 100;
            tag.style.left = `${xPerc}%`;
            tag.style.right = 'auto';
            tag.style.transform = 'translateY(-50%)';
            tagFragment.appendChild(tag);

            // 3. Universal Connectors & Pulse Positioning
            // For the Pulse Dot (Current Year), stop at the actual data end (maxDay)
            // For the Connector/Tag, stay at the right edge (Day 366 for consistent alignment)
            const actualLastPoint = isCurr ? (data.find(p => p.day === maxDay) || lastPoint) : lastPoint;
            const lx = getX(actualLastPoint.day);
            const ly = getY(isPercent ? (actualLastPoint[valProp] !== undefined ? actualLastPoint[valProp] : actualLastPoint.val) : actualLastPoint.regular);
            const connectorX2 = width - paddingRight - 10; // 10px safety gap before ruler

            // Draw a subtle dashed connector for EVERY year to ensure alignment (WIDTH: 0.8 for subtlety)
            chartContent += `<line x1="${lx}" y1="${ly}" x2="${connectorX2}" y2="${ly}" stroke="${color}" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.6" />`;

            // Current Year Extras (Pulse dots)
            if (isCurr) {
                chartContent += `
                    <circle cx="${lx}" cy="${ly}" r="4" class="live-pulse-dot" fill="${color}" />
                    <circle cx="${lx}" cy="${ly}" r="5" class="live-pulse-ring" stroke="${color}" />
                `;
            }
        });

        // 5. Finally, render Average Line if enabled (Batch to contentHtml)
        if (this.showSeasonalAverage && averageData.length > 1) {
            let avgPathD = `M ${getX(averageData[0].day)} ${getY(averageData[0].val)}`;
            for (let i = 1; i < averageData.length; i++) {
                avgPathD += ` L ${getX(averageData[i].day)} ${getY(averageData[i].val)}`;
            }

            // Add Avg Path to SVG string (Live UI: 2.0)
            chartContent += `<path d="${avgPathD}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4" opacity="0.8" class="seasonal-average-path" />`;

            // Add Avg Tag to Fragment
            const lastAvg = averageData[averageData.length - 1];
            const tag = document.createElement('div');
            tag.className = 'year-tag average-tag';
            tag.style.background = '#ffffff';
            tag.style.color = '#000000';
            tag.innerHTML = `
                <span class="year-num" style="color:#000000">Avg</span>
                <span class="year-pct" style="color:#000000">${formatVal(lastAvg.val)}</span>
            `;
            const yPerc = (getY(lastAvg.val) / height) * 100;
            tag.style.position = 'absolute';
            tag.style.top = `${yPerc}%`;
            const xPerc = ((width - paddingRight) / width) * 100;
            tag.style.left = `${xPerc}%`;
            tag.style.transform = 'translateY(-50%)';
            tagFragment.appendChild(tag);
        }

        // 6. Push final results to DOM (The only two DOM writes for the whole render)
        svg.innerHTML = chartContent;
        labelCol.innerHTML = '';
        labelCol.appendChild(tagFragment);

        // Synchronize Table View if active
        const tableWrapper = document.getElementById('seasonals-full-table');
        if (tableWrapper && tableWrapper.style.display === 'flex') {
            this.renderSeasonalTable(this.fullSeasonalsResults);
        }

        // Restore hover if active
        if (this.fullHoverDay !== null) {
            this.refreshSeasonalHover(false); // isSidebar = false
        }
    }

    refreshSeasonalHover(isSidebar) {
        const svg = document.getElementById(isSidebar ? 'seasonals-svg' : 'seasonals-full-svg');
        const tooltip = document.getElementById(isSidebar ? 'seasonal-tooltip' : 'seasonals-full-tooltip');
        const day = isSidebar ? this.sidebarHoverDay : this.fullHoverDay;
        const pos = isSidebar ? this.sidebarHoverPos : this.fullHoverPos;
        const results = isSidebar ? this.seasonalData : this.fullSeasonalsResults;
        const colors = isSidebar ? this.seasonalColors : this.fullSeasonalsResults; // Note: Sidebar uses a separate color map, Full uses object property

        if (!svg || !tooltip || !results || day === null || !pos) return;

        const rect = svg.getBoundingClientRect();
        // Use dynamic dimensions to match the render exactly
        const width = svg.clientWidth || (isSidebar ? 400 : 1000);
        const height = svg.clientHeight || (isSidebar ? 150 : 600);

        const pLeft = isSidebar ? 20 : (this._lastFullSeasonalsPaddingLeft || 50);
        const pRight = isSidebar ? 20 : (this._lastFullSeasonalsPaddingRight || 100);
        const pTop = isSidebar ? 20 : (this._lastFullSeasonalsPaddingTop || 20);
        const pBot = isSidebar ? 30 : (this._lastFullSeasonalsPaddingBottom || 150);

        const getX = (d) => {
            const day = Math.min(366, Math.max(0, d));
            return pLeft + (day / 366) * (width - pLeft - pRight);
        };
        const getY = (val) => {
            const min = this._lastFullSeasonalsMin || 0;
            const range = this._lastFullSeasonalsRange || 1;
            const y = height - pBot - (((val - min) / range) * (height - pTop - pBot));
            return isNaN(y) ? 0 : y;
        };
        // Handle Leap Year specific tooltip display (using 2024 as reference)
        const dateObj = new Date(2024, 0, day || 1);
        const dateStr = day === 0 ? "1 Jan (Base)" : dateObj.toLocaleString('en-GB', { day: 'numeric', month: 'short' });
        let tooltipHtml = `<div style="font-weight:700;margin-bottom:${isSidebar ? '4px' : '6px'};border-bottom:1px solid #363c4e;padding-bottom:${isSidebar ? '4px' : '6px'}">${dateStr}</div>`;
        let hasData = false;

        const valProp = isSidebar ? 'percentage' : (this.seasonalViewMode || 'percentage');
        const isPercent = valProp === 'percentage';

        let years = Object.keys(results).sort((a, b) => b - a);
        if (isSidebar) {
            // Sidebar chart only shows latest 3 years, hover must match
            years = years.slice(0, 3);
        } else {
            const minYear = Math.min(this.currentStartYear, this.currentEndYear);
            const maxYear = Math.max(this.currentStartYear, this.currentEndYear);
            years = years.filter(year => {
                const yNum = parseInt(year);
                return yNum >= minYear && yNum <= maxYear;
            });
        }

        years.forEach(year => {

            const data = isSidebar ? results[year] : results[year].data;
            const color = isSidebar ? this.seasonalColors[year] : results[year].color;

            const point = data.find(p => p.day === day) || [...data].reverse().find(p => p.day <= day);

            if (point && point.day === day) {
                const val = (point[valProp] !== undefined) ? point[valProp] : (point.val || 0);
                tooltipHtml += `
                    <div class="tooltip-row" style="margin: ${isSidebar ? '0' : '4px 0'}">
                        <span style="color:${color};font-weight:700">${year}</span>
                        <span class="${val >= 0 ? 'change-up' : 'change-down'}">${isPercent ? val.toFixed(2) + '%' : val.toFixed(2)}</span>
                    </div>
                `;
                hasData = true;
            }
        });

        // Clear old average dot if it exists from previous frame
        const oldAvgDot = svg.querySelector('.seasonal-avg-dot');
        if (oldAvgDot) oldAvgDot.remove();

        // Average for Full View - SYNCED WITH CORRECT ARITHMETIC LOGIC
        if (!isSidebar && this.showSeasonalAverage && this.fullSeasonalsAverage) {
            const avgPt = this.fullSeasonalsAverage.find(p => p.day === day) || [...this.fullSeasonalsAverage].reverse().find(p => p.day <= day);
            if (avgPt) {
                const avgVal = avgPt.val;

                // Add Hover Dot for Average
                const ax = getX(day);
                const ay = getY(avgVal);
                tooltipHtml += `
                    <div class="tooltip-row" style="margin: 4px 0; border-top: 1px solid #363c4e; padding-top: 4px">
                        <span style="color:#ffffff;font-weight:700">Average</span>
                        <span class="${avgVal >= 0 ? 'change-up' : 'change-down'}">${isPercent ? avgVal.toFixed(2) + '%' : avgVal.toFixed(2)}</span>
                    </div>
                `;

                // Draw Average Line Dot (Unified size r=4)
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", ax);
                circle.setAttribute("cy", ay);
                circle.setAttribute("r", "4");
                circle.setAttribute("fill", "#ffffff");
                circle.setAttribute("stroke", "#131722");
                circle.setAttribute("stroke-width", "1");
                circle.setAttribute("class", "seasonal-avg-dot");
                circle.setAttribute("style", "pointer-events: none");
                svg.appendChild(circle);

                hasData = true;
            }
        }

        if (hasData) {
            tooltip.innerHTML = tooltipHtml;
            tooltip.style.display = 'block';
            tooltip.style.pointerEvents = 'none';

            const tRect = tooltip.getBoundingClientRect();
            let tx = pos.clientX - rect.left + (isSidebar ? 15 : 20);
            let ty = pos.clientY - rect.top + (isSidebar ? 15 : 20);

            if (tx + tRect.width > rect.width) tx -= (tRect.width + (isSidebar ? 30 : 40));
            if (!isSidebar && ty + tRect.height > rect.height) ty -= (tRect.height + 40);

            tooltip.style.left = `${tx}px`;
            tooltip.style.top = `${ty}px`;
        } else {
            tooltip.style.display = 'none';
        }

        // Line
        const className = isSidebar ? 'seasonal-hover-line' : 'seasonal-full-hover-line';
        let hoverLine = svg.querySelector('.' + className);
        if (!hoverLine) {
            hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hoverLine.setAttribute("class", className);
            if (!isSidebar) {
                hoverLine.setAttribute("stroke", "#787b86");
                hoverLine.setAttribute("stroke-width", "1");
                hoverLine.setAttribute("stroke-dasharray", "4 4");
            }
            hoverLine.style.pointerEvents = 'none';
            svg.appendChild(hoverLine);
        }
        // X calculation horizontal mapping
        const lx = isSidebar
            ? pLeft + (day / 366) * (width - 2 * pLeft)
            : pLeft + (day / 366) * (width - pLeft - pRight);

        hoverLine.setAttribute("x1", lx);
        hoverLine.setAttribute("y1", isSidebar ? 0 : pTop);
        hoverLine.setAttribute("x2", lx);
        hoverLine.setAttribute("y2", isSidebar ? height : (height - pBot));

        // Dots
        const dotClass = isSidebar ? 'seasonal-sidebar-hover-dot' : 'seasonal-hover-dot';
        svg.querySelectorAll('.' + dotClass).forEach(d => d.remove());

        const getYLocal = (val) => {
            const rMin = isSidebar ? this._lastSidebarSeasonalMin : this._lastFullSeasonalsMin;
            const rRange = isSidebar ? this._lastSidebarSeasonalRange : this._lastFullSeasonalsRange;
            const y = height - pBot - (((val - (rMin || 0)) / (rRange || 1)) * (height - pTop - pBot));
            return isNaN(y) ? 0 : y;
        };

        years.forEach(year => {
            if (!isSidebar) {
                const yNum = parseInt(year);
                if (yNum < Math.min(this.currentStartYear, this.currentEndYear) || yNum > Math.max(this.currentStartYear, this.currentEndYear)) return;
            }
            const data = isSidebar ? results[year] : results[year].data;
            const color = isSidebar ? this.seasonalColors[year] : results[year].color;

            // Ensure maxDay is at least 366 for past years to avoid clipping normalized Dec 31
            const yrNum = parseInt(year);
            const currentYr = new Date().getUTCFullYear();
            const maxD = yrNum < currentYr ? 366 : (isSidebar ? (this.seasonalMaxDays ? this.seasonalMaxDays[year] : 366) : results[year].maxDay);

            if (day > maxD) return;

            const pt = data.find(p => p.day === day) || [...data].reverse().find(p => p.day <= day);
            if (pt) {
                const val = (pt[valProp] !== undefined) ? pt[valProp] : (pt.val || 0);
                const dy = getYLocal(val);
                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("class", dotClass);
                dot.setAttribute("cx", lx);
                dot.setAttribute("cy", dy);
                dot.setAttribute("r", isSidebar ? "5" : "6.5");
                dot.setAttribute("fill", color);
                dot.setAttribute("stroke", "#131722");
                dot.setAttribute("stroke-width", "1.5");
                dot.setAttribute("pointer-events", "none");
                svg.appendChild(dot);
            }
        });
    }

    getNiceInterval(range) {
        if (range <= 0) return 1;
        const targetNodes = 7;
        const rawInterval = range / targetNodes;
        const mag = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const res = rawInterval / mag;
        let interval;
        if (res < 1.5) interval = 1;
        else if (res < 3) interval = 2;
        else if (res < 7) interval = 5;
        else interval = 10;
        return interval * mag;
    }

    initTableToggles() {
        const btnChart = document.getElementById('seasonals-btn-chart');
        const btnTable = document.getElementById('seasonals-btn-table');
        const chartWrapper = document.getElementById('seasonals-full-chart');
        const tableWrapper = document.getElementById('seasonals-full-table');
        const csvBtn = document.getElementById('btn-export-csv');

        if (!btnChart || !btnTable || !chartWrapper || !tableWrapper) return;

        const syncExportMenu = () => {
            if (csvBtn) {
                csvBtn.style.display = (tableWrapper.style.display === 'block') ? 'flex' : 'none';
            }
        };

        btnChart.onclick = () => {
            btnChart.classList.add('active');
            btnTable.classList.remove('active');
            chartWrapper.style.display = 'block';
            tableWrapper.style.display = 'none';
            syncExportMenu();
        };

        btnTable.onclick = () => {
            btnTable.classList.add('active');
            btnChart.classList.remove('active');
            chartWrapper.style.display = 'none';
            tableWrapper.style.display = 'block';
            syncExportMenu();
            this.renderSeasonalTable(this.fullSeasonalsResults);
        };

        // Initial sync
        syncExportMenu();
    }

    renderSeasonalTable(results) {
        const tableContainer = document.getElementById('seasonals-full-table');
        if (!tableContainer || !results) return;

        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';

        const startYear = Math.min(this.currentStartYear, this.currentEndYear);
        const endYear = Math.max(this.currentStartYear, this.currentEndYear);

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        let tableHtml = `<table class="seasonal-table"><thead><tr><th style="position: sticky; left: 0; z-index: 5;">Date</th>`;
        months.forEach(m => tableHtml += `<th>${m}</th>`);
        tableHtml += `<th style="border-left: 1px solid #363c4e; color: #2962ff">Total</th></tr></thead><tbody>`;

        const yearPerformance = {};
        const years = Object.keys(results).map(Number).filter(y => y >= startYear && y <= endYear).sort((a, b) => b - a);

        years.forEach(year => {
            const data = results[year].data;
            yearPerformance[year] = { months: [] };
            // Since data is already mapped to a 366-day grid (Feb 29 always at 60), 
            // we MUST use the unified leap-year boundaries for all table lookups.
            const mBounds = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];

            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m];
                const endDay = (m === 11) ? 366 : mBounds[m + 1];

                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];

                let perf;
                if (isPercent) {
                    const startVal = (m === 0) ? 0 : (startPt.percentage || 0);
                    const endVal = endPt.percentage || 0;
                    // RELATIVE ROI: The true percentage return of the month
                    perf = ((1 + endVal / 100) / (1 + startVal / 100) - 1) * 100;
                } else {
                    const startVal = startPt.regular;
                    perf = endPt.regular - startVal;
                }

                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                yearPerformance[year].months[m] = perf;
            }

            const lastPt = data[data.length - 1];
            yearPerformance[year].total = isPercent ? lastPt.percentage : (lastPt.regular - data[0].regular);
        });

        years.forEach(year => {
            tableHtml += `<tr><td style="position: sticky; left: 0; z-index: 4;">${year}</td>`;
            for (let m = 0; m < 12; m++) {
                tableHtml += this.formatTableCell(yearPerformance[year].months[m], isPercent);
            }
            tableHtml += this.formatTableCell(yearPerformance[year].total, isPercent, true);
            tableHtml += `</tr>`;
        });

        // Average Row (Conditional) - RECALCULATED FROM YEAR DATA FOR PERFECT CONSISTENCY
        if (this.showSeasonalAverage) {
            tableHtml += `<tr class="footer-row"><td style="position: sticky; left: 0; z-index: 4;">Average</td>`;
            for (let m = 0; m < 12; m++) {
                let sum = 0, count = 0;
                years.forEach(y => {
                    const val = yearPerformance[y].months[m];
                    if (val !== null && !isNaN(val)) {
                        sum += val;
                        count++;
                    }
                });
                const avg = sum / years.length;
                tableHtml += this.formatTableCell(avg, isPercent);
            }
            // Total Average (Arithmetic average of all selected years)
            let totalSum = 0;
            years.forEach(y => {
                const val = yearPerformance[y].total;
                totalSum += (val !== null && !isNaN(val)) ? val : 0;
            });
            const finalAvg = totalSum / years.length;
            tableHtml += this.formatTableCell(finalAvg, isPercent, true);
            tableHtml += `</tr>`;
        }

        // Rises & Falls Row
        tableHtml += `<tr class="footer-row"><td style="position: sticky; left: 0; z-index: 4;">Rises and falls</td>`;
        for (let m = 0; m < 12; m++) {
            let up = 0, down = 0;
            years.forEach(y => {
                const data = results[y].data;
                const mBounds = this.getMonthBoundaries(y);
                const startDay = mBounds[m];
                const endDay = (m === 11) ? 366 : mBounds[m + 1];
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];

                let perf;
                if (isPercent) {
                    const startVal = (m === 0) ? 0 : (startPt.percentage || 0);
                    const endVal = endPt.percentage || 0;
                    perf = ((1 + endVal / 100) / (1 + startVal / 100) - 1) * 100;
                } else {
                    const startVal = (m === 0) ? 0 : startPt.regular;
                    perf = endPt.regular - startVal;
                }

                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                if (perf !== null && !isNaN(perf)) { if (perf > 0) up++; else if (perf < 0) down++; }
            });
            tableHtml += `<td><div class="rise-fall-text"><span class="rise-text">▲${up}</span> <span class="fall-text">▼${down}</span></div></td>`;
        }

        // Year Column Rise/Fall
        let yUp = 0, yDown = 0;
        years.forEach(y => {
            const t = yearPerformance[y].total;
            if (t > 0) yUp++; else if (t < 0) yDown++;
        });
        tableHtml += `<td class="year-column"><div class="rise-fall-text"><span class="rise-text">▲${yUp}</span> <span class="fall-text">▼${yDown}</span></div></td></tr></tbody></table>`;

        tableContainer.innerHTML = tableHtml;
    }

    formatTableCell(val, isPercent, isYear = false) {
        if (val === null || isNaN(val)) return `<td>—</td>`;
        const cls = val > 0 ? 'cell-up' : (val < 0 ? 'cell-down' : 'cell-neutral');
        const sign = val > 0 ? '+' : (val < 0 ? '-' : '');
        const suffix = isPercent ? '%' : '';
        const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const monthCellClass = 'month-cell seasonal-cell';
        return `<td class="${monthCellClass} ${cls}${isYear ? ' year-column' : ''}" style="color: #ffffff">${sign}${formatted}${suffix}</td>`;
    }

    initFullSeasonals() {
        this.initTableToggles();
        const track = document.getElementById('year-slider-track');
        const thumbStart = document.getElementById('year-thumb-start');
        const thumbEnd = document.getElementById('year-thumb-end');
        const fill = document.getElementById('year-slider-fill');
        const labelStart = document.getElementById('year-range-start-label');
        const labelEnd = document.getElementById('year-range-end-label');
        const svg = document.getElementById('seasonals-full-svg');

        if (!track || !thumbStart || !thumbEnd || !svg) return;

        const sliderMin = this.seasonalSliderMin;
        const sliderMax = this.seasonalSliderMax;

        // Dynamically update Year Labels on the track
        const labelsContainer = document.querySelector('.slider-years-labels');
        if (labelsContainer) {
            labelsContainer.innerHTML = '';
            // Generate labels for Min, Max, and a few in between
            const labelCount = Math.min(5, (sliderMax - sliderMin) + 1);
            for (let i = 0; i < labelCount; i++) {
                const year = labelCount > 1
                    ? Math.round(sliderMin + (i * (sliderMax - sliderMin) / (labelCount - 1)))
                    : sliderMin;
                const span = document.createElement('span');
                span.textContent = year;
                labelsContainer.appendChild(span);
            }
        }

        const updateUI = () => {
            if (!this.currentStartYear || !this.currentEndYear) return;
            const currentMin = this.seasonalSliderMin;
            const currentMax = this.seasonalSliderMax;
            const total = (currentMax - currentMin) || 1;

            const startYear = Math.min(this.currentStartYear, this.currentEndYear);
            const endYear = Math.max(this.currentEndYear, this.currentEndYear);

            const sPerc = ((this.currentStartYear - currentMin) / total) * 100;
            const ePerc = ((this.currentEndYear - currentMin) / total) * 100;

            thumbStart.style.left = `${sPerc}%`;
            thumbEnd.style.left = `${ePerc}%`;

            const fillLeft = Math.min(sPerc, ePerc);
            const fillWidth = Math.abs(ePerc - sPerc);
            fill.style.left = `${fillLeft}%`;
            fill.style.width = `${fillWidth}%`;

            labelStart.textContent = startYear;
            labelEnd.textContent = endYear;

            this.renderFullSeasonalsChart(this.fullSeasonalsResults, startYear, endYear);

            // Refresh Table View if active (Phase 1.7)
            const tableWrapper = document.getElementById('seasonals-full-table');
            if (tableWrapper && tableWrapper.style.display === 'block') {
                this.renderSeasonalTable(this.fullSeasonalsResults);
            }
        };

        // Initial UI Sync (runs every time)
        updateUI();

        if (this.fullSeasonalsInitialized) return;

        const handleDrag = (e, isStart) => {
            const rect = track.getBoundingClientRect();
            let perc = (e.clientX - rect.left) / rect.width;
            perc = Math.max(0, Math.min(1, perc));

            const currentMin = this.seasonalSliderMin;
            const currentMax = this.seasonalSliderMax;
            const total = (currentMax - currentMin) || 1;
            const year = Math.round(currentMin + perc * total);

            if (isStart) {
                this.currentStartYear = year;

                // LAZY LOADING: If sliding back into unloaded history
                const earliestLoadedYear = this.earliestSeasonalTs ? new Date(this.earliestSeasonalTs).getUTCFullYear() : this.currentStartYear;
                if (year <= earliestLoadedYear && year > this.minAllowedYear) {
                    this.loadMoreSeasonalHistory();
                }
            } else {
                this.currentEndYear = year;
            }

            updateUI();
        };

        const onMouseDown = (isStart) => {
            // Bring active thumb to front
            thumbStart.style.zIndex = isStart ? "10" : "5";
            thumbEnd.style.zIndex = isStart ? "5" : "10";

            const onMouseMove = (e) => handleDrag(e, isStart);
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        thumbStart.onmousedown = () => onMouseDown(true);
        thumbEnd.onmousedown = () => onMouseDown(false);

        // Average Button Toggle
        const averageBtn = document.getElementById('seasonals-average-btn');
        if (averageBtn) {
            averageBtn.classList.toggle('active', this.showSeasonalAverage);
            averageBtn.onclick = () => {
                this.showSeasonalAverage = !this.showSeasonalAverage;
                averageBtn.classList.toggle('active', this.showSeasonalAverage);
                updateUI();
            };
        }

        // Export (Camera) Dropdown Toggle
        const exportBtn = document.getElementById('seasonals-export-btn');
        const exportMenu = document.getElementById('seasonals-export-menu');
        if (exportBtn && exportMenu) {
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                exportMenu.classList.toggle('show');
            };

            document.addEventListener('click', () => {
                exportMenu.classList.remove('show');
            });

            document.getElementById('btn-export-download').onclick = () => this.exportSeasonalAsImage('download');
            document.getElementById('btn-export-copy').onclick = () => this.exportSeasonalAsImage('copy');
            const btnCsv = document.getElementById('btn-export-csv');
            if (btnCsv) btnCsv.onclick = () => this.exportSeasonalToCSV();
        }

        // Mode Dropdown Toggle (Percent vs Regular)
        const modeDropdown = document.getElementById('seasonals-mode-dropdown');
        const modeText = document.getElementById('seasonals-mode-text');
        if (modeDropdown && modeText) {
            modeText.textContent = this.seasonalViewMode === 'percentage' ? 'Percent' : 'Regular';
            modeDropdown.onclick = () => {
                this.seasonalViewMode = this.seasonalViewMode === 'percentage' ? 'regular' : 'percentage';
                modeText.textContent = this.seasonalViewMode === 'percentage' ? 'Percent' : 'Regular';
                updateUI();
            };
        }

        // Initial UI Sync
        updateUI();

        const tooltip = document.getElementById('seasonals-full-tooltip');
        const container = document.getElementById('seasonals-full-chart');

        if (this.isFullSeasonalsHoverSetup) return;
        this.isFullSeasonalsHoverSetup = true;

        if (tooltip) tooltip.style.pointerEvents = 'none';

        // Smooth resize handling (Settled-only)
        // Transition is handled smoothly by CSS (width: 100%)
        // High-quality render is triggered in toggleSidebar after settle

        svg.addEventListener('mousemove', (e) => {
            if (!this.fullSeasonalsResults) return;
            const rect = svg.getBoundingClientRect();
            // Use real pixel width and dynamic padding (matched to render)
            const pLeft = 50;
            const pRight = 100;
            const curWidth = rect.width;

            const relX = (e.clientX - rect.left);

            // Map relX to day (0-366) respecting padding
            const usableWidth = curWidth - pLeft - pRight;
            let day = Math.round(((relX - pLeft) / usableWidth) * 366);
            day = Math.max(0, Math.min(366, day));

            this.fullHoverDay = day;
            this.fullHoverPos = { clientX: e.clientX, clientY: e.clientY };
            this.refreshSeasonalHover(false);
        });

        svg.addEventListener('mouseleave', () => {
            this.fullHoverDay = null;
            this.fullHoverPos = null;
            if (tooltip) tooltip.style.display = 'none';
            const hLine = svg.querySelector('.seasonal-full-hover-line');
            if (hLine) hLine.remove();
            svg.querySelectorAll('.seasonal-hover-dot').forEach(d => d.remove());
        });

        this.fullSeasonalsInitialized = true;
    }

    setupFullSeasonalsHover(results) {
        // Obsolete - moved to initFullSeasonals
    }

    getContrastColor(hex) {
        if (!hex) return '#ffffff';
        // Clean the hex string
        const color = hex.replace('#', '');
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);

        // Calculate YIQ brightness (Industry standard formula)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        // If brightness is > 150 (light color), use dark text, else white
        return (yiq >= 150) ? '#131722' : '#ffffff';
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    }

    closeSeasonalsView() {
        const container = document.getElementById('seasonals-view-container');
        if (container) container.style.display = 'none';

        // Show left toolbar
        const sideToolbar = document.querySelector('.side-toolbar');
        if (sideToolbar) sideToolbar.style.display = 'flex';

        // Restore chart legend and trading panel
        if (window.chart) {
            if (window.chart.legendOverlay) window.chart.legendOverlay.style.display = 'flex';
            if (window.chart.tradingPanel) window.chart.tradingPanel.style.display = 'flex';
        }
    }

    setupResizeLogic() {
        if (!this.resizeHandle) return;
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing || !this.sidebar) return;

            const sidebarRect = this.sidebar.getBoundingClientRect();
            const relativeY = e.clientY - sidebarRect.top;
            const panelHeight = sidebarRect.height - relativeY;

            // Min height for panels
            if (panelHeight > 100 && panelHeight < sidebarRect.height - 150) {
                if (this.detailPanel) this.detailPanel.style.height = `${panelHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.cursor = 'default';
                // Trigger chart resize if needed with layoutOnly: true to prevent price range jumps
                if (window.chart) window.chart.resize(null, null, true, true);
            }
        });
    }

    setupResponsiveLogic() {
        const mql = window.matchMedia('(max-width: 1024px)');
        const handleMediaChange = (e) => {
            if (e.matches && !this.isCollapsed) {
                this.toggleSidebar();
            }
        };
        mql.addEventListener('change', handleMediaChange);
        // Initial check
        if (mql.matches && !this.isCollapsed) {
            this.toggleSidebar();
        }
    }

    toggleSidebar() {
        if (!this.sidebar) return;

        // Toggle the state and class
        this.isCollapsed = !this.isCollapsed;
        this.sidebar.classList.toggle('collapsed', this.isCollapsed);
        this.syncTabsWithSidebar();

        // If chart exists, it will automatically resize via ResizeObserver in Chartify.js
        // because its container (#chart-container) changes width due to CSS transition.
        // We just keep a small timeout to ensure the final layout is captured perfectly.
        if (window.chart) {
            const seasonalFull = document.getElementById('seasonals-view-container');
            const fullSvg = document.getElementById('seasonals-full-svg');
            if (fullSvg && seasonalFull && seasonalFull.style.display !== 'none') {
                fullSvg.setAttribute('preserveAspectRatio', 'none');
            }

            setTimeout(() => {
                if (window.chart) window.chart.resize(null, null, true, true);

                // Also trigger full seasonal chart re-render if it's active
                const seasonalFull = document.getElementById('seasonals-view-container');
                if (seasonalFull && seasonalFull.style.display !== 'none' && this.fullSeasonalsResults) {
                    this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
                }
            }, 350); // 300ms transition + buffer
        }
    }

    syncTabsWithSidebar() {
        if (this.isCollapsed) {
            // Deactivate all tabs when collapsed
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.sidebar-view').forEach(view => view.classList.remove('active'));
        } else {
            // If opening and no tab is active, activate default (Watchlist)
            const activeTab = document.querySelector('.tab-btn.active');
            if (!activeTab) {
                const defaultTabId = 'watchlist-view';
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-tab') === defaultTabId);
                });
                document.querySelectorAll('.sidebar-view').forEach(view => {
                    view.classList.toggle('active', view.id === defaultTabId);
                });
            }
        }
    }

    async exportSeasonalAsImage(mode) {
        // Detect current active view
        const chartView = document.getElementById('seasonals-full-chart');
        const tableView = document.getElementById('seasonals-full-table');

        // Use computed style or display check
        if (chartView && chartView.style.display === 'none') {
            return this.exportSeasonalTableAsImage(mode);
        }

        const container = chartView;
        const svg = document.getElementById('seasonals-full-svg');
        const labelsCol = document.getElementById('seasonals-full-labels');
        if (!container || !svg || !labelsCol) {
            console.error("Export failed: Required elements missing", { container, svg, labelsCol });
            alert("Export failed: Required chart elements not found.");
            return;
        }

        // Visual feedback
        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        try {
            // FIX: IMMUTABLE 16:9 ULTRA-HIFI RESOLUTION (2560x1440)
            const targetWidth = 2560; // 1440p / 2K Standard (Highest Quality)
            const targetHeight = 1440;

            // Proportional Scaling Factor (Original was ~1000px, now 2560px)
            const s = targetWidth / 1000;

            // Generate SVG string specifically for this resolution without touching live DOM
            await this.renderFullSeasonalsChart(
                this.fullSeasonalsResults,
                this.currentStartYear,
                this.currentEndYear,
                targetWidth,
                targetHeight
            );

            // Give browser a micro-moment to parse the newly set innerHTML
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Dimensions for canvas (Professional 16:9 frame - SCALED)
            const padding = 25 * s; // Proportional padding
            const headerHeight = 55 * s;
            const bottomPadding = 20 * s;

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 2;
            const ctx = canvas.getContext('2d');

            // 1. Calculate Maximum Label Width for Dynamic Framing
            ctx.font = `bold ${Math.round(11 * s)}px Arial`;
            let maxLabelWidth = 0;
            this.selectedYears.forEach(yearNum => {
                const year = yearNum.toString();
                const yrData = this.fullSeasonalsResults[year];
                if (!yrData) return;
                const lastPoint = yrData.data[yrData.data.length - 1];
                const lastVal = lastPoint[this.seasonalViewMode || 'percentage'];
                const yearPct = lastVal.toFixed(2) + '%';
                const textWidth = ctx.measureText(`${year} (${yearPct})`).width;
                maxLabelWidth = Math.max(maxLabelWidth, textWidth + (12 * s));
            });

            // Adjust canvas width dynamically to wrap perfectly around the longest label
            const pRight = this._lastFullSeasonalsPaddingRight || 80;
            const pTop = this._lastFullSeasonalsPaddingTop || 20;
            const pBot = this._lastFullSeasonalsPaddingBottom || 60;

            // The label starts at relX + padding. relX = targetWidth - pRight - 10.
            // So we want: padding + (targetWidth - pRight - 10) + maxLabelWidth + safetyGap
            const canvasWidth = padding + (targetWidth - pRight - 10) + maxLabelWidth + (15 * s);
            const canvasHeight = targetHeight + headerHeight + (padding * 2) + bottomPadding;

            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset scale after resizing

            // Redraw Overall Background (PURE BLACK as requested)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.fillStyle = '#000000';
            ctx.fillRect(padding, padding + headerHeight, targetWidth, targetHeight);

            const valProp = this.seasonalViewMode || 'percentage';
            const isPercent = valProp === 'percentage';

            // Construct title with exchange info 
            const ticker = document.getElementById('detail-symbol')?.textContent || this.currentTicker || 'BTC/USDT';
            const exchangeName = document.getElementById('detail-exchange')?.textContent || '';
            const title = `${ticker}${exchangeName ? ' • ' + exchangeName : ''}`;

            // Fetch and Load Token Icon - REFINED SYMBOL EXTRACTION
            let logoImg = null;
            try {
                // Strip slashes and suffixes to get clean asset symbol (e.g. BTC/USDT -> BTC)
                let cleanSymbol = ticker.split(/[/\-:_]/)[0].replace('.P', '');
                const logoUrl = getTickerLogo(cleanSymbol, this.currentMarket || 'crypto');

                logoImg = new Image();
                logoImg.crossOrigin = 'anonymous'; // Critical for canvas drawing
                await new Promise((resolve) => {
                    logoImg.onload = resolve;
                    logoImg.onerror = () => { logoImg = null; resolve(); }; // Graceful fallback
                    logoImg.src = logoUrl;
                });
            } catch (err) { logoImg = null; }

            // 1. Draw Styled Logo Box (Left)
            let headerTextX = padding + (10 * s);
            const logoBoxSize = 38 * s;
            const logoPadding = 4 * s;
            const titleY = padding + (24 * s);

            if (logoImg) {
                // Draw white background CIRCLE (border effect)
                ctx.fillStyle = '#ffffff';
                const centerX = headerTextX + (logoBoxSize / 2);
                const centerY = padding + (5 * s) + (logoBoxSize / 2);
                ctx.beginPath();
                ctx.arc(centerX, centerY, logoBoxSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // Draw icon inside
                ctx.drawImage(logoImg, headerTextX + logoPadding, padding + (5 * s) + logoPadding, logoBoxSize - (logoPadding * 2), logoBoxSize - (logoPadding * 2));

                headerTextX += logoBoxSize + (12 * s);
            }

            // 2. Draw Ticker Title (Right of logo)
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(20 * s)}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText(title, headerTextX, titleY);

            // 3. Draw Year Range (Right of logo, below ticker)
            ctx.fillStyle = '#787b86';
            ctx.font = `${Math.round(13 * s)}px Arial`;
            let yearRangeStr = '';
            if (this.selectedYears && this.selectedYears.length > 0) {
                const minYear = Math.min(...this.selectedYears);
                const maxYear = Math.max(...this.selectedYears);
                yearRangeStr = (minYear === maxYear) ? `${minYear}` : `${this.selectedYears.length} Years (${minYear} - ${maxYear})`;
                ctx.fillText(yearRangeStr, headerTextX, titleY + (20 * s));
            }

            // 3. Draw SVG (Drawing SVG BEFORE labels so it acts as background)
            const svgClone = svg.cloneNode(true);

            // Boost line brightness/thickness for 1440p resolution - REFINED
            svgClone.querySelectorAll('.seasonal-path, path, .seasonal-average-path, line').forEach(p => {
                const currentWidth = parseFloat(p.getAttribute('stroke-width')) || 1.2;
                const dash = p.getAttribute('stroke-dasharray');

                if (dash && dash !== 'none') {
                    // DASHED LINES: Keep them elegant. 
                    // Reference guide lines (line tags) get extra thinning to stay subtle.
                    const isRef = p.tagName.toLowerCase() === 'line' || p.getAttribute('stroke') === '#434651';
                    const baseWidth = isRef ? 0.6 : currentWidth;
                    p.setAttribute('stroke-width', baseWidth * s);
                    p.setAttribute('opacity', isRef ? '0.6' : '1.0');
                } else {
                    // SOLID LINES: Apply refined thickness boost for clarity
                    p.setAttribute('stroke-width', (currentWidth + 0.5) * s);
                }
            });

            // Scale Pulse Dot (if exists) and Match Color - BEEFED UP FOR 1440p
            svgClone.querySelectorAll('circle').forEach(c => {
                const r = parseFloat(c.getAttribute('r')) || 0;
                if (r > 0) {
                    // Standard is r=4, we want it significantly larger for 1440p
                    c.setAttribute('r', r * s * 1.5);
                    const sw = parseFloat(c.getAttribute('stroke-width')) || 0;
                    c.setAttribute('stroke-width', (sw || 1) * s * 1.5);

                    // Force 100% visibility for export
                    c.setAttribute('opacity', '1.0');
                }
            });

            // Scale all other line children (connectors, grid, etc.)
            svgClone.querySelectorAll('line').forEach(l => {
                const x1 = l.getAttribute('x1');
                const x2 = l.getAttribute('x2');
                const y1 = l.getAttribute('y1');
                const y2 = l.getAttribute('y2');

                // User requested: No HORIZONTAL grid (y1 === y2)
                // BUT we must keep horizontal DASHED lines (connectors or projections)
                const isDashed = l.getAttribute('stroke-dasharray');
                if (y1 === y2 && x1 !== x2 && !isDashed) {
                    // These are strictly solid horizontal grid lines - remove per request
                    l.remove();
                    return;
                }

                // If it's a connector line (identified by opacity < 1 or stroke-dasharray)
                const dash = l.getAttribute('stroke-dasharray');
                if (dash && dash !== 'none') {
                    // Connectors should also be significantly thicker for 1440p clarity
                    l.setAttribute('stroke-width', (parseFloat(l.getAttribute('stroke-width')) || 0.7) * s * 2.5);
                    const scaledDash = dash.split(/[\s,]+/)
                        .map(v => (v.trim() ? parseFloat(v) * s * 2.5 : 0))
                        .join(' ');
                    l.setAttribute('stroke-dasharray', scaledDash);
                    // Match subtle projection opacity
                    l.setAttribute('opacity', '0.7');
                } else {
                    // This covers the Vertical Grid Lines (X-axis dividers)
                    const str = l.getAttribute('stroke');
                    if (str === '#2a2e39' || str === '#363c4e' || str === '#444b5e') {
                        l.setAttribute('stroke', '#444b5e');
                        l.setAttribute('opacity', '1.0');
                        l.setAttribute('stroke-width', 0.8 * s);
                    }
                }
            });

            // User requested: No hover dots or hover lines in export
            svgClone.querySelectorAll('#seasonal-hover-line, .seasonal-hover-dot').forEach(el => el.remove());

            // Remove all SVG text before drawing to canvas (prevents doubled text)
            svgClone.querySelectorAll('text').forEach(t => t.remove());

            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('width', targetWidth);
            svgClone.setAttribute('height', targetHeight);

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("Failed to load SVG image"));
                img.src = url;
            });

            ctx.drawImage(img, padding, padding + headerHeight, targetWidth, targetHeight);
            URL.revokeObjectURL(url);

            // 4. Draw All Labels (Ticks + Year Tags) - ON TOP
            const containerRect = container.getBoundingClientRect();

            // 4a. Draw Tick Labels (Ruler Scale) - OPTIMIZED SIZE
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(13 * s)}px Arial`;
            ctx.textAlign = 'left';
            // Refined filter: Ticks always have text-anchor="start" in our SVG
            const tickLabels = Array.from(svg.querySelectorAll('text')).filter(t => t.getAttribute('text-anchor') === 'start');
            tickLabels.forEach(txt => {
                const x = parseFloat(txt.getAttribute('x'));
                const y = parseFloat(txt.getAttribute('y'));
                // User requested: Add a small gap between text and chart edge
                ctx.fillText(txt.textContent, x + padding + (10 * s), y + padding + headerHeight);
            });

            // 4b. Draw Month Labels - OPTIMIZED SIZE + TOP PADDING + CENTERED
            ctx.font = `bold ${Math.round(12 * s)}px Arial`;
            ctx.textAlign = 'center'; // User requested: Perfect horizontal center
            const monthLabels = Array.from(svg.querySelectorAll('text')).filter(t => t.getAttribute('text-anchor') === 'middle');
            monthLabels.forEach(txt => {
                const x = parseFloat(txt.getAttribute('x'));
                const y = parseFloat(txt.getAttribute('y'));
                // Add 10px * s extra top padding to separate from chart area
                ctx.fillText(txt.textContent, x + padding, y + padding + headerHeight + (10 * s));
            });

            // 4c. Draw Year Tags - PIXEL PERFECT MATHEMATICAL ALIGNMENT
            const rMin = this._lastFullSeasonalsMin || 0;
            const rRange = this._lastFullSeasonalsRange || 1;

            const getYForVal = (val) => {
                const rangeH = targetHeight - pTop - pBot;
                return (targetHeight - pBot) - (((val - rMin) / (rRange || 1)) * rangeH);
            };

            // Only draw years that were selected/rendered
            this.selectedYears.forEach(yearNum => {
                const year = yearNum.toString();
                const yrData = this.fullSeasonalsResults[year];
                if (!yrData) return;

                const lastPoint = yrData.data[yrData.data.length - 1];
                const lastVal = lastPoint[this.seasonalViewMode || 'percentage'];
                const color = yrData.color;

                const relY = getYForVal(lastVal);
                // Important: Match the 10px gap from renderFullSeasonalsChart 
                // so the label touches the connector exactly.
                const relX = targetWidth - pRight - 10;

                const sign = lastVal > 0 ? '+' : '';
                const formattedVal = isPercent ? sign + lastVal.toFixed(2) + '%' : sign + lastVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const combinedText = `${year} (${formattedVal})`;

                ctx.font = `bold ${Math.round(11 * s)}px Arial`;
                const textWidth = ctx.measureText(combinedText).width;
                const boxWidth = textWidth + (12 * s);
                const boxHeight = 18 * s;

                // Draw background box exactly at the end of the line/connector
                ctx.fillStyle = color;
                // Center the box vertically on relY (-9*s offset for 18*s height)
                const boxY = relY + padding + headerHeight - (9 * s);
                this.drawRoundedRect(ctx, relX + padding, boxY, boxWidth, boxHeight, 4 * s);

                // Helper to determine adaptive text color (Luminance check)
                const getContrastColor = (hex) => {
                    if (!hex || hex === 'transparent') return '#ffffff';
                    let r, g, b;
                    if (hex.startsWith('rgb')) {
                        [r, g, b] = hex.match(/\d+/g).map(Number);
                    } else if (hex.startsWith('#')) {
                        r = parseInt(hex.slice(1, 3), 16);
                        g = parseInt(hex.slice(3, 5), 16);
                        b = parseInt(hex.slice(5, 7), 16);
                    } else return '#ffffff';
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    return luminance > 0.5 ? '#000000' : '#ffffff';
                };

                // Draw text inside the tag
                ctx.fillStyle = getContrastColor(color);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle'; // Perfect vertical centering
                ctx.fillText(combinedText, relX + padding + (6 * s), boxY + (boxHeight / 2) + (1 * s));
                ctx.textBaseline = 'alphabetic'; // Reset
            });

            // 4d. Draw Average Tag if enabled - SYNCED WITH CHART SCALE
            if (this.showSeasonalAverage && this.fullSeasonalsAverage && this.fullSeasonalsAverage.length > 0) {
                const lastAvgPt = this.fullSeasonalsAverage[this.fullSeasonalsAverage.length - 1];
                const lastAvgVal = lastAvgPt.val;
                const sign = lastAvgVal > 0 ? '+' : '';
                const formattedAvgVal = isPercent ? sign + lastAvgVal.toFixed(2) + '%' : sign + lastAvgVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const avgText = `Avg (${formattedAvgVal})`;

                const relY = getYForVal(lastAvgVal);
                const relX = targetWidth - pRight - 10;

                ctx.font = `bold ${Math.round(11 * s)}px Arial`;
                const textWidth = ctx.measureText(avgText).width;
                const boxWidth = textWidth + (12 * s);
                const boxHeight = 18 * s;

                // White box for Average Label
                ctx.fillStyle = '#ffffff';
                const boxY = relY + padding + headerHeight - (9 * s);
                this.drawRoundedRect(ctx, relX + padding, boxY, boxWidth, boxHeight, 4 * s);

                // Black text inside the tag
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(avgText, relX + padding + (6 * s), boxY + (boxHeight / 2) + (1 * s));
                ctx.textBaseline = 'alphabetic';
            }

            // 5. Cleanup (Restore original UI view at current window size)
            await this.renderFullSeasonalsChart();

            // 6. Output Result
            if (mode === 'download') {
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `seasonal_${this.currentTicker || 'chart'}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (mode === 'copy') {
                try {
                    // Modern Promise-based ClipboardItem avoids "NotAllowedError" 
                    // by keeping the "User Activation" context active during generation.
                    const blobPromise = new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
                    const data = [new ClipboardItem({ 'image/png': blobPromise })];
                    await navigator.clipboard.write(data);
                    alert("Image copied to clipboard!");
                } catch (err) {
                    console.error("Clipboard Copy failed:", err);
                    alert("Could not copy image. Try downloading.");
                }
            }
        } catch (err) {
            console.error("Export failed:", err);
            alert("Export failed: " + err.message);
        } finally {
            document.body.style.cursor = originalCursor;
        }
    }

    async exportSeasonalTableAsImage(mode) {
        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';

        try {
            const results = this.fullSeasonalsResults;
            const years = [...(this.selectedYears || [])].sort((a, b) => b - a);
            if (!results || years.length === 0) return;

            const valProp = this.seasonalViewMode || 'percentage';
            const isPercent = valProp === 'percentage';
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthBoundaries = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

            // 1. Calculate Table Data (Pre-calculate for drawing)
            const tableData = [];
            years.forEach(year => {
                const data = results[year].data;
                const mBounds = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
                const row = { year, months: [], total: 0 };
                for (let m = 0; m < 12; m++) {
                    const startDay = mBounds[m];
                    const endDay = (m === 11) ? 366 : mBounds[m + 1];
                    const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                    const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                    let perf = isPercent ? (((1 + endPt.percentage / 100) / (1 + (startPt.percentage || 0) / 100) - 1) * 100) : (endPt.regular - startPt.regular);
                    if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                    row.months.push(perf);
                }
                const firstPt = data[0];
                const lastPt = data[data.length - 1];
                row.total = isPercent ? lastPt.percentage : (lastPt.regular - firstPt.regular);
                row.isComplete = (lastPt.day - firstPt.day) >= 360;
                tableData.push(row);
            });

            // 2. Dimensions and Canvas setup - REBALANCED FOR HIGH-DEFINITION
            const targetTableWidth = 1200; // Optimal width for a 13-column financial table
            const s = targetTableWidth / 900;

            const padding = 25 * s;
            const headerHeight = 70 * s;
            const rowHeight = 40 * s;
            const dateColWidth = 80 * s; // Wider for "Year" column
            const monthColWidth = 80 * s; // Uniform monthly columns
            const yearColWidth = 95 * s; // Slightly wider for Year Total

            const tableWidth = dateColWidth + (monthColWidth * 12) + yearColWidth;
            const rowTotal = tableData.length + 1 + (this.showSeasonalAverage ? 1 : 0) + 1;
            const tableHeight = rowTotal * rowHeight;

            const canvasWidth = tableWidth + padding * 2;
            const canvasHeight = tableHeight + headerHeight + padding + (24 * s);

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 2;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // 3. Draw Background (PURE BLACK)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 4. Draw Premium Branded Header
            const ticker = document.getElementById('detail-symbol')?.textContent || this.currentTicker || 'BTC/USDT';
            const exchangeName = document.getElementById('detail-exchange')?.textContent || '';
            const title = `${ticker}${exchangeName ? ' • ' + exchangeName : ''}`;

            // Fetch and Load Token Icon (Sync with Chart logic)
            let logoImg = null;
            try {
                let cleanSymbol = ticker.split(/[/\-:_]/)[0].replace('.P', '');
                const logoUrl = getTickerLogo(cleanSymbol, this.currentMarket || 'crypto');
                logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                await new Promise((resolve) => {
                    logoImg.onload = resolve;
                    logoImg.onerror = () => { logoImg = null; resolve(); };
                    logoImg.src = logoUrl;
                });
            } catch (err) { logoImg = null; }

            // 4a. Draw Styled Logo Box (Left)
            let headerTextX = padding + (10 * s);
            const logoBoxSize = 38 * s;
            const logoPadding = 4 * s;
            const titleY = padding + (24 * s);

            if (logoImg) {
                ctx.fillStyle = '#ffffff';
                const centerX = headerTextX + (logoBoxSize / 2);
                const centerY = padding + (5 * s) + (logoBoxSize / 2);
                ctx.beginPath();
                ctx.arc(centerX, centerY, logoBoxSize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.drawImage(logoImg, headerTextX + logoPadding, padding + (5 * s) + logoPadding, logoBoxSize - (logoPadding * 2), logoBoxSize - (logoPadding * 2));
                headerTextX += logoBoxSize + (12 * s);
            }

            // 4b. Draw Titles (Right of Logo)
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(20 * s)}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText(title, headerTextX, titleY);

            ctx.fillStyle = '#787b86';
            ctx.font = `${Math.round(13 * s)}px Arial`;
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            const yearRangeStr = minYear === maxYear ? `${minYear}` : `${years.length} Years (${minYear} - ${maxYear})`;
            ctx.fillText(yearRangeStr, headerTextX, titleY + (20 * s));

            // 5. Draw Table Header
            let curY = padding + headerHeight;
            ctx.fillStyle = '#131722';
            ctx.fillRect(padding, curY, tableWidth, rowHeight);

            ctx.fillStyle = '#787b86';
            ctx.font = `bold ${Math.round(13 * s)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText("Year", padding + dateColWidth / 2, curY + (25 * s));
            for (let i = 0; i < 12; i++) {
                ctx.fillText(monthNames[i], padding + dateColWidth + (i * monthColWidth) + monthColWidth / 2, curY + (25 * s));
            }
            ctx.fillText("Total", padding + tableWidth - yearColWidth / 2, curY + (25 * s));
            curY += rowHeight;

            // 6. Draw Table Rows
            ctx.font = `${Math.round(12.5 * s)}px Arial`;
            tableData.forEach(row => {
                // Year label
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(row.year, padding + dateColWidth / 2, curY + (25 * s));

                // Monthly cells
                for (let m = 0; m < 12; m++) {
                    const val = row.months[m];
                    const x = padding + dateColWidth + (m * monthColWidth);
                    const cellColor = val > 0 ? 'rgba(8, 153, 129, 0.45)' : (val < 0 ? 'rgba(242, 54, 69, 0.45)' : 'transparent');
                    if (cellColor !== 'transparent') {
                        ctx.fillStyle = cellColor;
                        ctx.fillRect(x + 1, curY + 1, monthColWidth - 2, rowHeight - 2);
                    }

                    ctx.fillStyle = (val === null || isNaN(val)) ? '#787b86' : (val === 0 ? '#787b86' : '#ffffff');
                    const sign = (val > 0) ? '+' : '';
                    const text = (val === null || isNaN(val)) ? '—' : (isPercent ? sign + val.toFixed(2) + '%' : sign + val.toFixed(2));
                    ctx.fillText(text, x + monthColWidth / 2, curY + (25 * s));
                }

                // Total column
                const t = row.total;
                const tx = padding + tableWidth - yearColWidth;
                const tColor = t > 0 ? 'rgba(8, 153, 129, 0.45)' : (t < 0 ? 'rgba(242, 54, 69, 0.45)' : 'transparent');
                if (tColor !== 'transparent') {
                    ctx.fillStyle = tColor;
                    ctx.fillRect(tx + 1, curY + 1, yearColWidth - 2, rowHeight - 2);
                }
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(13 * s)}px Arial`;
                const sign = (t > 0) ? '+' : '';
                const tText = (isPercent ? sign + t.toFixed(2) + '%' : sign + t.toFixed(2));
                ctx.fillText(tText, tx + yearColWidth / 2, curY + (25 * s));
                ctx.font = `${Math.round(12.5 * s)}px Arial`;

                curY += rowHeight;
            });

            // 7. Draw Footer (AVG + Rise/Fall) - SYNCED WITH CHART LOGIC
            if (this.showSeasonalAverage) {
                ctx.fillStyle = '#131722';
                ctx.fillRect(padding, curY, tableWidth, rowHeight);
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(13 * s)}px Arial`;
                ctx.fillText("Average", padding + dateColWidth / 2, curY + (25 * s));

                // Recalculate Average row arithmetically for perfect consistency with table data
                for (let m = 0; m < 12; m++) {
                    let sum = 0, count = 0;
                    tableData.forEach(r => {
                        const val = r.months[m];
                        if (val !== null && !isNaN(val)) {
                            sum += val;
                            count++;
                        }
                    });
                    const avg = sum / tableData.length;

                    const x = padding + dateColWidth + (m * monthColWidth);
                    const cellColor = avg > 0 ? 'rgba(8, 153, 129, 0.45)' : (avg < 0 ? 'rgba(242, 54, 69, 0.45)' : 'transparent');
                    if (cellColor !== 'transparent') {
                        ctx.fillStyle = cellColor;
                        ctx.fillRect(x + 1, curY + 1, monthColWidth - 2, rowHeight - 2);
                    }

                    const sign = (avg > 0) ? '+' : '';
                    const avgText = isPercent ? sign + avg.toFixed(2) + '%' : sign + avg.toFixed(2);
                    ctx.fillStyle = (avg === 0) ? '#787b86' : '#ffffff';
                    ctx.fillText(avg === 0 ? '—' : avgText, x + monthColWidth / 2, curY + (25 * s));
                }

                // Total Average (Arithmetic)
                let totalSum = 0, totalCount = 0;
                tableData.forEach(r => {
                    const t = r.total;
                    if (t !== null && !isNaN(t)) {
                        totalSum += t;
                        totalCount++;
                    }
                });
                const finalAvg = totalSum / tableData.length;
                const tx = padding + dateColWidth + (12 * monthColWidth);
                const finalColor = finalAvg > 0 ? 'rgba(8, 153, 129, 0.45)' : (finalAvg < 0 ? 'rgba(242, 54, 69, 0.45)' : 'transparent');
                if (finalColor !== 'transparent') {
                    ctx.fillStyle = finalColor;
                    ctx.fillRect(tx + 1, curY + 1, yearColWidth - 2, rowHeight - 2);
                }

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(13 * s)}px Arial`;
                const sign = (finalAvg > 0) ? '+' : '';
                const tText = (isPercent ? sign + finalAvg.toFixed(2) + '%' : sign + finalAvg.toFixed(2));
                ctx.fillText(finalAvg === 0 ? '—' : tText, tx + yearColWidth / 2, curY + (25 * s));

                curY += rowHeight;
            }

            // Rise/Fall Row (SCALED FOR HD)
            ctx.fillStyle = '#131722';
            ctx.fillRect(padding, curY, tableWidth, rowHeight);
            ctx.fillStyle = '#787b86';
            ctx.font = `bold ${Math.round(12 * s)}px Arial`;
            ctx.fillText("Rises/Falls", padding + dateColWidth / 2, curY + (25 * s));
            for (let m = 0; m < 12; m++) {
                let up = 0, down = 0;
                tableData.forEach(r => { if (r.months[m] > 0) up++; else if (r.months[m] < 0) down++; });
                const x = padding + dateColWidth + (m * monthColWidth);
                ctx.fillStyle = '#089981';
                ctx.fillText(`▲${up}`, x + monthColWidth / 2 - (15 * s), curY + (25 * s));
                ctx.fillStyle = '#f23645';
                ctx.fillText(`▼${down}`, x + monthColWidth / 2 + (15 * s), curY + (25 * s));
            }
            // Year total column rise/fall
            let yUp = 0, yDown = 0;
            tableData.forEach(r => { if (r.total > 0) yUp++; else if (r.total < 0) yDown++; });
            const yx = padding + dateColWidth + (12 * monthColWidth);
            ctx.fillStyle = '#089981';
            ctx.fillText(`▲${yUp}`, yx + yearColWidth / 2 - (15 * s), curY + (25 * s));
            ctx.fillStyle = '#f23645';
            ctx.fillText(`▼${yDown}`, yx + yearColWidth / 2 + (15 * s), curY + (25 * s));

            // 8. Output
            if (mode === 'download') {
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `seasonal_table_${ticker.replace('/', '_')}.png`;
                link.href = dataUrl;
                link.click();
            } else {
                canvas.toBlob(async (blob) => {
                    try {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        alert("Table image copied to clipboard!");
                    } catch (err) {
                        alert("Could not copy table image. Try downloading.");
                    }
                }, 'image/png');
            }
        } catch (err) {
            console.error("Table export failed:", err);
            alert("Table export failed: " + err.message);
        } finally {
            document.body.style.cursor = originalCursor;
        }
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    exportSeasonalToCSV() {
        const results = this.fullSeasonalsResults;
        const years = [...(this.selectedYears || [])].sort((a, b) => b - a);
        if (!results || years.length === 0) return;

        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthBoundaries = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

        let csvRows = [];
        const ticker = document.getElementById('detail-symbol')?.textContent || this.currentTicker || 'SYMBOL';
        const exchange = document.getElementById('detail-exchange')?.textContent || '';
        csvRows.push(`Ticker,${ticker}`);
        csvRows.push(`Exchange,${exchange}`);
        csvRows.push(`Exported At,${new Date().toLocaleString()}`);
        csvRows.push("");
        csvRows.push(["Year", ...monthNames, "Total"].join(","));

        years.forEach(year => {
            const data = results[year].data;
            const mBounds = this.getMonthBoundaries(year);
            const rowArr = [year];
            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m];
                const endDay = (m === 11) ? 366 : mBounds[m + 1];
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                let perf = isPercent ? (((1 + endPt.percentage / 100) / (1 + (startPt.percentage || 0) / 100) - 1) * 100) : (endPt.regular - startPt.regular);
                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                rowArr.push(perf === null ? "" : perf.toFixed(2) + (isPercent ? "%" : ""));
            }
            const total = isPercent ? data[data.length - 1].percentage : (data[data.length - 1].regular - data[0].regular);
            rowArr.push(total.toFixed(2) + (isPercent ? "%" : ""));
            csvRows.push(rowArr.join(","));
        });

        if (this.showSeasonalAverage) {
            const avgRow = ["Average"];
            const monthlyAvgs = [];
            for (let m = 0; m < 12; m++) {
                let sum = 0, count = 0;
                years.forEach(y => {
                    const data = results[y].data;
                    const mBounds = this.getMonthBoundaries(y);
                    const startDay = mBounds[m];
                    const endDay = (m === 11) ? 366 : mBounds[m + 1];
                    const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                    const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                    let perf = isPercent ? (((1 + endPt.percentage / 100) / (1 + (startPt.percentage || 0) / 100) - 1) * 100) : (endPt.regular - startPt.regular);
                    if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                    if (perf !== null) { sum += perf; count++; }
                });
                const mAvg = count > 0 ? sum / count : null;
                monthlyAvgs.push(mAvg);
                avgRow.push(mAvg !== null ? mAvg.toFixed(2) + (isPercent ? "%" : "") : "");
            }
            // Total Average (Sum of monthly averages)
            let totalAvg = 0;
            monthlyAvgs.forEach(a => { if (a !== null) totalAvg += a; });
            avgRow.push(totalAvg !== 0 ? totalAvg.toFixed(2) + (isPercent ? "%" : "") : "");
            csvRows.push(avgRow.join(","));

            // Year Rise/Fall Row (Optional addition for CSV consistency)
            let yUp = 0, yDown = 0;
            years.forEach(y => {
                const data = results[y].data;
                const total = isPercent ? data[data.length - 1].percentage : (data[data.length - 1].regular - data[0].regular);
                if (total > 0) yUp++; else if (total < 0) yDown++;
            });
            csvRows.push(`Year Rise/Fall,,,,,,,,,,,,,▲${yUp} ▼${yDown}`);
        }

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `seasonal_${ticker.replace('/', '_')}.csv`;
        link.click();
    }
}
