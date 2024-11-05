window.ForecastUIHandler = class ForecastUIHandler {
    constructor() {
        this.data = [];
        this.failures = [];
    }

    async openForecastView(button) {
        button.click();
        console.log('Opening forecast view');
        await Promise.all([
            window.helpers.waitForElement('.forecast-chart-main'),
            window.helpers.waitForElement('g.brush')
        ]);
        console.log('Forecast view opened');
    }

    async closeForecastView(button) {
        let retries = 3;
        while (retries > 0) {
            try {
                const popover = document.querySelector('div.a-popover[aria-modal="true"]');
                const closeButton = document.querySelector('button[data-action="a-popover-close"][aria-label="Close"]');
                
                console.log('Attempting to find the close button...');
                console.log('Popover found:', popover);
                console.log('Close button found:', closeButton);
                
                if (!closeButton || !popover) {
                    throw new Error('Close button or popover not found');
                }
                
                closeButton.click();
                console.log('Closing forecast view, attempt', 4 - retries);
                
                await Promise.race([
                    this.waitForElementToDisappear('.a-popover[aria-modal="true"]', 2000),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                
                const isPopoverGone = !document.querySelector('.a-popover[aria-modal="true"]') || 
                                    document.querySelector('.a-popover[aria-modal="true"][aria-hidden="true"]');
                
                if (!isPopoverGone) {
                    throw new Error('Popover still visible after close attempt');
                }
                
                await window.helpers.sleep(300);
                console.log('Forecast view closed successfully');
                return;
            } catch (error) {
                console.warn(`Close attempt ${4 - retries} failed:`, error.message);
                retries--;
                if (retries > 0) {
                    await window.helpers.sleep(500);
                }
            }
        }
        
        throw new Error('Failed to close forecast view after multiple attempts');
    }

    async waitForElementToDisappear(selector, timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            
            if (!element) {
                return true;
            }
            
            const isHidden = 
                element.style.display === 'none' || 
                element.style.visibility === 'hidden' ||
                element.hasAttribute('aria-hidden') ||
                element.classList.contains('hidden') ||
                !element.offsetParent;
            
            if (isHidden) {
                return true;
            }
            
            await window.helpers.sleep(100);
        }
        
        throw new Error(`Timeout waiting for element ${selector} to disappear`);
    }

    async setSliderTo40Weeks() {
        const brush = await window.helpers.waitForElement('g.brush', 2000);
        if (!brush) {
            console.error('Brush element not found');
            return false;
        }

        const resizeE = brush.querySelector('g.resize.e');
        if (!resizeE) {
            console.error('Resize element not found');
            return false;
        }

        const brushRect = brush.getBoundingClientRect();
        const handleRect = resizeE.getBoundingClientRect();

        const currentX = handleRect.left + handleRect.width / 2;
        const currentY = handleRect.top + handleRect.height / 2;
        const desiredX = brushRect.left + 690;
        const desiredY = currentY;

        window.helpers.simulateMouseEvent(resizeE, 'mousedown', currentX, currentY);
        window.helpers.simulateMouseEvent(document, 'mousemove', desiredX, desiredY);
        window.helpers.simulateMouseEvent(document, 'mouseup', desiredX, desiredY);

        await Promise.all([
            window.helpers.waitForElement('#line-Mean'),
            window.helpers.waitForElement('.yAxis .tick')
        ]);
        console.log('Slider set to 40 weeks');
    }

    async processASIN(button, asin, dataExtractor) {
        try {
            await this.openForecastView(button);
            await this.setSliderTo40Weeks();
            const meanData = await dataExtractor.extractForecastData(asin);
            
            this.data.push({
                asin: asin,
                startWeek: meanData[0].week,
                startYear: meanData[0].year,
                forecasts: meanData.map(point => ({
                    week: point.week,
                    year: point.year,
                    units: point.units
                }))
            });

            await this.closeForecastView(button);
            return true;
        } catch (error) {
            console.error(`Error processing ASIN ${asin}:`, error);
            this.failures.push(asin);
            return false;
        }
    }

    async extract(dataExtractor, buttons, asins) {
        this.data = [];
        this.failures = [];
        if (buttons.length === 0) {
            throw new Error('No "View forecast" buttons found.');
        }

        let processed = 0;
        const total = buttons.length;

        for (const { button, asin } of buttons) {
            console.log(`Processing ASIN ${asin} (${processed + 1}/${total})`);
            try {
                await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'progress',
                        data: {
                            current: processed,
                            total: total,
                            currentAsin: asin
                        }
                    }, resolve);
                });
            } catch (error) {
                console.warn('Progress message failed:', error);
            }

            const success = await this.processASIN(button, asin, dataExtractor);
            if (!success) this.failures.push(asin);
            
            processed++;
            
            if (processed < total) {
                await window.helpers.sleep(200);
            }
        }

        try {
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'progress',
                    data: {
                        current: processed,
                        total: total,
                        currentAsin: 'Complete'
                    }
                }, resolve);
            });
        } catch (error) {
            console.warn('Final progress message failed:', error);
        }
        console.log('All ASINs processed');

        if (this.data.length === 0) {
            throw new Error('No forecast data was extracted.');
        }

        try {
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'storeData',
                    data: this.data,
                    failures: this.failures
                }, resolve);
            });
            console.log('Extraction data sent to background script');
        } catch (error) {
            console.error('Failed to send data to background script:', error);
            throw error;
        }
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'extractData') {
        // Start asynchronous data extraction
        extractDataAsync(request.payload)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Indicates that sendResponse will be called asynchronously
    }

    // ... existing listeners ...
}); 