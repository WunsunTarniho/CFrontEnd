import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PitchforkTool, InsidePitchforkTool } from '../../Chartify/lib/tools/PitchforkTool.js';
import { ChartMock, mockCtx } from '../mocks/ChartMock.js';

describe('PitchforkTool (Standard)', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 }, // P1 (Anchor)
        { timestamp: 2000, price: 200 }, // P2 (B)
        { timestamp: 2000, price: 50 }   // P3 (C)
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new PitchforkTool('pf-1', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should have 5 prongs (rays) by default', () => {
        tool.draw(mockCtx);
        const strokeCount = mockCtx.stroke.mock.calls.length;
        expect(strokeCount).toBe(6); // 5 rays + 1 BC connector
    });

    it('should detect hits on all 5 rays', () => {
        const p1 = tool.getCanvasPoint(0);
        const b = tool.getCanvasPoint(1);
        const c = tool.getCanvasPoint(2);
        const t = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
        const medianDir = { x: t.x - p1.x, y: t.y - p1.y };

        // Median (Level 0) starts at p1 (Anchor)
        expect(tool.containsPoint({ x: p1.x + medianDir.x, y: p1.y + medianDir.y })).toBe(true);
        
        // Upper Inner (Level 0.5) starts on BC line between t and b
        const originUpper = { x: t.x + 0.5 * (b.x - t.x), y: t.y + 0.5 * (b.y - t.y) };
        expect(tool.containsPoint({ x: originUpper.x + medianDir.x, y: originUpper.y + medianDir.y })).toBe(true);
    });
});

describe('InsidePitchforkTool', () => {
    let mockChart;
    let tool;
    const points = [
        { timestamp: 1000, price: 100 }, // P1
        { timestamp: 2000, price: 200 }, // P2
        { timestamp: 2000, price: 300 }  // P3
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockChart = new ChartMock();
        tool = new InsidePitchforkTool('ipf-1', mockChart, null, [...points.map(p => ({...p}))], { color: '#fff' });
    });

    it('should have 5 prongs by default', () => {
        tool.draw(mockCtx);
        const strokeCount = mockCtx.stroke.mock.calls.length;
        expect(strokeCount).toBe(8); // 5 rays + 3 handles
    });

    it('should detect hits on all 5 rays', () => {
        const p1 = tool.getCanvasPoint(0);
        const p2 = tool.getCanvasPoint(1);
        const p3 = tool.getCanvasPoint(2);
        const anchor = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const target = p3;
        const medianDir = { x: target.x - anchor.x, y: target.y - anchor.y };

        // Median (Level 0) starts at anchor
        expect(tool.containsPoint({ x: anchor.x + medianDir.x, y: anchor.y + medianDir.y })).toBe(true);
        
        // Level -1 (P2) starts on BC line
        expect(tool.containsPoint({ x: p2.x + medianDir.x, y: p2.y + medianDir.y })).toBe(true);
        
        // Level 1 (P3) starts on BC line
        expect(tool.containsPoint({ x: p3.x + medianDir.x, y: p3.y + medianDir.y })).toBe(true);
    });
});
