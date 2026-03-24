import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HorizontalLineTool } from '../../Chartify/lib/tools/LineTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('HorizontalLineTool', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 150 }];
    const style = { color: '#00ff00', width: 1, dash: [] };

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new HorizontalLineTool('test-h', mockChart, null, [...points.map(p => ({...p}))], style);
    });

    it('should draw a full-width horizontal line', () => {
        tool.draw(mockCtx);
        const y = mockChart.getYForPrice(150);
        expect(mockCtx.moveTo).toHaveBeenCalledWith(0, y);
        expect(mockCtx.lineTo).toHaveBeenCalledWith(mockChart.width, y);
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space, moving vertically by -50
        tool.move(12, -50);
        expect(tool.points[0].timestamp).toBe(1000); // Should not move horizontally
        expect(tool.points[0].price).toBe(200);
    });

    it('should detect proximity to the horizontal line', () => {
        const nearPoint = { x: 500, y: mockChart.getYForPrice(150) + 2 };
        expect(tool.containsPoint(nearPoint)).toBe(true);
        
        const farPoint = { x: 500, y: mockChart.getYForPrice(150) + 20 };
        expect(tool.containsPoint(farPoint)).toBe(false);
    });
});
