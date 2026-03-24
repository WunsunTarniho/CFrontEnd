import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    VerticalLineTool, RayTool, HorizontalRayTool,
    ExtendedLineTool, InfoLineTool, TrendAngleTool, CrossLineTool
} from '../../Chartify/lib/tools/LineTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('VerticalLineTool', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 150 }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new VerticalLineTool('test-v', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw a full-height vertical line', () => {
        tool.draw(mockCtx);
        const x = mockChart.getXForTime(1000);
        expect(mockCtx.moveTo).toHaveBeenCalledWith(x, 0);
        expect(mockCtx.lineTo).toHaveBeenCalledWith(x, mockChart.height);
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space (12 * 1000 = 12000 in custom mock)
        tool.move(12, 50);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[0].price).toBe(150); // Should not move vertically
    });
});

describe('RayTool', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 100 }, { timestamp: 2000, price: 200 }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new RayTool('test-ray', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw a ray (starting at p0, continuing through p1)', () => {
        tool.draw(mockCtx);
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });
});

describe('HorizontalRayTool', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 100 }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new HorizontalRayTool('test-hray', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw a horizontal ray from p0 to chart width', () => {
        tool.draw(mockCtx);
        const x = mockChart.getXForTime(1000);
        const y = mockChart.getYForPrice(100);
        expect(mockCtx.moveTo).toHaveBeenCalledWith(x, y);
        expect(mockCtx.lineTo).toHaveBeenCalledWith(mockChart.width, y);
    });
});

describe('Complex Line Tools', () => {
    let mockChart;

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
    });

    it('ExtendedLineTool should draw through both edges', () => {
        const points = [{ timestamp: 1000, price: 100 }, { timestamp: 2000, price: 200 }];
        const tool = new ExtendedLineTool('ext1', mockChart, null, points, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(1); // One long line
    });

    it('InfoLineTool should draw line and info text', () => {
        const points = [{ timestamp: 1000, price: 100 }, { timestamp: 2000, price: 200 }];
        const tool = new InfoLineTool('info1', mockChart, null, points, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('CrossLineTool should draw both horizontal and vertical lines', () => {
        const tool = new CrossLineTool('cross1', mockChart, null, [{ timestamp: 1000, price: 100 }], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.moveTo).toHaveBeenCalledTimes(2);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    });
});
