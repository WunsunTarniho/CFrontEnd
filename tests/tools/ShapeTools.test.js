import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    CircleTool, EllipseTool, TriangleTool, 
    PolylineTool, CurveTool, ArcTool, DoubleCurveTool, PathTool,
    RotatedRectangle, RectangleTool
} from '../../Chartify/lib/tools/RectangleTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('Shape Tools', () => {
    let mockChart;

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
    });

    it('CircleTool should draw an arc', () => {
        const tool = new CircleTool('c1', mockChart, null, [{ timestamp: 1000, price: 100 }, { timestamp: 1100, price: 110 }], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('TriangleTool should draw triangle path', () => {
        const tool = new TriangleTool('tr1', mockChart, null, [
            { timestamp: 1000, price: 100 }, 
            { timestamp: 2000, price: 200 },
            { timestamp: 3000, price: 100 }
        ], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    });

    it('PolylineTool should draw multiple lines', () => {
        const tool = new PolylineTool('pl1', mockChart, null, [
            { timestamp: 1000, price: 100 }, 
            { timestamp: 2000, price: 200 },
            { timestamp: 3000, price: 150 }
        ], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    });

    it('EllipseTool should draw an ellipse', () => {
        const tool = new EllipseTool('e1', mockChart, null, [{ timestamp: 1000, price: 100 }, { timestamp: 1100, price: 110 }, { timestamp: 1200, price: 120 }], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.ellipse).toHaveBeenCalled();
    });

    it('CurveTool should draw quadratic curve', () => {
        const tool = new CurveTool('cur1', mockChart, null, [
            { timestamp: 1000, price: 100 }, 
            { timestamp: 1500, price: 150 },
            { timestamp: 2000, price: 100 }
        ], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.beginPath).toHaveBeenCalled();
    });

    it('CurveTool should move correctly', () => {
        const tool = new CurveTool('cur1', mockChart, null, [
            { timestamp: 1000, price: 100 }, 
            { timestamp: 1500, price: 150 },
            { timestamp: 2000, price: 100 }
        ], { color: '#fff' });
        // dx=12 is 1 candle space (12 * 1000 = 12000 in custom mock)
        tool.move(12, 10);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[0].price).toBeCloseTo(90);
    });

    it('RotatedRectangle should draw 4 edges', () => {
        const tool = new RotatedRectangle('rr1', mockChart, null, [
            { timestamp: 1000, price: 100 }, 
            { timestamp: 2000, price: 100 },
            { timestamp: 1500, price: 200 }
        ], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(4);
    });
    
    it('RectangleTool should draw a rectangle', () => {
        const tool = new RectangleTool('rt1', mockChart, null, [{ timestamp: 1000, price: 100 }, { timestamp: 1100, price: 110 }], { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.strokeRect).toHaveBeenCalled();
    });
});
