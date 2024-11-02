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
        
        this.initializeEventListeners();
        setTimeout(() => this.validateCurrentPage(), 500);
    }

    async validateCurrentPage() {
        try {
            const tabs = await chrome.tabs.query({});
            const amazonTabs = tabs.filter(tab => 
                tab.url && tab.url.includes('amazon.com')
            );
            
            if (amazonTabs.length === 0) {
                throw new Error('No Amazon tabs found');
            }

            for (const tab of amazonTabs) {
                this.amazonTabId = tab.id;

                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: this.amazonTabId },
                        files: [
                            'scripts/utils/helpers.js',
                            'scripts/utils/extractor.js',
                            'scripts/forecastExtractor.js',
                            'scripts/content.js'
                        ]
                    });
                } catch (error) {
                    // Scripts already loaded, continue
                }

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
            }

            this.extractBtn.disabled = true;
            this.setStatus('No forecast buttons found', 'error');
            this.showErrors([
                'No forecast buttons found on any Amazon tab.',
                'Make sure you are on the Restock Inventory page',
                'and that the page has fully loaded.'
            ]);
            return false;

        } catch (error) {
            this.setStatus('Error validating page', 'error');
            this.extractBtn.disabled = true;
            return false;
        }
    }

    initializeEventListeners() {
        this.extractBtn.addEventListener('click', () => this.startExtraction());

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    async startExtraction() {
        try {
            if (!await this.validateCurrentPage()) {
                return;
            }

            this.resetUI();
            this.setStatus('Processing', 'processing');
            this.extractBtn.disabled = true;
            
            chrome.tabs.sendMessage(this.amazonTabId, { 
                action: 'START_EXTRACTION'
            });

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

        if (failedAsins?.length > 0) {
            this.showErrors(failedAsins);
        }
    }

    handleError(error) {
        this.setStatus('Error', 'error');
        this.extractBtn.disabled = false;
        this.showErrors([error.message || 'An unknown error occurred']);
    }

    setStatus(text, type) {
        this.statusBadge.textContent = text;
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
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WindowManager();
}); 