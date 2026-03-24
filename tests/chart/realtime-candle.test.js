import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradingChart } from '../../Chartify/lib/Chartify.js';

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

describe('TradingChart Real-time Candle Logic', () => {
    let chart;
    let container;

    beforeEach(() => {
        // Setup JSDOM environment
        document.body.innerHTML = '<div id="chart-container" style="width:1000px; height:600px;"></div>';
        container = document.getElementById('chart-container');
        
        // Mock clientWidth/Height which JSDOM doesn't set
        Object.defineProperty(container, 'clientWidth', { value: 1000 });
        Object.defineProperty(container, 'clientHeight', { value: 600 });

        // Instantiate chart - suppressing some visual setups if they crash, but TradingChart seems robust
        chart = new TradingChart('chart-container', {
            timeframe: '1m'
        });

        // Mock render to focus on data logic
        chart.render = vi.fn();

        // Initial data state: one base candle
        chart.data = [
            {
                timestamp: 1710000000000, // T=0 (Base)
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
                lastUpdateTs: 1710000000000
            }
        ];
    });

    it('should update current candle High, Low, Close, and Volume for trade in same bucket', () => {
        const timeframeMs = 60 * 1000;
        const trade = {
            timestamp: 1710000030000, // T+30s
            price: 115,
            volume: 500
        };

        chart.updateCandleWithTrade(trade, Date.now(), timeframeMs);

        const lastCandle = chart.data[chart.data.length - 1];
        expect(lastCandle.close).toBe(115);
        expect(lastCandle.high).toBe(115); // 115 > 110
        expect(lastCandle.volume).toBe(1500);
        expect(lastCandle.lastUpdateTs).toBe(1710000030000);
    });

    it('should push a new candle when trade crossing timeframe boundary', () => {
        const timeframeMs = 60 * 1000;
        const trade = {
            timestamp: 1710000060000, // T+60s (Next Bucket)
            price: 112,
            volume: 200
        };

        chart.updateCandleWithTrade(trade, Date.now(), timeframeMs);

        expect(chart.data.length).toBe(2);
        const newCandle = chart.data[1];
        expect(newCandle.timestamp).toBe(1710000060000);
        expect(newCandle.open).toBe(105); // took previous close
        expect(newCandle.close).toBe(112);
        expect(newCandle.volume).toBe(200);
    });

    it('should FREEZE previous candle prices if trade is for a past bucket', () => {
        const timeframeMs = 60 * 1000;
        
        // 1. Advance to next candle first
        chart.updateCandleWithTrade({
            timestamp: 1710000060000,
            price: 112,
            volume: 200
        }, Date.now(), timeframeMs);

        // 2. Late trade for the FIRST candle arrives
        const lateTrade = {
            timestamp: 1710000030000, // T+30s (First bucket)
            price: 500, // Very high price
            volume: 100
        };

        chart.updateCandleWithTrade(lateTrade, Date.now(), timeframeMs);

        const firstCandle = chart.data[0];
        expect(chart.data.length).toBe(2);
        expect(firstCandle.close).toBe(105); // Should remain 105
        expect(firstCandle.high).toBe(110);  // Should remain 110
        expect(firstCandle.volume).toBe(1100); // Volume SHOULD accumulate
    });

    it('should maintain chronological integrity for Close price within same bucket (late trade arrival)', () => {
        const timeframeMs = 60 * 1000;
        
        // Trade at T+45s arrives
        chart.updateCandleWithTrade({
            timestamp: 1710000045000,
            price: 110,
            volume: 100
        }, Date.now(), timeframeMs);
        
        // Late trade at T+30s arrives (but same bucket 0..60s)
        chart.updateCandleWithTrade({
            timestamp: 1710000030000,
            price: 120,
            volume: 100
        }, Date.now(), timeframeMs);

        const lastCandle = chart.data[chart.data.length - 1];
        expect(lastCandle.close).toBe(110); // Chronologically later trade (45s) must be the Close
        expect(lastCandle.volume).toBe(1200); // Both volumes added
    });
});
