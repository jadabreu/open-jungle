import '../styles/common.css';
import '../styles/sidepanel.css';

interface ExtractResponse {
  success: boolean;
  error?: string;
  asin?: string;
  progress?: number;
  total?: number;
  processed?: number;
  errors?: string[];
}

interface Settings {
  forecastStart: 'currentWeek' | 'week1';
}

class SidePanelManager {
  private extractButton: HTMLButtonElement;
  private downloadButton: HTMLButtonElement;
  private calculateButton: HTMLButtonElement;
  private reloadButton: HTMLButtonElement;
  private statusBadge: HTMLElement;
  private progressContainer: HTMLElement;
  private actionButtons: HTMLElement;
  private errorContainer: HTMLElement;
  private errorMessage: HTMLElement;
  private errorList: HTMLElement;
  private currentAsin: HTMLElement;
  private progress: HTMLElement;
  private processedCount: HTMLElement;
  private totalCount: HTMLElement;
  private amazonTabIds: number[] = [];

  // Menu and Settings elements
  private menuButton: HTMLButtonElement;
  private menuDropdown: HTMLElement;
  private menuItems: HTMLButtonElement[] = [];
  private mainContent: HTMLElement;
  private settingsContent: HTMLElement;
  private backButton: HTMLButtonElement;
  private week1Radio: HTMLInputElement;
  private currentWeekRadio: HTMLInputElement;
  private currentView: 'main' | 'settings' = 'main';
  private settings: Settings = {
    forecastStart: 'week1'
  };

  constructor() {
    // Initialize existing elements
    this.extractButton = document.getElementById('extractButton') as HTMLButtonElement;
    this.downloadButton = document.getElementById('downloadButton') as HTMLButtonElement;
    this.calculateButton = document.getElementById('calculateButton') as HTMLButtonElement;
    this.reloadButton = document.getElementById('reloadBtn') as HTMLButtonElement;
    this.statusBadge = document.getElementById('statusBadge') as HTMLElement;
    this.progressContainer = document.getElementById('progressContainer') as HTMLElement;
    this.actionButtons = document.getElementById('actionButtons') as HTMLElement;
    this.errorContainer = document.getElementById('errorContainer') as HTMLElement;
    this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
    this.errorList = document.getElementById('errorList') as HTMLElement;
    this.currentAsin = document.getElementById('currentAsin') as HTMLElement;
    this.progress = document.getElementById('progress') as HTMLElement;
    this.processedCount = document.getElementById('processedCount') as HTMLElement;
    this.totalCount = document.getElementById('totalCount') as HTMLElement;

    // Initialize menu elements
    this.menuButton = document.getElementById('menuBtn') as HTMLButtonElement;
    this.menuDropdown = document.getElementById('menuDropdown') as HTMLElement;
    this.mainContent = document.getElementById('mainContent') as HTMLElement;
    this.settingsContent = document.getElementById('settingsContent') as HTMLElement;
    this.backButton = document.getElementById('backButton') as HTMLButtonElement;
    this.week1Radio = document.getElementById('week1Radio') as HTMLInputElement;
    this.currentWeekRadio = document.getElementById('currentWeekRadio') as HTMLInputElement;

    this.initializeUI();
    this.initializeEventListeners();
    this.initializeMenu();
    this.initializeSettings();
    setTimeout(() => this.validateCurrentPage(), 1000);
  }

