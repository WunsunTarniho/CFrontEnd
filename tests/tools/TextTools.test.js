import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceLabelTool } from '../../Chartify/lib/tools/TextTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('Text Tools', () => {
    let mockChart;

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
    });

    it('PriceLabelTool should draw with circle and text', () => {
        const points = [{ timestamp: 1000, price: 130 }];
        const tool = new PriceLabelTool('test-label', mockChart, null, points, { color: '#fff', textColor: '#000' });
        
        expect(() => tool.draw(mockCtx)).not.toThrow();
        expect(mockCtx.arc).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
    });
});