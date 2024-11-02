window.ForecastDataExtractor = class ForecastDataExtractor {
    constructor() {
        // Removed: this.currentAsin = null;
        // Removed: this.extractionResults = new Map();
    }

    async initialize() {
        try {
            const forecastButtons = this.locateForecastButtons();
            const asins = this.extractAsins();
            return { forecastButtons, asins };
        } catch (error) {
            throw new Error(`Initialization failed: ${error.message}`);
        }
    }

    async extractForecastData(asin) {
        try {
            const data = await this.extractMeanForecastData();
            return data;
        } catch (error) {
            throw new Error(`Data extraction failed for ASIN ${asin}: ${error.message}`);
        }
    }

    locateForecastButtons() {
        const buttons = Array.from(document.querySelectorAll('.mt-popover'))
            .map(container => {
                const button = container.querySelector('.a-popover-trigger.a-declarative');
                if (!button) return null;

                const span = button.querySelector('span.mt-text-content');
                if (span && span.innerText.trim().toLowerCase() === 'view forecast') {
                    const row = button.closest('tr.mt-row');
                    const rowData = row?.getAttribute('data-row-data');
                    
                    if (!rowData) return null;
                    
                    try {
                        const { asin } = JSON.parse(rowData.replace(/&quot;/g, '"'));
                        return { button, asin };
                    } catch {
                        return null;
                    }
                }
                return null;
            })
            .filter(item => item !== null);

        if (buttons.length === 0) {
            throw new Error('No "View forecast" buttons found.');
        }

        return buttons;
    }

    extractAsins() {
        return Array.from(document.querySelectorAll('tr.mt-row'))
            .map(row => {
                const rowData = row?.getAttribute('data-row-data');
                if (!rowData) return null;
                try {
                    const { asin } = JSON.parse(rowData.replace(/&quot;/g, '"'));
                    return asin;
                } catch {
                    return null;
                }
            })
            .filter(asin => asin !== null);
    }

    async extractMeanForecastData() {
        const { slope, intercept } = await this.initializeConversionParameters();
        
        const path = document.querySelector('#line-Mean');
        if (!path?.getAttribute('d')) {
            throw new Error('Mean forecast line not found.');
        }

        const points = path.getAttribute('d')
            .split(/(?=[ML])/)
            .map(segment => {
                const [x, y] = segment.slice(1).trim().split(',').map(Number);
                return { x, y };
            })
            .filter(point => !isNaN(point.y));

        return points.map((point, index) => ({
            week: index + 1,
            units: this.convertYToUnits(point.y, slope, intercept)
        }));
    }

    async initializeConversionParameters() {
        const yAxes = document.querySelectorAll('.yAxis');
        const mainYAxis = yAxes[0];
        
        if (!mainYAxis) {
            throw new Error('Y-axis not found.');
        }
        
        const yAxisTicks = mainYAxis.querySelectorAll('.tick text');
        
        if (yAxisTicks.length < 2) {
            throw new Error('Insufficient y-axis labels to determine scaling.');
        }

        const points = Array.from(yAxisTicks)
            .map(textElement => {
                const parentTick = textElement.parentElement;
                const transform = parentTick.getAttribute('transform');
                const match = /translate\(\s*0\s*,\s*([-\d.]+)\s*\)/.exec(transform);
                const y = match ? parseFloat(match[1]) : null;
                const unit = parseFloat(textElement.textContent.trim());
                
                return y !== null && !isNaN(unit) ? { y, unit } : null;
            })
            .filter(point => point !== null)
            .sort((a, b) => b.y - a.y);

        if (points.length < 2) {
            throw new Error('Not enough valid points to determine scaling.');
        }

        const [p1, p2] = [points[0], points[points.length - 1]];
        const slope = (p2.unit - p1.unit) / (p2.y - p1.y);
        const intercept = p1.unit - slope * p1.y;

        return { slope, intercept };
    }

    convertYToUnits(y, slope, intercept) {
        const units = (slope * y) + intercept;
        return units < 0 ? 0 : parseFloat(units.toFixed(2));
    }
}; 