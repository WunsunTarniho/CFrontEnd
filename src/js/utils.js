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

// Maps custom timezone options (from index.html) to standard IANA timezone names
export function getIANAFromCustomTimezone(tz) {
    // 1. If 'Local' or empty, use the browser's own resolved timezone
    if (!tz || tz === 'Local' || tz === 'default') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
    
    // 2. Direct mappings for legacy/common selections in index.html
    const mapping = {
        'UTC+7': 'Asia/Jakarta',
        'UTC': 'UTC',
        'UTC+1': 'Europe/London',
        'UTC+8': 'Asia/Singapore',
        'UTC-5': 'America/New_York'
    };
    
    if (mapping[tz]) return mapping[tz];
    
    // 3. Handled generic UTC codes (e.g. UTC+4)
    if (tz.startsWith('UTC') && (tz.includes('+') || tz.includes('-'))) {
        const offset = parseInt(tz.replace('UTC', '')) || 0;
        // Inverting sign for Etc/GMT format (Etc/GMT-7 is actually UTC+7)
        const etcSign = offset >= 0 ? '-' : '+';
        return `Etc/GMT${etcSign}${Math.abs(offset)}`;
    }
    
    // 4. Otherwise, assume it's already a valid IANA name (e.g. 'Europe/Paris')
    return tz; 
}

// Timezone clock synchronized with chart settings
export function updateClock() {
    const clockEl = document.getElementById('current-time');
    if (!clockEl) return;

    // Default to 'Local' if not yet defined
    const selectedTz = (window.chart && window.chart.timezone) ? window.chart.timezone : 'Local';
    const ianaTz = getIANAFromCustomTimezone(selectedTz);

    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { 
            hour12: false, 
            timeZone: ianaTz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Calculate the actual UTC offset and region name
        let offsetStr = 'UTC';
        let regionStr = '';
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: ianaTz,
                timeZoneName: 'shortOffset'
            }).formatToParts(now);
            const tzPart = parts.find(p => p.type === 'timeZoneName');
            offsetStr = tzPart ? tzPart.value.replace('GMT', 'UTC') : 'UTC';
            if (offsetStr === 'GMT') offsetStr = 'UTC';

            // Extract region/city from IANA name (e.g. Asia/Jakarta -> Jakarta)
            if (ianaTz.includes('/')) {
                regionStr = ianaTz.split('/').pop().replace(/_/g, ' ');
            } else if (ianaTz === 'UTC') {
                regionStr = 'UTC';
            } else {
                regionStr = ianaTz;
            }
        } catch (e) {
            offsetStr = selectedTz.startsWith('UTC') ? selectedTz : 'UTC';
            regionStr = selectedTz;
        }

        const displayRegion = regionStr ? ` ${regionStr}` : '';
        clockEl.textContent = `${timeStr} ${offsetStr}${displayRegion}`;
    } catch (e) {
        // Fallback to local time if timezone invalid
        const localTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        clockEl.textContent = `${localTime} (Local)`;
    }
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
    document.querySelectorAll('[data-tf]').forEach(o => {
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
    if (s.endsWith('.P')) return s;
    if (s.includes('.')) s = s.split('.')[0];
    return s;
}

export function getTickerLogo(ticker, currency = '', market = 'crypto') {
    let fullTicker = (ticker || "").toUpperCase();
    let symbol = fullTicker;

    // 1. Handle Global Indices (Yahoo Style: ^SPX, ^DJI, ^IXIC)
    if (symbol.startsWith('^')) {
        const index = symbol.substring(1).toUpperCase();
        if (index === 'SPX' || index === 'SPY') return 'https://static.wikia.nocookie.net/logopedia/images/4/4b/S%26P_500_logo.svg.png';
        if (index === 'DJI') return 'https://www.spglobal.com/spdji/en/idbi/dow-jones-industrial-average.png';
        if (index === 'IXIC' || index === 'NDX') return 'https://www.nasdaq.com/favicon.ico';
        if (index === 'VIX') return 'https://www.cboe.com/favicon.ico';
        return 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.17.2/128/color/snp.png'; // Verified
    }

    // 2. Handle Forex and Metals (Yahoo Style: EURUSD=X, XAUUSD=X)
    if (symbol.endsWith('=X') || market === 'forex') {
        const base = symbol.replace('=X', '').substring(0, 3).toLowerCase();
        if (base === 'xau' || base === 'xag') return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.17.2/128/color/${base}.png`; // Verified
        return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.17.2/128/color/${base}.png`; // Verified
    }

    if (market === 'crypto' || !market) {
        // Strip .P suffix for Perpetual Futures icons
        symbol = symbol.replace('.P', '');
        if (market === 'crypto') {
            symbol = symbol.replace(currency.toUpperCase(), '')
        }
        // Very reliable crypto icon source
        return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.17.2/128/color/${symbol.toLowerCase()}.png`;
    } else {
        if (currency.toLowerCase() === 'usd') {
            symbol = symbol.split('.')[0]
        }
        // Ticker Logos repo is a high-quality community maintained source
        return `https://companiesmarketcap.com/img/company-logos/64/${symbol.toUpperCase()}.png`;
    }
}

export function getExchangeLogo(exchange, micCode = '') {
    if (!exchange && !micCode) return null;
    const ex = (exchange || "").toLowerCase();
    const mic = (micCode || "").toUpperCase();
    
    // 1. First Priority: Canonical MIC Code (Standard Global Identifiers)
    // This allows automatic support for 2000+ stock exchanges worldwide
    if (mic && mic.length === 4) {
        return `https://static.twelvedata.com/logos/exchanges/${mic}.png`;
    }

    // 2. Second Priority: Major Exchange Direct Mapping (Common Stock/Crypto)
    // High-consistency logos using official favicon sources (Verified)
    if (ex.includes('binance')) return 'https://public.bnbstatic.com/20190405/eb2349c3-b2f8-4a93-a286-8f86a62ea9d8.png';
    if (ex.includes('kucoin')) return 'https://www.kucoin.com/logo.png';
    if (ex.includes('kraken')) return 'https://www.kraken.com/favicon.ico';
    if (ex.includes('coinbase') || ex === 'cb' || ex === 'gdax') return 'https://www.coinbase.com/favicon.ico';
    // if (ex.includes('huobi') || ex === 'htx') return 'https://www.htx.com/favicon.ico';
    if (ex.includes('okx')) return 'https://www.okx.com/favicon.ico';
    if (ex.includes('bybit')) return 'https://www.bybit.com/favicon.ico';
    if (ex.includes('gateio')) return 'https://www.gate.io/favicon.ico';
    if (ex.includes('mexc')) return 'https://static.mocortech.com/image-host/web/favicon/favicon.ico';
    if (ex.includes('nasdaq')) return 'https://www.nasdaq.com/favicon.ico';
    if (ex.includes('nyse')) return 'https://www.nyse.com/favicon.ico';

    // 3. Third Priority: Domain Inference (Flexible for any exchange name)
    // Try to guess the domain for thousands of other entities
    if (ex.length > 2) {
        // Many exchanges share the name with their domain (e.g. poloniex, bitstamp)
        // We use a high-quality favicon service for broad compatibility
        return `https://www.google.com/s2/favicons?domain=${ex}.com&sz=64`;
    }
    
    // 4. Final Fallback: Stylized Branded Initial (Never a broken image)
    return `https://ui-avatars.com/api/?name=${ex || 'EX'}&background=2a2e39&color=d1d4dc&size=64&font-size=0.5`;
}
