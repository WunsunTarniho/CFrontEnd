import { getTickerLogo } from './utils.js';

export class SeasonalController {
    constructor(parent) {
        this.parent = parent;
        this.isSeasonalsHoverSetup = false;
        this.fullSeasonalsResults = null;
        this.fullSeasonalsInitialized = false;
        this.showSeasonalAverage = false;
        this.seasonalViewMode = 'percentage'; // 'percentage' | 'regular'
        this.currentStartYear = 2017;
        this.currentEndYear = 2026;
        this.lastSeasonalSyncTime = 0;
        this.lastSeasonalUpdateTime = 0;
        this.currentSeasonalSymbol = null;
        this.seasonalCandles = [];
        this.earliestSeasonalTs = null;
        this.isFetchingMoreSeasonals = false;
        this.minAllowedYear = 2010;
        this.seasonalData = null;
        this.seasonalMaxDays = {};
        this.seasonalColors = null;
        
        // Hover States
        this.sidebarHoverDay = null;
        this.sidebarHoverPos = null;
        this.fullHoverDay = null;
        this.fullHoverPos = null;
    }

    async updateSeasonals(symbol, market = 'crypto') {
        const now = Date.now();
        const isNewSymbol = symbol !== this.currentSeasonalSymbol;
        const isTimeForUpdate = now - this.lastSeasonalUpdateTime > 300000; // 5 min throttle

        if (!isNewSymbol && !isTimeForUpdate && this.seasonalData) {
            this.renderSeasonalsChart(this.seasonalData, this.seasonalColors);
            return;
        }

        this.currentSeasonalSymbol = symbol;
        this.lastSeasonalUpdateTime = now;

        const svg = document.getElementById('seasonals-svg');
        if (!svg) return;

        if (!this.seasonalData || isNewSymbol) {
            svg.innerHTML = '<text x="200" y="75" text-anchor="middle" fill="#787b86" font-size="12">Loading Seasonals...</text>';
        }

        try {
            const currentYear = new Date().getUTCFullYear();
            const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
            const colors = { [currentYear]: '#2962ff', [currentYear - 1]: '#089981', [currentYear - 2]: '#f7931a', [currentYear - 3]: '#f23645' };

            const apiBase = 'http://localhost:5000/api/v1';
            const marketParam = market === 'stock' ? 'stocks' : market;
            const activeExch = window.chart?.exchange || '';

            const res = await fetch(`${apiBase}/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&market=${marketParam}&limit=1500&exchange=${activeExch}`);
            const responseData = await res.json();
            const candles = responseData.candles || [];

            if (Array.isArray(candles) && candles.length > 0) {
                const results = {};
                for (const year of years) {
                    const currentYearIdx = candles.findIndex(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (currentYearIdx === -1) continue;

                    const yearCandles = candles.slice(currentYearIdx).filter(c => new Date(c.timestamp).getUTCFullYear() == year);
                    if (yearCandles.length < 2) continue;

                    let firstPrice;
                    if (currentYearIdx > 0) {
                        firstPrice = candles[currentYearIdx - 1].close;
                    } else {
                        firstPrice = yearCandles[0].open || yearCandles[0].close;
                    }

                    const rawResults = yearCandles.map(c => {
                        const d = new Date(c.timestamp);
                        const doy = this.getSeasonalDayIndex(d, year);
                        return { day: doy, percentage: ((c.close - firstPrice) / firstPrice) * 100, regular: c.close - firstPrice };
                    });

                    const seasonalResults = [];
                    const hasPrevYear = currentYearIdx > 0;
                    const startDay = hasPrevYear ? 0 : rawResults[0].day;
                    const endDay = rawResults[rawResults.length - 1].day;

                    let lastVal = hasPrevYear ? { percentage: 0, regular: 0 } : { percentage: rawResults[0].percentage, regular: rawResults[0].regular };

                    if (hasPrevYear) {
                        seasonalResults.push({ day: 0, percentage: 0, regular: 0 });
                    } else {
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
                }
                this.seasonalData = results;
                this.seasonalColors = colors;
                
                this.seasonalMaxDays = {};
                Object.keys(results).forEach(yr => {
                    const yrCandles = candles.filter(c => new Date(c.timestamp).getUTCFullYear() == yr);
                    if (yrCandles.length > 0) {
                        const d = new Date(yrCandles[yrCandles.length - 1].timestamp);
                        this.seasonalMaxDays[yr] = this.getSeasonalDayIndex(d, yr);
                    }
                });

                this.renderSeasonalsChart(results, colors);
                this.setupSeasonalsHover();
            }

            if ((!this.seasonalData || Object.keys(this.seasonalData).length === 0) && svg && svg.innerHTML.includes('Loading')) {
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

        const width = svg.clientWidth || 400;
        const height = svg.clientHeight || 150;
        const padding = 20;
        const paddingBottom = 30;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const availYearsList = Object.keys(results).map(Number).sort((a, b) => b - a);
        if (availYearsList.length === 0) return;
        const endY = availYearsList[0];
        const startY = availYearsList[Math.min(2, availYearsList.length - 1)];

        const filteredResults = {};
        availYearsList.forEach(y => {
            if (y >= startY && y <= endY) filteredResults[y] = results[y];
        });

        let allValues = [];
        Object.values(filteredResults).forEach(arr => {
            allValues = allValues.concat(arr.map(d => d.percentage || 0));
        });
        if (allValues.length === 0) return;

        const maxVal = Math.max(...allValues, 10);
        const minVal = Math.min(...allValues, -10);
        const range = maxVal - minVal;
        
        const getY = (val) => height - paddingBottom - (((val - minVal) / (range || 1)) * (height - padding - paddingBottom));
        const getX = (index) => padding + (index / 366) * (width - 2 * padding);

        const currentYear = new Date().getUTCFullYear();
        let bgContent = '';
        const zeroY = getY(0);
        bgContent += `<line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" class="seasonal-zero-line" />`;

        const labels = [
            { d: 31, n: 'Feb' }, { d: 121, n: 'May' }, { d: 213, n: 'Aug' }, { d: 305, n: 'Nov' }
        ];

        labels.forEach(q => {
            const x = getX(q.d);
            bgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height - paddingBottom}" class="seasonal-grid" />`;
            bgContent += `<text x="${x}" y="${height - 5}" fill="#787b86" font-size="10" font-weight="500" text-anchor="middle">${q.n}</text>`;
        });
        svg.innerHTML = bgContent;

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
                const lx = getX(data[lastIdx].day), ly = getY(data[lastIdx].percentage || 0);

                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", lx); dot.setAttribute("cy", ly); dot.setAttribute("r", "3");
                dot.setAttribute("class", "live-pulse-dot"); dot.setAttribute("fill", colors[year]);
                svg.appendChild(dot);

                const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                ring.setAttribute("cx", lx); ring.setAttribute("cy", ly); ring.setAttribute("r", "4");
                ring.setAttribute("class", "live-pulse-ring"); ring.setAttribute("stroke", colors[year]);
                svg.appendChild(ring);
                path.setAttribute("opacity", "1");
            } else {
                path.setAttribute("opacity", "0.8");
            }
            svg.appendChild(path);
        });

        if (this.sidebarHoverDay !== null) this.refreshSeasonalHover(true);
    }

