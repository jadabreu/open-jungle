let state = {
    extractedData: null,
    failedAsins: [],
    isExtracting: false
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Always return false if we're not sending an async response
    if (request.type === 'immediate_action') {
        // Handle synchronous actions
        sendResponse({ status: 'success' });
        return false; // Synchronous response
    }
    
    // For async operations, return true and handle with Promise
    if (request.type === 'async_action') {
        // Ensure we keep the message channel open
        (async () => {
            try {
                // Your async operation here
                const result = await someAsyncOperation();
                sendResponse({ status: 'success', data: result });
            } catch (error) {
                sendResponse({ status: 'error', error: error.message });
            }
        })();
        return true; // Will respond asynchronously
    }
    
    return false; // Default synchronous response
});

// Example async operation
async function someAsyncOperation() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('Operation completed');
        }, 1000);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background Received Message:', message);
    switch (message.action) {
        case 'storeData':
            state.extractedData = message.data;
            state.failedAsins = message.failures || [];
            console.log('Data stored in background state:', state);

            // Generate CSV and create data URL
            try {
                const csvContent = generateCsv(state.extractedData);
                const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
                
                chrome.downloads.download({
                    url: dataUrl,
                    filename: `forecast_data_${new Date().toISOString().split('T')[0]}.csv`,
                    saveAs: false
                }, (downloadId) => {
                    if (downloadId) {
                        console.log(`CSV download initiated with ID: ${downloadId}`);
                    } else {
                        console.error('CSV download failed:', chrome.runtime.lastError);
                    }
                });
            } catch (error) {
                console.error('CSV generation/download error:', error);
            }
            break;
    }
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

function generateCsv(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid data format for CSV generation');
    }

    // Generate headers (ASIN, Week 1, Week 2, ...)
    const maxWeeks = Math.max(...data.map(item => item.units.length));
    const weekHeaders = Array.from({ length: maxWeeks }, (_, i) => `Week ${i + 1}`);
    const headers = ['ASIN', ...weekHeaders];

    // Generate rows
    const rows = [headers.join(',')];

    // Add data rows
    data.forEach(item => {
        const row = [item.asin, ...item.units];
        rows.push(row.join(','));
    });

    console.log('CSV Content Generated:', rows.join('\n'));
    return rows.join('\n');
}

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
