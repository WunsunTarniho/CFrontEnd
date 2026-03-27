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

                    if (this.seasonalData[currentYear]) {
                        const sData = this.seasonalData[currentYear];
                        if (sData.length > 0) {
                            const lastP = sData[sData.length - 1];
                            if (doy > lastP.day) {
                                sData.push({ day: doy, val: pct });
                            } else {
                                sData[sData.length - 1] = { day: doy, val: pct };
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

                    if (this.fullSeasonalsResults[currentYear]) {
                        const fData = this.fullSeasonalsResults[currentYear].data;
                        if (fData.length > 0) {
                            const lastP = fData[fData.length - 1];
                            if (doy > lastP.day) {
                                fData.push({ day: doy, val: pct });
                            } else {
                                fData[fData.length - 1] = { day: doy, val: pct };
                            }
                            this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
                            updated = true;
                        }
                    }
                }

                if (updated) this.lastSeasonalSyncTime = now;
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

            for (const year of years) {
                const endTs = year === currentYear ? Date.now() : new Date(year, 11, 31, 23, 59, 59).getTime();

                const res = await fetch(`${apiBase}/api/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&endDateTs=${endTs}&market=${marketParam}`);
                const candles = await res.json();

                if (Array.isArray(candles) && candles.length > 0) {
                    // Find the first candle of this year and the one before it for anchoring
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

                    let seasonalResults = yearCandles.map(c => {
                        const d = new Date(c.timestamp);
                        const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
                        const doy = Math.floor((c.timestamp - startOfYear) / 86400000);
                        return { day: doy, val: ((c.close - firstPrice) / firstPrice) * 100 };
                    });

                    // Pad the start if Jan 1st data is missing (e.g. IPO year or market closure)
                    if (seasonalResults.length > 0 && seasonalResults[0].day > 0) {
                        seasonalResults.unshift({ day: 0, val: 0 });
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
            allValues = allValues.concat(arr.map(d => d.val));
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

            let pathD = `M ${getX(data[0].day)} ${getY(data[0].val)}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${getX(data[i].day)} ${getY(data[i].val)}`;
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
                const ly = getY(data[lastIdx].val);

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
                    const val = point.val;
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
            const minAllowedYear = (market === 'stock' || market === 'commodities') ? 2000 : 2010;
            const years = [];
            // We'll populate 'years' dynamically or just loop
            
            const palette = ['#2962ff', '#089981', '#f7931a', '#f23645', '#bb86fc', '#ffeb3b', '#00bcd4', '#e91e63', '#4caf50', '#ff9800'];
            const results = {};

            const apiBase = 'http://localhost:5000';
            const marketParam = market === 'stock' ? 'stocks' : market;

            let emptyStreak = 0;
            for (let y = currentYear; y >= minAllowedYear; y--) {
                const year = y;
                const endTime = year === currentYear ? Date.now() : new Date(year, 11, 31, 23, 59, 59).getTime();

                const res = await fetch(`${apiBase}/api/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&endDateTs=${endTime}&market=${marketParam}`);
                const data = await res.json();

                if (Array.isArray(data) && data.length > 5) { // At least a few days of data
                    emptyStreak = 0;
                    const currentYearIdx = data.findIndex(k => new Date(k.timestamp).getUTCFullYear() == year);
                    if (currentYearIdx === -1) continue;

                    const yearData = data.slice(currentYearIdx).filter(k => new Date(k.timestamp).getUTCFullYear() == year);
                    if (yearData.length < 2) continue;

                    // Anchor 0% to the close of the PREVIOUS year's last candle if available
                    let firstPrice;
                    if (currentYearIdx > 0) {
                        firstPrice = data[currentYearIdx - 1].close;
                    } else {
                        firstPrice = yearData[0].open || yearData[0].close;
                    }

                    let seasonalData = yearData.map(k => {
                        const d = new Date(k.timestamp);
                        const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
                        const doy = Math.floor((k.timestamp - startOfYear) / 86400000);
                        return { day: doy, val: ((k.close - firstPrice) / firstPrice) * 100 };
                    });

                    // Pad the start if Jan 1st data is missing
                    if (seasonalData.length > 0 && seasonalData[0].day > 0) {
                        seasonalData.unshift({ day: 0, val: 0 });
                    }

                    results[year] = {
                        data: seasonalData,
                        color: palette[Object.keys(results).length % palette.length]
                    };
                    if (year === currentYear) this.fullYearStartPrice = firstPrice;
                } else {
                    emptyStreak++;
                    // If we find 2 consecutive empty years, we probably reached the start of the asset history
                    if (emptyStreak >= 2) break;
                }
            }

            this.fullSeasonalsResults = results;

            // Force default to latest 3 years of data BEFORE init
            const availYears = Object.keys(results).map(Number).sort((a, b) => b - a);
            if (availYears.length > 0) {
                this.currentEndYear = availYears[0];
                this.currentStartYear = availYears[Math.min(2, availYears.length - 1)];
                this.seasonalSliderMin = availYears[availYears.length - 1];
                this.seasonalSliderMax = availYears[0];
            }

            this.initFullSeasonals();
            this.renderFullSeasonalsChart(results, this.currentStartYear, this.currentEndYear);
        } catch (e) {
            console.error("Error opening seasonals view:", e);
        }
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

        // Filter results by year range
        const filteredResults = {};
        Object.keys(results).forEach(year => {
            const y = parseInt(year);
            if (y >= sYear && y <= eYear) {
                filteredResults[year] = results[year];
            }
        });

        let allValues = [];
        Object.values(filteredResults).forEach(obj => {
            allValues = allValues.concat(obj.data.map(d => d.val));
        });
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

        const getY = (val) => height - paddingBottom - (((val - roundedMin) / (range || 1)) * (height - paddingTop - paddingBottom));
        const getX = (index) => paddingLeft + (index / 365) * (width - paddingLeft - paddingRight);

        let bgContent = '';
        // Zero Line
        const zeroY = getY(0);
        bgContent += `<line x1="0" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="#434651" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.8" />`;

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
            bgContent += `<text x="${width - paddingRight + 10}" y="${y + 4}" fill="#ffffff" font-size="10" font-weight="600" text-anchor="start">${lvl > 0 ? '+' : ''}${lvl.toFixed(1)}%</text>`;
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
            let pathD = `M ${getX(data[0].day)} ${getY(data[0].val)}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${getX(data[i].day)} ${getY(data[i].val)}`;
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
            const lastVal = lastPoint.val;
            const tag = document.createElement('div');
            tag.className = 'year-tag';
            tag.style.background = color;
            tag.innerHTML = `
                <span class="year-num">${year}</span>
                <span class="year-pct">${lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}%</span>
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
    }

    getNiceInterval(range) {
        if (range <= 5) return 0.5;
        if (range <= 15) return 1;
        if (range <= 40) return 2;
        if (range <= 100) return 10;
        if (range <= 300) return 25;
        if (range <= 600) return 50;
        if (range <= 1200) return 100;
        return 250;
    }

    initFullSeasonals() {
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

            // Sort years for tooltip
            Object.keys(this.fullSeasonalsResults)
                .filter(y => y >= Math.min(this.currentStartYear, this.currentEndYear) && y <= Math.max(this.currentStartYear, this.currentEndYear))
                .sort((a, b) => b - a).forEach(year => {
                    const yearData = this.fullSeasonalsResults[year].data;
                    const point = yearData.find(pt => pt.day === day) ||
                        [...yearData].reverse().find(pt => pt.day <= day);

                    if (point) {
                        const val = point.val;
                        const color = this.fullSeasonalsResults[year].color;
                        tooltipHtml += `
                        <div class="tooltip-row" style="margin: 4px 0">
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
}