    setupSeasonalsHover() {
        const svg = document.getElementById('seasonals-svg');
        const tooltip = document.getElementById('seasonal-tooltip');
        if (!svg || !tooltip || !this.seasonalData) return;

        tooltip.style.pointerEvents = 'none';
        if (this.isSeasonalsHoverSetup) return;
        this.isSeasonalsHoverSetup = true;

        const width = 400;

        svg.addEventListener('mousemove', (e) => {
            const rect = svg.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            let day = Math.round(((relX - 20) / (width - 40)) * 366);
            day = Math.max(0, Math.min(366, day));

            this.sidebarHoverDay = day;
            this.sidebarHoverPos = { clientX: e.clientX, clientY: e.clientY };
            this.refreshSeasonalHover(true);
        });

        svg.addEventListener('mouseleave', () => {
            this.sidebarHoverDay = null;
            this.sidebarHoverPos = null;
            tooltip.style.display = 'none';
            svg.querySelector('.seasonal-hover-line')?.remove();
            svg.querySelectorAll('.seasonal-sidebar-hover-dot').forEach(d => d.remove());
        });
    }

    getSeasonalDayIndex(date, year) {
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        const offsets = isLeap ? [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] : [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let doy = offsets[date.getUTCMonth()] + date.getUTCDate();
        if (!isLeap && doy >= 60) doy++;
        return doy;
    }

    processSeasonalData(allCandles) {
        if (!allCandles || allCandles.length === 0) return {};
        const results = {};
        const palette = ['#2962ff', '#089981', '#f7931a', '#f23645', '#bb86fc', '#ffeb3b', '#00bcd4', '#e91e63', '#4caf50', '#ff9800'];
        const currentYear = new Date().getUTCFullYear();
        const sorted = [...allCandles].sort((a, b) => a.timestamp - b.timestamp);
        const yearsFound = [...new Set(sorted.map(k => new Date(k.timestamp).getUTCFullYear()))].sort((a, b) => b - a);

        yearsFound.forEach((y, i) => {
            const yearIdx = sorted.findIndex(k => new Date(k.timestamp).getUTCFullYear() == y);
            const yearData = sorted.filter(k => new Date(k.timestamp).getUTCFullYear() == y);
            if (yearData.length < 2) return;

            let firstPrice = yearIdx > 0 ? sorted[yearIdx - 1].close : (yearData[0].open || yearData[0].close);
            const rawData = yearData.map(k => {
                const doy = this.getSeasonalDayIndex(new Date(k.timestamp), y);
                return { day: doy, percentage: ((k.close - firstPrice) / firstPrice) * 100, regular: k.close };
            });

            const seasonalData = [];
            const hasPrevYear = yearIdx > 0;
            const startDay = hasPrevYear ? 0 : rawData[0].day, endDay = rawData[rawData.length - 1].day;
            let lastPoint = hasPrevYear ? { percentage: 0, regular: 0 } : { percentage: rawData[0].percentage, regular: rawData[0].regular };
            
            seasonalData.push({ day: hasPrevYear ? 0 : startDay, percentage: lastPoint.percentage, regular: hasPrevYear ? firstPrice : lastPoint.regular + firstPrice });

            const fullDayMap = {};
            rawData.forEach(r => fullDayMap[r.day] = r);
            for (let d = startDay + 1; d <= endDay; d++) {
                if (fullDayMap[d]) lastPoint = { percentage: fullDayMap[d].percentage, regular: fullDayMap[d].regular - firstPrice };
                seasonalData.push({ day: d, percentage: lastPoint.percentage, regular: lastPoint.regular + firstPrice });
            }

            results[y] = { data: seasonalData, maxDay: Math.max(...seasonalData.map(r => r.day)), color: palette[i % palette.length] };
        });
        return results;
    }

    async openSeasonalsView() {
        const container = document.getElementById('seasonals-view-container');
        if (!container) return;
        const symbol = document.getElementById('detail-symbol')?.textContent || window.chart?.symbol;
        container.style.display = 'flex';
        
        if (window.chart) {
            window.chart.legendOverlay.style.display = 'none';
            window.chart.tradingPanel.style.display = 'none';
        }

        const title = document.getElementById('seasonals-view-title'), logo = document.getElementById('seasonals-view-logo'), fullName = document.getElementById('detail-full-name');
        if (title && fullName) title.textContent = fullName.textContent;
        if (logo) {
            const logoUrl = getTickerLogo(window.chart.base, window.chart.original_symbol, window.chart.market);
            logo.innerHTML = `<img src="${logoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;"><div class="icon-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${symbol.charAt(0)}</div>`;
        }

        document.querySelector('.side-toolbar').style.display = 'none';
        const svg = document.getElementById('seasonals-full-svg');
        if (svg) svg.innerHTML = `<text x="${svg.clientWidth / 2}" y="${svg.clientHeight / 2}" fill="#787b86" text-anchor="middle" dominant-baseline="middle" font-size="16px">Loading historical data...</text>`;

        try {
            const apiBase = 'http://localhost:5000/api/v1';
            const marketParam = (this.parent.currentMarket === 'stock' ? 'stocks' : this.parent.currentMarket) || 'crypto';
            const res = await fetch(`${apiBase}/market/history?symbol=${symbol.toUpperCase()}&timeframe=1d&market=${marketParam}&limit=4000&exchange=${window.chart?.exchange || ''}`);
            const responseData = await res.json();
            const candles = responseData.candles || [];

            if (candles.length > 0) {
                this.seasonalCandles = candles.sort((a, b) => a.timestamp - b.timestamp);
                this.earliestSeasonalTs = this.seasonalCandles[0].timestamp;
                this.fullSeasonalsResults = this.processSeasonalData(this.seasonalCandles);
                const currentYear = new Date().getUTCFullYear();
                this.currentEndYear = currentYear;
                this.minAllowedYear = Math.max(currentYear - 9, new Date(this.earliestSeasonalTs).getUTCFullYear());
                this.currentStartYear = Math.max(currentYear - 2, this.minAllowedYear);
                
                this.initFullSeasonals();
                this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);
            }
        } catch (e) { console.error("Error opening full seasonal view:", e); }
    }

