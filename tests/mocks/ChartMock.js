import { vi } from 'vitest';

export const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    setLineDash: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    canvas: { width: 1000, height: 600 }
};

export class ChartMock {
    constructor() {
        this.margin = { top: 50, bottom: 50, left: 50, right: 50 };
        this.width = 1000;
        this.height = 600;
        this.candleWidth = 10;
        this.scrollOffset = 0;
        this.data = [];
        this.ctx = mockCtx;
    }

    getXForTime(timestamp) {
        return this.margin.left + (timestamp / 1000);
    }

    getYForPrice(price) {
        return this.height - this.margin.bottom - price;
    }

    getTimeForX(x) {
        return (x - this.margin.left) * 1000;
    }

    getPriceForY(y) {
        return this.height - this.margin.bottom - y;
    }

    getIntersectedCandles(x1, x2) {
        return {
            candles: [],
            totalVolume: 0,
            startIndex: 0,
            endIndex: 0
        };
    }
}
