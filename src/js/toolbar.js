import * as Icons from './icons.js';

export const toolCategories = {
    'cursor-tools': [
        {
            groupName: "Cursors",
            tools: [
                { name: 'Cursor', icon: Icons.svgCursor, tool: '' },
                { name: 'Eraser', icon: Icons.svgEraser, tool: 'eraser' },
            ]
        }
    ],
    'line-tools': [
        {
            groupName: "Basic Lines",
            tools: [
                { name: 'Trend Line', icon: Icons.svgLine, shortcut: 'Alt+T', tool: 'trend-line' },
                { name: 'Horizontal Line', icon: Icons.svgHLine, shortcut: 'Alt+L', tool: 'horizontal-line' },
                { name: 'Vertical Line', icon: Icons.svgVLine, shortcut: 'Alt+V', tool: 'vertical-line' }
            ]
        },
        {
            groupName: "Advanced Lines",
            tools: [
                { name: 'Ray', icon: Icons.svgRay, shortcut: '', tool: 'ray' },
                { name: 'Horizontal Ray', icon: Icons.svgHRay, shortcut: 'Alt+R', tool: 'horizontal-ray' },
                { name: 'Extended Line', icon: Icons.svgExtended, shortcut: '', tool: 'extended-line' },
                { name: 'Info Line', icon: Icons.svgInfo, shortcut: '', tool: 'info-line' },
                { name: 'Trend Angle', icon: Icons.svgAngle, shortcut: '', tool: 'trend-angle' },
                { name: 'Cross Line', icon: Icons.svgCross, shortcut: 'Alt+C', tool: 'cross-line' },
            ]
        },
        {
            groupName: "Channels",
            tools: [
                { name: 'Parallel Channel', icon: Icons.svgParallelChannel, shortcut: '', tool: 'parallel-channel' },
                { name: 'Regression Trend', icon: Icons.svgRegressionTrend, shortcut: '', tool: 'regression-trend' },
                { name: 'Flat Top/Bottom', icon: Icons.svgFlatTopBottom, shortcut: '', tool: 'flat-top-bottom' },
                { name: 'Disjoint Channel', icon: Icons.svgDisjointChannel, shortcut: '', tool: 'disjoint-channel' },
            ]
        },
        {
            groupName: "Pitchforks",
            tools: [
                { name: 'Andrews Pitchfork', icon: Icons.svgPitch, shortcut: '', tool: 'pitchfork' },
                { name: 'Schiff Pitchfork', icon: Icons.svgSchiffPitchfork, shortcut: '', tool: 'schiff-pitchfork' },
                { name: 'Modified Schiff Pitchfork', icon: Icons.svgModifiedSchiffPitchfork, shortcut: '', tool: 'modified-schiff-pitchfork' },
                { name: 'Inside Pitchfork', icon: Icons.svgInsidePitchfork, shortcut: '', tool: 'inside-pitchfork' },
            ]
        }
    ],
    'visibility-tools': [
        {
            groupName: "Visibility",
            tools: [
                { name: 'Hide Drawings', icon: Icons.svgHideDrawings, tool: 'toggle-drawings', type: 'action' },
                { name: 'Hide Indicators', icon: Icons.svgHideIndicators, tool: 'toggle-indicators', type: 'action' },
                { name: 'Hide All', icon: Icons.svgHideAll, tool: 'toggle-all', type: 'action' },
            ]
        }
    ],
    'fibonacci-tools': [
        {
            groupName: "Fibonacci Tools",
            tools: [
                { name: 'Fibonacci Retracement', icon: Icons.svgFib, shortcut: 'Alt+F', tool: 'fibonacci-retracement' },
                { name: 'Trend-Based Fib Extension', icon: Icons.svgFibExt, shortcut: '', tool: 'fibonacci-extension' },
                { name: 'Trend-Based Fib Time', icon: Icons.svgFibTime, shortcut: '', tool: 'fibonacci-time' },
                { name: 'Fib Speed Resistance Fan', icon: Icons.svgFibFan, shortcut: '', tool: 'fibonacci-fan' },
                { name: 'Fibonacci Channel', icon: Icons.svgFibChan, shortcut: '', tool: 'fibonacci-channel' },
                { name: 'Fibonacci Circles', icon: Icons.svgFibCirc, shortcut: '', tool: 'fibonacci-circle' },
                { name: 'Fibonacci Spiral', icon: Icons.svgFibSpiral, shortcut: '', tool: 'fibonacci-spiral' },
                { name: 'Fib Speed Resistance Arcs', icon: Icons.svgFibArcs, shortcut: '', tool: 'fibonacci-arcs' },
                { name: 'Fibonacci Wedge', icon: Icons.svgFibWedge, shortcut: '', tool: 'fibonacci-wedge' },
                { name: 'Pitch Fan', icon: Icons.svgPitchFan, shortcut: '', tool: 'pitch-fan' },
            ]
        },
        {
            groupName: "Gann Tools",
            tools: [
                { name: 'Gann Box', icon: Icons.svgGannBox, shortcut: '', tool: 'gann-box' },
                { name: 'Gann Square', icon: Icons.svgGannSquare, shortcut: '', tool: 'gann-square' },
                { name: 'Gann Square Fixed', icon: Icons.svgGannSquareFixed, shortcut: '', tool: 'gann-square-fixed' },
                { name: 'Gann Fan', icon: Icons.svgGannFan, shortcut: '', tool: 'gann-fan' },
            ]
        }
    ],
    'shape-tools': [
        {
            groupName: "Pen Tools",
            tools: [
                { name: 'Brush', icon: Icons.svgBrush, shortcut: '', tool: 'brush' },
                { name: 'Highlighter', icon: Icons.svgHighlighter, shortcut: '', tool: 'highlighter' },
            ]
        },
        {
            groupName: "Shapes",
            tools: [
                { name: 'Rectangle', icon: Icons.svgRect, shortcut: 'Alt+Shift+R', tool: 'rectangle' },
                { name: 'Circle', icon: Icons.svgCircle, shortcut: '', tool: 'circle' },
                { name: 'Ellipse', icon: Icons.svgEllipse, shortcut: '', tool: 'ellipse' },
                { name: 'Triangle', icon: Icons.svgTriangle, shortcut: '', tool: 'triangle' },
                { name: 'Rotated Rectangle', icon: Icons.svgRotRect, shortcut: '', tool: 'rotated-rectangle' },
                { name: 'Path', icon: Icons.svgPathIcon, shortcut: '', tool: 'path' },
                { name: 'Polyline', icon: Icons.svgPoly, shortcut: '', tool: 'polyline' },
                { name: 'Arc', icon: Icons.svgArc, shortcut: '', tool: 'arc' },
                { name: 'Curve', icon: Icons.svgCurve, shortcut: '', tool: 'curve' },
                { name: 'Double Curve', icon: Icons.svgDoubleCurve, shortcut: '', tool: 'double-curve' },
            ]
        }
    ],
    'technical-tools': [
        {
            groupName: "Projection",
            tools: [
                { name: 'Long Position', icon: Icons.svgLong, shortcut: '', tool: 'long-position' },
                { name: 'Short Position', icon: Icons.svgShort, shortcut: '', tool: 'short-position' },
                { name: 'Forecast', icon: Icons.svgForecast, shortcut: '', tool: 'forecast' },
                { name: 'Bars Pattern', icon: Icons.svgBarsPattern, shortcut: '', tool: 'bars-pattern' },
                { name: 'Projection', icon: Icons.svgProj, shortcut: '', tool: 'projection' },
            ]
        },
        {
            groupName: "Measurer",
            tools: [
                { name: 'Price Range', icon: Icons.svgMeasPrice, shortcut: '', tool: 'price-range' },
                { name: 'TIme Range', icon: Icons.svgMeasTime, shortcut: '', tool: 'time-range' },
                { name: 'Date and Price Range', icon: Icons.svgMeasPriceTime, shortcut: '', tool: 'price-time-range' },
            ]
        }
    ],
    'arrow-tools': [
        {
            groupName: "Arrows",
            tools: [
                { name: 'Arrow', icon: Icons.svgArrowRight, shortcut: '', tool: 'arrow' },
                { name: 'Arrow Mark Up', icon: Icons.svgArrowUp, shortcut: '', tool: 'arrow-mark-up' },
                { name: 'Arrow Mark Down', icon: Icons.svgArrowDown, shortcut: '', tool: 'arrow-mark-down' },
                { name: 'Arrow Marker', icon: Icons.svgArrowMarker, shortcut: '', tool: 'arrow-marker' },
            ]
        }
    ],
    'text-tools': [
        {
            groupName: "Annotation",
            tools: [
                { name: 'Text', icon: Icons.svgText, shortcut: '', tool: 'text' },
                { name: 'Anchored Text', icon: Icons.svgAnchoredText, shortcut: '', tool: 'anchored-text' },
                { name: 'Pin', icon: Icons.svgPin, shortcut: '', tool: 'pin' },
                { name: 'Table', icon: Icons.svgTable, shortcut: '', tool: 'table' },
                { name: 'Callout', icon: Icons.svgCallout, shortcut: '', tool: 'callout' },
                { name: 'Comment', icon: Icons.svgComment, shortcut: '', tool: 'comment' },
                { name: 'Price Label', icon: Icons.svgPriceLabel, shortcut: '', tool: 'price-label' },
                { name: 'Signpost', icon: Icons.svgSignpost, shortcut: '', tool: 'sign-post' },
                { name: 'Flag Mark', icon: Icons.svgFlag, shortcut: '', tool: 'flag-mark' },
            ]
        }
    ],
    'pattern-tools': [
        {
            groupName: "Chart Patterns",
            tools: [
                { name: 'XABCD Pattern', icon: Icons.svgXABCD, tool: 'xabcd-pattern' },
                { name: 'Cypher Pattern', icon: Icons.svgCypher, tool: 'cypher-pattern' },
                { name: 'Head and Shoulders', icon: Icons.svgHS, tool: 'hs-pattern' },
                { name: 'ABCD Pattern', icon: Icons.svgABCD, tool: 'abcd-pattern' },
                { name: 'Triangle Pattern', icon: Icons.svgTriangle, tool: 'triangle-pattern' },
                { name: 'Three Drives Pattern', icon: Icons.svgThreeDrives, tool: 'three-drives-pattern' },
            ]
        },
        {
            groupName: "Elliott Waves",
            tools: [
                { name: 'Elliott Impulse Wave (12345)', icon: Icons.svgElliottImpulse, tool: 'elliott-impulse' },
                { name: 'Elliott Correction Wave (ABC)', icon: Icons.svgElliottCorrection, tool: 'elliott-correction' },
                { name: 'Elliott Triangle Wave (ABCDE)', icon: Icons.svgElliottTriangle, tool: 'elliott-triangle' },
                { name: 'Elliott Double Combo (WXY)', icon: Icons.svgElliottCorrection, tool: 'elliott-double-combo' },
                { name: 'Elliott Triple Combo WXYXZ', icon: Icons.svgElliottImpulse, tool: 'elliott-triple-combo' },
            ]
        },
        {
            groupName: "Cycles",
            tools: [
                { name: 'Cyclic Lines', icon: Icons.svgCyclicLines, tool: 'cyclic-lines' },
                { name: 'Time Cycles', icon: Icons.svgTimeCycles, tool: 'time-cycles' },
                { name: 'Sine Line', icon: Icons.svgSineLine, tool: 'sine-line' },
            ]
        }
    ],
    'remove-tools': [
        {
            groupName: 'Remove',
            tools: [
                { name: 'Remove Drawings', tool: 'remove-drawings', icon: Icons.svgTrash, type: 'action' },
                { name: 'Remove Indicators', tool: 'remove-indicators', icon: Icons.svgTrashIndicators, type: 'action' },
                { name: 'Remove All', tool: 'remove-all', icon: Icons.svgTrashAll, type: 'action' }
            ]
        }
    ]
};