    initFullSeasonals() {
        if (this.fullSeasonalsInitialized) return;
        this.fullSeasonalsInitialized = true;
        const svg = document.getElementById('seasonals-full-svg');
        if (!svg) return;

        svg.addEventListener('mousemove', (e) => {
            const rect = svg.getBoundingClientRect();
            const width = 1000, padding = 40;
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            let day = Math.round(((relX - padding) / (width - 2 * padding)) * 366);
            day = Math.max(0, Math.min(366, day));
            this.fullHoverDay = day;
            this.fullHoverPos = { clientX: e.clientX, clientY: e.clientY };
            this.refreshSeasonalHover(false);
        });

        svg.addEventListener('mouseleave', () => {
            this.fullHoverDay = null; this.fullHoverPos = null;
            const ft = document.getElementById('seasonals-full-tooltip'); if (ft) ft.style.display = 'none';
            svg.querySelector('.seasonal-full-hover-line')?.remove();
            svg.querySelectorAll('.seasonal-full-hover-dot').forEach(d => d.remove());
        });
    }

    renderFullSeasonalsChart(results, startYear, endYear) {
        const svg = document.getElementById('seasonals-full-svg'), labelCol = document.getElementById('seasonals-full-labels');
        if (!svg || !labelCol) return;

        const width = 1000, height = 500, padding = 40;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = '';
        labelCol.innerHTML = '';

        const filtered = {};
        for (let y = startYear; y <= endYear; y++) if (results[y]) filtered[y] = results[y];

        const valProp = this.seasonalViewMode === 'percentage' ? 'percentage' : 'regular';
        let allVals = [];
        Object.values(filtered).forEach(yr => allVals = allVals.concat(yr.data.map(d => d[valProp])));
        
        const avgData = this.calculateSeasonalAverage(filtered, valProp);
        if (this.showSeasonalAverage) allVals = allVals.concat(avgData.map(d => d.val));

        if (allVals.length === 0) return;
        const max = Math.max(...allVals, 1), min = Math.min(...allVals, -1), range = max - min;
        const getY = (v) => height - padding - (((v - min) / range) * (height - 2 * padding));
        const getX = (d) => padding + (d / 366) * (width - 2 * padding);

        let bg = `<line x1="${padding}" y1="${getY(0)}" x2="${width - padding}" y2="${getY(0)}" stroke="#363a45" stroke-width="1" />`;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const offsets = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        offsets.forEach((o, i) => {
            const x = getX(o);
            bg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="#2a2e39" stroke-dasharray="4,4" />`;
            bg += `<text x="${x + 5}" y="${height - 10}" fill="#787b86" font-size="12">${months[i]}</text>`;
        });
        svg.innerHTML = bg;

        Object.keys(filtered).forEach(yr => {
            const yrData = filtered[yr];
            let dAttr = `M ${getX(yrData.data[0].day)} ${getY(yrData.data[0][valProp])}`;
            for (let i = 1; i < yrData.data.length; i++) dAttr += ` L ${getX(yrData.data[i].day)} ${getY(yrData.data[i][valProp])}`;
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", dAttr); p.setAttribute("stroke", yrData.color); p.setAttribute("fill", "none");
            p.setAttribute("stroke-width", yr == endYear ? "3" : "1.5"); p.setAttribute("opacity", yr == endYear ? "1" : "0.5");
            svg.appendChild(p);

            const lbl = document.createElement('div');
            lbl.className = 'seasonal-label';
            lbl.innerHTML = `<span class="seasonal-label-color" style="background: ${yrData.color}"></span><span class="seasonal-label-text">${yr}</span>`;
            labelCol.appendChild(lbl);
        });

        if (this.showSeasonalAverage && avgData.length > 1) {
            let dAttr = `M ${getX(avgData[0].day)} ${getY(avgData[0].val)}`;
            for (let i = 1; i < avgData.length; i++) dAttr += ` L ${getX(avgData[i].day)} ${getY(avgData[i].val)}`;
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", dAttr); p.setAttribute("stroke", "#ffffff"); p.setAttribute("fill", "none");
            p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-dasharray", "5,5");
            svg.appendChild(p);
            const lbl = document.createElement('div');
            lbl.className = 'seasonal-label';
            lbl.innerHTML = `<span class="seasonal-label-color" style="background: #ffffff; border: 1px dashed #000;"></span><span class="seasonal-label-text">Average</span>`;
            labelCol.appendChild(lbl);
        }
    }

    calculateSeasonalAverage(filtered, valProp) {
        if (!this.showSeasonalAverage) return [];
        const years = Object.keys(filtered);
        if (years.length === 0) return [];
        let maxD = 0;
        const yearMaps = {};
        years.forEach(y => {
            const data = filtered[y].data;
            const map = {}; data.forEach(p => map[p.day] = p);
            maxD = Math.max(maxD, data[data.length - 1].day);
            yearMaps[y] = { map, start: data[0].day, end: data[data.length - 1].day };
        });

        const avg = [];
        for (let d = 0; d <= maxD; d++) {
            let sum = 0, count = 0;
            years.forEach(y => {
                const info = yearMaps[y];
                if (d >= info.start && d <= info.end && info.map[d]) {
                    sum += info.map[d][valProp]; count++;
                }
            });
            if (count > 0) avg.push({ day: d, val: sum / count });
        }
        return avg;
    }

    closeSeasonalsView() {
        document.getElementById('seasonals-view-container').style.display = 'none';
        document.querySelector('.side-toolbar').style.display = 'flex';
        if (window.chart) {
            window.chart.legendOverlay.style.display = 'block';
            window.chart.tradingPanel.style.display = 'block';
        }
    }

    refreshSeasonalHover(isSidebar = true) {
        const day = isSidebar ? this.sidebarHoverDay : this.fullHoverDay;
        const pos = isSidebar ? this.sidebarHoverPos : this.fullHoverPos;
        const svg = document.getElementById(isSidebar ? 'seasonals-svg' : 'seasonals-full-svg');
        const tooltip = document.getElementById(isSidebar ? 'seasonal-tooltip' : 'seasonals-full-tooltip');
        if (!svg || !tooltip || day === null) return;

        const width = isSidebar ? 400 : 1000, height = isSidebar ? 150 : 500, padding = isSidebar ? 20 : 40;
        const getX = (d) => padding + (d / 366) * (width - 2 * padding);
        const x = getX(day);

        svg.querySelector(isSidebar ? '.seasonal-hover-line' : '.seasonal-full-hover-line')?.remove();
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x); line.setAttribute("y1", isSidebar ? 0 : padding);
        line.setAttribute("x2", x); line.setAttribute("y2", isSidebar ? height - 30 : height - padding);
        line.setAttribute("class", isSidebar ? "seasonal-hover-line" : "seasonal-full-hover-line");
        svg.appendChild(line);

        const filtered = {};
        if (isSidebar) {
            const avail = Object.keys(this.seasonalData).map(Number).sort((a, b) => b - a);
            const start = avail[Math.min(2, avail.length - 1)];
            avail.forEach(y => { if (y >= start) filtered[y] = { data: this.seasonalData[y], color: this.seasonalColors[y] }; });
        } else {
            for (let y = this.currentStartYear; y <= this.currentEndYear; y++) if (this.fullSeasonalsResults[y]) filtered[y] = this.fullSeasonalsResults[y];
        }

        const valProp = (!isSidebar && this.seasonalViewMode === 'regular') ? 'regular' : 'percentage';
        let tipHtml = `<div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #363a45; padding-bottom: 3px;">Day ${day}</div>`;
        
        svg.querySelectorAll(isSidebar ? '.seasonal-sidebar-hover-dot' : '.seasonal-full-hover-dot').forEach(d => d.remove());
        
        // Find Y range for dot placement
        let allVals = [];
        Object.values(filtered).forEach(yr => allVals = allVals.concat(yr.data.map(d => d[valProp])));
        const max = Math.max(...allVals, 1), min = Math.min(...allVals, -1), range = max - min;
        const getY = (v) => (isSidebar ? 150 - 30 : 500 - 40) - (((v - min) / range) * (isSidebar ? 150 - 20 - 30 : 500 - 2 * 40));

        Object.keys(filtered).sort((a, b) => b - a).forEach(yr => {
            const data = filtered[yr].data;
            const point = data.find(p => p.day === day) || data.reduce((prev, curr) => Math.abs(curr.day - day) < Math.abs(prev.day - day) ? curr : prev);
            const val = point[valProp];
            const dotY = getY(val);
            
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x); dot.setAttribute("cy", dotY); dot.setAttribute("r", isSidebar ? "3" : "4");
            dot.setAttribute("fill", filtered[yr].color); dot.setAttribute("stroke", "#000");
            dot.setAttribute("class", isSidebar ? "seasonal-sidebar-hover-dot" : "seasonal-full-hover-dot");
            svg.appendChild(dot);

            tipHtml += `<div style="display: flex; justify-content: space-between; gap: 20px; color: ${filtered[yr].color}">
                <span>${yr}:</span>
                <span>${val >= 0 ? '+' : ''}${val.toFixed(2)}${valProp === 'percentage' ? '%' : ''}</span>
            </div>`;
        });

        tooltip.innerHTML = tipHtml;
        tooltip.style.display = 'block';
        tooltip.style.left = (pos.clientX + 15) + 'px';
        tooltip.style.top = (pos.clientY - 20) + 'px';
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    getMonthBoundaries(year) {
        return this.isLeapYear(year)
            ? [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
            : [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    }

    getNiceInterval(range) {
        if (range <= 0) return 1;
        const rawInterval = range / 7;
        const mag = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const res = rawInterval / mag;
        const interval = res < 1.5 ? 1 : res < 3 ? 2 : res < 7 ? 5 : 10;
        return interval * mag;
    }

    getContrastColor(hex) {
        if (!hex) return '#ffffff';
        const color = hex.replace('#', '');
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 150) ? '#000000' : '#ffffff';
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    }

    async loadMoreSeasonalHistory() {
        return; // Data is loaded in bulk via openSeasonalsView
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

    // ─── Table ──────────────────────────────────────────────────────────────

    initTableToggles() {
        const btnChart = document.getElementById('seasonals-btn-chart');
        const btnTable = document.getElementById('seasonals-btn-table');
        const chartWrapper = document.getElementById('seasonals-full-chart');
        const tableWrapper = document.getElementById('seasonals-full-table');
        const csvBtn = document.getElementById('btn-export-csv');
        if (!btnChart || !btnTable || !chartWrapper || !tableWrapper) return;

        const syncExportMenu = () => {
            if (csvBtn) csvBtn.style.display = (tableWrapper.style.display === 'block') ? 'flex' : 'none';
        };

        btnChart.onclick = () => {
            btnChart.classList.add('active'); btnTable.classList.remove('active');
            chartWrapper.style.display = 'block'; tableWrapper.style.display = 'none';
            syncExportMenu();
        };
        btnTable.onclick = () => {
            btnTable.classList.add('active'); btnChart.classList.remove('active');
            chartWrapper.style.display = 'none'; tableWrapper.style.display = 'block';
            syncExportMenu();
            this.renderSeasonalTable(this.fullSeasonalsResults);
        };
        syncExportMenu();
    }

    renderSeasonalTable(results) {
        const tableContainer = document.getElementById('seasonals-full-table');
        if (!tableContainer || !results) return;
        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';
        const startYear = Math.min(this.currentStartYear, this.currentEndYear);
        const endYear = Math.max(this.currentStartYear, this.currentEndYear);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const mBounds = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];

        let tableHtml = `<table class="seasonal-table"><thead><tr><th style="position: sticky; left: 0; z-index: 5;">Date</th>`;
        months.forEach(m => tableHtml += `<th>${m}</th>`);
        tableHtml += `<th style="border-left: 1px solid #363c4e; color: #2962ff">Total</th></tr></thead><tbody>`;

        const years = Object.keys(results).map(Number).filter(y => y >= startYear && y <= endYear).sort((a, b) => b - a);
        const yearPerformance = {};

        years.forEach(year => {
            const data = results[year].data;
            yearPerformance[year] = { months: [] };
            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m], endDay = m === 11 ? 366 : mBounds[m + 1];
                const startPt = data.find(p => p.day === startDay) || [...data].reverse().find(p => p.day <= startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || [...data].reverse().find(p => p.day <= endDay) || data[data.length - 1];
                let perf = isPercent
                    ? ((1 + endPt.percentage / 100) / (1 + (m === 0 ? 0 : startPt.percentage) / 100) - 1) * 100
                    : endPt.regular - startPt.regular;
                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                yearPerformance[year].months[m] = perf;
            }
            const lastPt = data[data.length - 1];
            yearPerformance[year].total = isPercent ? lastPt.percentage : (lastPt.regular - data[0].regular);
        });

        years.forEach(year => {
            tableHtml += `<tr><td style="position: sticky; left: 0; z-index: 4;">${year}</td>`;
            for (let m = 0; m < 12; m++) tableHtml += this.formatTableCell(yearPerformance[year].months[m], isPercent);
            tableHtml += this.formatTableCell(yearPerformance[year].total, isPercent, true) + `</tr>`;
        });

        if (this.showSeasonalAverage) {
            tableHtml += `<tr class="footer-row"><td style="position: sticky; left: 0; z-index: 4;">Average</td>`;
            for (let m = 0; m < 12; m++) {
                let sum = 0, count = 0;
                years.forEach(y => { const val = yearPerformance[y].months[m]; if (val !== null && !isNaN(val)) { sum += val; count++; } });
                tableHtml += this.formatTableCell(sum / years.length, isPercent);
            }
            tableHtml += this.formatTableCell(years.reduce((s, y) => s + (yearPerformance[y].total || 0), 0) / years.length, isPercent, true) + `</tr>`;
        }

        // Rise/Fall row
        tableHtml += `<tr class="footer-row"><td style="position: sticky; left: 0; z-index: 4;">Rises and falls</td>`;
        for (let m = 0; m < 12; m++) {
            let up = 0, down = 0;
            years.forEach(y => { const v = yearPerformance[y].months[m]; if (v > 0) up++; else if (v < 0) down++; });
            tableHtml += `<td><div class="rise-fall-text"><span class="rise-text">▲${up}</span> <span class="fall-text">▼${down}</span></div></td>`;
        }
        let yUp = 0, yDown = 0;
        years.forEach(y => { if (yearPerformance[y].total > 0) yUp++; else if (yearPerformance[y].total < 0) yDown++; });
        tableHtml += `<td class="year-column"><div class="rise-fall-text"><span class="rise-text">▲${yUp}</span> <span class="fall-text">▼${yDown}</span></div></td></tr></tbody></table>`;
        tableContainer.innerHTML = tableHtml;
    }

    formatTableCell(val, isPercent, isYear = false) {
        if (val === null || isNaN(val)) return `<td>—</td>`;
        const cls = val > 0 ? 'cell-up' : (val < 0 ? 'cell-down' : 'cell-neutral');
        const sign = val > 0 ? '+' : (val < 0 ? '-' : '');
        const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `<td class="month-cell seasonal-cell ${cls}${isYear ? ' year-column' : ''}" style="color: #ffffff">${sign}${formatted}${isPercent ? '%' : ''}</td>`;
    }

    // ─── Export ──────────────────────────────────────────────────────────────

    async exportSeasonalAsImage(mode) {
        const chartView = document.getElementById('seasonals-full-chart');
        if (chartView && chartView.style.display === 'none') return this.exportSeasonalTableAsImage(mode);

        const svg = document.getElementById('seasonals-full-svg');
        const container = chartView;
        if (!container || !svg) { alert("Export failed: Required chart elements not found."); return; }

        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        try {
            const targetWidth = 2560, targetHeight = 1440, s = targetWidth / 1000;
            await this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear, targetWidth, targetHeight);
            await new Promise(resolve => requestAnimationFrame(resolve));

            const padding = 25 * s, headerHeight = 55 * s;
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 2;
            canvas.width = (targetWidth + padding * 2) * dpr;
            canvas.height = (targetHeight + headerHeight + padding * 2) * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            // Header
            const ticker = document.getElementById('detail-symbol')?.textContent || 'CHART';
            ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(20 * s)}px Arial`;
            ctx.textAlign = 'left'; ctx.fillText(ticker, padding + 10 * s, padding + 24 * s);

            // SVG to canvas
            const svgClone = svg.cloneNode(true);
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('width', targetWidth); svgClone.setAttribute('height', targetHeight);
            const svgBlob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
            ctx.drawImage(img, padding, padding + headerHeight, targetWidth, targetHeight);
            URL.revokeObjectURL(url);

            await this.renderFullSeasonalsChart(this.fullSeasonalsResults, this.currentStartYear, this.currentEndYear);

            if (mode === 'download') {
                const link = document.createElement('a');
                link.download = `seasonal_${ticker.replace('/', '_')}.png`;
                link.href = canvas.toDataURL('image/png'); link.click();
            } else {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                alert("Image copied to clipboard!");
            }
        } catch (err) { console.error("Export failed:", err); alert("Export failed: " + err.message); }
        finally { document.body.style.cursor = originalCursor; }
    }

    async exportSeasonalTableAsImage(mode) {
        const results = this.fullSeasonalsResults;
        const years = [...(this.selectedYears || [])].sort((a, b) => b - a);
        if (!results || years.length === 0) return;

        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const s = 1200 / 900;
        const padding = 25 * s, headerHeight = 70 * s, rowHeight = 40 * s;
        const dateColWidth = 80 * s, monthColWidth = 80 * s, yearColWidth = 95 * s;
        const tableWidth = dateColWidth + (monthColWidth * 12) + yearColWidth;
        const rowCount = years.length + 1 + (this.showSeasonalAverage ? 1 : 0) + 1;
        const canvasWidth = tableWidth + padding * 2;
        const canvasHeight = rowCount * rowHeight + headerHeight + padding + (24 * s);

        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 2;
        canvas.width = canvasWidth * dpr; canvas.height = canvasHeight * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const ticker = document.getElementById('detail-symbol')?.textContent || 'SYMBOL';
        ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(20 * s)}px Arial`;
        ctx.textAlign = 'left'; ctx.fillText(ticker, padding, padding + 24 * s);

        // Table header
        let curY = padding + headerHeight;
        ctx.fillStyle = '#787b86'; ctx.font = `bold ${Math.round(13 * s)}px Arial`; ctx.textAlign = 'center';
        ctx.fillText("Year", padding + dateColWidth / 2, curY + 25 * s);
        for (let i = 0; i < 12; i++) ctx.fillText(monthNames[i], padding + dateColWidth + i * monthColWidth + monthColWidth / 2, curY + 25 * s);
        ctx.fillText("Total", padding + tableWidth - yearColWidth / 2, curY + 25 * s);
        curY += rowHeight;

        // Data rows
        ctx.font = `${Math.round(12.5 * s)}px Arial`;
        years.forEach(year => {
            const data = results[year].data;
            const mBounds = this.getMonthBoundaries(year);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.fillText(year, padding + dateColWidth / 2, curY + 25 * s);
            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m], endDay = m === 11 ? 366 : mBounds[m + 1];
                const startPt = data.find(p => p.day === startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || data[data.length - 1];
                let perf = isPercent ? (((1 + endPt.percentage / 100) / (1 + (startPt.percentage || 0) / 100) - 1) * 100) : (endPt.regular - startPt.regular);
                const x = padding + dateColWidth + m * monthColWidth;
                if (perf !== null) {
                    ctx.fillStyle = perf > 0 ? 'rgba(8,153,129,0.45)' : 'rgba(242,54,69,0.45)';
                    ctx.fillRect(x + 1, curY + 1, monthColWidth - 2, rowHeight - 2);
                }
                ctx.fillStyle = '#ffffff';
                ctx.fillText(perf === null ? '—' : ((perf > 0 ? '+' : '') + perf.toFixed(2) + (isPercent ? '%' : '')), x + monthColWidth / 2, curY + 25 * s);
            }
            const lastPt = data[data.length - 1];
            const total = isPercent ? lastPt.percentage : (lastPt.regular - data[0].regular);
            const tx = padding + tableWidth - yearColWidth;
            ctx.fillStyle = total > 0 ? 'rgba(8,153,129,0.45)' : 'rgba(242,54,69,0.45)';
            ctx.fillRect(tx + 1, curY + 1, yearColWidth - 2, rowHeight - 2);
            ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(13 * s)}px Arial`;
            ctx.fillText((total > 0 ? '+' : '') + total.toFixed(2) + (isPercent ? '%' : ''), tx + yearColWidth / 2, curY + 25 * s);
            ctx.font = `${Math.round(12.5 * s)}px Arial`;
            curY += rowHeight;
        });

        if (mode === 'download') {
            const link = document.createElement('a'); link.download = `seasonal_table_${ticker.replace('/', '_')}.png`;
            link.href = canvas.toDataURL('image/png'); link.click();
        } else {
            canvas.toBlob(async blob => {
                try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert("Table image copied!"); }
                catch (err) { alert("Could not copy. Try downloading."); }
            }, 'image/png');
        }
    }

    exportSeasonalToCSV() {
        const results = this.fullSeasonalsResults;
        const years = [...(this.selectedYears || [])].sort((a, b) => b - a);
        if (!results || years.length === 0) return;

        const valProp = this.seasonalViewMode || 'percentage';
        const isPercent = valProp === 'percentage';
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const ticker = document.getElementById('detail-symbol')?.textContent || 'SYMBOL';

        let csvRows = [`Ticker,${ticker}`, `Exported At,${new Date().toLocaleString()}`, '', ["Year", ...monthNames, "Total"].join(',')];

        years.forEach(year => {
            const data = results[year].data;
            const mBounds = this.getMonthBoundaries(year);
            const rowArr = [year];
            for (let m = 0; m < 12; m++) {
                const startDay = mBounds[m], endDay = m === 11 ? 366 : mBounds[m + 1];
                const startPt = data.find(p => p.day === startDay) || data[0];
                const endPt = data.find(p => p.day === endDay) || data[data.length - 1];
                let perf = isPercent ? (((1 + endPt.percentage / 100) / (1 + (startPt.percentage || 0) / 100) - 1) * 100) : (endPt.regular - startPt.regular);
                if (endPt.day <= startPt.day && m > 0 && endPt.day < endDay - 5) perf = null;
                rowArr.push(perf === null ? '' : perf.toFixed(2) + (isPercent ? '%' : ''));
            }
            const lastPt = data[data.length - 1];
            rowArr.push((isPercent ? lastPt.percentage : lastPt.regular - data[0].regular).toFixed(2) + (isPercent ? '%' : ''));
            csvRows.push(rowArr.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `seasonal_${ticker.replace('/', '_')}.csv`; link.click();
    }
}
