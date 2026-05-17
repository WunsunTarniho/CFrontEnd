    getHeikinAshiData() {
        if (!this.#rawData || this.#rawData.length === 0) return [];
        const haData = [];
        let prevHAOpen = this.#rawData[0].open;
        let prevHAClose = this.#rawData[0].close;

        this.#rawData.forEach((candle, i) => {
            const hClose = (candle.open + candle.high + candle.low + candle.close) / 4;
            const hOpen = (prevHAOpen + prevHAClose) / 2;
            const hHigh = Math.max(candle.high, hOpen, hClose);
            const hLow = Math.min(candle.low, hOpen, hClose);

            haData.push({
                ...candle,
                open: hOpen,
                high: hHigh,
                low: hLow,
                close: hClose,
                timestamp: candle.timestamp
            });

            prevHAOpen = hOpen;
            prevHAClose = hClose;
        });
        return haData;
    }


    getRenkoData(limitRaw = null, brickSizeOverride = null, customRawData = null) {
        if ((!this.#rawData || this.#rawData.length === 0) && !customRawData) return [];

        let rawData = customRawData || this.#rawData;
        if (limitRaw && rawData.length > limitRaw && limitRaw !== Infinity) {
            rawData = rawData.slice(-limitRaw);
        }

        // 1. Calculate brick size
        let brickSize = brickSizeOverride;
        if (brickSize === null) {
            if (this.renkoBoxSizeMethod === 'atr') {
                brickSize = this.calculateATR(this.renkoAtRLength || 14);
            } else if (this.renkoBoxSizeMethod === 'percentage') {
                const latestPrice = rawData.length > 0 ? rawData[rawData.length - 1].close : 100;
                const perc = Number(this.renkoPercentageValue) || 1.0;
                brickSize = latestPrice * (perc / 100);
            } else {
                brickSize = Number(this.renkoBoxSize) || 1.0;
            }
            this._lastRenkoBrickSize = brickSize;
        }

        const getPrice = (c) => {
            switch (this.renkoSource) {
                case 'open': return c.open;
                case 'high': return c.high;
                case 'low': return c.low;
                case 'hl2': return (c.high + c.low) / 2;
                case 'hlc3': return (c.high + c.low + c.close) / 3;
                case 'ohlc4': return (c.open + c.high + c.low + c.close) / 4;
                default: return c.close;
            }
        };

        // Safety floor: Prevent excessively small brick sizes that cause browser hang or massive truncation
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        for (let i = 0; i < this.#rawData.length; i++) {
            const p = getPrice(this.#rawData[i]);
            if (p < minPrice) minPrice = p;
            if (p > maxPrice) maxPrice = p;
        }
        const totalRange = maxPrice - minPrice;

        // Ensure brickSize isn't so small that we'd need more than MAX_TOTAL_BRICKS just to cover the price range
        const maxBricksSafety = 100000;
        const minSafeBrickByRange = totalRange / (maxBricksSafety * 0.8); // 80% buffer
        const firstPrice = getPrice(this.#rawData[0]);
        const minSafeBrickByPrice = firstPrice * 0.00001;

        const finalMinBrick = Math.max(minSafeBrickByRange, minSafeBrickByPrice, 0.00000001);

        if (!brickSize || brickSize < finalMinBrick) {
            brickSize = finalMinBrick;
        }

        const bricks = [];
        const MAX_TOTAL_BRICKS = 100000;

        let lastBrickClose = Math.floor(getPrice(rawData[0]) / brickSize) * brickSize;
        let isUp = true;

        // Pending extremes for the next brick
        let pendingHigh = lastBrickClose;
        let pendingLow = lastBrickClose;

        for (let idx = 0; idx < rawData.length; idx++) {

            const candle = rawData[idx];
            // Update extremes
            pendingHigh = Math.max(pendingHigh, candle.high);
            pendingLow = Math.min(pendingLow, candle.low);

            const price = getPrice(candle);
            let triggeredCount = 0;

            if (isUp) {
                // Continuation Up
                while (price >= lastBrickClose + brickSize) {
                    const open = lastBrickClose;
                    const close = lastBrickClose + brickSize;
                    triggeredCount++;

                    bricks.push({
                        open: open,
                        close: close,
                        // Bullish wicks only extend DOWN (rejections)
                        high: close,
                        low: triggeredCount === 1 ? Math.min(open, pendingLow) : open,
                        timestamp: candle.timestamp,
                        volume: candle.volume / 10,
                        isBullish: true,
                        isProjection: false
                    });
                    lastBrickClose = close;
                    pendingHigh = lastBrickClose;
                    pendingLow = lastBrickClose;
                }
                // Reversal Down
                if (triggeredCount === 0 && price <= lastBrickClose - (2 * brickSize)) {
                    isUp = false;
                    let open = lastBrickClose - brickSize;
                    let close = lastBrickClose - (2 * brickSize);
                    bricks.push({
                        open: open,
                        close: close,
                        // Bearish wicks only extend UP (rejections)
                        high: Math.max(open, pendingHigh),
                        low: close,
                        timestamp: candle.timestamp,
                        volume: candle.volume / 10,
                        isBullish: false,
                        isProjection: false
                    });
                    lastBrickClose = close;
                    pendingHigh = lastBrickClose;
                    pendingLow = lastBrickClose;

                    let revTriggerCount = 0;
                    while (price <= lastBrickClose - brickSize) {
                        revTriggerCount++;
                        open = lastBrickClose;
                        close = lastBrickClose - brickSize;
                        bricks.push({
                            open: open,
                            close: close,
                            high: open,
                            low: close,
                            timestamp: candle.timestamp,
                            volume: candle.volume / 10,
                            isBullish: false,
                            isProjection: false
                        });
                        lastBrickClose = close;
                        pendingHigh = lastBrickClose;
                        pendingLow = lastBrickClose;
                    }
                }
            } else {
                // Continuation Down
                while (price <= lastBrickClose - brickSize) {
                    const open = lastBrickClose;
                    const close = lastBrickClose - brickSize;
                    triggeredCount++;

                    bricks.push({
                        open: open,
                        close: close,
                        // Bearish wicks only extend UP
                        high: triggeredCount === 1 ? Math.max(open, pendingHigh) : open,
                        low: close,
                        timestamp: candle.timestamp,
                        volume: candle.volume / 10,
                        isBullish: false,
                        isProjection: false
                    });
                    lastBrickClose = close;
                    pendingHigh = lastBrickClose;
                    pendingLow = lastBrickClose;
                }
                // Reversal Up
                if (triggeredCount === 0 && price >= lastBrickClose + (2 * brickSize)) {
                    isUp = true;
                    let open = lastBrickClose + brickSize;
                    let close = lastBrickClose + (2 * brickSize);
                    bricks.push({
                        open: open,
                        close: close,
                        // Bullish wicks only extend DOWN
                        high: close,
                        low: Math.min(open, pendingLow),
                        timestamp: candle.timestamp,
                        volume: candle.volume / 10,
                        isBullish: true,
                        isProjection: false
                    });
                    lastBrickClose = close;
                    pendingHigh = lastBrickClose;
                    pendingLow = lastBrickClose;

                    let revTriggerCount = 0;
                    while (price >= lastBrickClose + brickSize) {
                        revTriggerCount++;
                        open = lastBrickClose;
                        close = lastBrickClose + brickSize;
                        bricks.push({
                            open: open,
                            close: close,
                            high: close,
                            low: open,
                            timestamp: candle.timestamp,
                            volume: candle.volume / 10,
                            isBullish: true,
                            isProjection: false
                        });
                        lastBrickClose = close;
                        pendingHigh = lastBrickClose;
                        pendingLow = lastBrickClose;
                    }
                }
            }
        }

        return bricks;
    }

    getLineBreakData(numLines = 3) {
        const bricks = [];
        if (this.#rawData.length === 0) return bricks;

        // Initialize with the first price
        let lastClose = this.#rawData[0].close;
        let lineCloses = [lastClose];
        // We need to keep track of the ranges of the previous lines
        let lines = [];

        this.#rawData.forEach((candle, i) => {
            if (i === 0) return;
            const price = candle.close;

            if (lines.length === 0) {
                // First line formation
                if (price > lastClose) {
                    const line = { open: lastClose, close: price, isBullish: true, timestamp: candle.timestamp };
                    lines.push(line);
                    bricks.push({ ...line, high: price, low: lastClose });
                    lastClose = price;
                } else if (price < lastClose) {
                    const line = { open: lastClose, close: price, isBullish: false, timestamp: candle.timestamp };
                    lines.push(line);
                    bricks.push({ ...line, high: lastClose, low: price });
                    lastClose = price;
                }
                return;
            }

            const currentTrend = lines[lines.length - 1].isBullish ? 1 : -1;

            // Reversal Rule: 
            // If current trend is UP, must break the LOW of last N lines to reverse.
            // If current trend is DOWN, must break the HIGH of last N lines to reverse.
            // Continuation Rule:
            // Must break the CLOSE of the previous block only.

            if (currentTrend === 1) { // Current trend is BULLISH
                if (price > lastClose) {
                    // Continuation UP
                    const line = { open: lastClose, close: price, isBullish: true, timestamp: candle.timestamp };
                    lines.push(line);
                    bricks.push({ ...line, high: price, low: lastClose });
                    lastClose = price;
                } else {
                    // Check for Bearish Reversal
                    const relevantLines = lines.slice(-numLines);
                    const reversalLevel = Math.min(...relevantLines.map(l => Math.min(l.open, l.close)));
                    if (price < reversalLevel) {
                        const line = { open: lastClose, close: price, isBullish: false, timestamp: candle.timestamp };
                        lines.push(line);
                        bricks.push({ ...line, high: lastClose, low: price });
                        lastClose = price;
                    }
                }
            } else { // Current trend is BEARISH
                if (price < lastClose) {
                    // Continuation DOWN
                    const line = { open: lastClose, close: price, isBullish: false, timestamp: candle.timestamp };
                    lines.push(line);
                    bricks.push({ ...line, high: lastClose, low: price });
                    lastClose = price;
                } else {
                    // Check for Bullish Reversal
                    const relevantLines = lines.slice(-numLines);
                    const reversalLevel = Math.max(...relevantLines.map(l => Math.max(l.open, l.close)));
                    if (price > reversalLevel) {
                        const line = { open: lastClose, close: price, isBullish: true, timestamp: candle.timestamp };
                        lines.push(line);
                        bricks.push({ ...line, high: price, low: lastClose });
                        lastClose = price;
                    }
                }
            }
        });
        return bricks;
    }

    getKagiData(reversalAmount = 0.01, isAbsolute = false) {
        const legs = [];
        if (this.#rawData.length === 0) return legs;

        let lastPrice = this.#rawData[0].close;
        let extreme = lastPrice;
        let direction = 0;
        let isYang = true;

        let highShoulder = lastPrice;
        let lowWaist = lastPrice;

        let currentLegSegments = [];

        this.#rawData.forEach((candle, idx) => {
            const price = candle.close;

            if (direction === 0) {
                const diff = price - lastPrice;
                const threshold = isAbsolute ? reversalAmount : (lastPrice * reversalAmount);
                if (Math.abs(diff) >= threshold) {
                    direction = diff > 0 ? 1 : -1;
                    extreme = price;
                    isYang = direction > 0;
                    if (direction > 0) highShoulder = extreme;
                    else lowWaist = extreme;
                }
                return;
            }

            if (direction === 1) { // UP
                if (price > extreme) {
                    // Check for breakout to Yang
                    if (!isYang && price > highShoulder) {
                        currentLegSegments.push({ open: lastPrice, close: highShoulder, isYang: false });
                        lastPrice = highShoulder;
                        isYang = true;
                    }
                    extreme = price;
                } else if (price <= extreme - (isAbsolute ? reversalAmount : (extreme * reversalAmount))) {
                    // Reversal DOWN
                    currentLegSegments.push({ open: lastPrice, close: extreme, isYang: isYang });
                    legs.push({ segments: currentLegSegments, timestamp: candle.timestamp });

                    highShoulder = extreme;
                    lastPrice = extreme;
                    extreme = price;
                    direction = -1;
                    currentLegSegments = [];
                }
            } else { // DOWN
                if (price < extreme) {
                    // Check for breakout to Yin
                    if (isYang && price < lowWaist) {
                        currentLegSegments.push({ open: lastPrice, close: lowWaist, isYang: true });
                        lastPrice = lowWaist;
                        isYang = false;
                    }
                    extreme = price;
                } else if (price >= extreme + (isAbsolute ? reversalAmount : (extreme * reversalAmount))) {
                    // Reversal UP
                    currentLegSegments.push({ open: lastPrice, close: extreme, isYang: isYang });
                    legs.push({ segments: currentLegSegments, timestamp: candle.timestamp });

                    lowWaist = extreme;
                    lastPrice = extreme;
                    extreme = price;
                    direction = 1;
                    currentLegSegments = [];
                }
            }
        });

        // Push last leg
        currentLegSegments.push({ open: lastPrice, close: extreme, isYang: isYang });
        legs.push({ segments: currentLegSegments, timestamp: Date.now() });

        // Compatibility OHLC
        return legs.map(leg => {
            const s = leg.segments;
            const open = s[0].open;
            const close = s[s.length - 1].close;
            const highs = s.map(seg => Math.max(seg.open, seg.close));
            const lows = s.map(seg => Math.min(seg.open, seg.close));
            return {
                ...leg,
                open: open,
                close: close,
                high: Math.max(...highs),
                low: Math.min(...lows)
            };
        });
    }

    getPnFData(boxSize = null, reversal = 3, source = 'close', oneStepBack = true) {
        const columns = [];
        if (this.#rawData.length === 0) return columns;

        // If boxSize is not provided, calculate dynamic boxSize based on average price
        if (boxSize === null) {
            const lastPortion = this.#rawData.slice(-20);
            const avgPrice = lastPortion.reduce((sum, c) => sum + c.close, 0) / (lastPortion.length || 1);
            boxSize = avgPrice * 0.01 || 1.0; // 1% or 1.0
        }

        const getPrice = (c) => {
            switch (source) {
                case 'open': return c.open;
                case 'high': return c.high;
                case 'low': return c.low;
                case 'close': return c.close;
                case 'hl2': return (c.high + c.low) / 2;
                case 'hlc3': return (c.high + c.low + c.close) / 3;
                case 'ohlc4': return (c.open + c.high + c.low + c.close) / 4;
                default: return c.close;
            }
        };

        let currentVal = Math.floor(getPrice(this.#rawData[0]) / boxSize) * boxSize;
        let isUp = true;
        let col = [currentVal];

        this.#rawData.forEach(candle => {
            const price = getPrice(candle);
            if (isUp) {
                if (price >= currentVal + boxSize) {
                    while (price >= currentVal + boxSize) {
                        currentVal += boxSize;
                        col.push(currentVal);
                    }
                } else if (price <= currentVal - (boxSize * reversal)) {
                    columns.push({ boxes: col, isUp: true, timestamp: candle.timestamp });
                    isUp = false;

                    // One step back: new column starts one box below the highest box of previous column
                    // Instead of starting from 'currentVal' which is the highest.
                    if (oneStepBack) {
                        currentVal -= boxSize;
                    }

                    col = [];
                    while (price <= currentVal - boxSize) {
                        currentVal -= boxSize;
                        col.push(currentVal);
                    }
                    if (col.length === 0) { // Safety: ensure at least one box if reversal occurred
                        currentVal -= boxSize;
                        col.push(currentVal);
                    }
                }
            } else {
                if (price <= currentVal - boxSize) {
                    while (price <= currentVal - boxSize) {
                        currentVal -= boxSize;
                        col.push(currentVal);
                    }
                } else if (price >= currentVal + (boxSize * reversal)) {
                    columns.push({ boxes: col, isUp: false, timestamp: candle.timestamp });
                    isUp = true;

                    if (oneStepBack) {
                        currentVal += boxSize;
                    }

                    col = [];
                    while (price >= currentVal + boxSize) {
                        currentVal += boxSize;
                        col.push(currentVal);
                    }
                    if (col.length === 0) {
                        currentVal += boxSize;
                        col.push(currentVal);
                    }
                }
            }
        });

        // Push the final active column so the latest price is visible
        if (col.length > 0) {
            columns.push({ boxes: col, isUp: isUp, timestamp: this.#rawData[this.#rawData.length - 1].timestamp });
        }

        // Map to a "pseudo-candle" format for indexing
        return columns.map(c => ({
            open: Math.min(...c.boxes),
            close: Math.max(...c.boxes),
            high: Math.max(...c.boxes),
            low: Math.min(...c.boxes),
            boxes: c.boxes,
            isUp: c.isUp,
            timestamp: c.timestamp
        }));
    }

