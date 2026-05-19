import { describe, it, expect, beforeEach, vi } from 'vitest';
import TradingChart from '../../Chartify/lib/Chartify.js';

describe('Volume Footprint Rendering Logic', () => {
    let chart;
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="chart-container" style="width:1000px; height:600px;"></div>';
        container = document.getElementById('chart-container');
        Object.defineProperty(container, 'clientWidth', { value: 1000 });
        Object.defineProperty(container, 'clientHeight', { value: 600 });

        chart = new TradingChart('chart-container', {
            chartMode: 'footprint',
            footprintRowSizeMethod: 'manual',
            footprintRowSizeManual: 1
        });

        // Mock panex and coordinate mapping
        chart.panes = [{
            id: 'main',
            top: 0,
            height: 500,
            min: 100,
            max: 200,
            range: 100
        }];
        
        chart.ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            rect: vi.fn(),
            clip: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            fillText: vi.fn(),
            setLineDash: vi.fn(),
            measureText: () => ({ width: 10 })
        };
    });

    it('should calculate bucketSize based on manual ticks', () => {
        chart.precision = '2'; // 0.01 tick
        chart.footprintRowSizeManual = 5;
        const bucketSize = chart.getFootprintBucketSize();
        expect(bucketSize).toBe(0.05);
    });

    it('should handle tiny row heights gracefully in drawFootprint', () => {
        // Mock visible data with a footprint
        const candle = {
            timestamp: Date.now(),
            open: 150,
            close: 151,
            high: 152,
            low: 149,
            footprint: {
                clusters: {
                    "150": { buy: 10, sell: 5, total: 15 },
                    "150.1": { buy: 8, sell: 12, total: 20 }
                },
                isLoaded: true,
                poc: 150.1
            }
        };

        chart.getVisibleData = () => [candle];
        chart.startIndex = 0;
        chart.candleWidth = 50;
        chart.getFootprintBucketSize = () => 0.1;


        // Force a very small h by making the range huge or height tiny
        chart.panes[0].range = 10000; // 10k price range -> 0.01 tick is 0.0005 pixels
        
        chart.drawFootprint();

        // Check if fillRect was called
        // We expect fillRect to be called for boxes. 
        // The height passed to fillRect should be drawH
        const fillRectCalls = chart.ctx.fillRect.mock.calls;
        expect(fillRectCalls.length).toBeGreaterThan(0);
        
        // Find a call that looks like it's for a cluster box (not the candle body)
        // Candle body draw is at line 4936: fillRect(centerX - bodyW / 2, bodyY, bodyW, bodyH)
        // Cluster box draw is at line 5024/5030.
        
        const boxCalls = fillRectCalls.filter(call => call[2] < 50); // width < candleWidth
        expect(boxCalls.length).toBeGreaterThan(0);
        
        boxCalls.forEach(call => {
            const h = call[3];
            // Since h is tiny (~0.0005), drawH should be h + h*0.1 = 0.00055
            expect(h).toBeLessThan(0.1); 
            expect(h).toBeGreaterThan(0);
        });
    });

    it('should add standard overlap for larger row heights', () => {
        const candle = {
            timestamp: Date.now(),
            open: 150,
            close: 151,
            high: 152,
            low: 149,
            footprint: {
                clusters: { "150.0": { buy: 10, sell: 5, total: 15 } },
                isLoaded: true
            }
        };

        chart.getVisibleData = () => [candle];
        chart.startIndex = 0;
        chart.candleWidth = 100;
        chart.getFootprintBucketSize = () => 10; // Large bucket

        chart.panes[0].range = 100; 
        // h = 500 * (10 / 100) = 50 pixels
        
        chart.drawFootprint();

        const fillRectCalls = chart.ctx.fillRect.mock.calls;
        const boxCalls = fillRectCalls.filter(call => call[2] < 100);
        
        boxCalls.forEach(call => {
            const drawH = call[3];
            expect(drawH).toBeCloseTo(50.6, 1); // 50 + 0.6
        });
    });
});
