class WindowManager {
    constructor() {
        this.extractBtn = document.getElementById('extractBtn');
        this.statusBadge = document.getElementById('statusBadge');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progress');
        this.currentAsin = document.getElementById('currentAsin');
        this.processedCount = document.getElementById('processedCount');
        this.totalCount = document.getElementById('totalCount');
        this.errorContainer = document.getElementById('errorContainer');
        this.errorList = document.getElementById('errorList');
        this.reloadBtn = document.getElementById('reloadBtn');
        
        this.initializeEventListeners();
        setTimeout(() => this.validateCurrentPage(), 500);
    }

    initializeEventListeners() {
        this.extractBtn.addEventListener('click', () => {
            console.log('Extract button clicked');
            this.startExtraction();
        });

        this.reloadBtn.addEventListener('click', () => {
            console.log('Reload button clicked');
            this.resetUI();
            this.setStatus('Ready', '');
            this.validateCurrentPage();
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Window received message:', message);
            switch (message.type) {
                case 'progress':
                    this.updateProgress(message.data);
                    break;
                case 'complete':
                    this.handleExtractionComplete(message.data);
                    break;
                case 'error':
                    this.handleError(message.error);
                    break;
            }
        });
    }

    async validateCurrentPage() {
        try {
            // Query all tabs to find Amazon tabs
            const tabs = await chrome.tabs.query({ url: "*://*.amazon.com/*" });
            
            if (tabs.length === 0) {
                throw new Error('No Amazon tabs found. Please open an Amazon Seller Central page.');
            }

            // Find the first tab that has forecast buttons
            for (const tab of tabs) {
                this.amazonTabId = tab.id;
                
                try {
                    // Inject content scripts manually to ensure they're loaded
                    await chrome.scripting.executeScript({
                        target: { tabId: this.amazonTabId },
                        files: [
                            'scripts/utils/helpers.js',
                            'scripts/utils/extractor.js',
                            'scripts/forecastExtractor.js',
                            'scripts/content.js'
                        ]
                    });

                    // Send a message to the content script to check the page
                    const response = await new Promise((resolve) => {
                        chrome.tabs.sendMessage(this.amazonTabId, { action: 'CHECK_PAGE' }, (response) => {
                            resolve(response || { valid: false });
                        });
                    });

                    if (response.valid) {
                        this.setStatus('Ready', '');
                        this.extractBtn.disabled = false;
                        return true;
                    }
                } catch (error) {
                    console.log(`Tab ${tab.id} check failed:`, error);
                    // Continue checking other tabs
                    continue;
                }
            }

            // If we get here, no valid tab was found
            this.extractBtn.disabled = true;
            this.setStatus('Error', 'error');
            this.showErrors([
                'No forecast buttons found.',
                'Please go to:',
                'https://sellercentral.amazon.com/restockinventory/recommendations?ref=fbacentral_nav_fba',
                '',
                'Make sure the page has fully loaded.'
            ]);
            return false;

        } catch (error) {
            this.setStatus('Error', 'error');
            this.extractBtn.disabled = true;
            this.showErrors([error.message]);
            return false;
        }
    }

    async startExtraction() {
        try {
            if (!await this.validateCurrentPage()) {
                return;
            }

            this.resetUI();
            this.setStatus('Processing', 'processing');
            this.extractBtn.disabled = true;
            this.reloadBtn.disabled = true;
            
            // Send message to the content script to start extraction
            chrome.tabs.sendMessage(this.amazonTabId, { 
                action: 'START_EXTRACTION'
            });
            console.log('START_EXTRACTION message sent to content script');

        } catch (error) {
            this.handleError(error);
        }
    }

    updateProgress({ current, total, currentAsin }) {
        this.progressContainer.style.display = 'block';
        this.currentAsin.textContent = currentAsin;
        this.processedCount.textContent = current;
        this.totalCount.textContent = total;
        this.progressBar.style.width = `${(current / total) * 100}%`;
    }

    handleExtractionComplete({ successCount, failedAsins }) {
        this.setStatus('Complete', 'success');
        this.extractBtn.disabled = false;
        this.reloadBtn.disabled = false;
        console.log(`Extraction complete: ${successCount} succeeded, ${failedAsins.length} failed`);

        if (failedAsins?.length > 0) {
            this.showErrors(failedAsins);
        }
    }

    handleError(error) {
        this.setStatus('Error', 'error');
        this.extractBtn.disabled = false;
        this.reloadBtn.disabled = false;
        this.showErrors([error.message || 'An unknown error occurred']);
        console.error('Extraction Error:', error);
    }

    setStatus(text, type) {
        if (type === 'error') {
            this.statusBadge.textContent = 'Error';
        } else {
            this.statusBadge.textContent = text;
        }
        this.statusBadge.className = 'status-badge ' + (type || '');
    }

    showErrors(messages) {
        this.errorContainer.style.display = 'block';
        this.errorList.textContent = messages.join('\n');
    }

    resetUI() {
        this.progressContainer.style.display = 'none';
        this.errorContainer.style.display = 'none';
        this.progressBar.style.width = '0';
        this.currentAsin.textContent = '-';
        this.processedCount.textContent = '0';
        this.totalCount.textContent = '0';
        this.reloadBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WindowManager();
}); 