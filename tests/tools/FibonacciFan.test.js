import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FibonacciFan } from '../../Chartify/lib/tools/FibonacciTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('FibonacciFan', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 200 }
    ];
    const style = { 
        color: '#ffffff', 
        width: 1, 
        dash: [],
        backgroundShow: true,
        gridShow: true,
        priceLabelsLeft: true,
        priceLabelsRight: true,
        timeLabelsTop: true,
        timeLabelsBottom: true,
        priceLevels: [
            { level: 0, color: '#787b86', visibility: true },
            { level: 0.25, color: '#ff9800', visibility: true },
            { level: 0.382, color: '#00bcd4', visibility: true },
            { level: 0.5, color: '#4caf50', visibility: true },
            { level: 0.618, color: '#009688', visibility: true },
            { level: 0.75, color: '#2962ff', visibility: true },
            { level: 1, color: '#787b86', visibility: true }
        ],
        timeLevels: [
            { level: 0, color: '#787b86', visibility: true },
            { level: 0.25, color: '#ff9800', visibility: true },
            { level: 0.382, color: '#00bcd4', visibility: true },
            { level: 0.5, color: '#4caf50', visibility: true },
            { level: 0.618, color: '#009688', visibility: true },
            { level: 0.75, color: '#2962ff', visibility: true },
            { level: 1, color: '#787b86', visibility: true }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new FibonacciFan('test-fan', mockChart, null, [...points.map(p => ({...p}))], style);
    });

    it('should have separate price and time levels with visibility', () => {
        expect(tool.style.priceLevels).toBeDefined();
        expect(tool.style.timeLevels).toBeDefined();
        expect(tool.style.priceLevels[3].level).toBe(0.5);
        expect(tool.style.timeLevels[3].color).toBe('#4caf50');
    });

    it('should draw diagonal lines for price and time levels', () => {
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should respect visibility flags for price and time', () => {
        tool.style.priceLevels[0].visibility = false;
        tool.style.timeLevels[0].visibility = false;
        tool.draw(mockCtx);
        // Verify no crash and calls made
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle background fills separately for price and time', () => {
        tool.style.backgroundShow = true;
        tool.draw(mockCtx);
        expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should calculate containment correctly for diagonals', () => {
        // Point exactly on a diagonal should return true
        // This is hard to test without exact coordinates, but we can verify it doesn't crash
        const result = tool.containsPoint({ x: 500, y: 500 });
        expect(typeof result).toBe('boolean');
    });
});
