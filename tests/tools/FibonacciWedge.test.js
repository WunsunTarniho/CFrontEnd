import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FibonacciWedge } from '../../Chartify/lib/tools/FibonacciTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('FibonacciWedge', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 }, // p0
        { timestamp: 2000, price: 200 }, // center
        { timestamp: 3000, price: 150 }  // p2
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new FibonacciWedge('test-wedge', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw arcs for levels', () => {
        tool.draw(mockCtx);
        expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should handle shortest path angular logic', () => {
        const startAngle = 0.1;
        const endAngle = 0.5;
        let diff = (endAngle - startAngle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        expect(diff).toBeCloseTo(0.4);

        const startAngle2 = 0.1;
        const endAngle2 = Math.PI * 1.9; // Fast wrap around
        let diff2 = (endAngle2 - startAngle2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        expect(diff2).toBeCloseTo(-0.414159); 
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space (12 * 1000 = 12000 in the custom mock)
        tool.move(12, 20);
        expect(tool.points[1].timestamp).toBeCloseTo(14000); 
        expect(tool.points[1].price).toBeCloseTo(180);
    });

    it('should resize radius or angle via resizingPoint', () => {
        // center is point-1 in this tool
        tool.resizingPoint('p0', 1200, 110);
        expect(tool.points[0].timestamp).toBe(1200);
        expect(tool.points[0].price).toBe(110);
    });
});
