import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceRange } from '../../Chartify/lib/tools/TechnicalTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('PriceRange', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 150 }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new PriceRange('test-pr', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw fill and labels', () => {
        tool.draw(mockCtx);
        expect(mockCtx.fillRect).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should calculate percentage change correctly in labels', () => {
        // 100 to 150 is 50%
        tool.draw(mockCtx);
        const lastCall = mockCtx.fillText.mock.calls[mockCtx.fillText.mock.calls.length - 1];
        expect(lastCall[0]).toContain('50.00%');
    });

    it('should move both points', () => {
        // dx=12 is 1 candle space
        tool.move(12, -10);
        expect(tool.points[0].price).toBeCloseTo(110);
        expect(tool.points[1].price).toBeCloseTo(160);
    });
});