const svgSmallChevronRight = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="9 18 15 12 9 6"></polyline></svg>';
const svgSmallChevronLeft = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="15 18 9 12 15 6"></polyline></svg>';

export class ToolbarManager {
    constructor() {
        this.currentOpenButton = null;
        this.dropdown = document.getElementById('tool-dropdown');
        this.lastUsedTools = {}; // Cache last used tool per group
        this.toolToContainer = {}; // Map tool name to its container
        this.setupEventListeners();
        this.initLastTools();
        this.mapToolsToContainers();
        this.listenToChart();
        this.updateVisibilityButtonState();
        this.previousToolBeforeDropdown = null;
    }

    mapToolsToContainers() {
        document.querySelectorAll('.split-btn-container').forEach(container => {
            const groupsAttr = container.getAttribute('data-tool-groups');
            if (!groupsAttr) return;
            const groups = groupsAttr.split(',');
            groups.forEach(group => {
                const toolCategory = toolCategories[group];
                if (toolCategory) {
                    toolCategory.forEach(g => {
                        g.tools.forEach(t => {
                            const toolName = (t.tool === null || t.tool === undefined) ? '' : t.tool;
                            this.toolToContainer[toolName] = container;
                        });
                    });
                }
            });
        });
    }

    listenToChart() {
        if (typeof window.chart !== 'undefined') {
            window.chart.onToolChange = (toolType) => {
                const tool = (toolType === null || toolType === undefined) ? '' : toolType;
                const container = this.toolToContainer[tool];

                document.querySelectorAll('.split-btn-container').forEach(c => {
                    if (c.id === 'btn-visibility-tools') return;
                    c.classList.remove('active');
                });
                if (container) {
                    container.classList.add('active');
                }
            };
        }
    }

