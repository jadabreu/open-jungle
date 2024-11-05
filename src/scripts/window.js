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

        // Add menu initialization
        this.initializeMenu();

        // Add current view tracking
        this.currentView = 'main'; // Can be 'main' or 'settings'
        this.mainContent = document.querySelector('.main-content');
        this.settingsContent = null; // Will be initialized when needed

        // Initialize settings
        this.initializeSettings();
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

    initializeMenu() {
        // Create menu button that will toggle the dropdown
        const menuButton = document.createElement('button');
        menuButton.className = 'menu-toggle';
        menuButton.innerHTML = `
            <i class="material-icons">menu</i>
        `;
        
        // Create dropdown container
        const menuDropdown = document.createElement('div');
        menuDropdown.className = 'menu-dropdown';
        
        // Find the header content and add menu button next to reload button
        const headerContent = document.querySelector('.header-content');
        const reloadBtn = document.getElementById('reloadBtn');
        
        // Create a container for the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'header-buttons';
        
        // Move reload button into container and add menu button
        reloadBtn.parentNode.insertBefore(buttonContainer, reloadBtn);
        buttonContainer.appendChild(reloadBtn);
        buttonContainer.appendChild(menuButton);
        
        // Add dropdown to header content
        headerContent.appendChild(menuDropdown);

        // Create menu items
        const menuItems = [
            { 
                label: 'Extract Data', 
                icon: 'cloud_download', 
                action: () => this.showMainView() 
            },
            { 
                label: 'Settings', 
                icon: 'settings', 
                action: () => this.showSettingsView() 
            },
            { 
                label: 'Help', 
                icon: 'help_outline', 
                action: () => console.log('Help clicked') 
            }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <i class="material-icons">${item.icon}</i>
                <span>${item.label}</span>
            `;
            menuItem.addEventListener('click', () => {
                item.action();
                menuDropdown.classList.remove('show');
            });
            menuDropdown.appendChild(menuItem);
        });

        // Toggle dropdown on menu button click
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            menuDropdown.classList.remove('show');
        });
    }

    showMainView() {
        if (this.currentView === 'main') return;
        
        // Hide settings view if it exists
        if (this.settingsContent) {
            this.settingsContent.style.display = 'none';
        }
        
        // Show main view
        this.mainContent.style.display = 'block';
        this.currentView = 'main';
    }

    showSettingsView() {
        if (this.currentView === 'settings') return;

        // Initialize settings view if it doesn't exist
        if (!this.settingsContent) {
            this.createSettingsView();
        }

        // Hide main view
        this.mainContent.style.display = 'none';
        
        // Show settings view
        this.settingsContent.style.display = 'block';
        this.currentView = 'settings';
    }

    async initializeSettings() {
        // Load saved settings or set defaults
        const result = await chrome.storage.sync.get({
            forecastStart: 'week1' // Default value
        });
        this.settings = result;
    }

    createSettingsView() {
        this.settingsContent = document.createElement('div');
        this.settingsContent.className = 'settings-content';
        
        this.settingsContent.innerHTML = `
            <div class="settings-header">
                <h2>Settings</h2>
                <button class="back-button" aria-label="Back to main view">
                    <i class="material-icons">arrow_back</i>
                </button>
            </div>
            <div class="settings-body">
                <div class="settings-section">
                    <h3>Forecast Settings</h3>
                    <div class="setting-item">
                        <label class="setting-label">
                            Forecast starts at
                            <div class="toggle-switch">
                                <input type="checkbox" id="forecastStartSetting"
                                    ${this.settings.forecastStart === 'currentWeek' ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                                <span class="toggle-label">
                                    ${this.settings.forecastStart === 'currentWeek' ? 'Current Week' : 'Week 1'}
                                </span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Add back button functionality
        const backButton = this.settingsContent.querySelector('.back-button');
        backButton.addEventListener('click', () => this.showMainView());

        // Add toggle functionality
        const forecastToggle = this.settingsContent.querySelector('#forecastStartSetting');
        const toggleLabel = this.settingsContent.querySelector('.toggle-label');
        
        forecastToggle.addEventListener('change', async (e) => {
            const newValue = e.target.checked ? 'currentWeek' : 'week1';
            toggleLabel.textContent = e.target.checked ? 'Current Week' : 'Week 1';
            
            // Save the setting
            await chrome.storage.sync.set({
                forecastStart: newValue
            });
            this.settings.forecastStart = newValue;
        });

        // Insert settings view into the window container
        const windowContainer = document.querySelector('.window-container');
        windowContainer.insertBefore(this.settingsContent, this.mainContent.nextSibling);
    }

    openSettings() {
        this.showSettingsView();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WindowManager();
}); 