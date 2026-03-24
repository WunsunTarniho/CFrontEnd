import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradingChart } from '../../Chartify/lib/Chartify.js';

// HTMLCanvasElement.prototype.getContext and requestAnimationFrame are now mocked in setup.js

describe('TradingChart Core Methods', () => {
    let chart;
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="chart-container" style="width:1000px; height:600px;"></div>';
        container = document.getElementById('chart-container');

        Object.defineProperty(container, 'clientWidth', { value: 1000 });
        Object.defineProperty(container, 'clientHeight', { value: 600 });

        chart = new TradingChart('chart-container', {
            timeframe: '1d'
        });

        chart.render = vi.fn(); // Suppress actual rendering calls

        // Sample Data: 3 daily candles
        chart.rawData = [
            { timestamp: 1710000000000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
            { timestamp: 1710086400000, open: 105, high: 115, low: 100, close: 110, volume: 1100 },
            { timestamp: 1710172800000, open: 110, high: 120, low: 105, close: 115, volume: 1200 }
        ];
        chart.data = [...chart.rawData];
    });

    describe('Coordinate Mapping', () => {
        beforeEach(() => {
            // Initialize main pane for coordinate mapping
            chart.panes = [{
                id: 'main',
                top: chart.margin.top,
                height: chart.height - chart.margin.top - chart.margin.bottom,
                min: 90,
                max: 120,
                range: 30
            }];
        });

        it('should correctly map timestamp to X coordinate', () => {
            const candleSpace = chart.candleWidth + 2; // 15 + 2 = 17
            // getXForTime uses getCandleIndexForX or similar internal logic, but let's test the public API
            // For index 0: x = margin.left + (0 * candleSpace) - scrollOffset + halfCandle
            const x0 = chart.getXForTime(1710000000000);
            expect(x0).toBe(chart.margin.left + (chart.candleWidth / 2) - chart.scrollOffset);
        });

        it('should correctly map price to Y coordinate', () => {
            // Price range is 90 to 120. height=600, margins: top=0, bottom=40
            const yMin = chart.getYForPrice(90);
            const yMax = chart.getYForPrice(120);

            expect(yMin).toBe(chart.height - chart.margin.bottom);
            expect(yMax).toBe(chart.margin.top);
        });

        it('should correctly handle inverse mappings', () => {
            chart.currentPriceRange = { min: 90, max: 120, range: 30 };
            const price = 105;
            const y = chart.getYForPrice(price);
            expect(chart.getPriceForY(y)).toBeCloseTo(price);

            const time = 1710086400000;
            const x = chart.getXForTime(time);
            expect(chart.getTimeForX(x)).toBeCloseTo(time, -3); // Binary search snap
        });
    });

    describe('Data Processing', () => {
        it('getTimeframeInMs should return correct ms for units', () => {
            chart.timeframe = '1m';
            expect(chart.getTimeframeInMs()).toBe(60000);
            chart.timeframe = '1h';
            expect(chart.getTimeframeInMs()).toBe(3600000);
            chart.timeframe = '1d';
            expect(chart.getTimeframeInMs()).toBe(86400000);
            chart.timeframe = '1mo';
            expect(chart.getTimeframeInMs()).toBe(30 * 86400000);
        });

        it('prependData should add data to the beginning and adjust scrollOffset', () => {
            const olderData = [{ timestamp: 1709913600000, open: 95, high: 105, low: 90, close: 100, volume: 900 }];
            const initialLen = chart.data.length;
            const candleSpace = chart.candleWidth + 2;

            chart.prependData(olderData);

            expect(chart.data.length).toBe(initialLen + 1);
            expect(chart.data[0].timestamp).toBe(1709913600000);
            expect(chart.scrollOffset).toBe(1 * candleSpace);
        });
    });

    describe('Scaling & Viewport', () => {
        it('getVisibleData should return correct slice based on scrollOffset', () => {
            chart.scrollOffset = 0;
            const visible = chart.getVisibleData();
            expect(visible.length).toBe(3); // All 3 fit in 1000px width

            // Scroll far right so only last 1 is visible (hypothetically)
            const candleSpace = chart.candleWidth + 2;
            chart.scrollOffset = candleSpace * 2;
            const visibleRight = chart.getVisibleData();
            expect(visibleRight[0].timestamp).toBe(1710172800000);
        });

        it('getPriceRange should calculate min/max from visible candles', () => {
            // 1710000000000 (90-110), 1710086400000 (100-115), 1710172800000 (105-120)
            const range = chart.getPriceRange();
            expect(range.min).toBe(90);
            expect(range.max).toBe(120);
        });
    });

    describe('State Management', () => {
        it('setTool should update activeTool and canvas cursor', () => {
            chart.setTool('trend-line');
            expect(chart.activeTool).toBe('trend-line');
            expect(chart.canvas.style.cursor).toBe('crosshair');

            chart.setTool(null);
            expect(chart.activeTool).toBeNull();
            expect(chart.canvas.style.cursor).toBe('default');
        });

        it('markToolDirty should track pending actions', () => {
            const tool = { id: 'test-1', type: 'trend-line', points: [], style: {} };
            chart.markToolDirty(tool, 'create');
            expect(chart.pendingActions.has('test-1')).toBe(true);
            expect(chart.pendingActions.get('test-1').action).toBe('create');
        });
    });

    describe('Zoom Mechanics', () => {
        it('handleZoom should change candleWidth', () => {
            const initialWidth = chart.candleWidth;
            // Scroll down (delta > 0) usually zooms out (smaller width)
            chart.handleZoom(100, 500);
            expect(chart.candleWidth).toBeLessThan(initialWidth);

            const narrowWidth = chart.candleWidth;
            chart.handleZoom(-100, 500);
            expect(chart.candleWidth).toBeGreaterThan(narrowWidth);
        });
    });
});