  private async initializeSettings(): Promise<void> {
    try {
      const result = await new Promise<Settings>((resolve) => {
        chrome.storage.sync.get(['forecastStart'], (items) => {
          resolve({
            forecastStart: (items.forecastStart as Settings['forecastStart']) || 'week1'
          });
        });
      });
      this.settings = result;
      this.updateRadioButtons();
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  private initializeMenu(): void {
    // Menu button click handler
    this.menuButton.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      this.menuDropdown.classList.toggle('show');
    });

    // Menu items click handlers
    document.getElementById('extractMenuItem')?.addEventListener('click', () => {
      this.showMainView();
      this.menuDropdown.classList.remove('show');
    });

    document.getElementById('settingsMenuItem')?.addEventListener('click', () => {
      this.showSettingsView();
      this.menuDropdown.classList.remove('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.menuDropdown.classList.remove('show');
    });

    // Back button in settings
    this.backButton.addEventListener('click', () => this.showMainView());

    // Settings radio buttons
    this.week1Radio.addEventListener('change', () => this.handleForecastStartChange('week1'));
    this.currentWeekRadio.addEventListener('change', () => this.handleForecastStartChange('currentWeek'));
  }

  private async handleForecastStartChange(value: Settings['forecastStart']): Promise<void> {
    await this.updateSettings({ forecastStart: value });
  }

  private updateRadioButtons(): void {
    this.week1Radio.checked = this.settings.forecastStart === 'week1';
    this.currentWeekRadio.checked = this.settings.forecastStart === 'currentWeek';
  }

  private async updateSettings(newSettings: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set(newSettings, resolve);
    });
    this.updateRadioButtons();
  }

  private showMainView(): void {
    if (this.currentView === 'main') return;
    this.mainContent.style.display = 'block';
    this.settingsContent.style.display = 'none';
    this.currentView = 'main';
  }

  private showSettingsView(): void {
    if (this.currentView === 'settings') return;
    this.mainContent.style.display = 'none';
    this.settingsContent.style.display = 'block';
    this.currentView = 'settings';
  }

  private initializeUI(): void {
    this.errorContainer.style.display = 'none';
    this.progressContainer.style.display = 'none';
    this.downloadButton.disabled = true;
    this.calculateButton.disabled = true;
    this.actionButtons.style.display = 'none';
  }

  private initializeEventListeners(): void {
    this.extractButton.addEventListener('click', () => this.startExtraction());
    this.downloadButton.addEventListener('click', () => this.handleDownload());
    this.calculateButton.addEventListener('click', () => this.handleCalculateBuffers());
    this.reloadButton.addEventListener('click', () => {
      this.resetUI();
      this.setStatus('Ready', '');
      this.validateCurrentPage();
    });

    chrome.runtime.onMessage.addListener((message: any) => {
      if (message.type === 'progress' && message.data) {
        this.updateProgress(message.data);
      } else if (message.type === 'complete' && message.data) {
        this.handleExtractionComplete(message.data);
      } else if (message.type === 'error') {
        this.handleError(message.error || 'Unknown error');
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
      
      if (tabs.length === 0) {
        throw new Error('No Amazon tabs found. Please open an Amazon Seller Central page.');
      }

      for (const tab of tabs) {
        if (!tab.id) continue;
        
        try {
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
            await chrome.scripting.executeScript({
              target: { tabId: tab.id! },
              files: ['content.bundle.js']
            });
          });

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
            this.amazonTabIds = [tab.id];
            this.setStatus('Ready', '');
            this.extractButton.disabled = false;
            return true;
          }
        } catch (error) {
          console.log(`Tab ${tab.id} check failed:`, error);
        }
      }

      throw new Error('Click the link above and then hit refresh button on the top.');
      
    } catch (error) {
      this.setStatus('Error', 'error');
      this.extractButton.disabled = true;
      this.showErrors([
        error instanceof Error ? error.message : 'Unknown error occurred',
        'Please ensure you are on the Amazon Seller Central forecast page'
      ]);
      return false;
    }
  }

  private async startExtraction(): Promise<void> {
    try {
      if (!await this.validateCurrentPage()) {
        return;
      }

      this.resetUI();
      this.setStatus('Processing', 'processing');
      this.extractButton.disabled = true;
      this.reloadButton.disabled = true;
      
      for (const tabId of this.amazonTabIds) {
        try {
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
                resolve();
              }
            );
          });
        } catch (error) {
          this.handleError(`Failed to start extraction: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(errorMessage);
    }
  }

  private updateProgress(data: { current: number; total: number; currentAsin: string }): void {
    this.progressContainer.style.display = 'block';
    this.currentAsin.textContent = data.currentAsin;
    this.processedCount.textContent = data.current.toString();
    this.totalCount.textContent = data.total.toString();
    this.progress.style.width = `${(data.current / data.total) * 100}%`;
  }

  private handleExtractionComplete(data: { successCount: number; failedAsins: string[] }): void {
    this.setStatus('Complete', 'success');
    this.extractButton.disabled = false;
    this.reloadButton.disabled = false;
    this.actionButtons.style.display = 'flex';
    this.downloadButton.disabled = false;
    this.calculateButton.disabled = false;
    
    if (data.failedAsins?.length > 0) {
      this.showErrors(data.failedAsins);
    }
  }

  private handleError(error: string): void {
    this.setStatus('Error', 'error');
    this.extractButton.disabled = false;
    this.reloadButton.disabled = false;
    this.showErrors([error || 'An unknown error occurred']);
  }

  private setStatus(text: string, type: string = ''): void {
    this.statusBadge.textContent = type === 'error' ? 'Error' : text;
    this.statusBadge.className = 'status-badge ' + type;
  }

  private showErrors(messages: string[]): void {
    this.errorContainer.style.display = 'block';
    
    // Clear previous error message content
    this.errorMessage.innerHTML = '';
    
    // Check if it's a forecast page error
    if (messages.some(msg => msg.toLowerCase().includes('forecast page') || msg.toLowerCase().includes('seller central'))) {
      this.errorMessage.innerHTML = `
        <p>Please make sure you have the Amazon Seller Central Restock Inventory page open, click the link below and then hit the refresh button on the top:</p>
        <a href="https://sellercentral.amazon.com/restockinventory/recommendations?ref=fbacentral_nav_fba" 
           target="_blank" 
           class="amazon-link">
            <i class="material-icons">open_in_new</i>
            Open Restock Inventory Page
        </a>
      `;
    } else {
      this.errorMessage.innerHTML = messages.map(msg => `<p>${msg}</p>`).join('');
    }
    
    this.errorList.textContent = '';
  }

  private resetUI(): void {
    this.progressContainer.style.display = 'none';
    this.errorContainer.style.display = 'none';
    this.progress.style.width = '0';
    this.currentAsin.textContent = '-';
    this.processedCount.textContent = '0';
    this.totalCount.textContent = '0';
    this.reloadButton.disabled = false;
    this.actionButtons.style.display = 'none';
    this.downloadButton.disabled = true;
    this.calculateButton.disabled = true;
  }

  private async handleDownload(): Promise<void> {
    try {
      this.setStatus('Downloading...', 'processing');
      const response = await new Promise<{ error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'downloadForecast' }, (response) => resolve(response));
      });
      
      if (response?.error) {
        this.handleError(response.error);
      } else {
        this.setStatus('Download Complete', 'success');
      }
    } catch (error) {
      this.handleError(`Failed to download forecast: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleCalculateBuffers(): Promise<void> {
    try {
      this.setStatus('Calculating Buffers...', 'processing');
      const response = await new Promise<{ error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'downloadBuffer' }, (response) => resolve(response));
      });
      
      if (response?.error) {
        this.handleError(response.error);
      } else {
        this.setStatus('Buffer Calculation Complete', 'success');
      }
    } catch (error) {
      this.handleError(`Failed to calculate buffers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SidePanelManager();
}); 