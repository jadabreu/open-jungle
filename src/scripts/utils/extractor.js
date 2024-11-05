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
        const path = document.querySelector('#line-Mean');
        if (!path?.getAttribute('d')) {
            throw new Error('Mean forecast line not found.');
        }

        // Get Y-axis scale from the current graph view
        const yAxisTicks = Array.from(document.querySelectorAll('.yAxis .tick'))
            .map(tick => {
                const transform = tick.getAttribute('transform');
                const yMatch = transform.match(/translate\(0,([0-9.]+)\)/);
                const y = yMatch ? parseFloat(yMatch[1]) : null;
                
                const text = tick.querySelector('text');
                const value = text ? parseFloat(text.textContent.replace(/,/g, '')) : null;
                
                return (y !== null && value !== null) ? { y, value } : null;
            })
            .filter(tick => tick !== null);

        if (yAxisTicks.length < 2) {
            throw new Error('Unable to determine Y-axis scale');
        }

        // Sort by Y coordinate (top to bottom)
        yAxisTicks.sort((a, b) => a.y - b.y);

        // Extract points from the path
        const points = path.getAttribute('d')
            .split(/(?=[ML])/)
            .map(segment => {
                const [x, y] = segment.slice(1).trim().split(',').map(Number);
                return { x, y };
            })
            .filter(point => !isNaN(point.y));

        // Convert Y coordinates to actual units
        return points.map((point, index) => {
            // Find the two closest tick marks
            let lowerTick = yAxisTicks[0];
            let upperTick = yAxisTicks[yAxisTicks.length - 1];

            for (let i = 0; i < yAxisTicks.length - 1; i++) {
                if (yAxisTicks[i].y <= point.y && point.y <= yAxisTicks[i + 1].y) {
                    lowerTick = yAxisTicks[i];
                    upperTick = yAxisTicks[i + 1];
                    break;
                }
            }

            // Linear interpolation between the two closest tick marks
            const percentage = (point.y - lowerTick.y) / (upperTick.y - lowerTick.y);
            const value = lowerTick.value + percentage * (upperTick.value - lowerTick.value);

            // Calculate week number with rollover
            const currentWeek = this.getCurrentWeekNumber();
            const currentYear = new Date().getFullYear();
            let weekNumber = currentWeek + index;
            if (weekNumber > 52) {
                weekNumber = weekNumber - 52;
            }

            return {
                week: weekNumber,
                year: weekNumber < currentWeek ? currentYear + 1 : currentYear,
                units: Math.round(value)
            };
        });
    }

    getCurrentWeekNumber() {
        // Find the week label in Amazon's UI
        const weekLabel = document.querySelector('.forecast-week-label');
        if (weekLabel) {
            const match = weekLabel.textContent.match(/Week (\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        
        // Fallback: Calculate current week
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
        return week;
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