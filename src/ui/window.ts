import '../styles/common.css';
import '../styles/main.css';
import '../styles/test.css';

// Define interfaces for structured data
interface ProgressData {
  current: number;
  total: number;
  currentAsin: string;
}

interface ExtractionCompleteData {
  successCount: number;
  failedAsins: string[];
}

interface Settings {
  forecastStart: 'currentWeek' | 'week1';
}

// Add these missing type definitions at the top of the file
interface Message {
  type: 'progress' | 'complete' | 'error' | 'LOADING_STATE_CHANGED'
  data?: ProgressData | ExtractionCompleteData
  error?: string
  loading?: boolean
}

interface ForecastButton {
  button: HTMLElement
  asin: string
}

class WindowManager {
  extractBtn: HTMLButtonElement | null;
  statusBadge: HTMLElement | null;
  progressContainer: HTMLElement | null;
  progressBar: HTMLElement | null;
  currentAsin: HTMLElement | null;
  processedCount: HTMLElement | null;
  totalCount: HTMLElement | null;
  errorContainer: HTMLElement | null;
  errorList: HTMLElement | null;
  reloadBtn: HTMLButtonElement | null;

  currentView: 'main' | 'settings';
  mainContent: HTMLElement | null;
  settingsContent: HTMLElement | null;

  settings: Settings = {
    forecastStart: 'week1' // Default value
  };

  amazonTabIds: number[] = [];

  menuButton!: HTMLButtonElement;
  menuDropdown!: HTMLDivElement;
  menuItems: HTMLButtonElement[] = [];

  constructor() {
    this.extractBtn = document.getElementById('extractBtn') as HTMLButtonElement | null;
    this.statusBadge = document.getElementById('statusBadge');
    this.progressContainer = document.getElementById('progressContainer');
    this.progressBar = document.getElementById('progress');
    this.currentAsin = document.getElementById('currentAsin');
    this.processedCount = document.getElementById('processedCount');
    this.totalCount = document.getElementById('totalCount');
    this.errorContainer = document.getElementById('errorContainer');
    this.errorList = document.getElementById('errorList');
    this.reloadBtn = document.getElementById('reloadBtn') as HTMLButtonElement | null;

    this.initializeEventListeners();
    setTimeout(() => this.validateCurrentPage(), 1000);

    this.initializeMenu();

    this.currentView = 'main';
    this.mainContent = document.querySelector('.main-content');
    this.settingsContent = null;

    this.initializeSettings();
  }

  initializeEventListeners(): void {
    this.extractBtn?.addEventListener('click', () => {
      console.log('Extract button clicked');
      this.startExtraction();
    });

    this.reloadBtn?.addEventListener('click', () => {
      console.log('Reload button clicked');
      this.resetUI();
      this.setStatus('Ready', '');
      this.validateCurrentPage();
    });

    chrome.runtime.onMessage.addListener((
        message: Message, 
        sender: chrome.runtime.MessageSender, 
        sendResponse: (response?: any) => void
    ) => {
        console.log('Window received message:', message)
        switch (message.type) {
            case 'progress':
                this.updateProgress(message.data as ProgressData)
                break
            case 'complete':
                this.handleExtractionComplete(message.data as ExtractionCompleteData)
                break
            case 'error':
                this.handleError(message.error || 'Unknown error')
                break
            case 'LOADING_STATE_CHANGED':
                this.setUILoading(message.loading ?? false);
                break;
        }
    });
  }

