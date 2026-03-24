import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    FibonacciRetracement, FibonacciExtension, FibonacciFan,
    FibonacciChannel, FibonacciCircle, FibonacciSpeedResistanceArcs,
    FibonacciSpiral, PitchFan
} from '../../Chartify/lib/tools/FibonacciTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('FibonacciRetracement', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 200 }
    ];
    const style = { color: '#ffffff', width: 1, dash: [] };

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new FibonacciRetracement('test-fib', mockChart, null, [...points.map(p => ({...p}))], style);
    });

    it('should draw all fibonacci levels', () => {
        tool.draw(mockCtx);
        // levels count + 1 baseline
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(tool.levels.length + 1);
    });

    it('should calculate y-coordinates for levels correctly', () => {
        const p1 = mockChart.getYForPrice(100); // 450
        const p2 = mockChart.getYForPrice(200); // 350
        const levels = tool.calculateLevels({x: 0, y: p1}, {x: 0, y: p2});
        
        // 50% level
        const level50 = levels.find(l => l.level === 0.5);
        expect(level50.y).toBe(400); // Average of 350 and 450
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space (12000 in custom mock)
        tool.move(12, -100);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[0].price).toBeCloseTo(200);
    });

    it('FibonacciExtension should draw levels based on 3 points', () => {
        const pts = [...points, { timestamp: 3000, price: 150 }];
        const tool = new FibonacciExtension('ext1', mockChart, null, pts, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('FibonacciFan should draw trend lines and fans', () => {
        const tool = new FibonacciFan('fan1', mockChart, null, points, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('FibonacciCircle should draw ellipses', () => {
        const tool = new FibonacciCircle('circ1', mockChart, null, points, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.ellipse).toHaveBeenCalled();
    });
});
