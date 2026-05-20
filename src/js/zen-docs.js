export const ZEN_DOCS = {
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
        signature: 'bb bb(float source, int length, float mult)',
        desc: 'Bollinger Bands. Returns Bollinger Bands values as an object containing basis, upper, and lower series.',
        params: [
            { name: 'source', desc: 'Main source series.' },
            { name: 'length', desc: 'Length (bars).' },
            { name: 'mult', desc: 'Standard deviation multiplier.' }
        ]
    },
    'macd': {
        signature: 'macd macd(float source, int fastLength, int slowLength, int signalLength)',
        desc: 'Moving Average Convergence Divergence (MACD). Returns an object containing macd, signal, and hist series.',
        params: [
            { name: 'source', desc: 'Source series.' },
            { name: 'fastLength', desc: 'Fast EMA length.' },
            { name: 'slowLength', desc: 'Slow EMA length.' },
            { name: 'signalLength', desc: 'Signal EMA length.' }
        ]
    },
    'volume_profile': {
        signature: 'volume_profile volume_profile(int length, int levels=50)',
        desc: 'Volume Profile (lookback-based). Calculates volume distribution over price levels, returning an object containing poc (Point of Control), vah (Value Area High), and val (Value Area Low) series.',
        params: [
            { name: 'length', desc: 'Lookback length (number of bars).' },
            { name: 'levels', desc: 'Number of price levels/bins (default: 50).' }
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