  async validateCurrentPage(): Promise<boolean> {
    try {
      this.amazonTabIds = [];

      const tabs = await Promise.race([
        chrome.tabs.query({ 
          url: [
            "https://sellercentral.amazon.com/*",
            "https://sellercentral-europe.amazon.com/*",
            "https://sellercentral-japan.amazon.com/*"
          ]
        }),
        new Promise<chrome.tabs.Tab[]>((_, reject) => 
          setTimeout(() => reject(new Error('Tab query timeout')), 2000)
        )
      ]) as chrome.tabs.Tab[];
      
      console.log('Found Amazon tabs:', tabs.length);
      
      if (tabs.length === 0) {
        throw new Error('No Amazon tabs found. Please open an Amazon Seller Central page.');
      }

      // Instead of checking all tabs in parallel, check them sequentially until we find a valid one
      for (const tab of tabs) {
        if (!tab.id) continue;
        
        try {
          console.log(`Checking tab ${tab.id}...`);
          
          // Quick PING check
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              chrome.tabs.sendMessage(tab.id!, { action: 'PING' }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                resolve();
              });
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('PING timeout')), 500)
            )
          ]).catch(async () => {
            // If PING fails, inject content script
            await chrome.scripting.executeScript({
              target: { tabId: tab.id! },
              files: ['content.bundle.js']
            });
          });

          // Check if this tab has forecast buttons
          const response = await Promise.race([
            new Promise<{ valid: boolean }>((resolve, reject) => {
              chrome.tabs.sendMessage(tab.id!, { action: 'CHECK_PAGE' }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                resolve(response || { valid: false });
              });
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Page check timeout')), 2000)
            )
          ]);

          if (response.valid) {
            console.log(`Found valid forecast page in tab: ${tab.id}`);
            this.amazonTabIds = [tab.id];  // Only store the valid tab
            this.setStatus('Ready', '');
            if (this.extractBtn) this.extractBtn.disabled = false;
            return true;  // Stop checking other tabs once we find a valid one
          } else {
            console.log(`Tab ${tab.id} is not a forecast page, skipping...`);
          }
        } catch (error) {
          console.log(`Tab ${tab.id} check failed:`, error);
          // Continue to next tab
        }
      }

      throw new Error('Click the link above and then hit refresh button on the top.');
      
    } catch (error) {
      console.error('Page validation failed:', error);
      this.setStatus('Error', 'error');
      if (this.extractBtn) this.extractBtn.disabled = true;
      this.showErrors([
        error instanceof Error ? error.message : 'Unknown error occurred',
        'Please ensure you are on the Amazon Seller Central forecast page'
      ]);
      return false;
    }
  }

  async startExtraction(): Promise<void> {
    try {
      if (!await this.validateCurrentPage()) {
        return;
      }

      this.resetUI();
      this.setStatus('Processing', 'processing');
      if (this.extractBtn) this.extractBtn.disabled = true;
      if (this.reloadBtn) this.reloadBtn.disabled = true;
      
      // Iterate through all valid tabs
      for (const tabId of this.amazonTabIds) {
        try {
          // Send message and wait for acknowledgment
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('START_EXTRACTION timeout'));
            }, 5000);

            chrome.tabs.sendMessage(
              tabId, 
              { action: 'START_EXTRACTION' },
              (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                // Even if no response, consider it acknowledged
                resolve();
              }
            );
          });

          console.log(`START_EXTRACTION sent to tab ${tabId}`);
        } catch (error) {
          console.error(`Failed to start extraction on tab ${tabId}:`, error);
          this.handleError(`Failed to start extraction: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      }

      console.log('START_EXTRACTION message sent to content scripts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Extraction initiation failed:', error);
      this.handleError(errorMessage);
    }
  }

  updateProgress(data: ProgressData): void {
    if (this.progressContainer) this.progressContainer.style.display = 'block';
    if (this.currentAsin) this.currentAsin.textContent = data.currentAsin;
    if (this.processedCount) this.processedCount.textContent = data.current.toString();
    if (this.totalCount) this.totalCount.textContent = data.total.toString();
    if (this.progressBar) {
      this.progressBar.style.width = `${(data.current / data.total) * 100}%`;
    }
  }

  handleExtractionComplete(data: ExtractionCompleteData): void {
    this.setStatus('Complete', 'success');
    if (this.extractBtn) this.extractBtn.disabled = false;
    if (this.reloadBtn) this.reloadBtn.disabled = false;
    console.log(`Extraction complete: ${data.successCount} succeeded, ${data.failedAsins.length} failed`);

    if (data.failedAsins?.length > 0) {
      this.showErrors(data.failedAsins);
    }
  }

  handleError(error: string): void {
    this.setStatus('Error', 'error');
    if (this.extractBtn) this.extractBtn.disabled = false;
    if (this.reloadBtn) this.reloadBtn.disabled = false;
    this.showErrors([error || 'An unknown error occurred']);
    console.error('Extraction Error:', error);
  }

  setStatus(text: string, type?: string): void {
    if (this.statusBadge) {
      if (type === 'error') {
        this.statusBadge.textContent = 'Error';
      } else {
        this.statusBadge.textContent = text;
      }
      this.statusBadge.className = 'status-badge ' + (type || '');
    }
  }

  showErrors(messages: string[]): void {
    if (this.errorContainer) this.errorContainer.style.display = 'block';
    if (this.errorList) this.errorList.textContent = messages.join('\n');
  }

  resetUI(): void {
    if (this.progressContainer) this.progressContainer.style.display = 'none';
    if (this.errorContainer) this.errorContainer.style.display = 'none';
    if (this.progressBar) this.progressBar.style.width = '0';
    if (this.currentAsin) this.currentAsin.textContent = '-';
    if (this.processedCount) this.processedCount.textContent = '0';
    if (this.totalCount) this.totalCount.textContent = '0';
    if (this.reloadBtn) this.reloadBtn.disabled = false;
  }

  initializeMenu(): void {
    // Create menu button that will toggle the dropdown
    const menuButton: HTMLButtonElement = document.createElement('button');
    menuButton.className = 'menu-toggle';
    menuButton.innerHTML = `
      <i class="material-icons">menu</i>
    `;
    this.menuButton = menuButton;
    
    // Create dropdown container
    const menuDropdown: HTMLDivElement = document.createElement('div');
    menuDropdown.className = 'menu-dropdown';
    this.menuDropdown = menuDropdown;
    
    // Find the header content and add menu button next to reload button
    const headerContent: HTMLElement | null = document.querySelector('.header-content');
    const reloadBtn: HTMLButtonElement | null = this.reloadBtn;
    
    if (headerContent && reloadBtn) {
      // Create a container for the buttons
      const buttonContainer: HTMLDivElement = document.createElement('div');
      buttonContainer.className = 'header-buttons';
      
      // Move reload button into container and add menu button
      reloadBtn.parentNode!.insertBefore(buttonContainer, reloadBtn);
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

      // Store menu items for later access
      this.menuItems = menuItems.map(item => {
        const menuItem: HTMLButtonElement = document.createElement('button');
        menuItem.className = 'menu-item';
        menuItem.innerHTML = `
          <i class="material-icons">${item.icon}</i>
          <span>${item.label}</span>
        `;
        menuItem.addEventListener('click', () => {
          if (!menuItem.disabled) {
            item.action();
            menuDropdown.classList.remove('show');
          }
        });
        menuDropdown.appendChild(menuItem);
        return menuItem;
      });

      // Toggle dropdown on menu button click
      menuButton.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        menuDropdown.classList.remove('show');
      });
    }
  }

  showMainView(): void {
    if (this.currentView === 'main') return;
    
    if (this.settingsContent) {
      this.settingsContent.style.display = 'none';
    }
    
    if (this.mainContent) {
      this.mainContent.style.display = 'block';
    }
    this.currentView = 'main';
  }

  showSettingsView(): void {
    if (this.currentView === 'settings') return;

    if (!this.settingsContent) {
      this.createSettingsView();
    }

    if (this.mainContent) {
      this.mainContent.style.display = 'none';
    }

    if (this.settingsContent) {
      this.settingsContent.style.display = 'block';
    }
    this.currentView = 'settings';
  }

  async initializeSettings(): Promise<void> {
    try {
      const result = await new Promise<Settings>((resolve) => {
        chrome.storage.sync.get(['forecastStart'], (items) => {
          resolve({
            forecastStart: (items.forecastStart as Settings['forecastStart']) || 'week1'
          })
        })
      })
      this.settings = result
      console.log('Settings initialized:', this.settings)
    } catch (error) {
      console.error('Failed to initialize settings:', error)
      this.settings = {
        forecastStart: 'week1'
      }
    }
  }

  createSettingsView(): void {
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
    const backButton: HTMLButtonElement | null = this.settingsContent.querySelector('.back-button') as HTMLButtonElement | null;
    backButton?.addEventListener('click', () => this.showMainView());

    // Add toggle functionality
    const forecastToggle: HTMLInputElement | null = this.settingsContent.querySelector('#forecastStartSetting') as HTMLInputElement | null;
    const toggleLabel: HTMLElement | null = this.settingsContent.querySelector('.toggle-label');
    
    forecastToggle?.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newValue: 'currentWeek' | 'week1' = target.checked ? 'currentWeek' : 'week1';
      if (toggleLabel) {
        toggleLabel.textContent = target.checked ? 'Current Week' : 'Week 1';
      }
      
      await new Promise<void>((resolve) => {
        chrome.storage.sync.set({ forecastStart: newValue }, resolve)
      });
      this.settings!.forecastStart = newValue;
      console.log('Settings updated:', this.settings);
    });

    // Insert settings view into the window container
    const windowContainer: HTMLElement | null = document.querySelector('.window-container');
    if (windowContainer && this.mainContent) {
      windowContainer.insertBefore(this.settingsContent, this.mainContent.nextSibling);
    }
  }

  private setUILoading(loading: boolean): void {
    const container = document.querySelector('.main-content');
    if (loading) {
      container?.classList.add('loading');
      // Disable all interactive elements
      if (this.extractBtn) this.extractBtn.disabled = true;
      if (this.reloadBtn) this.reloadBtn.disabled = true;
      if (this.menuButton) this.menuButton.disabled = true;
      this.menuItems.forEach(item => item.disabled = true);
      if (this.menuDropdown) this.menuDropdown.classList.remove('show');
    } else {
      container?.classList.remove('loading');
      // Re-enable all interactive elements
      if (this.extractBtn) this.extractBtn.disabled = false;
      if (this.reloadBtn) this.reloadBtn.disabled = false;
      if (this.menuButton) this.menuButton.disabled = false;
      this.menuItems.forEach(item => item.disabled = false);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WindowManager();
}); 