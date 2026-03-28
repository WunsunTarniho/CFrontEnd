import * as Icons from './icons.js';
import { getLayouts, saveLayout, updateLayout, deleteLayout, touchLayout } from './service.js';
import { candleCache, fetchStockData, loadStockData, saveCurrentLayout } from './data-service.js';
import { DEFAULT_WATCHLIST_SYMBOLS } from './constants.js';

export class SidebarController {
    constructor() {
        this.watchlistData = DEFAULT_WATCHLIST_SYMBOLS.map(s => ({
            symbol: s.ticker, market: s.market, price: '...', change: '...', up: true
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
        this.sidebarYearStartPrice = null;
        this.fullYearStartPrice = null;
        this.performanceBasePrices = {};
        this.lastPerformanceSyncTime = 0;
        this.currentLayouts = [];
        this.activeLayoutId = null;
        this.watchlistPrevClose = {}; // symbol -> prevClose price for correct % calculation

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
            const { symbol, data } = e.detail;
            this.handleTickerUpdate(symbol, data);
        });

        // Listen for when chart loads new data (e.g. via search modal)
        window.addEventListener('chartify:data-loaded', (e) => {
            const chart = e.detail.chart;
            if (chart && chart.symbol) {
                // Pass full info to sync sidebar UI correctly
                this.selectSymbol({
                    symbol: chart.symbol,
                    name: chart.instrument,
                    market: chart.market
                }, null, true);
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
    }

    handleTickerUpdate(symbol, data) {
        // Only update if the symbol matches the currently selected one (strip / for comparison)
        const detailSymbol = document.getElementById('detail-symbol');
        const currentSelected = detailSymbol ? detailSymbol.textContent.replace('/', '') : '';
        const incomingSymbol = symbol.replace('/', '');

        if (detailSymbol && currentSelected === incomingSymbol) {
            const priceEl = document.getElementById('detail-price');
            const changeAbsEl = document.getElementById('detail-change-abs');
            const changePctEl = document.getElementById('detail-change-pct');
            const volumeEl = document.getElementById('detail-volume');

            if (priceEl) {
                // Tick-by-tick coloring
                if (this.lastDetailedPrice !== null && data.price !== this.lastDetailedPrice) {
                    priceEl.className = data.price > this.lastDetailedPrice ? 'change-up' : 'change-down';
                }
                priceEl.textContent = data.price.toLocaleString(undefined, { minimumFractionDigits: 2 });
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
                    changeAbsEl.textContent = `${sign}${diff.toFixed(2)}`;
                    changeAbsEl.className = sessionColorClass;
                }
                if (changePctEl) {
                    changePctEl.textContent = `${sign}${pct.toFixed(2)}%`;
                    changePctEl.className = sessionColorClass;
                }
            } else {
                // Fallback to 24h data if sessionOpen is not yet available
                const colorClass = data.change >= 0 ? 'change-up' : 'change-down';
                if (changeAbsEl) {
                    const sign = data.change >= 0 ? '+' : '';
                    changeAbsEl.textContent = `${sign}${data.change.toFixed(2)}`;
                    changeAbsEl.className = colorClass;
                }
                if (changePctEl) {
                    const sign = data.changePercent >= 0 ? '+' : '';
                    changePctEl.textContent = `${sign}${data.changePercent.toFixed(2)}%`;
                    changePctEl.className = colorClass;
                }
            }

            if (volumeEl) {
                let displayVol = data.volume;
                // Sync with chart daily candle if available to show "Today's Volume" instead of rolling 24h
                if (window.chart && window.chart.rawData && window.chart.rawData.length > 0) {
                    const latest = window.chart.rawData[window.chart.rawData.length - 1];
                    if (window.chart.timeframe === '1d') {
                        displayVol = latest.volume;
                    }
                }
                volumeEl.textContent = this.formatNumber(displayVol);
            }

            // Real-time Seasonals Sync
            const now = Date.now();
            if (now - this.lastSeasonalSyncTime > 1500) {
                const currentYear = new Date().getUTCFullYear();
                let updated = false;

                // 1. Update Sidebar Seasonals
                if (this.seasonalData && this.sidebarYearStartPrice) {
                    const doy = Math.floor((now - new Date(currentYear, 0, 1)) / 86400000);
                    const pct = ((data.price - this.sidebarYearStartPrice) / this.sidebarYearStartPrice) * 100;
                    const points = data.price - this.sidebarYearStartPrice;

                    if (this.seasonalData[currentYear]) {
                        const sData = this.seasonalData[currentYear];
                        if (sData.length > 0) {
                            const lastP = sData[sData.length - 1];
                            const newPoint = { day: doy, percentage: pct, regular: points };
                            if (doy > lastP.day) {
                                sData.push(newPoint);
                            } else {
                                sData[sData.length - 1] = newPoint;
                            }
                            this.renderSeasonalsChart(this.seasonalData, this.seasonalColors);
                            updated = true;
                        }
                    }
                }

                // 2. Update Full Seasonals
                if (this.fullSeasonalsResults && this.fullYearStartPrice) {
                    const doy = Math.floor((now - new Date(currentYear, 0, 1)) / 86400000);
                    const pct = ((data.price - this.fullYearStartPrice) / this.fullYearStartPrice) * 100;
                    const points = data.price - this.fullYearStartPrice; // This is for sidebar if needed

                    if (this.fullSeasonalsResults[currentYear]) {
                        const fData = this.fullSeasonalsResults[currentYear].data;
                        if (fData.length > 0) {
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
        watchlistItems.forEach(item => {
            const itemSymbol = item.querySelector('.symbol-name').textContent.replace('/', '');
            if (itemSymbol === incomingSymbol) {
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

    async fetchInitialWatchlistPrices() {
        const apiBase = 'http://localhost:5000';
        for (const item of this.watchlistData) {
            try {
                // Determine symbol for history fetch (already normalized in constructor)
                const ticker = item.symbol.toUpperCase();
                const marketParam = item.market === 'stock' ? 'stocks' : item.market;
                const res = await fetch(`${apiBase}/api/market/history?symbol=${ticker}&timeframe=1d&market=${marketParam}`);
                const candles = await res.json();

                if (Array.isArray(candles) && candles.length > 0) {
                    const last = candles[candles.length - 1];
                    const prev = candles.length >= 2 ? candles[candles.length - 2] : last;
                    const prevClose = prev.close;       // previous day's close = baseline
                    const close = last.close;
                    const change = close - prevClose;
                    const changePercent = (change / prevClose) * 100;

                    // Store for real-time updates
                    this.watchlistPrevClose[ticker] = prevClose;

                    item.price = close.toLocaleString(undefined, { minimumFractionDigits: 2 });
                    item.change = (change >= 0 ? '+' : '') + changePercent.toFixed(2) + '%';
                    item.up = change >= 0;

                    // Update UI immediately
                    this.updateWatchlistItemUI(item.symbol, close, changePercent);
                }
            } catch (e) {
                console.warn(`[Sidebar] Failed initial fetch for ${item.symbol}:`, e.message);
            }
        }
    }

    async subscribeToRealTime(symbol) {
        // Redirect individual subscriptions to the chart's worker if needed
        if (window.chart && window.chart.wsWorker) {
            window.chart.wsWorker.postMessage({ type: 'subscribe', symbols: [symbol] });
        }
    }

    updateWatchlistItemUI(symbol, price, changePercent) {
        const incomingSymbol = symbol.replace('/', '');
        const watchlistItems = document.querySelectorAll('.watchlist-item');
        watchlistItems.forEach(item => {
            const itemSymbol = item.querySelector('.symbol-name').textContent.replace('/', '');
            if (itemSymbol === incomingSymbol) {
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
        if (num === null || num === undefined) return '0';
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        return Math.floor(num).toLocaleString();
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
            row.innerHTML = `
                <div class="symbol-name">${item.symbol}</div>
                <div class="symbol-price">${item.price}</div>
                <div class="symbol-change ${item.up ? 'change-up' : 'change-down'}">${item.change}</div>
            `;
            row.addEventListener('click', (e) => this.selectSymbol(item, e));
            this.watchlistContainer.appendChild(row);
        });
    }

    async selectSymbol(item, event, skipLoadOnChart = false) {
        const symbol = item.symbol.toUpperCase();
        const name = item.name || item.symbol;
        const market = item.market || 'crypto';
        this.currentMarket = market;

        // Always update Detail Panel UI
        const detailSymbol = document.getElementById('detail-symbol');
        const detailName = document.getElementById('detail-full-name');
        const detailLogo = document.getElementById('detail-logo');

        if (detailSymbol) detailSymbol.textContent = item.symbol;
        if (detailName) detailName.textContent = name;
        if (detailLogo) detailLogo.textContent = item.symbol.charAt(0);

        // Update secondary data
        // Reset seasonal base prices to avoid jumps while loading
        this.sidebarYearStartPrice = null;
        this.fullYearStartPrice = null;
        this.seasonalData = null;
        this.fullSeasonalsResults = null;
        this.performanceBasePrices = null;

        this.updatePerformanceData(symbol, market);
        this.updateSeasonals(symbol, market);

        if (skipLoadOnChart) return;

        const layoutId = window.chart ? window.chart.currentLayoutId : null;
        loadStockData(layoutId, { _id: item.symbol });
    }

    async updatePerformanceData(symbol, market = 'crypto') {
        this.sessionOpenPrice = null; // Reset
        this.performanceBasePrices = {}; // Reset
        const detailAvgVol = document.getElementById('detail-avg-volume');
        if (detailAvgVol) detailAvgVol.textContent = 'loading...';

        const perfs = ['1w', '1m', '3m', '6m', 'ytd', '1y'];
        perfs.forEach(p => {
            const el = document.getElementById(`perf-${p}`);
            if (el) el.textContent = '...';
            const box = document.getElementById(`perf-box-${p}`);
            if (box) box.className = 'perf-box';
        });

        try {
            const apiBase = 'http://localhost:5000';
            const ticker = symbol.toUpperCase();
            const marketParam = market === 'stock' ? 'stocks' : market;

            // Fetch daily history for performance and volume via backend
            const historyRes = await fetch(`${apiBase}/api/market/history?symbol=${ticker}&timeframe=1d&market=${marketParam}`);
            const candles = await historyRes.json();

            if (!Array.isArray(candles) || candles.length === 0) return;

            const currentPrice = candles[candles.length - 1].close;
            // Use previous day's close as the session baseline (industry standard for % change)
            const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : candles[0];
            this.sessionOpenPrice = prevCandle.close;

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
                item.className = `context-menu-item ${layout._id === window.chart?.currentLayoutId ? 'active' : ''}`;
                item.style.cssText = `display: flex; align-items: center; padding: 8px 12px; cursor: pointer; transition: background 0.2s;`;
                item.innerHTML = `
                    <span style="flex: 1; font-size: 13px;">${layout.name}</span>
                    ${layout.isDefault ? '<span style="font-size: 10px; color: #f7931a; background: rgba(247,147,26,0.1); padding: 1px 4px; border-radius: 2px; margin-right: 8px;">DEF</span>' : ''}
                    <div class="layout-actions" style="display: none; align-items: center; gap: 8px;">
                         <button class="delete-layout-btn" data-id="${layout._id}" style="background:none; border:none; color: #f7525f; cursor:pointer; padding: 2px;">&times;</button>
                    </div>
                `;

                item.onmouseenter = () => { item.querySelector('.layout-actions').style.display = 'flex'; };
                item.onmouseleave = () => { item.querySelector('.layout-actions').style.display = 'none'; };

                item.onclick = (e) => {
                    if (e.target.classList.contains('delete-layout-btn')) {
                        e.stopPropagation();
                        this.handleDeleteLayout(layout._id);
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
            this.currentLayouts = this.currentLayouts.filter(l => l._id !== id);
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
            // Auto-save current layout first
            if (window.chart.currentLayoutId) {
                await window.chart.syncWithDatabase();
                await saveCurrentLayout();
            }

            const chartState = window.chart.getChartState();
            const newLayout = await saveLayout({
                name,
                lastSymbol: window.chart.symbol,
                lastTickerId: window.chart.tickerId,
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

        // Save current layout first (sync drawings AND chart state)
        if (window.chart.currentLayoutId) {
            await window.chart.syncWithDatabase();
            await saveCurrentLayout();
        }

        // Set the active layout ID for Chartify
        window.chart.currentLayoutId = layout._id;

        // Emit layout change for top bar UI
        window.dispatchEvent(new CustomEvent('layout-changed', { detail: { name: layout.name } }));

        // Re-load stock data with this specific layout
        if (typeof loadStockData === 'function') {
            await loadStockData(layout._id);
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
                    searchInput.dataset.stockId = stock._id;
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
        const svg = document.getElementById('seasonals-svg');
        if (!svg) return;
        svg.innerHTML = ''; // Clear

        try {
            const currentYear = new Date().getUTCFullYear();
            const years = [currentYear, currentYear - 1, currentYear - 2];
            const colors = { [currentYear]: '#2962ff', [currentYear - 1]: '#089981', [currentYear - 2]: '#f7931a' };

            const results = {};
            const apiBase = 'http://localhost:5000';
            const marketParam = market === 'stock' ? 'stocks' : market;

            // Fetch bulk data for the last 3+ years in one request (approx 1100 days)
            const res = await fetch(`${apiBase}/api/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&market=${marketParam}&limit=1100`);
            const allCandles = await res.json();

            if (Array.isArray(allCandles) && allCandles.length > 0) {
                for (const year of years) {
                    const currentYearIdx = allCandles.findIndex(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (currentYearIdx === -1) continue;

                    const yearCandles = allCandles.slice(currentYearIdx).filter(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (yearCandles.length < 2) continue;

                    // Anchor 0% to the close of the PREVIOUS year's last candle if available
                    let firstPrice;
                    if (currentYearIdx > 0) {
                        firstPrice = allCandles[currentYearIdx - 1].close;
                    } else {
                        firstPrice = yearCandles[0].open || yearCandles[0].close;
                    }

                    let seasonalResults = yearCandles.map(c => {
                        const d = new Date(c.timestamp);
                        const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
                        const doy = Math.floor((c.timestamp - startOfYear) / 86400000);
                        return { 
                            day: doy, 
                            percentage: ((c.close - firstPrice) / firstPrice) * 100,
                            regular: c.close - firstPrice 
                        };
                    });

                    if (seasonalResults.length > 0 && seasonalResults[0].day > 0) {
                        seasonalResults.unshift({ day: 0, percentage: 0, regular: 0 });
                    }

                    results[year] = seasonalResults;
                    if (year === currentYear) this.sidebarYearStartPrice = firstPrice;
                }
            }

            this.seasonalData = results;
            this.seasonalColors = colors;
            this.renderSeasonalsChart(results, colors);
            this.setupSeasonalsHover();
        } catch (e) {
            console.error("Error updating seasonals:", e);
        }
    }

    renderSeasonalsChart(results, colors) {
        const svg = document.getElementById('seasonals-svg');
        if (!svg) return;

        const width = 400;
        const height = 150;
        const padding = 10;

        // Filter to latest 3 years by default for sidebar
        const availYears = Object.keys(results).map(Number).sort((a, b) => b - a);
        const endY = availYears[0];
        const startY = availYears[Math.min(2, availYears.length - 1)];

        const filteredResults = {};
        availYears.forEach(y => {
            if (y >= startY && y <= endY) filteredResults[y] = results[y];
        });

        // Find min/max for Y axis scaling
        let allValues = [];
        Object.values(filteredResults).forEach(arr => {
            allValues = allValues.concat(arr.map(d => d.percentage || 0));
        });
        if (allValues.length === 0) return;

        const maxVal = Math.max(...allValues, 10); // Min 10% range
        const minVal = Math.min(...allValues, -10);
        const range = maxVal - minVal;

        const getY = (val) => height - padding - (((val - minVal) / range) * (height - 2 * padding));
        const getX = (index) => padding + (index / 365) * (width - 2 * padding);

        const currentYear = new Date().getUTCFullYear();
        let bgContent = '';
        // Draw Grid and Zero Line
        const zeroY = getY(0);
        bgContent += `<line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" class="seasonal-zero-line" />`;

        // Vertical grid lines for quarters
        [91, 182, 273].forEach(day => {
            const x = getX(day);
            bgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="seasonal-grid" />`;
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
                // Add pulsing marker at the end for current year
                const lastIdx = data.length - 1;
                const lx = getX(data[lastIdx].day);
                const ly = getY(data[lastIdx].percentage || data[lastIdx].val || 0);

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
            } else {
                path.setAttribute("opacity", "0.7");
            }
            svg.appendChild(path);
        });
    }

    setupSeasonalsHover() {
        const svg = document.getElementById('seasonals-svg');
        const tooltip = document.getElementById('seasonal-tooltip');
        if (!svg || !tooltip || !this.seasonalData) return;
        if (this.isSeasonalsHoverSetup) return; // Only setup once
        this.isSeasonalsHoverSetup = true;

        const width = 400;
        const height = 150;
        const padding = 10;

        const onMouseMove = (e) => {
            const rect = svg.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;

            // Calculate day (0-365)
            let day = Math.round(((relX - padding) / (width - 2 * padding)) * 365);
            day = Math.max(0, Math.min(365, day));

            // Find values for each year
            let tooltipHtml = `<div style="font-weight:700;margin-bottom:4px;border-bottom:1px solid #363c4e;padding-bottom:4px">Day ${day}</div>`;
            let hasData = false;

            Object.keys(this.seasonalData).sort((a, b) => b - a).forEach(year => {
                const yearData = this.seasonalData[year];
                // Find point for this day or the closest preceding point
                const point = yearData.find(pt => pt.day === day) ||
                    [...yearData].reverse().find(pt => pt.day <= day);

                if (point) {
                    const val = point.percentage || 0;
                    const color = this.seasonalColors[year];
                    tooltipHtml += `
                        <div class="tooltip-row">
                            <span style="color:${color};font-weight:700">${year}</span>
                            <span class="${val >= 0 ? 'change-up' : 'change-down'}">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</span>
                        </div>
                    `;
                    hasData = true;
                }
            });

            if (hasData) {
                tooltip.innerHTML = tooltipHtml;
                tooltip.style.display = 'block';

                // Position tooltip
                const tooltipRect = tooltip.getBoundingClientRect();
                let x = e.clientX - rect.left + 15;
                let y = e.clientY - rect.top + 15;

                // Flip if overflow
                if (x + tooltipRect.width > rect.width) x -= (tooltipRect.width + 30);

                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;

                // Draw/Update hover line
                let hoverLine = svg.querySelector('.seasonal-hover-line');
                if (!hoverLine) {
                    hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    hoverLine.setAttribute("class", "seasonal-hover-line");
                    svg.appendChild(hoverLine);
                }
                const lx = padding + (day / 365) * (width - 2 * padding);
                hoverLine.setAttribute("x1", lx);
                hoverLine.setAttribute("y1", 0);
                hoverLine.setAttribute("x2", lx);
                hoverLine.setAttribute("y2", height);
            }
        };

        const onMouseLeave = () => {
            tooltip.style.display = 'none';
            const hoverLine = svg.querySelector('.seasonal-hover-line');
            if (hoverLine) hoverLine.remove();
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

        // Hide chart legend if it exists
        if (window.chart && window.chart.legendOverlay) {
            window.chart.legendOverlay.style.display = 'none';
        }

        // Update header
        const title = document.getElementById('seasonals-view-title');
        const logo = document.getElementById('seasonals-view-logo');
        const fullName = document.getElementById('detail-full-name');
        if (title && fullName) title.textContent = fullName.textContent;
        if (logo) logo.textContent = symbol.charAt(0);

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
        if (svg) svg.innerHTML = '<text x="500" y="225" fill="#787b86" text-anchor="middle" dominant-baseline="middle" font-size="16px">Loading historical data...</text>';
        if (labelCol) labelCol.innerHTML = '';

        try {
            // Reset range to force first-3-years default
            this.currentStartYear = null;
            this.currentEndYear = null;

            const currentYear = new Date().getUTCFullYear();
            const minAllowedYear = 1970; // All history back to Unix Epoch for stocks
            const years = [];
            // We'll populate 'years' dynamically or just loop
            
            const apiBase = 'http://localhost:5000';
            const marketParam = market === 'stock' ? 'stocks' : market;
            const palette = ['#2962ff', '#089981', '#f7931a', '#f23645', '#bb86fc', '#ffeb3b', '#00bcd4', '#e91e63', '#4caf50', '#ff9800'];
            const results = {};
            
            let currentEndTs = Date.now();
            let allCandles = [];
            let iterations = 0;

            // Fetch in bulk chunks of 5000 candles (approx 14 years of daily data)
            // Limit to 10 iterations (approx 140 years of history)
            while (currentEndTs > new Date(minAllowedYear, 0, 1).getTime() && iterations < 10) {
                const res = await fetch(`${apiBase}/api/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&endDateTs=${currentEndTs}&market=${marketParam}&limit=5000`);
                const batch = await res.json();
                if (!Array.isArray(batch) || batch.length === 0) break;

                allCandles = [...batch, ...allCandles];
                // Update for next chunk if needed
                currentEndTs = batch[0].timestamp - 1;
                if (batch.length < 100) break; // Truly reached the beginning
                iterations++;
            }

            if (allCandles.length === 0) return;

            // Re-sort to be safe and ensure continuity (Earliest to Latest)
            allCandles.sort((a, b) => a.timestamp - b.timestamp);

            for (let y = currentYear; y >= minAllowedYear; y--) {
                const yearIdx = allCandles.findIndex(k => new Date(k.timestamp).getUTCFullYear() == y);
                if (yearIdx === -1) continue;

                const yearData = allCandles.slice(yearIdx).filter(k => new Date(k.timestamp).getUTCFullYear() == y);
                if (yearData.length < 2) continue;

                // Anchor 0% to the close of the PREVIOUS year's last candle if available
                let firstPrice;
                if (yearIdx > 0) {
                    firstPrice = allCandles[yearIdx - 1].close;
                } else {
                    firstPrice = yearData[0].open || yearData[0].close;
                }

                let seasonalData = yearData.map(k => {
                    const d = new Date(k.timestamp);
                    const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
                    // Shift doy by 1 so that Day 0 is the previous year's anchor
                    const doy = Math.floor((k.timestamp - startOfYear) / 86400000) + 1;
                    return { 
                        day: doy, 
                        percentage: ((k.close - firstPrice) / firstPrice) * 100,
                        regular: k.close
                    };
                });

                // Always prepend Day 0 (Anchor)
                seasonalData.unshift({ day: 0, percentage: 0, regular: firstPrice });

                results[y] = {
                    data: seasonalData,
                    color: palette[Object.keys(results).length % palette.length]
                };
                if (y === currentYear) this.fullYearStartPrice = firstPrice;
            }

            this.fullSeasonalsResults = results;

            // Force dynamic range based on data found
            const availYears = Object.keys(results).map(Number).sort((a, b) => b - a);
            if (availYears.length > 0) {
                this.seasonalSliderMax = availYears[0];
                this.seasonalSliderMin = availYears[availYears.length - 1];
                this.currentEndYear = availYears[0];
                this.currentStartYear = availYears[Math.min(2, availYears.length - 1)];
            }

            this.initFullSeasonals();
            this.renderFullSeasonalsChart(results, this.currentStartYear, this.currentEndYear);
        } catch (e) {
            console.error("Error opening seasonals view:", e);
        }
    }

    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    getMonthBoundaries(year) {
        if (this.isLeapYear(year)) {
            return [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
        }
        return [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    }

    renderFullSeasonalsChart(results, startYear, endYear) {
        const svg = document.getElementById('seasonals-full-svg');
        const labelCol = document.getElementById('seasonals-full-labels');
        if (!svg || !labelCol || !results) return;

        const width = 1000;
        const height = 600;
        const paddingLeft = 0;
        const paddingRight = 80;
        const paddingTop = 5; // No gap at top
        const paddingBottom = 150; // 75% height (600-150=450, 450/600=0.75)

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
        this.selectedYears = yearsFound.sort((a,b) => a-b);

        // Calculate Average if enabled
        let averageData = [];
        if (this.showSeasonalAverage) {
            // Using 367 slots (0 to 366) to account for Day 0 anchor and leap years
            const dayMap = {};
            for (let d = 0; d <= 366; d++) dayMap[d] = { sum: 0, count: 0 };

            Object.values(filteredResults).forEach(obj => {
                obj.data.forEach(p => {
                    const d = p.day;
                    if (d <= 364 && dayMap[d]) {
                        dayMap[d].sum += p[valProp];
                        dayMap[d].count++;
                    }
                });
            });

            for (let d = 0; d <= 366; d++) {
                if (dayMap[d].count > 0) {
                    averageData.push({ day: d, val: dayMap[d].sum / dayMap[d].count });
                }
            }
        }

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
            svg.innerHTML = `<text x="500" y="300" fill="#787b86" text-anchor="middle" font-size="14">No data for selected range (${sYear}-${eYear})</text>`;
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

        const getY = (val) => {
            const y = height - paddingBottom - (((val - roundedMin) / (range || 1)) * (height - paddingTop - paddingBottom));
            return isNaN(y) ? 0 : y;
        };
        const getX = (index) => {
            const day = Math.min(366, Math.max(0, index));
            return paddingLeft + (day / 366) * (width - paddingLeft - paddingRight);
        };
        const formatVal = (v) => {
            if (v === undefined || v === null || isNaN(v)) return '0.00';
            return isPercent ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : `${v.toFixed(2)}`;
        };

        let bgContent = '';
        // Zero Line (Only show if range covers zero - mostly for percentage mode)
        const zeroY = getY(0);
        if (roundedMin <= 0 && roundedMax >= 0) {
            bgContent += `<line x1="0" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="#434651" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.8" />`;
        }

        // Accurate Monthly Grid & Labels
        const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        monthStarts.forEach((day, i) => {
            const x = getX(day);
            // Grid line
            bgContent += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${height - paddingBottom}" stroke="#2a2e39" stroke-width="1" />`;
            // Label
            bgContent += `<text x="${x + 5}" y="${height - paddingBottom + 20}" fill="#787b86" font-size="11" font-weight="500">${monthNames[i]}</text>`;
        });

        // End line
        bgContent += `<line x1="${width - paddingRight}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#2a2e39" stroke-width="1" />`;

        // Percentage Labels on the Right Inside SVG (Consistent Ruler)
        for (let lvl = roundedMin; lvl <= roundedMax; lvl += interval) {
            const y = getY(lvl);
            bgContent += `<text x="${width - paddingRight + 10}" y="${y + 4}" fill="#ffffff" font-size="10" font-weight="600" text-anchor="start">${formatVal(lvl)}</text>`;
            bgContent += `<line x1="0" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#2a2e39" stroke-width="0.5" opacity="0.3" />`;
        }
        svg.innerHTML = bgContent; // Set background once

        // Paths and Labels
        labelCol.innerHTML = '';
        const sortedYears = Object.keys(filteredResults).sort((a, b) => b - a);

        sortedYears.forEach(year => {
            const { data, color } = filteredResults[year];
            if (data.length < 2) return;

            // Use the first point's day for the 'M' command
            let pathD = `M ${getX(data[0].day)} ${getY(data[0][valProp])}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${getX(data[i].day)} ${getY(data[i][valProp])}`;
            }

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathD);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", color);
            const currentYear = new Date().getUTCFullYear();
            path.setAttribute("stroke-width", year == currentYear ? "1.5" : "1.2");
            path.setAttribute("opacity", year == currentYear ? "1" : "0.6");
            svg.appendChild(path);

            // Year Label Tag (Flag Style)
            const lastPoint = data[data.length - 1];
            const lastVal = lastPoint[valProp];
            const tag = document.createElement('div');
            tag.className = 'year-tag';
            tag.style.background = color;
            tag.style.color = '#ffffff'; // White text by default
            tag.innerHTML = `
                <span class="year-num">${year}</span>
                <span class="year-pct">${formatVal(lastVal)}</span>
            `;
            // Position tag roughly based on last value
            const yPerc = (getY(lastVal) / height) * 100;
            tag.style.position = 'absolute';
            tag.style.top = `${yPerc}%`;
            // Position tag at the chart boundary (920px in 1000px grid)
            const xPerc = ((width - paddingRight) / width) * 100;
            tag.style.left = `${xPerc}%`;
            tag.style.right = 'auto';
            tag.style.transform = 'translateY(-50%)';
            labelCol.appendChild(tag);

            if (year == currentYear) {
                const connector = document.createElementNS("http://www.w3.org/2000/svg", "line");
                connector.setAttribute("x1", getX(lastPoint.day));
                connector.setAttribute("y1", getY(lastVal));
                connector.setAttribute("x2", width - paddingRight);
                connector.setAttribute("y2", getY(lastVal));
                connector.setAttribute("stroke", color);
                connector.setAttribute("stroke-width", "0.5");
                connector.setAttribute("stroke-dasharray", "2 2");
                svg.appendChild(connector);

                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", getX(lastPoint.day));
                dot.setAttribute("cy", getY(lastVal));
                dot.setAttribute("r", "4");
                dot.setAttribute("class", "live-pulse-dot");
                dot.setAttribute("fill", color);
                svg.appendChild(dot);

                const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ring.setAttribute("cx", getX(lastPoint.day));
                ring.setAttribute("cy", getY(lastVal));
                ring.setAttribute("r", "5");
                ring.setAttribute("class", "live-pulse-ring");
                ring.setAttribute("stroke", color);
                svg.appendChild(ring);
            }
        });

        // Finally, render Average Line if enabled
        if (this.showSeasonalAverage && averageData.length > 1) {
            let avgD = `M ${getX(averageData[0].day)} ${getY(averageData[0].val)}`;
            for (let i = 1; i < averageData.length; i++) {
                avgD += ` L ${getX(averageData[i].day)} ${getY(averageData[i].val)}`;
            }
            const avgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            avgPath.setAttribute("d", avgD);
            avgPath.setAttribute("fill", "none");
            avgPath.setAttribute("stroke", "#ffffff"); // Pure white for average
            avgPath.setAttribute("stroke-width", "1.5");
            avgPath.setAttribute("stroke-dasharray", "4 4");
            avgPath.setAttribute("stroke-linejoin", "round");
            avgPath.setAttribute("stroke-linecap", "round");
            avgPath.setAttribute("opacity", "0.9");
            svg.appendChild(avgPath);

            // Average Tag
            const lastAvg = averageData[averageData.length - 1];
            const tag = document.createElement('div');
            tag.className = 'year-tag average-tag';
            tag.style.background = '#ffffff';
            tag.style.color = '#000000'; // Black text
            tag.innerHTML = `
                <span class="year-num" style="color:#000000">AVG</span>
                <span class="year-pct" style="color:#000000">${formatVal(lastAvg.val)}</span>
            `;
            const yPerc = (getY(lastAvg.val) / height) * 100;
            tag.style.position = 'absolute';
            tag.style.top = `${yPerc}%`;
            const xPerc = ((width - paddingRight) / width) * 100;
            tag.style.left = `${xPerc}%`;
            tag.style.transform = 'translateY(-50%)';
            labelCol.appendChild(tag);
        }

        // Synchronize Table View if active
        const tableWrapper = document.getElementById('seasonals-full-table');
        if (tableWrapper && tableWrapper.style.display === 'flex') {
            this.renderSeasonalTable(this.fullSeasonalsResults);
        }
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
        tableHtml += `<th>Year</th></tr></thead><tbody>`;

        const yearPerformance = {};
        const years = Object.keys(results).map(Number).filter(y => y >= startYear && y <= endYear).sort((a, b) => b - a);

        years.forEach(year => {
            const data = results[year].data;
            yearPerformance[year] = { months: [] };
            const mBounds = this.getMonthBoundaries(year);
            
            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m];
                const endDay = (m === 11) ? 366 : mBounds[m+1];
                
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                
                let perf;
                if (isPercent) {
                    const startVal = startPt.percentage;
                    const endVal = endPt.percentage;
                    perf = ((1 + endVal/100) / (1 + (startVal || 0)/100) - 1) * 100;
                } else {
                    perf = endPt.regular - startPt.regular;
                }
                
                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                yearPerformance[year].months[m] = perf;
            }
            
            const firstPt = data[0];
            const lastPt = data[data.length - 1];
            yearPerformance[year].total = isPercent ? lastPt.percentage : (lastPt.regular - firstPt.regular);
        });

        years.forEach(year => {
            tableHtml += `<tr><td style="position: sticky; left: 0; z-index: 4;">${year}</td>`;
            for (let m = 0; m < 12; m++) {
                tableHtml += this.formatTableCell(yearPerformance[year].months[m], isPercent);
            }
            tableHtml += this.formatTableCell(yearPerformance[year].total, isPercent, true);
            tableHtml += `</tr>`;
        });

        // Average Row (Conditional)
        if (this.showSeasonalAverage) {
            tableHtml += `<tr class="footer-row"><td style="position: sticky; left: 0; z-index: 4;">Average</td>`;
            const standardBounds = this.getMonthBoundaries(2021); // Non-leap standard
            const monthlyAvgs = [];
            for (let m = 0; m < 12; m++) {
                let sum = 0, count = 0;
                years.forEach(y => {
                    const data = results[y].data;
                    const mBounds = this.getMonthBoundaries(y);
                    const startDay = mBounds[m];
                    const endDay = (m === 11) ? 366 : mBounds[m+1];
                    const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                    const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                    let perf = isPercent ? (((1 + endPt.percentage/100) / (1 + (startPt.percentage || 0)/100) - 1) * 100) : (endPt.regular - startPt.regular);
                    if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                    if (perf !== null && !isNaN(perf)) { sum += perf; count++; }
                });
                const avg = count > 0 ? sum / count : null;
                monthlyAvgs.push(avg);
                tableHtml += this.formatTableCell(avg, isPercent);
            }
            let totalAvg = 0;
            monthlyAvgs.forEach(a => { if (a !== null) totalAvg += a; });
            tableHtml += this.formatTableCell(totalAvg !== 0 ? totalAvg : null, isPercent, true);
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
                const endDay = (m === 11) ? 366 : mBounds[m+1];
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                let perf = isPercent ? (((1 + endPt.percentage/100) / (1 + (startPt.percentage || 0)/100) - 1) * 100) : (endPt.regular - startPt.regular);
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
        const sign = (isPercent && val > 0) ? '+' : '';
        const suffix = isPercent ? '%' : '';
        const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const displayVal = (val < 0 ? '-' : sign) + formatted + suffix;
        return `<td class="month-cell ${cls} ${isYear ? 'year-column' : ''}">${displayVal}</td>`;
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
        const totalYears = (sliderMax - sliderMin) || 1;

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
            const startYear = Math.min(this.currentStartYear, this.currentEndYear);
            const endYear = Math.max(this.currentStartYear, this.currentEndYear);

            const sPerc = ((this.currentStartYear - sliderMin) / totalYears) * 100;
            const ePerc = ((this.currentEndYear - sliderMin) / totalYears) * 100;
            
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

            const year = Math.round(sliderMin + perc * totalYears);

            if (isStart) {
                this.currentStartYear = year;
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

        // Hover logic (One-time setup)
        const tooltip = document.getElementById('seasonals-full-tooltip');
        const width = 1000;
        const height = 600;
        const paddingRight = 80;
        const paddingTop = 5;
        const paddingBottom = 150;

        svg.addEventListener('mousemove', (e) => {
            if (!this.fullSeasonalsResults) return;
            const rect = svg.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;

            let day = Math.round((relX / (width - paddingRight)) * 365);
            day = Math.max(0, Math.min(365, day));

            let tooltipHtml = `<div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #363c4e;padding-bottom:6px">Day ${day}</div>`;
            let hasData = false;

            const valProp = this.seasonalViewMode || 'percentage';
            const isPercent = valProp === 'percentage';

            // Sort years for tooltip
            Object.keys(this.fullSeasonalsResults)
                .filter(y => y >= Math.min(this.currentStartYear, this.currentEndYear) && y <= Math.max(this.currentStartYear, this.currentEndYear))
                .sort((a, b) => b - a).forEach(year => {
                    const yearData = this.fullSeasonalsResults[year].data;
                    const point = yearData.find(pt => pt.day === day) ||
                        [...yearData].reverse().find(pt => pt.day <= day);

                    if (point) {
                        const val = (point[valProp] !== undefined) ? point[valProp] : (point.val || 0);
                        const color = this.fullSeasonalsResults[year].color;
                        const valStr = isPercent ? (val >= 0 ? '+' : '') + val.toFixed(2) + '%' : val.toFixed(2);
                        tooltipHtml += `
                        <div class="tooltip-row" style="margin: 4px 0">
                            <span style="color:${color};font-weight:700">${year}</span>
                            <span class="${val >= 0 ? 'change-up' : 'change-down'}">${valStr}</span>
                        </div>
                    `;
                        hasData = true;
                    }
                });

            // Add Average to tooltip if enabled
            if (this.showSeasonalAverage) {
                let sum = 0;
                let count = 0;
                Object.values(this.fullSeasonalsResults).forEach(obj => {
                     const pt = obj.data.find(p => p.day === day) || [...obj.data].reverse().find(p => p.day <= day);
                     if (pt) {
                         const v = (pt[valProp] !== undefined) ? pt[valProp] : (pt.val || 0);
                         sum += v;
                         count++;
                     }
                });
                if (count > 0) {
                    const avg = sum / count;
                    const avgStr = isPercent ? (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%' : avg.toFixed(2);
                    tooltipHtml += `
                        <div class="tooltip-row" style="margin: 4px 0; border-top: 1px solid #363c4e; padding-top: 4px">
                            <span style="color:#ffffff;font-weight:700">AVERAGE</span>
                            <span class="${avg >= 0 ? 'change-up' : 'change-down'}">${avgStr}</span>
                        </div>
                    `;
                }
            }

            if (hasData) {
                tooltip.innerHTML = tooltipHtml;
                tooltip.style.display = 'block';

                const tooltipRect = tooltip.getBoundingClientRect();
                let x = e.clientX - rect.left + 20;
                let y = e.clientY - rect.top + 20;

                if (x + tooltipRect.width > rect.width) x -= (tooltipRect.width + 40);
                if (y + tooltipRect.height > rect.height) y -= (tooltipRect.height + 40);

                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;

                let hoverLine = svg.querySelector('.seasonal-full-hover-line');
                if (!hoverLine) {
                    hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    hoverLine.setAttribute("class", "seasonal-full-hover-line");
                    hoverLine.setAttribute("stroke", "#787b86");
                    hoverLine.setAttribute("stroke-width", "1");
                    hoverLine.setAttribute("stroke-dasharray", "4 4");
                    svg.appendChild(hoverLine);
                }
                const lx = (day / 365) * (width - paddingRight);
                hoverLine.setAttribute("x1", lx);
                hoverLine.setAttribute("y1", paddingTop);
                hoverLine.setAttribute("x2", lx);
                hoverLine.setAttribute("y2", height - paddingBottom);
            }
        });

        svg.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
            const hoverLine = svg.querySelector('.seasonal-full-hover-line');
            if (hoverLine) hoverLine.remove();
        });

        this.fullSeasonalsInitialized = true;
    }

    setupFullSeasonalsHover(results) {
        // Obsolete - moved to initFullSeasonals
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

        // Show chart legend back
        if (window.chart && window.chart.legendOverlay) {
            window.chart.legendOverlay.style.display = 'flex';
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
            setTimeout(() => {
                if (window.chart) window.chart.resize(null, null, true, true);
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

        // Visual feedback
        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        try {
            const isChartVisible = container.offsetParent !== null;
            if (!isChartVisible) {
                alert("Please switch to Chart View before exporting.");
                return;
            }

            // Capture current state to restore later
            const originalWidth = container.style.width;
            const originalHeight = container.style.height;
            const originalFlex = container.style.flex;

            // Use a professional FIXED high-resolution for the export to ensure consistency 
            // (1000x550 gives a tight, professional chart aesthetic)
            const targetWidth = 1000;
            const targetHeight = 550;
            
            // Temporarily resize to target dimensions for clean rendering
            container.style.flex = 'none';
            container.style.width = `${targetWidth}px`;
            container.style.height = `${targetHeight}px`;
            
            // Force a re-render at this specific size
            await this.renderFullSeasonalsChart();
            
            // Critical: Wait for browser to recalculate layout/rects
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            // Dimensions for canvas
            const padding = 24; 
            const headerHeight = 60; 
            const bottomPadding = 24; 
            
            const canvasWidth = targetWidth + padding * 2;
            const canvasHeight = targetHeight + headerHeight + padding + bottomPadding;

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 2;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // 1. Draw Overall Background
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(padding, padding + headerHeight, targetWidth, targetHeight);

            // 2. Draw Title Header Area
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 17px Arial'; // Not too big as requested
            ctx.textAlign = 'left';
            
            // Get accurate metadata from DOM
            const ticker = document.getElementById('detail-symbol')?.textContent || this.currentTicker || 'BTC/USDT';
            const exchangeName = document.getElementById('detail-exchange')?.textContent || '';
            
            ctx.fillText(`${ticker}${exchangeName ? ' • ' + exchangeName : ''}`, padding + 10, padding + 22);

            ctx.fillStyle = '#787b86';
            ctx.font = '12px Arial';
            // Construct year range text (Support single year case)
            let yearRangeStr = '';
            if (this.selectedYears && this.selectedYears.length > 0) {
                const minYear = Math.min(...this.selectedYears);
                const maxYear = Math.max(...this.selectedYears);
                if (minYear === maxYear) {
                    yearRangeStr = `${minYear}`; // Single year
                } else {
                    yearRangeStr = `${this.selectedYears.length} Years (${minYear} - ${maxYear})`;
                }
            }
            ctx.fillText(yearRangeStr, padding + 10, padding + 40);

            // 3. Draw SVG (Drawing SVG BEFORE labels so it acts as background)
            const svgClone = svg.cloneNode(true);
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
            
            // 4a. Draw Tick Labels
            ctx.fillStyle = '#787b86';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            const tickSpans = Array.from(labelsCol.querySelectorAll('span')).filter(s => !s.closest('.year-tag'));
            tickSpans.forEach(span => {
                const r = span.getBoundingClientRect();
                const relY = r.top - containerRect.top + (r.height / 2);
                const relX = r.right - containerRect.left;
                ctx.fillText(span.textContent, relX + padding - 5, relY + padding + headerHeight + 4);
            });

            // 4b. Draw Year Tags - INLINE
            const yearTags = labelsCol.querySelectorAll('.year-tag');
            yearTags.forEach(tag => {
                const r = tag.getBoundingClientRect();
                const relY = r.top - containerRect.top;
                const relX = r.left - containerRect.left;
                
                const bgColor = window.getComputedStyle(tag).backgroundColor;
                ctx.fillStyle = bgColor;
                
                // Draw rounded background box (adjusted width for inline text)
                const spans = tag.querySelectorAll('span');
                const yearNum = spans[0]?.textContent || '';
                const yearPct = spans[1]?.textContent || '';
                const combinedText = `${yearNum} (${yearPct})`;
                
                // Measure text to decide box width
                ctx.font = 'bold 11px Arial';
                const textWidth = ctx.measureText(combinedText).width;
                const boxWidth = textWidth + 12;
                
                this.drawRoundedRect(ctx, relX + padding, relY + padding + headerHeight, boxWidth, 18, 4);
                
                // Draw text inside the tag (Inline)
                ctx.fillStyle = (bgColor === 'rgb(255, 255, 255)' || bgColor === 'white') ? '#000000' : '#ffffff';
                ctx.textAlign = 'left';
                ctx.fillText(combinedText, relX + padding + 6, relY + padding + headerHeight + 13);
            });

            // 5. Restore original view
            container.style.flex = originalFlex;
            container.style.width = originalWidth;
            container.style.height = originalHeight;
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
                canvas.toBlob(async (blob) => {
                    try {
                        const data = [new ClipboardItem({ 'image/png': blob })];
                        await navigator.clipboard.write(data);
                        alert("Image copied to clipboard!");
                    } catch (err) {
                        alert("Could not copy image. Try downloading.");
                    }
                }, 'image/png');
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
                const mBounds = this.getMonthBoundaries(year);
                const row = { year, months: [], total: 0 };
                for (let m = 0; m < 12; m++) {
                    const startDay = mBounds[m];
                    const endDay = (m === 11) ? 366 : mBounds[m+1];
                    const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                    const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                    let perf = isPercent ? (((1 + endPt.percentage/100) / (1 + (startPt.percentage || 0)/100) - 1) * 100) : (endPt.regular - startPt.regular);
                    if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                    row.months.push(perf);
                }
                const firstPt = data[0];
                const lastPt = data[data.length - 1];
                row.total = isPercent ? lastPt.percentage : (lastPt.regular - firstPt.regular);
                row.isComplete = (lastPt.day - firstPt.day) >= 360;
                tableData.push(row);
            });

            // 2. Dimensions and Canvas setup
            const padding = 24;
            const headerHeight = 60;
            const rowHeight = 30;
            const dateColWidth = 40;
            const monthColWidth = 65;
            const yearColWidth = 75;
            
            const tableWidth = dateColWidth + (monthColWidth * 12) + yearColWidth;
            const rowTotal = tableData.length + 1 + (this.showSeasonalAverage ? 1 : 0) + 1; // Headers + Data + Avg + Rise/Fall
            const tableHeight = rowTotal * rowHeight;
            
            const canvasWidth = tableWidth + padding * 2;
            const canvasHeight = tableHeight + headerHeight + padding + 24;

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 2;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // 3. Draw Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 4. Draw Header
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 17px Arial';
            ctx.textAlign = 'left';
            const ticker = document.getElementById('detail-symbol')?.textContent || this.currentTicker || 'BTC/USDT';
            const exchange = document.getElementById('detail-exchange')?.textContent || '';
            ctx.fillText(`${ticker}${exchange ? ' • ' + exchange : ''}`, padding + 10, padding + 22);

            ctx.fillStyle = '#787b86';
            ctx.font = '12px Arial';
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            const yearRange = minYear === maxYear ? `${minYear}` : `${years.length} Years (${minYear} - ${maxYear})`;
            ctx.fillText(yearRange, padding + 10, padding + 40);

            // 5. Draw Table Header
            let curY = padding + headerHeight;
            ctx.fillStyle = '#131722';
            ctx.fillRect(padding, curY, tableWidth, rowHeight);
            
            ctx.fillStyle = '#787b86';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Year", padding + dateColWidth/2, curY + 19);
            for (let i = 0; i < 12; i++) {
                ctx.fillText(monthNames[i], padding + dateColWidth + (i * monthColWidth) + monthColWidth/2, curY + 19);
            }
            ctx.fillText("Total", padding + tableWidth - yearColWidth/2, curY + 19);
            curY += rowHeight;

            // 6. Draw Table Rows
            ctx.font = '11px Arial';
            tableData.forEach(row => {
                // Year label
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(row.year, padding + dateColWidth/2, curY + 19);
                
                // Monthly cells
                for (let m = 0; m < 12; m++) {
                    const val = row.months[m];
                    const x = padding + dateColWidth + (m * monthColWidth);
                    const cellColor = val > 0 ? 'rgba(8, 153, 129, 0.45)' : (val < 0 ? 'rgba(242, 54, 69, 0.45)' : 'transparent');
                    if (cellColor !== 'transparent') {
                        ctx.fillStyle = cellColor;
                        ctx.fillRect(x + 1, curY + 1, monthColWidth - 2, rowHeight - 2);
                    }
                    
                    ctx.fillStyle = (val === null || isNaN(val)) ? '#434651' : (val === 0 ? '#787b86' : '#ffffff');
                    const text = (val === null || isNaN(val)) ? '—' : (isPercent ? (val > 0 ? '+' : '') + val.toFixed(1) + '%' : val.toFixed(2));
                    ctx.fillText(text, x + monthColWidth/2, curY + 19);
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
                ctx.font = 'bold 11px Arial';
                const tText = (isPercent ? (t > 0 ? '+' : '') + t.toFixed(1) + '%' : t.toFixed(2));
                ctx.fillText(tText, tx + yearColWidth/2, curY + 19);
                ctx.font = '11px Arial';

                curY += rowHeight;
            });

            // 7. Draw Footer (AVG + Rise/Fall)
            if (this.showSeasonalAverage) {
                ctx.fillStyle = '#131722';
                ctx.fillRect(padding, curY, tableWidth, rowHeight);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px Arial';
                ctx.fillText("Average", padding + dateColWidth/2, curY + 19);
                
                const footerAvgs = [];
                for (let m = 0; m < 12; m++) {
                    let sum = 0, count = 0;
                    tableData.forEach(r => { if (r.months[m] !== null) { sum += r.months[m]; count++; }});
                    const avg = count > 0 ? sum / count : null;
                    footerAvgs.push(avg);
                    const x = padding + dateColWidth + (m * monthColWidth);
                    const avgText = avg === null ? '—' : (isPercent ? (avg > 0 ? '+' : '') + avg.toFixed(1) + '%' : avg.toFixed(2));
                    ctx.fillText(avgText, x + monthColWidth/2, curY + 19);
                }
                
                // Total Average (Sum of monthly averages)
                let totalAvg = 0;
                footerAvgs.forEach(a => { if (a !== null) totalAvg += a; });
                const tx = padding + dateColWidth + (12 * monthColWidth);
                const tText = totalAvg === 0 ? '—' : (isPercent ? (totalAvg > 0 ? '+' : '') + totalAvg.toFixed(1) + '%' : totalAvg.toFixed(2));
                ctx.fillText(tText, tx + yearColWidth/2, curY + 19);

                curY += rowHeight;
            }

            // Rise/Fall Row
            ctx.fillStyle = '#131722';
            ctx.fillRect(padding, curY, tableWidth, rowHeight);
            ctx.fillStyle = '#787b86';
            ctx.font = '10px Arial';
            ctx.fillText("Rises/Falls", padding + dateColWidth/2, curY + 19);
            for (let m = 0; m < 12; m++) {
                let up = 0, down = 0;
                tableData.forEach(r => { if (r.months[m] > 0) up++; else if (r.months[m] < 0) down++; });
                const x = padding + dateColWidth + (m * monthColWidth);
                ctx.fillStyle = '#089981';
                ctx.fillText(`▲${up}`, x + monthColWidth/2 - 12, curY + 19);
                ctx.fillStyle = '#f23645';
                ctx.fillText(`▼${down}`, x + monthColWidth/2 + 12, curY + 19);
            }
            // Increase Y for Year total column rise/fall
            let yUp = 0, yDown = 0;
            tableData.forEach(r => { if (r.total > 0) yUp++; else if (r.total < 0) yDown++; });
            const yx = padding + dateColWidth + (12 * monthColWidth);
            ctx.fillStyle = '#089981';
            ctx.fillText(`▲${yUp}`, yx + yearColWidth/2 - 12, curY + 19);
            ctx.fillStyle = '#f23645';
            ctx.fillText(`▼${yDown}`, yx + yearColWidth/2 + 12, curY + 19);

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
                const endDay = (m === 11) ? 366 : mBounds[m+1];
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                let perf = isPercent ? (((1 + endPt.percentage/100) / (1 + (startPt.percentage || 0)/100) - 1) * 100) : (endPt.regular - startPt.regular);
                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                rowArr.push(perf === null ? "" : perf.toFixed(2) + (isPercent ? "%" : ""));
            }
            const total = isPercent ? data[data.length-1].percentage : (data[data.length-1].regular - data[0].regular);
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
                    const endDay = (m === 11) ? 366 : mBounds[m+1];
                    const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                    const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                    let perf = isPercent ? (((1 + endPt.percentage/100) / (1 + (startPt.percentage || 0)/100) - 1) * 100) : (endPt.regular - startPt.regular);
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
                const total = isPercent ? data[data.length-1].percentage : (data[data.length-1].regular - data[0].regular);
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
