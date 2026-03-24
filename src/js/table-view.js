export class TableViewController {
    constructor(chart) {
        this.chart = chart;
        this.container = document.getElementById('table-view-container');
        this.tbody = document.getElementById('table-view-body');
        this.closeBtn = document.getElementById('table-view-close');
        this.titleEl = document.getElementById('table-view-title');
        this.subtitleEl = document.getElementById('table-view-subtitle');
        this.dateHeaderEl = document.getElementById('table-view-date-header');
        this.mainToolbar = document.querySelector('.side-toolbar');
        this.chartContainer = document.getElementById('chart-container');
        
        this.init();
    }

    init() {
        if (!this.container || !this.closeBtn) return;

        this.closeBtn.addEventListener('click', () => this.hide());
        
        this.scrollArea = this.container.querySelector('div[style*="overflow-y: auto"]');
        if (this.scrollArea) {
            this.scrollArea.addEventListener('scroll', () => {
                // If scrolled to bottom (within 100px)
                if (this.scrollArea.scrollTop + this.scrollArea.clientHeight >= this.scrollArea.scrollHeight - 100) {
                    if (this.sortedData && this.currentIndex < this.sortedData.length) {
                        this.renderChunk(this.currentIndex, 50);
                    }
                }
            });
        }

        // Listen for real-time data updates from Chartify
        window.addEventListener('chartify:realtime-update', (e) => {
            if (e.detail.chart === this.chart && this.container.style.display === 'flex') {
                this.updateRealtimeRow(this.chart.data);
            }
        });

        // Listen for complete data reloads (e.g. timeframe change)
        window.addEventListener('chartify:data-loaded', (e) => {
            if (e.detail.chart === this.chart && this.container.style.display === 'flex') {
                this.renderData(this.chart.data);
            }
        });
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[date.getDay()];
        const dayNum = date.getDate().toString().padStart(2, '0');
        const monthName = months[date.getMonth()];
        const year = date.getFullYear().toString().slice(-2);
        
        let output = `${dayName} ${dayNum} ${monthName} '${year}`;

        // Include time if timeframe is intraday
        if (this.chart && this.chart.timeframe) {
            const tf = this.chart.timeframe.toLowerCase();
            if (tf.includes('m') || tf.includes('h')) {
                const hours = date.getHours().toString().padStart(2, '0');
                const mins = date.getMinutes().toString().padStart(2, '0');
                output += ` ${hours}:${mins}`;
            }
        }

        return output;
    }

    formatNumber(num) {
        if (num === undefined || num === null) return '---';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    show() {
        if (!this.chart || !this.chart.data || this.chart.data.length === 0) return;

        // Hide left toolbar to allow table to cover its area
        if (this.mainToolbar) this.mainToolbar.style.display = 'none';

        // Hide chart legend if it exists
        if (this.chart.legendOverlay) {
            this.chart.legendOverlay.style.display = 'none';
        }

        // Show table (overlays chart)
        this.container.style.display = 'flex';

        // Update headers based on chart symbol
        const symbol = this.chart.symbol || 'Unknown';

        if (this.titleEl) this.titleEl.textContent = symbol;
        if (this.subtitleEl) this.subtitleEl.textContent = symbol;

        this.renderData(this.chart.data);
    }

    hide() {
        // Hide table, revealing chart elements underneath
        this.container.style.display = 'none';
        
        // Restore left toolbar
        if (this.mainToolbar) this.mainToolbar.style.display = 'flex';

        // Show chart legend back
        if (this.chart.legendOverlay) {
            this.chart.legendOverlay.style.display = 'flex';
        }
    }

    renderData(data) {
        if (!this.tbody) return;
        this.tbody.innerHTML = '';

        // Clone and sort data descending (newest first)
        this.sortedData = [...data].sort((a, b) => b.timestamp - a.timestamp);
        this.currentIndex = 0;

        // Update Date column header to reflect current timeframe
        if (this.dateHeaderEl && this.chart && this.chart.timeframe) {
            this.dateHeaderEl.textContent = `Date • ${this.chart.timeframe.toUpperCase()}`;
        }

        // Render initial batch
        this.renderChunk(0, 50);
    }

    renderChunk(startIndex, count) {
        if (!this.sortedData) return;

        const endIndex = Math.min(startIndex + count, this.sortedData.length);
        
        for (let index = startIndex; index < endIndex; index++) {
            const candle = this.sortedData[index];
            const prevCandle = this.sortedData[index + 1];
            
            let changeVal = 0;
            let changePct = 0;

            if (candle.close !== undefined && candle.open !== undefined) {
                const referencePrice = prevCandle ? prevCandle.close : candle.open;
                changeVal = candle.close - referencePrice;
                changePct = referencePrice !== 0 ? (changeVal / referencePrice) * 100 : 0;
            }

            const isPositive = changeVal >= 0;
            const sign = isPositive ? '+' : '';
            const colorClass = isPositive ? 'color: #22ab94;' : 'color: #f23645;';

            const formattedChange = `${sign}${this.formatNumber(changeVal)} (${sign}${changePct.toFixed(2)}%)`;

            const tr = document.createElement('tr');
            tr.dataset.timestamp = candle.timestamp;
            tr.style.borderBottom = '1px solid #2a2e39';
            tr.onmouseover = () => tr.style.backgroundColor = '#1e222d';
            tr.onmouseout = () => tr.style.backgroundColor = 'transparent';

            tr.innerHTML = `
                <td style="padding: 12px 16px; text-align: left; color: #d1d4dc;">${this.formatDate(candle.timestamp)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(candle.open)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(candle.high)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(candle.low)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(candle.close)}</td>
                <td style="padding: 12px 24px; ${colorClass}">${formattedChange}</td>
            `;
            this.tbody.appendChild(tr);
        }

        this.currentIndex = endIndex;
    }

    updateRealtimeRow(data) {
        if (!this.tbody || !data || data.length === 0) return;
        
        // The newest candle is always at the end of the data array
        const newest = data[data.length - 1]; 
        const prevCandle = data.length > 1 ? data[data.length - 2] : null;

        let changeVal = 0;
        let changePct = 0;
        if (newest.close !== undefined && newest.open !== undefined) {
            const referencePrice = prevCandle ? prevCandle.close : newest.open;
            changeVal = newest.close - referencePrice;
            changePct = referencePrice !== 0 ? (changeVal / referencePrice) * 100 : 0;
        }

        const isPositive = changeVal >= 0;
        const sign = isPositive ? '+' : '';
        const colorClass = isPositive ? 'color: #22ab94;' : 'color: #f23645;';
        const formattedChange = `${sign}${this.formatNumber(changeVal)} (${sign}${changePct.toFixed(2)}%)`;

        const firstRow = this.tbody.firstElementChild;
        
        if (firstRow && firstRow.dataset.timestamp == newest.timestamp) {
            // Update existing row
            firstRow.cells[1].textContent = this.formatNumber(newest.open);
            firstRow.cells[2].textContent = this.formatNumber(newest.high);
            firstRow.cells[3].textContent = this.formatNumber(newest.low);
            firstRow.cells[4].textContent = this.formatNumber(newest.close);
            firstRow.cells[5].textContent = formattedChange;
            firstRow.cells[5].style = `padding: 12px 24px; ${colorClass}`;
        } else {
            // It's a completely new candle, prepend a new row
            const tr = document.createElement('tr');
            tr.dataset.timestamp = newest.timestamp;
            tr.style.borderBottom = '1px solid #2a2e39';
            tr.onmouseover = () => tr.style.backgroundColor = '#1e222d';
            tr.onmouseout = () => tr.style.backgroundColor = 'transparent';
            
            tr.innerHTML = `
                <td style="padding: 12px 16px; text-align: left; color: #d1d4dc;">${this.formatDate(newest.timestamp)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(newest.open)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(newest.high)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(newest.low)}</td>
                <td style="padding: 12px 24px;">${this.formatNumber(newest.close)}</td>
                <td style="padding: 12px 24px; ${colorClass}">${formattedChange}</td>
            `;
            this.tbody.insertBefore(tr, firstRow);
        }
    }
}
