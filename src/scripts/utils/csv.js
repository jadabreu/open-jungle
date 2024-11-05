class CsvGenerator {
    constructor() {
        // Create headers: ASIN + 40 weeks
        this.headers = ['ASIN'];
        for (let i = 1; i <= 40; i++) {
            this.headers.push(`Week ${i}`);
        }
    }

    generateCsv(data) {
        try {
            console.log('Generating CSV with data:', data);
            const csvContent = [
                this.headers.join(','),
                ...this.formatDataRows(data)
            ].join('\n');
            
            return csvContent;
        } catch (error) {
            console.error('CSV Generation Error:', error);
            throw new Error(`CSV generation failed: ${error.message}`);
        }
    }

    formatDataRows(data) {
        const rows = [];
        for (const item of data) {
            if (!item.forecasts || !Array.isArray(item.forecasts)) {
                console.error('Invalid forecast data for ASIN:', item.asin);
                continue;
            }

            // Start with ASIN
            const row = [item.asin];
            
            // Add all forecast values in order
            for (let i = 0; i < 40; i++) {
                const forecast = item.forecasts[i];
                row.push(forecast ? forecast.units : '');
            }

            rows.push(row.join(','));
        }
        return rows;
    }
}

window.CsvGenerator = CsvGenerator; 