    initLastTools() {
        // Initialize last tools with the first tool of each category
        Object.keys(toolCategories).forEach(catId => {
            const firstTool = toolCategories[catId][0].tools[0];
            this.lastUsedTools[catId] = {
                tool: firstTool.tool,
                icon: firstTool.icon,
                name: firstTool.name,
                type: firstTool.type || ''
            };
        });
    }

    setupEventListeners() {
        document.querySelectorAll('.split-btn-container').forEach(container => {
            const toolGroups = container.getAttribute('data-tool-groups');
            const mainBtn = container.querySelector('.btn-main');
            const arrowBtn = container.querySelector('.btn-arrow');

            if (arrowBtn) {
                // Set initial arrow
                arrowBtn.innerHTML = svgSmallChevronRight;

                // Arrow click: toggle dropdown
                arrowBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleToolDropdown(container);
                });
            }

            if (mainBtn) {
                // Main button click: activate last used tool
                mainBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Special behavior for drawing & cursor: if already active, open dropdown on repeat click
                    const drawingAndCursorGroups = ['cursor-tools', 'line-tools', 'fibonacci-tools', 'pattern-tools', 'shape-tools', 'technical-tools', 'arrow-tools', 'text-tools'];
                    if (drawingAndCursorGroups.includes(toolGroups) && container.classList.contains('active')) {
                        this.toggleToolDropdown(container);
                        return;
                    }

                    this.closeDropdown(); // Close any open dropdown first
                    const lastTool = this.lastUsedTools[toolGroups];
                    if (lastTool) {
                        if (lastTool.type === 'action') {
                            this.handleActionTool(lastTool.tool);
                        } else {
                            console.log(`Activating last tool: ${lastTool.tool} for ${toolGroups}`);
                            if (window.chart) window.chart.setTool(lastTool.tool);

                            // Highlight this container
                            document.querySelectorAll('.split-btn-container').forEach(c => {
                                if (c.id === 'btn-visibility-tools') return; // Keep visibility tools independent
                                c.classList.remove('active');
                            });
                            container.classList.add('active');
                        }
                    }
                });
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.dropdown && !this.dropdown.contains(e.target)) {
                const isToolbarButton = e.target.closest('.split-btn-container');
                if (!isToolbarButton) {
                    this.closeDropdown();
                }
            }
        });
    }

    toggleToolDropdown(container) {
        const toolGroups = container.getAttribute('data-tool-groups');
        const arrowBtn = container.querySelector('.btn-arrow');

        if (this.currentOpenButton === container) {
            this.closeDropdown();
            return;
        }

        this.closeDropdown();
        this.currentOpenButton = container;

        // Disable drawing while dropdown is open
        if (typeof window.chart !== 'undefined') {
            this.previousToolBeforeDropdown = window.chart.activeTool;
            window.chart.setTool(null);
        }

        // Toggle arrow to left
        if (arrowBtn) arrowBtn.innerHTML = svgSmallChevronLeft;

        this.showToolDropdown(toolGroups);
    }

    showToolDropdown(toolGroups) {
        this.dropdown.innerHTML = this.buildDropdownContent(toolGroups);
        this.dropdown.style.display = 'flex';

        // Hitung posisi relatif terhadap main-content
        const buttonRect = this.currentOpenButton.getBoundingClientRect();
        const mainContent = this.currentOpenButton.closest('#main-content');
        if (mainContent) {
            const containerRect = mainContent.getBoundingClientRect();
            this.dropdown.style.top = `${buttonRect.top - containerRect.top}px`;
            this.dropdown.style.left = `5px`;
        }

        this.dropdown.querySelectorAll('.tool-item').forEach(item => {
            item.addEventListener('click', () => {
                const toolName = item.getAttribute('data-tool');
                const toolType = item.getAttribute('data-type');
                const iconHtml = item.querySelector('.tool-item-icon').innerHTML;
                const toolLabel = item.querySelector('.tool-item-name').innerText;

                console.log(`Selected tool: ${toolName} (Type: ${toolType})`);

                // Action tools don't change selection, they just trigger once
                if (toolType === 'action') {
                    this.handleActionTool(toolName);
                    this.closeDropdown();
                    return;
                }

                // Update last used tool
                this.lastUsedTools[toolGroups] = {
                    tool: toolName,
                    icon: iconHtml,
                    name: toolLabel,
                    type: toolType || ''
                };

                // Update main button icon and title
                const mainBtn = this.currentOpenButton.querySelector('.btn-main');
                if (mainBtn) {
                    const iconContainer = mainBtn.querySelector('.icon');
                    if (iconContainer) iconContainer.innerHTML = iconHtml;
                    mainBtn.title = toolLabel;
                }

                if (window.chart) window.chart.setTool(toolName);

                // Highlight only this container
                document.querySelectorAll('.split-btn-container').forEach(c => c.classList.remove('active'));
                const btnToKeep = this.currentOpenButton;
                this.closeDropdown();
                if (btnToKeep) btnToKeep.classList.add('active');
            });
        });
    }

    handleActionTool(action) {
        if (typeof window.chart === 'undefined') return;

        const isDrawingsHidden = window.chart.hideDrawings;
        const isIndicatorsHidden = window.chart.hideIndicators;
        const isAllHidden = isDrawingsHidden && isIndicatorsHidden;

        switch (action) {
            case 'toggle-drawings':
                if (isDrawingsHidden && !isIndicatorsHidden) {
                    window.chart.hideDrawings = false;
                } else {
                    window.chart.hideDrawings = true;
                    window.chart.hideIndicators = false;
                }
                break;
            case 'toggle-indicators':
                if (isIndicatorsHidden && !isDrawingsHidden) {
                    window.chart.hideIndicators = false;
                } else {
                    window.chart.hideIndicators = true;
                    window.chart.hideDrawings = false;
                }
                break;
            case 'toggle-all':
                if (isAllHidden) {
                    window.chart.hideDrawings = false;
                    window.chart.hideIndicators = false;
                } else {
                    window.chart.hideDrawings = true;
                    window.chart.hideIndicators = true;
                }
                break;
            case 'remove-drawings':
                window.chart.removeAllDrawings();
                break;
            case 'remove-indicators':
                window.chart.removeAllIndicators();
                break;
            case 'remove-all':
                window.chart.removeAll();
                break;
        }
        window.chart.render();

        this.updateVisibilityButtonState();

        // Refresh dropdown if it's for visibility
        if (this.currentOpenButton && this.currentOpenButton.id === 'btn-visibility-tools') {
            const toolGroups = this.currentOpenButton.getAttribute('data-tool-groups');
            this.showToolDropdown(toolGroups);
        }
    }

    updateVisibilityButtonState() {
        if (typeof window.chart === 'undefined') return;
        const container = document.getElementById('btn-visibility-tools');
        if (container) {
            if (window.chart.hideDrawings || window.chart.hideIndicators) {
                container.classList.add('active');
            } else {
                // Only remove if it's not actually the open button right now
                if (this.currentOpenButton !== container) {
                    container.classList.remove('active');
                }
            }
        }
    }

    buildDropdownContent(toolGroups) {
        if (!toolGroups) return '';
        let html = '';
        const categories = toolGroups.split(',');

        categories.forEach(category => {
            const toolCategory = toolCategories[category];
            if (toolCategory) {
                toolCategory.forEach(group => {
                    html += `<div class="tool-group-title">${group.groupName}</div>`;
                    group.tools.forEach(tool => {
                        let activeClass = '';
                        if (tool.type === 'action' && window.chart) {
                            const isDrawingsOnly = window.chart.hideDrawings && !window.chart.hideIndicators;
                            const isIndicatorsOnly = window.chart.hideIndicators && !window.chart.hideDrawings;
                            const isAll = window.chart.hideDrawings && window.chart.hideIndicators;

                            if (tool.tool === 'toggle-drawings' && isDrawingsOnly) activeClass = 'active';
                            if (tool.tool === 'toggle-indicators' && isIndicatorsOnly) activeClass = 'active';
                            if (tool.tool === 'toggle-all' && isAll) activeClass = 'active';
                        }

                        html += `
                            <div class="tool-item ${activeClass}" data-tool="${tool.tool === null ? '' : tool.tool}" data-type="${tool.type || ''}">
                                <div class="tool-item-icon">${tool.icon}</div>
                                <div class="tool-item-name">${tool.name}</div>
                                ${tool.shortcut ? `<div class="tool-shortcut">${tool.shortcut}</div>` : ''}
                            </div>
                        `;
                    });
                });
            }
        });

        return html;
    }

    closeDropdown() {
        if (this.currentOpenButton) {
            const arrowBtn = this.currentOpenButton.querySelector('.btn-arrow');
            if (arrowBtn) {
                arrowBtn.innerHTML = svgSmallChevronRight;
            }

            const prevBtn = this.currentOpenButton;
            this.currentOpenButton = null;

            if (prevBtn.id === 'btn-visibility-tools') {
                this.updateVisibilityButtonState();
            } else {
                // Check if it's the active tool container before removing
                if (typeof window.chart !== 'undefined' && this.toolToContainer[window.chart.activeTool || ''] !== prevBtn) {
                    prevBtn.classList.remove('active');
                }
            }

            // Restore previous tool if we didn't pick a new one
            if (typeof window.chart !== 'undefined' && window.chart.activeTool === null && this.previousToolBeforeDropdown) {
                window.chart.setTool(this.previousToolBeforeDropdown);
            }
            this.previousToolBeforeDropdown = null;
        }
        if (this.dropdown) this.dropdown.style.display = 'none';
    }
}
