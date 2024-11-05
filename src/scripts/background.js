let state = {
    extractedData: null,
    failedAsins: [],
    isExtracting: false
};

// CSV Generator class definition
class CsvGenerator {
    constructor() {
        this.headers = ['ASIN'];
        // We'll set the week headers dynamically based on the setting
    }

    async generateCsv(data) {
        try {
            const { forecastStart } = await chrome.storage.sync.get({ forecastStart: 'currentWeek' });
            console.log('Generating CSV with data:', data, 'forecastStart:', forecastStart);
            
            // Get the first item's forecasts to determine the current week
            const firstItem = data[0];
            if (!firstItem?.forecasts?.length) {
                throw new Error('No forecast data available');
            }

            // Generate headers based on setting
            if (forecastStart === 'week1') {
                // Start from Week 1 through Week 52
                this.headers = ['ASIN'];
                for (let i = 1; i <= 52; i++) {
                    this.headers.push(`Week ${i}`);
                }
            } else {
                // Start from current week through same week next year
                const startWeek = firstItem.forecasts[0].week;
                this.headers = ['ASIN'];
                let week = startWeek;
                for (let i = 0; i < 52; i++) {
                    this.headers.push(`Week ${week}`);
                    week = week === 52 ? 1 : week + 1;
                }
            }
            
            const csvContent = [
                this.headers.join(','),
                ...this.formatDataRows(data, forecastStart)
            ].join('\n');
            
            return csvContent;
        } catch (error) {
            console.error('CSV Generation Error:', error);
            throw new Error(`CSV generation failed: ${error.message}`);
        }
    }

    formatDataRows(data, forecastStart) {
        const rows = [];
        for (const item of data) {
            if (!item.forecasts || !Array.isArray(item.forecasts)) {
                console.error('Invalid forecast data for ASIN:', item.asin);
                continue;
            }

            // Start with ASIN
            const row = [item.asin];
            
            // Initialize array with 52 empty slots
            const orderedForecasts = new Array(52).fill('');
            
            if (forecastStart === 'week1') {
                // Place each forecast in its corresponding week slot
                item.forecasts.forEach(forecast => {
                    // week - 1 because array is 0-based but weeks are 1-based
                    orderedForecasts[forecast.week - 1] = forecast.units;
                });
            } else {
                // For currentWeek mode, just add forecasts sequentially
                for (let i = 0; i < 52; i++) {
                    const forecast = item.forecasts[i];
                    orderedForecasts[i] = forecast ? forecast.units : '';
                }
            }
            
            // Add all values to the row
            row.push(...orderedForecasts);
            
            rows.push(row.join(','));
        }
        return rows;
    }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'storeData') {
        // Create CSV content immediately and respond
        const csvGenerator = new CsvGenerator();
        csvGenerator.generateCsv(message.data)
            .then(csvContent => {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `forecast_data_${timestamp}.csv`;
                const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
                const dataUrl = 'data:text/csv;base64,' + csvBase64;
                
                return chrome.downloads.download({
                    url: dataUrl,
                    filename: filename,
                    saveAs: false
                });
            })
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('CSV generation/download error:', error);
                sendResponse({ success: false, error: error.message });
            });
            
        // Return true synchronously
        return true;
    }
    
    // For other messages, respond synchronously
    return false;
});

// Listen for tab updates to reset state when navigating away
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        state = {
            extractedData: null,
            failedAsins: [],
            isExtracting: false
        };
        console.log('Background state reset due to tab loading:', tabId);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked, opening window.html');
    chrome.windows.create({
        url: 'window.html',
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
    });
});
