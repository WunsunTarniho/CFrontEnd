/**
 * ScriptEditorController - Manages the Monaco Editor for ZenScript.
 */
/**
 * ScriptEditorController - Manages the Monaco Editor for ZenScript.
 */

const ZEN_DOCS = {
    // Built-in functions
    'indicator': {
        signature: 'void indicator(string title, string shorttitle="", bool overlay=false, int max_lines_count=500, int max_labels_count=50)',
        desc: 'Declares script properties (Must be called once at script start).',
        params: [
            { name: 'title', desc: 'Full name of the indicator.' },
            { name: 'shorttitle', desc: 'Short name shown in legend.' },
            { name: 'overlay', desc: 'Render on main chart if true.' },
            { name: 'max_lines_count', desc: 'Max historical lines on chart.' },
            { name: 'max_labels_count', desc: 'Max historical labels on chart.' }
        ]
    },
    'sma': {
        signature: 'float sma(float source, int length)',
        desc: 'Simple Moving Average (SMA). Calculates the sum of source values over the last length bars divided by length.',
        params: [
            { name: 'source', desc: 'Series of values to be averaged.' },
            { name: 'length', desc: 'Number of bars.' }
        ]
    },
    'ema': {
        signature: 'float ema(float source, int length)',
        desc: 'Exponential Moving Average (EMA). An exponentially weighted moving average of the source series.',
        params: [
            { name: 'source', desc: 'Series of values to be averaged.' },
            { name: 'length', desc: 'Number of bars.' }
        ]
    },
    'rsi': {
        signature: 'float rsi(float source, int length)',
        desc: 'Relative Strength Index (RSI). Measures speed and change of price movements.',
        params: [
            { name: 'source', desc: 'Series of values to calculate RSI.' },
            { name: 'length', desc: 'Number of bars.' }
        ]
    },
    'stoch': {
        signature: 'float stoch(float source, float high, float low, int length)',
        desc: 'Stochastic Oscillator. Calculates stochastic value based on source, high, low, and length.',
        params: [
            { name: 'source', desc: 'Main source series (usually close).' },
            { name: 'high', desc: 'High price series.' },
            { name: 'low', desc: 'Low price series.' },
            { name: 'length', desc: 'Length (bars).' }
        ]
    },
    'bb': {
        signature: 'float bb(float source, int length, float mult)',
        desc: 'Bollinger Bands. Returns Bollinger Bands values (basis, upper, lower).',
        params: [
            { name: 'source', desc: 'Main source series.' },
            { name: 'length', desc: 'Length (bars).' },
            { name: 'mult', desc: 'Standard deviation multiplier.' }
        ]
    },
    'atr': {
        signature: 'float atr(int length)',
        desc: 'Average True Range (ATR). Measures market volatility.',
        params: [
            { name: 'length', desc: 'Number of bars.' }
        ]
    },
    'supertrend': {
        signature: 'float supertrend(float factor, int period)',
        desc: 'SuperTrend indicator. Returns supertrend line value.',
        params: [
            { name: 'factor', desc: 'Multiplier factor.' },
            { name: 'period', desc: 'ATR period length.' }
        ]
    },
    'vwap': {
        signature: 'float vwap(float source)',
        desc: 'Volume Weighted Average Price (VWAP). Calculates volume weighted average price.',
        params: [
            { name: 'source', desc: 'Main source series.' }
        ]
    },
    'plot': {
        signature: 'plot plot(float series, string title, color color, int width, string style, bool force_overlay)',
        desc: 'Plots a time-series on the chart, returning a plot reference for area filling.',
        params: [
            { name: 'series', desc: 'Data series to plot (e.g. close).' },
            { name: 'title', desc: 'Title of the plot.' },
            { name: 'color', desc: 'Color of the plot line.' },
            { name: 'width', desc: 'Width of the line.' },
            { name: 'style', desc: 'Plot style ("line", "histogram", "columns").' },
            { name: 'force_overlay', desc: 'Force plot on main chart.' }
        ]
    },
    'plotshape': {
        signature: 'void plotshape(float|bool series, string title, string style, string location, color color, string size, string text)',
        desc: 'Plots a shape at specific locations when a condition is met.',
        params: [
            { name: 'series', desc: 'Boolean/float condition series.' },
            { name: 'title', desc: 'Plot title.' },
            { name: 'style', desc: 'Shape style ("triangleup", "triangledown", etc).' },
            { name: 'location', desc: 'Shape location ("abovebar", "belowbar", etc).' },
            { name: 'color', desc: 'Color of the shape.' },
            { name: 'size', desc: 'Size of the shape ("small", "normal", "large").' },
            { name: 'text', desc: 'Annotation text.' }
        ]
    },
    'plotchar': {
        signature: 'void plotchar(float|bool series, string title, string char, string location, color color, string size)',
        desc: 'Plots characters on the chart.',
        params: [
            { name: 'series', desc: 'Boolean/float condition series.' },
            { name: 'title', desc: 'Plot title.' },
            { name: 'char', desc: 'Character to plot.' },
            { name: 'location', desc: 'Location on chart.' },
            { name: 'color', desc: 'Color of character.' },
            { name: 'size', desc: 'Size.' }
        ]
    },
    'plotarrow': {
        signature: 'void plotarrow(float|bool series, string title, color colorup, color colordown)',
        desc: 'Plots up/down arrows based on series value.',
        params: [
            { name: 'series', desc: 'Data series (positive plots up, negative plots down).' },
            { name: 'title', desc: 'Plot title.' },
            { name: 'colorup', desc: 'Up arrow color.' },
            { name: 'colordown', desc: 'Down arrow color.' }
        ]
    },
    'plotcandle': {
        signature: 'void plotcandle(float open, float high, float low, float close, string title, color color, color wickcolor, color bordercolor)',
        desc: 'Plots a custom candlestick series.',
        params: [
            { name: 'open', desc: 'Open price series.' },
            { name: 'high', desc: 'High price series.' },
            { name: 'low', desc: 'Low price series.' },
            { name: 'close', desc: 'Close price series.' },
            { name: 'title', desc: 'Plot title in legend.' },
            { name: 'color', desc: 'Body fill color.' },
            { name: 'wickcolor', desc: 'Wick color.' },
            { name: 'bordercolor', desc: 'Border color.' }
        ]
    },
    'hline': {
        signature: 'hline hline(float price, string title, color color, int width, string style)',
        desc: 'Plots a constant horizontal price line, returning an hline reference for area filling.',
        params: [
            { name: 'price', desc: 'Price level.' },
            { name: 'title', desc: 'Title.' },
            { name: 'color', desc: 'Line color.' },
            { name: 'width', desc: 'Line width.' },
            { name: 'style', desc: 'Line style ("solid", "dashed", "dotted").' }
        ]
    },
    'bgcolor': {
        signature: 'void bgcolor(color color, string title, bool force_overlay)',
        desc: 'Fills the background color of the chart.',
        params: [
            { name: 'color', desc: 'Background color.' },
            { name: 'title', desc: 'Title.' },
            { name: 'force_overlay', desc: 'Force background fill on main chart.' }
        ]
    },
    'barcolor': {
        signature: 'void barcolor(color color, string title, bool force_overlay)',
        desc: 'Colors the chart bars/candles.',
        params: [
            { name: 'color', desc: 'Bar color.' },
            { name: 'title', desc: 'Title.' },
            { name: 'force_overlay', desc: 'Force color on main chart.' }
        ]
    },
    'fill': {
        signature: 'void fill(plot p1, plot p2, color color, string title)',
        desc: 'Fills the region between two plot lines.',
        params: [
            { name: 'p1', desc: 'First plot reference.' },
            { name: 'p2', desc: 'Second plot reference.' },
            { name: 'color', desc: 'Fill color.' },
            { name: 'title', desc: 'Title.' }
        ]
    },
    'crossover': {
        signature: 'bool crossover(float s1, float s2)',
        desc: 'Checks if series 1 crosses above series 2.',
        params: [
            { name: 's1', desc: 'First data series.' },
            { name: 's2', desc: 'Second data series.' }
        ]
    },
    'crossunder': {
        signature: 'bool crossunder(float s1, float s2)',
        desc: 'Checks if series 1 crosses below series 2.',
        params: [
            { name: 's1', desc: 'First data series.' },
            { name: 's2', desc: 'Second data series.' }
        ]
    },
    'highest': {
        signature: 'float highest(float source, int length)',
        desc: 'Highest value in a lookback window.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'lowest': {
        signature: 'float lowest(float source, int length)',
        desc: 'Lowest value in a lookback window.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'stdev': {
        signature: 'float stdev(float source, int length)',
        desc: 'Standard Deviation.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'variance': {
        signature: 'float variance(float source, int length)',
        desc: 'Sample variance of a series.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'covariance': {
        signature: 'float covariance(float source1, float source2, int length)',
        desc: 'Covariance of two series.',
        params: [
            { name: 'source1', desc: 'First source series.' },
            { name: 'source2', desc: 'Second source series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'correlation': {
        signature: 'float correlation(float source1, float source2, int length)',
        desc: 'Pearson Correlation Coefficient of two series.',
        params: [
            { name: 'source1', desc: 'First source series.' },
            { name: 'source2', desc: 'Second source series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'linreg': {
        signature: 'float linreg(float source, int length, int offset)',
        desc: 'Linear regression curve value at offset.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' },
            { name: 'offset', desc: 'Bar offset (optional, default: 0).' }
        ]
    },
    'linreg_slope': {
        signature: 'float linreg_slope(float source, int length)',
        desc: 'Linear regression slope.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'linreg_intercept': {
        signature: 'float linreg_intercept(float source, int length)',
        desc: 'Linear regression intercept.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length.' }
        ]
    },
    'change': {
        signature: 'float change(float source, int length=1)',
        desc: 'Difference between current value and value from length bars ago.',
        params: [
            { name: 'source', desc: 'Source data series.' },
            { name: 'length', desc: 'Lookback length (default: 1).' }
        ]
    },
    'pivothigh': {
        signature: 'float pivothigh(float source, int leftBars, int rightBars)',
        desc: 'Returns the price level of a Pivot High when a peak is confirmed.',
        params: [
            { name: 'source', desc: 'Source series.' },
            { name: 'leftBars', desc: 'Number of preceding bars to compare.' },
            { name: 'rightBars', desc: 'Number of succeeding bars to compare.' }
        ]
    },
    'pivotlow': {
        signature: 'float pivotlow(float source, int leftBars, int rightBars)',
        desc: 'Returns the price level of a Pivot Low when a trough is confirmed.',
        params: [
            { name: 'source', desc: 'Source series.' },
            { name: 'leftBars', desc: 'Number of preceding bars to compare.' },
            { name: 'rightBars', desc: 'Number of succeeding bars to compare.' }
        ]
    },
    'fixnan': {
        signature: 'float fixnan(float source)',
        desc: 'Replaces NaN values with the last valid non-NaN value in the series.',
        params: [
            { name: 'source', desc: 'Source series.' }
        ]
    },
    'rgba': {
        signature: 'color rgba(int red, int green, int blue, float alpha)',
        desc: 'Creates a custom color from RGBA channels.',
        params: [
            { name: 'red', desc: 'Red component (0 to 255).' },
            { name: 'green', desc: 'Green component (0 to 255).' },
            { name: 'blue', desc: 'Blue component (0 to 255).' },
            { name: 'alpha', desc: 'Transparency (0.0 to 1.0 or 0 to 100).' }
        ]
    },
    'abs': {
        signature: 'float abs(float source)',
        desc: 'Returns the absolute value of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'ceil': {
        signature: 'float ceil(float source)',
        desc: 'Returns the smallest integer value that is greater than or equal to the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'floor': {
        signature: 'float floor(float source)',
        desc: 'Returns the largest integer value that is less than or equal to the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'sqrt': {
        signature: 'float sqrt(float source)',
        desc: 'Returns the square root of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'exp': {
        signature: 'float exp(float source)',
        desc: 'Returns the natural exponential (e^x) of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'log': {
        signature: 'float log(float source)',
        desc: 'Returns the natural logarithm (base e) of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'log10': {
        signature: 'float log10(float source)',
        desc: 'Returns the base-10 logarithm of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'pow': {
        signature: 'float pow(float base, float exponent)',
        desc: 'Returns the base raised to the power of the exponent.',
        params: [
            { name: 'base', desc: 'The base value or series.' },
            { name: 'exponent', desc: 'The exponent value or series.' }
        ]
    },
    'sin': {
        signature: 'float sin(float source)',
        desc: 'Returns the trigonometric sine of an angle in radians.',
        params: [{ name: 'source', desc: 'The angle series or value in radians.' }]
    },
    'cos': {
        signature: 'float cos(float source)',
        desc: 'Returns the trigonometric cosine of an angle in radians.',
        params: [{ name: 'source', desc: 'The angle series or value in radians.' }]
    },
    'tan': {
        signature: 'float tan(float source)',
        desc: 'Returns the trigonometric tangent of an angle in radians.',
        params: [{ name: 'source', desc: 'The angle series or value in radians.' }]
    },
    'asin': {
        signature: 'float asin(float source)',
        desc: 'Returns the arcsine (in radians) of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'acos': {
        signature: 'float acos(float source)',
        desc: 'Returns the arccosine (in radians) of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'atan': {
        signature: 'float atan(float source)',
        desc: 'Returns the arctangent (in radians) of the source value or series.',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'sign': {
        signature: 'float sign(float source)',
        desc: 'Returns the sign of the source value (1 if positive, -1 if negative, 0 if zero).',
        params: [{ name: 'source', desc: 'The series or value to process.' }]
    },
    'min': {
        signature: 'float min(float a, float b)',
        desc: 'Returns the minimum of two values or series.',
        params: [
            { name: 'a', desc: 'First series or value.' },
            { name: 'b', desc: 'Second series or value.' }
        ]
    },
    'max': {
        signature: 'float max(float a, float b)',
        desc: 'Returns the maximum of two values or series.',
        params: [
            { name: 'a', desc: 'First series or value.' },
            { name: 'b', desc: 'Second series or value.' }
        ]
    },
    'nz': {
        signature: 'float nz(float source, float replacement=0.0)',
        desc: 'Replaces NaN or null values with a replacement value (default is 0.0).',
        params: [
            { name: 'source', desc: 'The series or value to check.' },
            { name: 'replacement', desc: 'The replacement value if source is null/NaN.' }
        ]
    },
    'na': {
        signature: 'bool na(float source)',
        desc: 'Returns true if the value is NaN or null, false otherwise.',
        params: [{ name: 'source', desc: 'The series or value to check.' }]
    },
    'wma': {
        signature: 'float wma(float source, int length)',
        desc: 'Calculates the Weighted Moving Average of a series.',
        params: [
            { name: 'source', desc: 'The series to calculate WMA on.' },
            { name: 'length', desc: 'The lookback window size.' }
        ]
    },
    'rma': {
        signature: 'float rma(float source, int length)',
        desc: 'Calculates the Running Moving Average of a series (exponential moving average with alpha = 1/length).',
        params: [
            { name: 'source', desc: 'The series to calculate RMA on.' },
            { name: 'length', desc: 'The lookback window size.' }
        ]
    },
    'tr': {
        signature: 'float tr()',
        desc: 'Returns the True Range of the current bar (max of high-low, abs(high-prevClose), abs(low-prevClose)).',
        params: []
    },
    'print': {
        signature: 'void print(any arg1, any arg2, ...)',
        desc: 'Prints debug messages to the browser developer console.',
        params: [{ name: 'args', desc: 'Comma-separated values to print.' }]
    },
    'plotbar': {
        signature: 'void plotbar(float open, float high, float low, float close, string title="", color color=color.blue)',
        desc: 'Plots custom price bars on the chart.',
        params: [
            { name: 'open', desc: 'Open series.' },
            { name: 'high', desc: 'High series.' },
            { name: 'low', desc: 'Low series.' },
            { name: 'close', desc: 'Close series.' },
            { name: 'title', desc: 'Title of the plot.' },
            { name: 'color', desc: 'Color of the bars.' }
        ]
    },


    // input namespace
    'input.int': {
        signature: 'int input.int(int defval, string title, int minval, int maxval)',
        desc: 'Declares an integer user-input configuration.',
        params: [
            { name: 'defval', desc: 'Default integer value.' },
            { name: 'title', desc: 'Input title label.' },
            { name: 'minval', desc: 'Minimum permitted value.' },
            { name: 'maxval', desc: 'Maximum permitted value.' }
        ]
    },
    'input.float': {
        signature: 'float input.float(float defval, string title, float minval, float maxval)',
        desc: 'Declares a float user-input configuration.',
        params: [
            { name: 'defval', desc: 'Default float value.' },
            { name: 'title', desc: 'Input title label.' },
            { name: 'minval', desc: 'Minimum permitted value.' },
            { name: 'maxval', desc: 'Maximum permitted value.' }
        ]
    },
    'input.bool': {
        signature: 'bool input.bool(bool defval, string title)',
        desc: 'Declares a boolean user-input checkbox.',
        params: [
            { name: 'defval', desc: 'Default boolean value.' },
            { name: 'title', desc: 'Input title label.' }
        ]
    },
    'input.string': {
        signature: 'string input.string(string defval, string title, any options)',
        desc: 'Declares a string user-input text or dropdown.',
        params: [
            { name: 'defval', desc: 'Default string value.' },
            { name: 'title', desc: 'Input title label.' },
            { name: 'options', desc: 'Dropdown options array (e.g. ["EMA", "SMA"]).' }
        ]
    },
    'input.color': {
        signature: 'color input.color(color defval, string title)',
        desc: 'Declares a color user-input colorpicker.',
        params: [
            { name: 'defval', desc: 'Default color value.' },
            { name: 'title', desc: 'Input title label.' }
        ]
    },
    'input.source': {
        signature: 'float input.source(float defval, string title)',
        desc: 'Declares a data source selector (close, open, high, low).',
        params: [
            { name: 'defval', desc: 'Default data source (close).' },
            { name: 'title', desc: 'Input title label.' }
        ]
    },

    // color namespace
    'color.new': {
        signature: 'color color.new(color color, int transparency)',
        desc: 'Applies transparency level to a color.',
        params: [
            { name: 'color', desc: 'Base color (e.g. color.blue).' },
            { name: 'transparency', desc: 'Transparency percentage (0 to 100).' }
        ]
    },
    'color.rgb': {
        signature: 'color color.rgb(int red, int green, int blue, int transparency)',
        desc: 'Creates a custom color from RGB values.',
        params: [
            { name: 'red', desc: 'Red component (0 to 255).' },
            { name: 'green', desc: 'Green component (0 to 255).' },
            { name: 'blue', desc: 'Blue component (0 to 255).' },
            { name: 'transparency', desc: 'Transparency percentage (optional, 0 to 100).' }
        ]
    },
    'color.gradient': {
        signature: 'color color.gradient(float value, float bottom_value, float top_value, color bottom_color, color top_color)',
        desc: 'Calculates a color dynamically based on a value between bottom and top values, interpolating between two colors.',
        params: [
            { name: 'value', desc: 'The series or value to base the gradient calculation on.' },
            { name: 'bottom_value', desc: 'The lower boundary value.' },
            { name: 'top_value', desc: 'The upper boundary value.' },
            { name: 'bottom_color', desc: 'Color corresponding to bottom_value.' },
            { name: 'top_color', desc: 'Color corresponding to top_value.' }
        ]
    },

    // box namespace
    'box.new': {
        signature: 'box box.new(int left, float top, int right, float bottom, color border_color, int border_width, string border_style, string extend, string xloc, color bgcolor, string text, string text_size, color text_color)',
        desc: 'Draws a box shape on the chart.',
        params: [
            { name: 'left', desc: 'Left boundary (bar index).' },
            { name: 'top', desc: 'Top boundary price level.' },
            { name: 'right', desc: 'Right boundary (bar index).' },
            { name: 'bottom', desc: 'Bottom boundary price level.' },
            { name: 'border_color', desc: 'Color of the box border.' },
            { name: 'border_width', desc: 'Width of the box border (pixels).' },
            { name: 'border_style', desc: 'Border style ("solid", "dashed", "dotted").' },
            { name: 'extend', desc: 'Extend box horizontally ("none", "left", "right", "both").' }
        ]
    },
    'box.set_left': {
        signature: 'void box.set_left(box id, int left)',
        desc: 'Sets the left boundary (bar index) of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'left', desc: 'Left boundary.' }
        ]
    },
    'box.set_top': {
        signature: 'void box.set_top(box id, float top)',
        desc: 'Sets the top boundary (price level) of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'top', desc: 'Top boundary.' }
        ]
    },
    'box.set_right': {
        signature: 'void box.set_right(box id, int right)',
        desc: 'Sets the right boundary (bar index) of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'right', desc: 'Right boundary.' }
        ]
    },
    'box.set_bottom': {
        signature: 'void box.set_bottom(box id, float bottom)',
        desc: 'Sets the bottom boundary (price level) of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'bottom', desc: 'Bottom boundary.' }
        ]
    },
    'box.set_border_color': {
        signature: 'void box.set_border_color(box id, color color)',
        desc: 'Sets the border color of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'color', desc: 'Border color.' }
        ]
    },
    'box.set_border_width': {
        signature: 'void box.set_border_width(box id, int width)',
        desc: 'Sets the border width (pixels) of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'width', desc: 'Border width.' }
        ]
    },
    'box.set_border_style': {
        signature: 'void box.set_border_style(box id, string style)',
        desc: 'Sets the border style of the box ("solid", "dashed", "dotted").',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'style', desc: 'Border style.' }
        ]
    },
    'box.set_extend': {
        signature: 'void box.set_extend(box id, string extend)',
        desc: 'Sets whether the box extends horizontally ("none", "left", "right", "both").',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'extend', desc: 'Extend direction.' }
        ]
    },
    'box.set_bgcolor': {
        signature: 'void box.set_bgcolor(box id, color color)',
        desc: 'Sets the background fill color of the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'color', desc: 'Background color.' }
        ]
    },
    'box.set_text': {
        signature: 'void box.set_text(box id, string text)',
        desc: 'Sets the text to display inside the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'text', desc: 'Text content.' }
        ]
    },
    'box.set_text_size': {
        signature: 'void box.set_text_size(box id, string size)',
        desc: 'Sets the size of the text inside the box ("small", "normal", "large", "huge").',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'size', desc: 'Text size.' }
        ]
    },
    'box.set_text_color': {
        signature: 'void box.set_text_color(box id, color color)',
        desc: 'Sets the color of the text inside the box.',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'color', desc: 'Text color.' }
        ]
    },
    'box.set_text_halign': {
        signature: 'void box.set_text_halign(box id, string halign)',
        desc: 'Sets the horizontal alignment of the text inside the box ("left", "center", "right").',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'halign', desc: 'Horizontal alignment.' }
        ]
    },
    'box.set_text_valign': {
        signature: 'void box.set_text_valign(box id, string valign)',
        desc: 'Sets the vertical alignment of the text inside the box ("top", "middle", "bottom").',
        params: [
            { name: 'id', desc: 'The box object.' },
            { name: 'valign', desc: 'Vertical alignment.' }
        ]
    },
    'box.delete': {
        signature: 'void box.delete(box id)',
        desc: 'Removes/deletes the box from the chart.',
        params: [
            { name: 'id', desc: 'The box object to delete.' }
        ]
    },

    // label namespace
    'label.new': {
        signature: 'label label.new(int x, float y, string text, string xloc, string yloc, color color, string style, color textcolor, string size)',
        desc: 'Creates an interactive text label on the chart.',
        params: [
            { name: 'x', desc: 'X coordinate (bar index).' },
            { name: 'y', desc: 'Y coordinate (price level).' },
            { name: 'text', desc: 'Label text content.' },
            { name: 'xloc', desc: 'X positioning coordinate system ("bar_index").' },
            { name: 'yloc', desc: 'Y positioning coordinate system ("price", "abovebar", "belowbar").' }
        ]
    },

    // line namespace
    'line.new': {
        signature: 'line line.new(int x1, float y1, int x2, float y2, color color, int width, string style)',
        desc: 'Draws a customized line segment on the chart.',
        params: [
            { name: 'x1', desc: 'Start X coordinate (bar index).' },
            { name: 'y1', desc: 'Start Y coordinate (price).' },
            { name: 'x2', desc: 'End X coordinate (bar index).' },
            { name: 'y2', desc: 'End Y coordinate (price).' },
            { name: 'color', desc: 'Color of the line.' },
            { name: 'width', desc: 'Width of the line (pixels).' },
            { name: 'style', desc: 'Line style ("solid", "dashed", "dotted").' }
        ]
    },

    // array namespace
    'array.new_float': {
        signature: 'array array.new_float(int size=0, float initial_value=null)',
        desc: 'Creates a new ZenArray of float type.',
        params: [
            { name: 'size', desc: 'Initial size of the array.' },
            { name: 'initial_value', desc: 'Initial value for all elements.' }
        ]
    },
    'array.new_int': {
        signature: 'array array.new_int(int size=0, int initial_value=null)',
        desc: 'Creates a new ZenArray of int type.',
        params: [
            { name: 'size', desc: 'Initial size.' },
            { name: 'initial_value', desc: 'Initial value.' }
        ]
    },
    'array.new_bool': {
        signature: 'array array.new_bool(int size=0, bool initial_value=null)',
        desc: 'Creates a new ZenArray of bool type.',
        params: [
            { name: 'size', desc: 'Initial size.' },
            { name: 'initial_value', desc: 'Initial value.' }
        ]
    },
    'array.new_color': {
        signature: 'array array.new_color(int size=0, color initial_value=null)',
        desc: 'Creates a new ZenArray of color type.',
        params: [
            { name: 'size', desc: 'Initial size.' },
            { name: 'initial_value', desc: 'Initial value.' }
        ]
    },
    'array.new_string': {
        signature: 'array array.new_string(int size=0, string initial_value=null)',
        desc: 'Creates a new ZenArray of string type.',
        params: [
            { name: 'size', desc: 'Initial size.' },
            { name: 'initial_value', desc: 'Initial value.' }
        ]
    },
    'array.push': {
        signature: 'void array.push(array id, any value)',
        desc: 'Pushes a value to the end of the array.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'value', desc: 'The value to push.' }
        ]
    },
    'array.get': {
        signature: 'any array.get(array id, int index)',
        desc: 'Gets the value at the specified index from the array.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'index', desc: 'The index of the element.' }
        ]
    },
    'array.set': {
        signature: 'void array.set(array id, int index, any value)',
        desc: 'Sets the value at the specified index in the array.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'index', desc: 'The index of the element.' },
            { name: 'value', desc: 'The new value.' }
        ]
    },
    'array.size': {
        signature: 'int array.size(array id)',
        desc: 'Returns the size (number of elements) of the array.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.clear': {
        signature: 'void array.clear(array id)',
        desc: 'Clears all elements from the array (sets size to 0).',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.remove': {
        signature: 'any array.remove(array id, int index)',
        desc: 'Removes the element at the specified index and returns it.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'index', desc: 'The index to remove.' }
        ]
    },
    'array.insert': {
        signature: 'void array.insert(array id, int index, any value)',
        desc: 'Inserts a value at the specified index, shifting subsequent elements.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'index', desc: 'The index to insert at.' },
            { name: 'value', desc: 'The value to insert.' }
        ]
    },
    'array.pop': {
        signature: 'any array.pop(array id)',
        desc: 'Removes the last element of the array and returns it.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.shift': {
        signature: 'any array.shift(array id)',
        desc: 'Removes the first element of the array and returns it.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.unshift': {
        signature: 'void array.unshift(array id, any value)',
        desc: 'Adds a value to the beginning of the array.',
        params: [
            { name: 'id', desc: 'The array object.' },
            { name: 'value', desc: 'The value to prepend.' }
        ]
    },
    'array.sort': {
        signature: 'array array.sort(array id)',
        desc: 'Sorts the array elements in ascending order in-place.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.avg': {
        signature: 'float array.avg(array id)',
        desc: 'Returns the average value of all elements in the array.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.min': {
        signature: 'float array.min(array id)',
        desc: 'Returns the minimum value in the array.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.max': {
        signature: 'float array.max(array id)',
        desc: 'Returns the maximum value in the array.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    },
    'array.sum': {
        signature: 'float array.sum(array id)',
        desc: 'Returns the sum of all elements in the array.',
        params: [
            { name: 'id', desc: 'The array object.' }
        ]
    }
};

export class ScriptEditorController {
    constructor(chart) {
        this.chart = chart;
        this.container = document.getElementById('script-editor-panel');
        this.monacoContainer = document.getElementById('monaco-editor-container');
        this.nameInput = document.getElementById('editor-script-name');
        
        this.editor = null;
        this.currentScriptName = "New Indicator";
        this.currentScriptId = null;
        this.addChartBtn = document.getElementById('editor-add-chart-btn');
        this.isInitialized = false;
        this.defaultScript = "// ZenScript Indicator\nint length = 14;\nfloat src = close;\nfloat val = sma(src, length);\nplot(val, \"SMA\", #2962ff);";
        
        // Dirty state tracking
        this.lastSavedScript = "";
        this.lastSavedName = "";
        this.lastAppliedScript = "";
        this.temporaryIndicatorId = null;

        this.init();
    }

    async init() {
        if (typeof require === 'undefined') {
            console.error('Monaco loader not found');
            return;
        }

        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });

        require(['vs/editor/editor.main'], () => {
            this.registerZenScript();
            this.createEditor();
            this.setupEventListeners();
            this.isInitialized = true;
        });
    }

    registerZenScript() {
        // Register a new language
        monaco.languages.register({ id: 'zenscript' });

        // Lexer definition
        monaco.languages.setMonarchTokensProvider('zenscript', {
            tokenizer: {
                root: [
                    // Comments FIRST
                    [/\/\/.*$/, 'comment'],

                    // Colors (Hex, RGB, RGBA)
                    [/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/, 'color-literal'],
                    [/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d\.]+\s*)?\)/, 'color-literal'],

                    // Function calls and definitions: any word followed by (
                    [/[a-z_$][\w$]*(?=\s*\()/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'predefined'
                        }
                    }],

                    // Variable declarations (e.g., int src =)
                    [/(int|float|bool|string|color|void|array)(\s+)([a-z_$][\w$]*)/, ['keyword', '', 'identifier']],

                    // Named Arguments (e.g., color=, title=)
                    [/[a-z_$][\w$]*(?=\s*=(?!=))/, 'attribute.name'],

                    // Identifiers and keywords
                    [/[a-z_$][\w$]*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@builtins': 'predefined',
                            '@default': 'identifier'
                        }
                    }],

                    // Brackets and Delimiters
                    [/[{}()\[\]]/, '@brackets'],
                    [/[;,.]/, 'delimiter'],

                    // Specific Operators (Longer ones first)
                    [/:=/, 'operator'],
                    [/=>/, 'operator'],
                    [/[<>=\+\-\*\/%&|^!]+/, 'operator'],

                    // Numbers
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],

                    // Strings
                    [/"([^"\\]|\\.)*"/, 'string'],
                    [/'([^'\\]|\\.)*'/, 'string'],
                ]
            },
            keywords: [
                'int', 'float', 'bool', 'string', 'color', 'void', 'return', 'if', 'else', 'switch', 'case', 'default', 'true', 'false', 'na', 'for', 'to', 'and', 'or', 'not', 'array'
            ],
            builtins: [
                'plot', 'sma', 'ema', 'rsi', 'stoch', 'bb', 'atr', 'supertrend', 'vwap',
                'input', 'indicator', 'plotshape', 'hline', 'fill', 'rgba',
                'label', 'label.new', 'line', 'line.new', 'bar_index',
                'open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4',
                'stdev', 'variance', 'covariance', 'correlation', 'linreg', 'linreg_slope', 'linreg_intercept',
                'array', 'array.new_float', 'array.new_int', 'array.new_bool', 'array.new_color', 'array.new_string', 'array.push', 'array.get', 'array.set', 'array.size', 'array.clear', 'array.remove', 'array.insert', 'array.pop', 'array.shift', 'array.unshift', 'array.sort', 'array.avg', 'array.min', 'array.max', 'array.sum'
            ]
        });

        // High-Performance Color Provider
        monaco.languages.registerColorProvider('zenscript', {
            provideDocumentColors: (model) => {
                const text = model.getValue();
                if (!text) return [];
                
                const colors = [];
                // More precise regex
                const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
                const rgbaRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d\.]+)\s*)?\)/g;
                
                let match;
                while ((match = hexRegex.exec(text))) {
                    const startPos = model.getPositionAt(match.index);
                    const endPos = model.getPositionAt(match.index + match[0].length);
                    
                    let hex = match[1];
                    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                    if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
                    
                    if (hex.length !== 6 && hex.length !== 8) continue;

                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;
                    const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

                    colors.push({
                        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                        color: { red: r, green: g, blue: b, alpha: a }
                    });
                }

                while ((match = rgbaRegex.exec(text))) {
                    const startPos = model.getPositionAt(match.index);
                    const endPos = model.getPositionAt(match.index + match[0].length);
                    
                    colors.push({
                        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                        color: { 
                            red: Math.min(255, parseInt(match[1])) / 255, 
                            green: Math.min(255, parseInt(match[2])) / 255, 
                            blue: Math.min(255, parseInt(match[3])) / 255, 
                            alpha: match[4] ? Math.min(1, parseFloat(match[4])) : 1 
                        }
                    });
                }
                return colors;
            },
            provideColorPresentations: (model, colorInfo) => {
                const color = colorInfo.color;
                const r = Math.round(color.red * 255);
                const g = Math.round(color.green * 255);
                const b = Math.round(color.blue * 255);
                const a = color.alpha;
                const label = a === 1 
                    ? `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
                    : `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
                return [{ label: label }];
            }
        });

        // Language configuration (brackets, comments)
        monaco.languages.setLanguageConfiguration('zenscript', {
            comments: {
                lineComment: '//',
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        });

        // Tokyo Night Theme
        monaco.editor.defineTheme('zen-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: 'bb9af7', fontStyle: 'bold' }, // Purple
                { token: 'predefined', foreground: '7aa2f7' },               // Blue (Functions)
                { token: 'attribute.name', foreground: 'e0af68' },            // Orange (Named Args)
                { token: 'comment', foreground: '565f89', fontStyle: 'italic' }, // Muted Blue-Gray
                { token: 'string', foreground: '9ece6a' },                   // Green
                { token: 'number', foreground: 'ff9e64' },                   // Orange
                { token: 'operator', foreground: '89ddff' },                 // Cyan
                { token: 'identifier', foreground: 'c0caf5' },               // Light Blue/White (Variables)
                { token: 'delimiter', foreground: 'bb9af7' },               // Purple
                { token: 'color-literal', foreground: 'f7768e' },           // Pinkish-Red for Color Codes
            ],
            colors: {
                'editor.background': '#000000',
                'editor.foreground': '#a9b1d6',
                'editor.lineHighlightBackground': '#24283b',
                'editorCursor.foreground': '#c0caf5',
                'editor.selectionBackground': '#33467C',
                'editorIndentGuide.background': '#292e42',
                'editor.lineNumbersForeground': '#3b4261',
            }
        });

        // Rich IntelliSense & Auto-Completion Provider for ZenScript
        monaco.languages.registerCompletionItemProvider('zenscript', {
            triggerCharacters: ['.'],
            provideCompletionItems: (model, position) => {
                const word = model.getWordAtPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word ? word.startColumn : position.column,
                    endColumn: word ? word.endColumn : position.column
                };

                // Check if we are typing after a dot
                const lastLine = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                const dotMatch = lastLine.match(/([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)?$/);
                if (dotMatch) {
                    const namespace = dotMatch[1];
                    const suggestions = [];
                    
                    if (namespace === 'color') {
                        const colors = ['red', 'green', 'blue', 'white', 'black', 'yellow', 'orange', 'purple', 'gray', 'teal', 'lime', 'maroon', 'navy', 'olive', 'silver', 'aqua', 'fuchsia', 'new', 'rgb', 'gradient'];
                        colors.forEach(c => {
                            const kind = c === 'gradient' || c === 'new' || c === 'rgb' ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Property;
                            let ins = c;
                            let rules = undefined;
                            
                            if (c === 'gradient') {
                                ins = 'gradient(${1:close}, ${2:0}, ${3:100}, ${4:color.red}, ${5:color.green})';
                                rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                            } else if (c === 'new') {
                                ins = 'new(${1:color.blue}, ${2:50})';
                                rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                            } else if (c === 'rgb') {
                                ins = 'rgb(${1:255}, ${2:255}, ${3:255})';
                                rules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                            }
                            
                            const item = {
                                label: c,
                                kind: kind,
                                insertText: ins,
                                insertTextRules: rules,
                                detail: `color.${c}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`color.${c}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    } else if (namespace === 'input') {
                        const inputs = [
                            { name: 'int', defval: '1' },
                            { name: 'float', defval: '1.0' },
                            { name: 'bool', defval: 'true' },
                            { name: 'string', defval: '"Default"' },
                            { name: 'color', defval: 'color.blue' },
                            { name: 'source', defval: 'close' }
                        ];
                        inputs.forEach(i => {
                            const item = {
                                label: i.name,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: i.name + '(${1:' + i.defval + '}, title="${2:Title}")',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `input.${i.name}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`input.${i.name}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    } else if (namespace === 'box') {
                        const boxMethods = ['new', 'set_left', 'set_top', 'set_right', 'set_bottom', 'set_border_color', 'set_border_width', 'set_border_style', 'set_extend', 'set_bgcolor', 'set_text', 'set_text_size', 'set_text_color', 'set_text_halign', 'set_text_valign', 'delete'];
                        boxMethods.forEach(m => {
                            const item = {
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: m + '($0)',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `box.${m}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`box.${m}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    } else if (namespace === 'label') {
                        const labelMethods = ['new'];
                        labelMethods.forEach(m => {
                            const item = {
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: m === 'new' ? 'new(x=${1:bar_index}, y=${2:high}, text="${3:Text}")' : m + '($0)',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `label.${m}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`label.${m}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    } else if (namespace === 'line') {
                        const lineMethods = ['new'];
                        lineMethods.forEach(m => {
                            const item = {
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: m === 'new' ? 'new(x1=${1:bar_index[1]}, y1=${2:low[1]}, x2=${3:bar_index}, y2=${4:low})' : m + '($0)',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `line.${m}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`line.${m}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    } else if (namespace === 'array') {
                        const arrayMethods = ['new_float', 'new_int', 'new_bool', 'new_color', 'new_string', 'push', 'get', 'set', 'size', 'clear', 'remove', 'insert', 'pop', 'shift', 'unshift', 'sort', 'avg', 'min', 'max', 'sum'];
                        arrayMethods.forEach(m => {
                            let ins = m + '($0)';
                            if (m.startsWith('new_')) {
                                ins = m + '(${1:size}, ${2:initial_value})';
                            } else if (m === 'push' || m === 'unshift' || m === 'insert') {
                                ins = m + '(${1:arr}, ${2:value})';
                            } else if (m === 'get' || m === 'remove') {
                                ins = m + '(${1:arr}, ${2:index})';
                            } else if (m === 'set') {
                                ins = m + '(${1:arr}, ${2:index}, ${3:value})';
                            } else {
                                ins = m + '(${1:arr})';
                            }
                            
                            const item = {
                                label: m,
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: ins,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: `array.${m}`,
                                range: range
                            };

                            const doc = ZEN_DOCS[`array.${m}`];
                            if (doc) {
                                item.detail = doc.signature;
                                item.documentation = {
                                    value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                           doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                                };
                            }
                            suggestions.push(item);
                        });
                    }
                    
                    return { suggestions: suggestions };
                }

                // Default suggestions (keywords, builtins, variables, functions)
                const suggestions = [];

                // Keywords
                const keywords = ['int', 'float', 'bool', 'string', 'color', 'void', 'return', 'if', 'else', 'switch', 'case', 'default', 'true', 'false', 'na', 'for', 'to'];
                keywords.forEach(k => {
                    suggestions.push({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k,
                        range: range
                    });
                });

                // Variables
                const variables = ['open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'bar_index'];
                variables.forEach(v => {
                    suggestions.push({
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: v,
                        detail: 'Built-in time-series series',
                        range: range
                    });
                });

                // Built-in Functions
                const functions = [
                    { name: 'indicator', snippet: 'indicator(title="${1:My Indicator}", overlay=${2:true})', desc: 'Declare script as indicator' },
                    { name: 'sma', snippet: 'sma(${1:close}, ${2:14})', desc: 'Simple Moving Average' },
                    { name: 'ema', snippet: 'ema(${1:close}, ${2:14})', desc: 'Exponential Moving Average' },
                    { name: 'rsi', snippet: 'rsi(${1:close}, ${2:14})', desc: 'Relative Strength Index' },
                    { name: 'stoch', snippet: 'stoch(${1:close}, ${2:high}, ${3:low}, ${4:14})', desc: 'Stochastic Oscillator' },
                    { name: 'bb', snippet: 'bb(${1:close}, ${2:20}, ${3:2})', desc: 'Bollinger Bands' },
                    { name: 'atr', snippet: 'atr(${1:14})', desc: 'Average True Range' },
                    { name: 'supertrend', snippet: 'supertrend(${1:3}, ${2:10})', desc: 'SuperTrend indicator' },
                    { name: 'vwap', snippet: 'vwap(${1:close})', desc: 'Volume Weighted Average Price' },
                    { name: 'plot', snippet: 'plot(${1:close}, title="${2:My Plot}", color=${3:color.blue})', desc: 'Plot series on chart' },
                    { name: 'plotshape', snippet: 'plotshape(${1:close > open}, title="${2:Shape}", style="${3:triangleup}", location="${4:belowbar}", color=${5:color.green})', desc: 'Plot shape on chart' },
                    { name: 'plotchar', snippet: 'plotchar(${1:close > open}, title="${2:Char}", char="${3:B}", location="${4:belowbar}", color=${5:color.green})', desc: 'Plot character on chart' },
                    { name: 'plotarrow', snippet: 'plotarrow(${1:close - open}, title="${2:Arrow}")', desc: 'Plot arrow on chart' },
                    { name: 'plotcandle', snippet: 'plotcandle(${1:open}, ${2:high}, ${3:low}, ${4:close})', desc: 'Plot candles on chart' },
                    { name: 'hline', snippet: 'hline(${1:0}, title="${2:Zero Line}", color=${3:color.gray})', desc: 'Plot horizontal line' },
                    { name: 'bgcolor', snippet: 'bgcolor(${1:color.new(color.blue, 90)})', desc: 'Change background color' },
                    { name: 'barcolor', snippet: 'barcolor(${1:color.blue})', desc: 'Change bar/candle color' },
                    { name: 'fill', snippet: 'fill(${1:p1}, ${2:p2}, color=${3:color.new(color.blue, 90)})', desc: 'Fill background between plots' },
                    { name: 'crossover', snippet: 'crossover(${1:s1}, ${2:s2})', desc: 'Check if s1 crosses above s2' },
                    { name: 'crossunder', snippet: 'crossunder(${1:s1}, ${2:s2})', desc: 'Check if s1 crosses below s2' },
                    { name: 'change', snippet: 'change(${1:close})', desc: 'Difference between current and previous value' },
                    { name: 'highest', snippet: 'highest(${1:close}, ${2:14})', desc: 'Highest value in a lookback window' },
                    { name: 'lowest', snippet: 'lowest(${1:close}, ${2:14})', desc: 'Lowest value in a lookback window' },
                    { name: 'pivothigh', snippet: 'pivothigh(${1:leftBars}, ${2:rightBars})', desc: 'Pivot High point index' },
                    { name: 'pivotlow', snippet: 'pivotlow(${1:leftBars}, ${2:rightBars})', desc: 'Pivot Low point index' },
                    { name: 'fixnan', snippet: 'fixnan(${1:close})', desc: 'Replace NaN with the last non-NaN value' },
                    { name: 'stdev', snippet: 'stdev(${1:close}, ${2:14})', desc: 'Standard Deviation' },
                    { name: 'variance', snippet: 'variance(${1:close}, ${2:14})', desc: 'Variance' },
                    { name: 'covariance', snippet: 'covariance(${1:close}, ${2:open}, ${3:14})', desc: 'Covariance of two series' },
                    { name: 'correlation', snippet: 'correlation(${1:close}, ${2:open}, ${3:14})', desc: 'Pearson Correlation Coefficient' },
                    { name: 'linreg', snippet: 'linreg(${1:close}, ${2:14}, ${3:0})', desc: 'Linear Regression Value' },
                    { name: 'linreg_slope', snippet: 'linreg_slope(${1:close}, ${2:14})', desc: 'Linear Regression Slope' },
                    { name: 'linreg_intercept', snippet: 'linreg_intercept(${1:close}, ${2:14})', desc: 'Linear Regression Intercept' },
                    { name: 'rgba', snippet: 'rgba(${1:255}, ${2:255}, ${3:255}, ${4:1.0})', desc: 'Create custom color with red, green, blue, alpha' },
                    { name: 'abs', snippet: 'abs(${1:close})', desc: 'Absolute value' },
                    { name: 'ceil', snippet: 'ceil(${1:close})', desc: 'Ceiling rounding' },
                    { name: 'floor', snippet: 'floor(${1:close})', desc: 'Floor rounding' },
                    { name: 'sqrt', snippet: 'sqrt(${1:close})', desc: 'Square root' },
                    { name: 'exp', snippet: 'exp(${1:close})', desc: 'Natural exponent (e^x)' },
                    { name: 'log', snippet: 'log(${1:close})', desc: 'Natural logarithm' },
                    { name: 'log10', snippet: 'log10(${1:close})', desc: 'Base 10 logarithm' },
                    { name: 'pow', snippet: 'pow(${1:close}, ${2:2})', desc: 'Power function (base^exponent)' },
                    { name: 'sin', snippet: 'sin(${1:close})', desc: 'Trigonometric sine' },
                    { name: 'cos', snippet: 'cos(${1:close})', desc: 'Trigonometric cosine' },
                    { name: 'tan', snippet: 'tan(${1:close})', desc: 'Trigonometric tangent' },
                    { name: 'asin', snippet: 'asin(${1:close})', desc: 'Trigonometric arcsine' },
                    { name: 'acos', snippet: 'acos(${1:close})', desc: 'Trigonometric arccosine' },
                    { name: 'atan', snippet: 'atan(${1:close})', desc: 'Trigonometric arctangent' },
                    { name: 'sign', snippet: 'sign(${1:close})', desc: 'Sign of value (1, -1, or 0)' },
                    { name: 'min', snippet: 'min(${1:close}, ${2:open})', desc: 'Minimum of two values/series' },
                    { name: 'max', snippet: 'max(${1:close}, ${2:open})', desc: 'Maximum of two values/series' },
                    { name: 'nz', snippet: 'nz(${1:close}, ${2:0.0})', desc: 'Replace NaN/null with replacement value' },
                    { name: 'na', snippet: 'na(${1:close})', desc: 'Check if value is NaN/null' },
                    { name: 'wma', snippet: 'wma(${1:close}, ${2:14})', desc: 'Weighted Moving Average' },
                    { name: 'rma', snippet: 'rma(${1:close}, ${2:14})', desc: 'Running Moving Average (used in ATR)' },
                    { name: 'tr', snippet: 'tr()', desc: 'True Range' },
                    { name: 'print', snippet: 'print(${1:value})', desc: 'Print debug message to developer console' },
                    { name: 'plotbar', snippet: 'plotbar(${1:open}, ${2:high}, ${3:low}, ${4:close})', desc: 'Plot price bars on chart' }
                ];

                functions.forEach(f => {
                    const doc = ZEN_DOCS[f.name];
                    const docDetails = doc ? {
                        detail: doc.signature,
                        documentation: {
                            value: `**Description:**\n${doc.desc}\n\n**Parameters:**\n` + 
                                   doc.params.map(p => `- \`${p.name}\`: ${p.desc}`).join('\n')
                        }
                    } : {
                        detail: f.desc,
                        documentation: f.desc
                    };

                    suggestions.push({
                        label: f.name,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: f.snippet,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range: range,
                        ...docDetails
                    });
                });

                // Add namespace base suggestions
                const namespaces = ['color', 'input', 'box', 'label', 'line', 'array'];
                namespaces.forEach(ns => {
                    suggestions.push({
                        label: ns,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: ns,
                        detail: `Namespace ${ns}`,
                        range: range
                    });
                });

                return { suggestions: suggestions };
            }
        });

        // Rich Hover Provider for ZenScript
        monaco.languages.registerHoverProvider('zenscript', {
            provideHover: (model, position) => {
                const word = model.getWordAtPosition(position);
                if (!word) return null;

                const line = model.getLineContent(position.lineNumber);
                const beforeWord = line.substring(0, word.startColumn - 1);
                const dotMatch = beforeWord.match(/([a-zA-Z_]\w*)\.$/);
                
                let lookupKey = word.word;
                if (dotMatch) {
                    lookupKey = `${dotMatch[1]}.${word.word}`;
                }

                const doc = ZEN_DOCS[lookupKey];
                if (doc) {
                    const contents = [];
                    contents.push({ value: `\`\`\`zenscript\n${doc.signature}\n\`\`\`` });
                    contents.push({ value: doc.desc });
                    if (doc.params && doc.params.length > 0) {
                        const paramsList = doc.params.map(p => `* \`${p.name}\`: ${p.desc}`).join('\n');
                        contents.push({ value: `**Parameters:**\n${paramsList}` });
                    }
                    return {
                        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                        contents: contents
                    };
                }

                const builtInVars = {
                    'open': 'Built-in time-series representing the Open price of each bar.',
                    'high': 'Built-in time-series representing the High price of each bar.',
                    'low': 'Built-in time-series representing the Low price of each bar.',
                    'close': 'Built-in time-series representing the Close price of each bar.',
                    'volume': 'Built-in time-series representing the Volume of each bar.',
                    'time': 'Built-in time-series representing the timestamp of each bar.',
                    'timestamp': 'Built-in time-series representing the timestamp of each bar.',
                    'hl2': 'Built-in time-series: `(high + low) / 2`.',
                    'hlc3': 'Built-in time-series: `(high + low) / close` or HLC average.',
                    'ohlc4': 'Built-in time-series: `(open + high + low + close) / 4`.',
                    'hlcc4': 'Built-in time-series: `(high + low + close + close) / 4`.',
                    'bar_index': 'Built-in variable representing the current index of the bar (starting at 0).',
                    'na': 'Representing a null, missing, or Not-a-Number value.'
                };

                if (builtInVars[word.word]) {
                    return {
                        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                        contents: [
                            { value: `\`\`\`zenscript\nfloat ${word.word}\n\`\`\`` },
                            { value: builtInVars[word.word] }
                        ]
                    };
                }

                const namespaces = {
                    'color': 'Namespace containing color constants and color creation/manipulation functions.',
                    'input': 'Namespace containing user-input configuration functions.',
                    'box': 'Namespace containing drawing functions and property setters for box elements.',
                    'label': 'Namespace containing drawing functions for label elements.',
                    'line': 'Namespace containing drawing functions for line elements.',
                    'array': 'Namespace containing array creation and manipulation functions.'
                };

                if (namespaces[word.word]) {
                    return {
                        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                        contents: [
                            { value: `\`\`\`zenscript\nnamespace ${word.word}\n\`\`\`` },
                            { value: namespaces[word.word] }
                        ]
                    };
                }

                return null;
            }
        });

        // Monaco Signature Help Provider (Argument suggestions when typing '(' or ',')
        monaco.languages.registerSignatureHelpProvider('zenscript', {
            signatureHelpTriggerCharacters: ['(', ','],
            signatureHelpRetriggerCharacters: [','],
            provideSignatureHelp: (model, position, token, context) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                let openParenIndex = -1;
                let commaCount = 0;
                let depth = 0;
                
                for (let i = textUntilPosition.length - 1; i >= 0; i--) {
                    const char = textUntilPosition[i];
                    if (char === ')') {
                        depth++;
                    } else if (char === '(') {
                        if (depth === 0) {
                            openParenIndex = i;
                            break;
                        } else {
                            depth--;
                        }
                    } else if (char === ',' && depth === 0) {
                        commaCount++;
                    }
                }
                
                if (openParenIndex === -1) return null;
                
                let nameEnd = openParenIndex;
                while (nameEnd > 0 && /\s/.test(textUntilPosition[nameEnd - 1])) {
                    nameEnd--;
                }
                
                let nameStart = nameEnd;
                while (nameStart > 0 && /[a-zA-Z0-9_\.]/.test(textUntilPosition[nameStart - 1])) {
                    nameStart--;
                }
                
                const functionName = textUntilPosition.substring(nameStart, nameEnd);
                if (!functionName) return null;
                
                const signatures = {};
                for (const [key, doc] of Object.entries(ZEN_DOCS)) {
                    const params = (doc.params || []).map(p => ({
                        label: p.name,
                        documentation: p.desc
                    }));
                    signatures[key] = {
                        label: doc.signature,
                        documentation: doc.desc,
                        parameters: params
                    };
                }

                // Dynamic Scan of the entire document to parse custom functions signature details!
                const docText = model.getValue();
                const funcRegex = /([a-zA-Z_|]+)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*=>/g;
                let match;
                while ((match = funcRegex.exec(docText))) {
                    const returnType = match[1];
                    const funcName = match[2];
                    const paramsStr = match[3];
                    
                    const params = [];
                    const paramLabels = [];
                    if (paramsStr.trim()) {
                        const paramParts = paramsStr.split(',');
                        paramParts.forEach(p => {
                            const parts = p.trim().split(/\s+/);
                            if (parts.length >= 2) {
                                const pType = parts[0];
                                const pName = parts[1];
                                paramLabels.push(`${pType} ${pName}`);
                                params.push({
                                    label: pName,
                                    documentation: `Type: ${pType}`
                                });
                            } else if (parts.length === 1 && parts[0]) {
                                const pName = parts[0];
                                paramLabels.push(pName);
                                params.push({
                                    label: pName,
                                    documentation: `Type: any`
                                });
                            }
                        });
                    }
                    
                    signatures[funcName] = {
                        label: `${returnType} ${funcName}(${paramLabels.join(', ')})`,
                        documentation: '',
                        parameters: params
                    };
                }
                
                const sig = signatures[functionName];
                if (!sig) return null;
                
                return {
                    value: {
                        signatures: [{
                            label: sig.label,
                            documentation: sig.documentation,
                            parameters: sig.parameters
                        }],
                        activeSignature: 0,
                        activeParameter: Math.min(commaCount, sig.parameters.length - 1)
                    },
                    dispose: () => {}
                };
            }
        });
    }

    createEditor() {
        this.editor = monaco.editor.create(this.monacoContainer, {
            value: this.defaultScript,
            language: 'zenscript',
            theme: 'zen-dark',
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            minimap: { enabled: true },
            automaticLayout: true,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            padding: { top: 10 }
        });
    }

    setupEventListeners() {
        document.getElementById('editor-close-btn').addEventListener('click', () => this.hide());
        document.getElementById('editor-new-btn').addEventListener('click', () => this.handleNew());
        document.getElementById('editor-save-btn').addEventListener('click', () => this.handleSave());
        document.getElementById('editor-add-chart-btn').addEventListener('click', () => this.handleApply());

        // Sync header name to currentScriptName
        this.nameInput.addEventListener('input', () => {
            this.currentScriptName = this.nameInput.value.trim() || "Untitled";
            this.updateButtonStates();
        });

        // Monaco content change listener with 300ms debounce to prevent typing lag
        let validationTimeout = null;
        this.editor.onDidChangeModelContent(() => {
            this.updateButtonStates();
            if (validationTimeout) {
                clearTimeout(validationTimeout);
            }
            validationTimeout = setTimeout(() => {
                this.validateScript();
            }, 300);
        });
    }

    updateButtonStates() {
        this.updateSaveButton();
        this.updateApplyButton();
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('editor-save-btn');
        if (!saveBtn) return;

        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        
        const isDirty = currentScript !== this.lastSavedScript || currentName !== this.lastSavedName;
        // Keep active if there's an error so user can click to peek the error!
        const shouldEnable = isDirty || (this.isScriptValid === false);

        saveBtn.disabled = !shouldEnable;
        saveBtn.style.opacity = shouldEnable ? "1" : "0.4";
        saveBtn.style.pointerEvents = shouldEnable ? "auto" : "none";
    }

    show(scriptData = null) {
        this.container.style.display = 'flex';
        // Resize chart if needed
        window.dispatchEvent(new Event('resize'));
        
        if (scriptData) {
            this.editor.setValue(scriptData.script);
            this.currentScriptName = scriptData.name;
            // Only use ID if it's a database ID (doesn't start with 'ind_')
            this.currentScriptId = (scriptData.id && String(scriptData.id).startsWith('ind_')) ? null : scriptData.id;
            this.nameInput.value = scriptData.name;
            
            this.lastSavedScript = scriptData.script;
            this.lastSavedName = scriptData.name;
            
            // Backup original script for ROLLBACK feature
            this.originalScriptBeforeEdit = scriptData.script;
            
            // Check if this indicator is already on chart to get its current script
            const name = scriptData.name;
            const existingInd = this.chart?.indicators?.find(ind => (this.currentScriptId && ind.id === this.currentScriptId) || (ind.name === name));
            this.lastAppliedScript = existingInd ? existingInd.script : "";
        } else {
            this.currentScriptId = null;
            this.lastSavedScript = this.defaultScript;
            this.lastSavedName = "New Indicator";
            this.originalScriptBeforeEdit = null;
            this.lastAppliedScript = "";
            this.editor.setValue(this.defaultScript);
            this.nameInput.value = "New Indicator";
        }

        this.updateButtonStates();
        this.logConsole("Editor opened.");
        this.validateScript();
    }

    updateApplyButton() {
        if (!this.addChartBtn) return;
        
        const name = (this.nameInput?.value || this.currentScriptName).trim();
        const id = this.currentScriptId;
        
        const isActive = this.chart && this.chart.indicators && this.chart.indicators.some(ind => {
            return (id && ind.id === id) || (ind.name === name);
        });

        if (isActive) {
            this.addChartBtn.title = 'Sync with Chart';
            this.addChartBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
            `;
            
            const currentScript = this.editor.getValue();
            const isDirty = currentScript !== this.lastAppliedScript;
            
            // Keep enabled if there's an error so they can click it to see the popup!
            const shouldEnable = isDirty || (this.isScriptValid === false);

            this.addChartBtn.disabled = !shouldEnable;
            this.addChartBtn.style.opacity = shouldEnable ? "1" : "0.4";
            this.addChartBtn.style.pointerEvents = shouldEnable ? "auto" : "none";
        } else {
            this.addChartBtn.title = 'Add to Chart';
            this.addChartBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
            this.addChartBtn.disabled = false;
            this.addChartBtn.style.opacity = "1";
            this.addChartBtn.style.pointerEvents = "auto";
        }
    }

    hide() {
        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        const isDirty = (currentScript !== this.lastSavedScript) || (currentName !== this.lastSavedName);

        if (isDirty || this.temporaryIndicatorId) {
            let message = "You have unsaved changes. Exit anyway?";
            if (this.temporaryIndicatorId && !this.currentScriptId) {
                message = "This indicator is not saved and will be removed from the chart. Continue?";
            }
            
            const confirmed = confirm(message);
            if (!confirmed) return;

            // ROLLBACK: Revert indicator on chart to its original state before this edit session
            if (this.chart && this.originalScriptBeforeEdit !== undefined) {
                const name = this.lastSavedName;
                const id = this.currentScriptId;
                const existingInd = this.chart.indicators.find(ind => (id && ind.id === id) || (ind.name === name));
                
                if (existingInd && existingInd.script !== this.originalScriptBeforeEdit) {
                    this.chart.removeIndicator(existingInd.id);
                    if (this.originalScriptBeforeEdit) {
                        this.chart.addIndicator(name, this.originalScriptBeforeEdit, id);
                    }
                }
            }

            // Cleanup temporary indicator if needed
            if (this.temporaryIndicatorId && this.chart && this.chart.removeIndicator) {
                this.chart.removeIndicator(this.temporaryIndicatorId);
            }
            this.temporaryIndicatorId = null;
        }

        this.container.style.display = 'none';
        window.dispatchEvent(new Event('resize'));
    }

    logConsole(message, type = 'info') {
        const consoleOutput = document.getElementById('editor-console-output');
        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    validateScript() {
        if (!this.editor) {
            this.isScriptValid = true;
            return true;
        }
        const script = this.editor.getValue();
        const model = this.editor.getModel();
        if (!model) {
            this.isScriptValid = true;
            return true;
        }

        const markers = [];
        let isValid = true;

        try {
            const lexer = new ZenScript.Lexer(script);
            const parser = new ZenScript.Parser(lexer);
            const ast = parser.parseProgram();

            const validator = new ZenScript.Validator(ast, script);
            const validationErrors = validator.validate();

            validationErrors.forEach(err => {
                isValid = false;
                markers.push({
                    severity: monaco.MarkerSeverity.Error,
                    message: err.message,
                    startLineNumber: err.line,
                    startColumn: err.column,
                    endLineNumber: err.line,
                    endColumn: err.column + (err.tokenLength || 1)
                });
            });
        } catch (e) {
            isValid = false;
            const pos = (e.pos !== undefined) ? e.pos : 0;
            const message = e.rawMessage || e.message;
            const tokenLen = e.tokenLength || 1;
            const { line, column } = ZenScript.getLineAndColumn(script, pos);
            
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: message,
                startLineNumber: line,
                startColumn: column,
                endLineNumber: line,
                endColumn: column + tokenLen
            });
        }

        monaco.editor.setModelMarkers(model, 'zenscript', markers);
        
        // Strictly prevent saving or applying if there are compilation/validation errors
        this.isScriptValid = isValid;

        // Auto-peek & console error logic
        if (!isValid && markers.length > 0) {
            const firstErr = markers[0];
            
            // Print descriptive error immediately to console
            if (this.lastPrintedError !== firstErr.message) {
                this.logConsole(`${firstErr.message} (Line ${firstErr.startLineNumber}, Col ${firstErr.startColumn})`, "error");
                this.lastPrintedError = firstErr.message;
            }
        } else {
            this.lastPrintedError = null;

            // Close active error peek/widget immediately when resolved!
            if (this.editor) {
                try {
                    const markerController = this.editor.getContribution('editor.contrib.markerController');
                    if (markerController && typeof markerController.close === 'function') {
                        markerController.close();
                    } else {
                        this.editor.focus();
                        this.editor.trigger('keyboard', 'escape', {});
                    }
                } catch (e) {
                    this.editor.focus();
                    this.editor.trigger('keyboard', 'escape', {});
                }
            }
        }

        return isValid;
    }

    triggerErrorPeek() {
        if (this.editor && this.isScriptValid === false) {
            const currentSelection = this.editor.getSelection();
            this.editor.getAction('editor.action.marker.next').run();
            if (currentSelection) {
                setTimeout(() => {
                    if (this.editor) {
                        this.editor.setSelection(currentSelection);
                    }
                }, 50);
            }
        }
    }

    async handleSave() {
        if (!this.validateScript()) {
            this.logConsole("Cannot save: Script has compilation or validation errors. Check the red squiggly lines in the editor.", "error");
            this.triggerErrorPeek();
            return;
        }
        // Now that name is in header, we can save directly!
        const name = this.nameInput.value.trim();
        if (!name) {
            this.logConsole("Indicator name cannot be empty.", 'error');
            this.nameInput.focus();
            return;
        }
        
        this.currentScriptName = name;
        await this.confirmSave();
    }

    async confirmSave() {
        const name = this.currentScriptName;
        const script = this.editor.getValue();

        try {
            const url = this.currentScriptId 
                ? `http://localhost:5000/api/v1/indicators/${this.currentScriptId}` 
                : 'http://localhost:5000/api/v1/indicators';
            
            const method = this.currentScriptId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, script, userId: "6633b499e1a90c2e34789abc" })
            });
            const result = await response.json();
            if (result.success) {
                this.logConsole(`Script "${name}" ${this.currentScriptId ? 'updated' : 'saved'} successfully!`, 'success');
                this.currentScriptName = name;
                if (!this.currentScriptId) {
                    this.currentScriptId = result.data.id;
                    this.temporaryIndicatorId = null; // No longer temporary once saved to DB
                }
                
                this.lastSavedScript = script;
                this.lastSavedName = name;
                this.updateButtonStates();

                document.getElementById('editor-script-name').textContent = name;
                // Refresh modal list if it's open
                if (window.indicatorsModalController) {
                    window.indicatorsModalController.fetchUserIndicators();
                }
            } else {
                this.logConsole(`Error saving script: ${result.message}`, 'error');
            }
        } catch (err) {
            this.logConsole(`Network error: ${err.message}`, 'error');
        }
    }

    handleApply() {
        if (!this.validateScript()) {
            this.logConsole("Cannot apply: Script has compilation or validation errors. Check the red squiggly lines in the editor.", "error");
            this.triggerErrorPeek();
            return;
        }
        const script = this.editor.getValue();
        const name = this.nameInput.value.trim() || this.currentScriptName;
        try {
            if (this.chart && this.chart.addIndicator) {
                try {
                    const indicator = this.chart.addIndicator(name, script, this.currentScriptId);
                    
                    // If it was just added, only update our local ID if it's a real database ID
                    // (Local IDs start with 'ind_')
                    if (indicator && indicator.id) {
                        if (!String(indicator.id).startsWith('ind_')) {
                            this.currentScriptId = indicator.id;
                            this.temporaryIndicatorId = null;
                        } else if (!this.currentScriptId) {
                            // It's a new script and not yet in DB, track it as temporary
                            this.temporaryIndicatorId = indicator.id;
                        }
                        this.lastAppliedScript = script;
                        this.updateButtonStates();
                    }

                    this.logConsole(`Indicator ${this.addChartBtn.title === 'Sync with Chart' ? 'synced' : 'added'} successfully.`, 'success');
                } catch (e) {
                    console.error("ZenScript Error:", e);
                    this.logConsole(`ZenScript Error: ${e.message}`, 'error');
                }
            } else {
                this.logConsole("Chart not ready to receive scripts.", 'error');
            }
        } catch (err) {
            this.logConsole(`Compile Error: ${err.message}`, 'error');
        }
    }

    handleNew() {
        const currentScript = this.editor.getValue();
        const currentName = this.nameInput.value.trim();
        const isDirty = currentScript !== this.lastSavedScript || currentName !== this.lastSavedName;

        if (!isDirty || confirm("Are you sure you want to create a new script? Any unsaved changes will be lost.")) {
            // Remove existing temporary indicator from chart if it exists
            if (this.temporaryIndicatorId && this.chart && this.chart.removeIndicator) {
                this.chart.removeIndicator(this.temporaryIndicatorId);
            }

            this.currentScriptName = "New Indicator";
            this.currentScriptId = null;
            this.temporaryIndicatorId = null;
            this.nameInput.value = this.currentScriptName;
            this.editor.setValue(this.defaultScript);
            
            this.lastSavedScript = this.defaultScript;
            this.lastSavedName = "New Indicator";
            this.lastAppliedScript = "";
            this.updateButtonStates();
            
            this.logConsole("New script started.");
        }
    }
}
