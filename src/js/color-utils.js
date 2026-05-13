/**
 * Color Utilities for ChartFrontEnd
 * Handles conversions between Hex, HSV, and RGBA
 */

export function hexToHsv(hex) {
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s, v };
}

export function hsvToHex(h, s, v) {
    h /= 360;
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getColorWithOpacity(hex, opacity) {
    if (!hex) return `rgba(0,0,0,${opacity})`;
    if (hex.startsWith('rgba')) return hex;
    
    let normalizedHex = hex;
    if (normalizedHex.length === 4) {
        normalizedHex = '#' + normalizedHex[1] + normalizedHex[1] + normalizedHex[2] + normalizedHex[2] + normalizedHex[3] + normalizedHex[3];
    }
    const r = parseInt(normalizedHex.slice(1, 3), 16);
    const g = parseInt(normalizedHex.slice(3, 5), 16);
    const b = parseInt(normalizedHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function getHexAlpha(hex, opacity) {
    let normalizedHex = hex;
    if (normalizedHex.length === 4) {
        normalizedHex = '#' + normalizedHex[1] + normalizedHex[1] + normalizedHex[2] + normalizedHex[2] + normalizedHex[3] + normalizedHex[3];
    }
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return normalizedHex + alpha;
}

export function parseColor(colorStr) {
    if (!colorStr) return { color: '#000000', opacity: 1 };
    
    // Hex with Alpha
    if (colorStr.startsWith('#') && colorStr.length === 9) {
        return {
            color: colorStr.slice(0, 7),
            opacity: parseInt(colorStr.slice(7, 9), 16) / 255
        };
    }
    
    // Regular Hex
    if (colorStr.startsWith('#')) {
        return { color: colorStr, opacity: 1 };
    }
    
    // RGBA
    if (colorStr.startsWith('rgba')) {
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            const a = match[4] ? parseFloat(match[4]) : 1;
            return { color: `#${r}${g}${b}`, opacity: a };
        }
    }
    
    return { color: colorStr, opacity: 1 };
}

/**
 * Normalizes any color string (hex, rgb, rgba) to a 7-character hex string (#RRGGBB).
 * @param {string} color 
 * @returns {string}
 */
export function normalizeHex(color) {
    if (!color || typeof color !== 'string') return '#2962FF';
    if (color.startsWith('#')) return color.slice(0, 7);
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    return '#2962FF';
}

/**
 * Determines whether black or white text should be used on a given background color.
 * @param {string} color 
 * @returns {string} '#000000' or '#FFFFFF'
 */
export function getContrastColor(color) {
    if (!color) return '#FFFFFF';
    let r, g, b;

    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        }
    }

    if (r !== undefined && g !== undefined && b !== undefined) {
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }
    return '#FFFFFF';
}

/**
 * Linearly interpolates between two colors.
 * @param {string} color1 
 * @param {string} color2 
 * @param {number} ratio 0 to 1
 * @returns {string}
 */
export function getInterpolatedColor(color1, color2, ratio) {
    if (!color1 || !color2) return color1 || color2 || '#FFFFFF';
    const parse = (c) => {
        if (c.startsWith('#')) {
            const hex = c.replace('#', '');
            if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
            return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        }
        const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [255, 255, 255];
    };

    const [r1, g1, b1] = parse(color1);
    const [r2, g2, b2] = parse(color2);
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
}
