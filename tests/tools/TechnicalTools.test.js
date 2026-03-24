import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeRange, TimePriceRange, ProjectionTool, LongPosition, ShortPosition } from '../../Chartify/lib/tools/TechnicalTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('TimeRange', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 100 }, { timestamp: 2000, price: 200 }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new TimeRange('test-tr', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw vertical region', () => {
        tool.draw(mockCtx);
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should move correctly', () => {
        // dx=12 is 1 candle space (12 * 1000 = 12000 in custom mock)
        tool.move(12, 0);
        expect(tool.points[0].timestamp).toBeCloseTo(13000);
        expect(tool.points[1].timestamp).toBeCloseTo(14000);
    });
});

describe('TimePriceRange', () => {
    let mockChart;
    let tool;
    const points = [{ timestamp: 1000, price: 100 }, { timestamp: 2000, price: 200 }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new TimePriceRange('test-tpr', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should draw area and info box', () => {
        tool.draw(mockCtx);
        expect(mockCtx.fillRect).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
    });
});

describe('Advanced Technical Tools', () => {
    let mockChart;

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
    });

    it('ProjectionTool should draw arcs and base lines', () => {
        const points = [
            { timestamp: 1000, price: 100 },
            { timestamp: 2000, price: 200 },
            { timestamp: 3000, price: 150 }
        ];
        const tool = new ProjectionTool('proj1', mockChart, null, points, { color: '#fff' });
        tool.draw(mockCtx);
        expect(mockCtx.arc).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('ProjectionTool should sync point-0 (radius) when point-2 is updated', () => {
        const points = [
            { timestamp: 1000, price: 100 },
            { timestamp: 2000, price: 100 }, // Center
            { timestamp: 3000, price: 100 }  // End
        ];
        const tool = new ProjectionTool('proj1', mockChart, null, points, { color: '#fff' });
        
        // Initial distance is 1000 in model time (12px in mock)
        // Move point-2 to 4000 (distance 2000 from center in model time, 24px in mock)
        tool.resizingPoint('point-2', 4000, 100);
        
        // Point-0 should now be at distance 24px from center (X=24) in opposite direction (angle is PI)
        // Center X = 24. Angle1 is PI. New X = 24 + cos(PI)*24 = 0.
        // getTimeForX(0) = 0.
        expect(tool.points[0].timestamp).toBeCloseTo(0);
    });

    it('LongPosition should draw profit/loss areas', () => {
        const style = { color: '#fff', fillColor: { long: 'green', short: 'red' } };
        const tool = new LongPosition('long1', mockChart, null, [{ timestamp: 1000, price: 100 }], style);
        tool.draw(mockCtx); // This triggers initializePoints
        expect(mockCtx.rect).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('ShortPosition should draw profit/loss areas', () => {
        const style = { color: '#fff', fillColor: { long: 'green', short: 'red' } };
        const tool = new ShortPosition('short1', mockChart, null, [{ timestamp: 1000, price: 100 }], style);
        tool.draw(mockCtx);
        expect(mockCtx.rect).toHaveBeenCalled();
    });
});
