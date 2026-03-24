import { vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Global mock for ZenScript
global.ZenScript = {
    Interpreter: vi.fn().mockImplementation(() => ({
        interpret: vi.fn(),
    })),
    Lexer: vi.fn().mockImplementation(() => ({})),
    Parser: vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockReturnValue({}),
    })),
};

// Global mock for Canvas getContext as JSDOM does not support it by default
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
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
        clearRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
    }));
}
