export const API_BASE = 'http://localhost:5000';

export const saveDrawingTool = async (drawingData) => {
    const response = await fetch(`${API_BASE}/api/v1/draw`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
    });

    if (!response.ok) {
        throw new Error('Failed to save drawing tool');
    }

    return await response.json();
};

export const updateDrawingTool = async (id, drawingData) => {
    const response = await fetch(`${API_BASE}/api/v1/draw/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
    });

    if (!response.ok) {
        throw new Error('Failed to update drawing tool');
    }

    return await response.json();
};

export const getDrawingTools = async (params) => {
    const payload = { ...params, userId: "6633b499e1a90c2e34789abc" };
    
    if (params.symbol) {
        payload.symbolId = params.symbolId || params.symbol; // Ensure we use symbolId
        delete payload.symbol;
    }

    const response = await fetch(`${API_BASE}/api/v1/draw/fetch`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error('Failed to fetch drawing tools');
    }

    return await response.json();
};

export const removeDrawingTools = async (id) => {
    const response = await fetch(`${API_BASE}/api/v1/draw/${id}`, { method: 'DELETE' });

    if (!response.ok) {
        throw new Error('Failed to delete drawing tool');
    }

    return await response.json();
};

export const bulkSyncDrawingTools = async (actions) => {
    const response = await fetch(`${API_BASE}/api/v1/draw/bulk`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actions }),
        keepalive: true
    });
    if (!response.ok) {
        throw new Error('Failed to bulk sync drawing tools');
    }

    return await response.json();
};

export const searchStock = async filter => {
    const response = await fetch(`${API_BASE}/api/v1/tickers?search=${encodeURIComponent(filter)}`)
    return await response.json();
}

export const findStock = async (id, exchange = '') => {
    let url = `${API_BASE}/api/v1/ticker/${id}`;
    if (exchange) {
        url += `?exchange=${exchange}`;
    }
    const response = await fetch(url);
    return await response.json();
}

export const findStockByTicker = async (symbol, exchange) => {
    if (!symbol || !exchange) {
        console.warn('findStockByTicker requires both symbol and exchange');
        return { status: false, data: null };
    }
    const response = await fetch(`${API_BASE}/api/v1/ticker/resolve?symbol=${symbol}&exchange=${exchange}`)
    return await response.json();
}

// Layout API
export const getLayouts = async () => {
    const response = await fetch(`${API_BASE}/api/v1/layouts`);
    if (!response.ok) throw new Error('Failed to fetch layouts');
    return await response.json();
};

export const saveLayout = async (layoutData) => {
    const response = await fetch(`${API_BASE}/api/v1/layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
    });
    if (!response.ok) throw new Error('Failed to save layout');
    return await response.json();
};

export const updateLayout = async (id, layoutData) => {
    const response = await fetch(`${API_BASE}/api/v1/layouts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
    });
    if (!response.ok) throw new Error('Failed to update layout');
    return await response.json();
};

export const deleteLayout = async (id) => {
    const response = await fetch(`${API_BASE}/api/v1/layouts/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete layout');
    return true;
};

export const setDefaultLayout = async (id) => {
    const response = await fetch(`${API_BASE}/api/v1/layouts/${id}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: "6633b499e1a90c2e34789abc" })
    });
    if (!response.ok) throw new Error('Failed to set default layout');
    return await response.json();
};

export const touchLayout = async (id) => {
    const response = await fetch(`${API_BASE}/api/v1/layouts/${id}/touch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('Failed to touch layout');
    return await response.json();
};
