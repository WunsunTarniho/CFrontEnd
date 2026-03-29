// Helper to format date for TwelveData API (YYYY-MM-DD HH:MM:SS)
export function formatTwelveDataDate(timestamp) {
    const date = new Date(timestamp);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${mm}:${ss}`;
}

// Timezone clock
export function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    const offset = -now.getTimezoneOffset() / 60;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    const clockEl = document.getElementById('current-time');
    if (clockEl) clockEl.textContent = `${timeStr} UTC${offsetStr}`;
}

// Enforce numeric constraints on all number inputs
export function setupNumericConstraints() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
            const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
            if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
                if (!e.ctrlKey && !e.metaKey) e.preventDefault();
            }
        }
    });

    document.addEventListener('blur', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
            const input = e.target;
            let val = parseInt(input.value);
            const min = parseInt(input.getAttribute('min'));
            const max = parseInt(input.getAttribute('max'));

            if (isNaN(val)) {
                if (!isNaN(min)) input.value = min;
                return;
            }

            if (!isNaN(min) && val < min) input.value = min;
            if (!isNaN(max) && val > max) input.value = max;

            if (parseInt(input.value) !== val) {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }, true);

    // Instant clamping for visibility inputs
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('visibility-input-small')) {
            const input = e.target;
            const row = input.closest('.visibility-row');
            if (!row) return;
            const inputs = Array.from(row.querySelectorAll('.visibility-input-small'));
            const isFrom = input === inputs[0];
            const other = isFrom ? inputs[1] : inputs[0];

            const maxLimit = parseInt(input.getAttribute('max'));
            if (!isNaN(maxLimit) && parseInt(input.value) > maxLimit) {
                input.value = maxLimit;
            }

            const val = parseInt(input.value);
            const otherVal = parseInt(other.value);

            if (!isNaN(val) && !isNaN(otherVal)) {
                if (isFrom && val > otherVal) {
                    other.value = val;
                    other.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (!isFrom && val < otherVal) {
                    other.value = val;
                    other.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Timeframe popup logic
export function toggleTfPopup() {
    const popup = document.getElementById('tf-popup');
    const backdrop = document.getElementById('tf-backdrop');
    const btn = document.getElementById('tf-trigger');
    const isOpen = popup.classList.contains('open');
    popup.classList.toggle('open', !isOpen);
    backdrop.classList.toggle('open', !isOpen);
    btn.classList.toggle('open', !isOpen);
}

export function closeTfPopup() {
    document.getElementById('tf-popup')?.classList.remove('open');
    document.getElementById('tf-backdrop')?.classList.remove('open');
    document.getElementById('tf-trigger')?.classList.remove('open');
}

export function setTfActive(tf) {
    const label = {
        '1s': '1s', '1m': '1m', '2m': '2m', '3m': '3m', '5m': '5m', '10m': '10m', '15m': '15m', '30m': '30m', '45m': '45m',
        '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
        '1d': '1D', '1w': '1W',
        '1mo': '1M', '3mo': '3M', '6mo': '6M', '12mo': '12M'
    };
    const display = label[tf] || tf.toUpperCase();
    const el = document.getElementById('tf-label');
    if (el) el.textContent = display;
    document.querySelectorAll('.tf-option').forEach(o => {
        o.classList.toggle('active', o.dataset.tf === tf);
    });
}

export function setChartModeActive(mode) {
    const item = document.querySelector(`.chart-type-item[data-mode="${mode}"]`);
    if (!item) return;

    const svgContent = item.querySelector('svg').cloneNode(true);
    svgContent.id = 'current-chart-icon';
    const labelText = item.textContent.trim();

    const currentIcon = document.getElementById('current-chart-icon');
    if (currentIcon) currentIcon.replaceWith(svgContent);

    const currentChartLabel = document.getElementById('current-chart-label');
    if (currentChartLabel) currentChartLabel.textContent = labelText;

    document.querySelectorAll('.chart-type-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
}

export function setSearchTicker(ticker) {
    const el = document.getElementById('search-label');
    if (el) el.textContent = ticker;

}

export function extractSymbol(ticker) {
    let s = (ticker || "").toUpperCase();
    if (s.includes(':')) s = s.split(':').pop();
    if (s.includes('.')) s = s.split('.')[0];
    return s;
}

export function getTickerLogo(ticker, currency = '', market = 'crypto') {
    let fullTicker = (ticker || "").toUpperCase();
    let symbol = fullTicker;

    if (market == 'crypto') {
        symbol = symbol.replace(currency.toUpperCase(), '')
    }

    if (market === 'crypto' || !market) {
        // Very reliable crypto icon source
        return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
    } else {
        if (currency.toLowerCase() == 'usd') {
            symbol = symbol.split('.')[0]
        }

        // Ticker Logos repo is a high-quality community maintained source
        return `https://companiesmarketcap.com/img/company-logos/64/${symbol.toUpperCase()}.png`;
    }
}
