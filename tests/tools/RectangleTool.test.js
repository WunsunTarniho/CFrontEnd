import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RectangleTool } from '../../Chartify/lib/tools/RectangleTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('RectangleTool', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 200 }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new RectangleTool('test-rect', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw a rectangle', () => {
        tool.draw(mockCtx);
        expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it('should handle movement', () => {
        // dx=12 is 1 candle space (12 * 1000 = 12000 in custom mock)
        tool.move(12, -10);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[1].price).toBeCloseTo(210);
    });

    it('should detect if point is near edges', () => {
        const x1 = mockChart.getXForTime(1000);
        const y1 = mockChart.getYForPrice(100);
        
        // Exact corner
        expect(tool.containsPoint({ x: x1, y: y1 })).toBe(true);
        
        // Far away
        expect(tool.containsPoint({ x: 0, y: 0 })).toBe(false);
    });
});
