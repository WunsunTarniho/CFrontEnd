import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrendLineTool } from '../../Chartify/lib/tools/LineTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('TrendLineTool', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 200 }
    ];
    const style = { color: '#ff0000', width: 2, dash: [] };

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new TrendLineTool('test-trend', mockChart, null, [...points.map(p => ({...p}))], style);
    });

    it('should initialize correctly', () => {
        expect(tool.id).toBe('test-trend');
        expect(tool.points.length).toBe(2);
        expect(tool.type).toBe('trend-line');
    });

    it('should draw a line between two points', () => {
        tool.draw(mockCtx);
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space (12 * 1000 = 12000 in custom mock)
        tool.move(12, 50);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[0].price).toBeCloseTo(50);
        expect(tool.points[1].timestamp).toBeCloseTo(14000);
        expect(tool.points[1].price).toBeCloseTo(150);
    });

    it('should resize a specific point', () => {
        const newT = 3000;
        const newP = 300;
        // In LineTool, resizingPoint is inherited from DrawingTool
        // Handle for point 0 is usually 'point-0' (from DrawingTool.getResizeHandles)
        tool.resizingPoint('point-0', newT, newP);
        
        expect(tool.points[0].timestamp).toBe(3000);
        expect(tool.points[0].price).toBe(300);
        expect(tool.points[1].timestamp).toBe(2000); // unchanged
    });

    it('should detect proximity to the line', () => {
        const midPoint = {
            x: mockChart.getXForTime(1500),
            y: mockChart.getYForPrice(150)
        };
        expect(tool.containsPoint(midPoint)).toBe(true);

        const farPoint = { x: 0, y: 0 };
        expect(tool.containsPoint(farPoint)).toBe(false);
    });
});
