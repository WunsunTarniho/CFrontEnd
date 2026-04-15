export const saveDrawingTool = async (drawingData) => {
    const response = await fetch('http://localhost:5000/api/v1/draw', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
    });

    if (!response.ok) {
        throw new Error('Failed to save drawing tool', response);
    }

    return await response.json();
};

export const updateDrawingTool = async (id, drawingData) => {
    const response = await fetch(`http://localhost:5000/api/v1/draw/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
    });

    if (!response.ok) {
        throw new Error('Failed to update drawing tool', response);
    }

    return await response.json();
};

export const getDrawingTools = async (params) => {
    // params = { layoutId, tickerId }
    const payload = { ...params, userId: 1 };
    
    // Ensure tickerId is correctly mapped for drawing fetch
    if (params.symbol && !params.tickerId) {
        payload.tickerId = params.symbol;
        delete payload.symbol;
    }

    const response = await fetch(`http://localhost:5000/api/v1/draw/fetch`, {
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
    const response = await fetch(`http://localhost:5000/api/v1/draw/${id}`, { method: 'DELETE' });

    if (!response.ok) {
        throw new Error('Failed to fetch drawing tools');
    }

    return await response.json();
};

export const bulkSyncDrawingTools = async (actions) => {
    const response = await fetch('http://localhost:5000/api/v1/draw/bulk', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actions }),
        keepalive: true
    });
    // console.log(actions, 'dddddddddddddddddddddd');
    if (!response.ok) {
        throw new Error('Failed to bulk sync drawing tools');
    }

    return await response.json();
};

export const searchStock = async filter => {
    const response = await fetch(`http://localhost:5000/api/v1/ticker?search=${filter}`)
    return await response.json();
}

export const findStock = async (id, exchange = '') => {
    let url = `http://localhost:5000/api/v1/ticker/${id}`;
    if (exchange) {
        url += `?exchange=${exchange}`;
    }
    const response = await fetch(url);
    return await response.json();
}

export const findStockByTicker = async ticker => {
    if (!ticker || ticker === 'undefined') {
        console.warn('findStockByTicker called with invalid ticker:', ticker);
        return { status: false, data: null };
    }
    const response = await fetch(`http://localhost:5000/api/v1/stock/symbol/${ticker}`)
    return await response.json();
}

// Layout API
export const getLayouts = async () => {
    const response = await fetch(`http://localhost:5000/api/v1/layouts`);
    if (!response.ok) throw new Error('Failed to fetch layouts');
    return await response.json();
};

export const saveLayout = async (layoutData) => {
    const response = await fetch('http://localhost:5000/api/v1/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
    });
    if (!response.ok) throw new Error('Failed to save layout');
    return await response.json();
};

export const updateLayout = async (id, layoutData) => {
    const response = await fetch(`http://localhost:5000/api/v1/layouts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
    });
    if (!response.ok) throw new Error('Failed to update layout');
    return await response.json();
};

export const deleteLayout = async (id) => {
    const response = await fetch(`http://localhost:5000/api/v1/layouts/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete layout');
    return true;
};
export const setDefaultLayout = async (id) => {
    const response = await fetch(`http://localhost:5000/api/v1/layouts/${id}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: "1" })
    });
    if (!response.ok) throw new Error('Failed to set default layout');
    return await response.json();
};

export const touchLayout = async (id) => {
    const response = await fetch(`http://localhost:5000/api/v1/layouts/${id}/touch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('Failed to touch layout');
    return await response.json();
};
