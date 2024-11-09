import { ForecastDataExtractor, ForecastUIHandler } from './forecastExtractor';
import { Settings, WeekStartOption, ForecastItem } from '../types/index';
import { waitForElement, sleep } from '../utils/helpers';

interface Message {
  action: 'CHECK_PAGE' | 'START_EXTRACTION' | 'PING';
}

interface ExtractionResult {
  extractedData: ForecastItem[];
  failedAsins: string[];
}

// At the top of the file, before the class definition
console.log('Content script file loaded');

// Create a global initialization flag
window.contentScriptInitialized = false;

class ContentScript {
  private static instance: ContentScript | null = null;
  private dataExtractor: ForecastDataExtractor | null = null;
  private uiHandler: ForecastUIHandler | null = null;
  private settings: Settings | null = null;

  constructor() {
    if (ContentScript.instance) {
      return ContentScript.instance;
    }
    ContentScript.instance = this;
    
    console.log('Content script constructor called');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('Content script initializing...');
      this.logPageState();
      
      // Only set up message listeners initially
      this.setupMessageListeners();
      
      // Set the initialization flag
      window.contentScriptInitialized = true;
      console.log('Content script initialized');
      
      // Set up periodic page state logging
      setInterval(() => this.logPageState(), 5000);
    } catch (error) {
      console.error('Content script initialization failed:', error);
    }
  }

  // Lazy initialization of extractors
  private async initializeExtractorsIfNeeded(): Promise<void> {
    if (this.dataExtractor && this.uiHandler) {
      return; // Already initialized
    }

    console.log('Initializing extractors on demand...');
    
    try {
      // Initialize components
      this.dataExtractor = new ForecastDataExtractor();
      this.uiHandler = new ForecastUIHandler();
      
      // Load settings
      await this.loadSettings();
      
      console.log('Extractors initialized successfully');
    } catch (error) {
      console.error('Failed to initialize extractors:', error);
      throw error;
    }
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message);

      if (message.action === 'PING') {
        console.log('Responding to PING');
        sendResponse({ status: 'ok' });
        return true;
      }

      if (message.action === 'CHECK_PAGE') {
        console.log('Received CHECK_PAGE action.');
        this.handleCheckPage(sendResponse);
        return true;
      }

      if (message.action === 'START_EXTRACTION') {
        console.log('Received START_EXTRACTION action.');
        // Acknowledge receipt immediately
        sendResponse({ status: 'started' });
        
        // Initialize extractors and start extraction
        this.initializeExtractorsIfNeeded()
          .then(() => this.handleStartExtraction())
          .catch((error) => {
            chrome.runtime.sendMessage({
              type: 'error',
              error: error instanceof Error ? error.message : String(error)
            });
            console.error('Extraction Error:', error instanceof Error ? error.message : error);
          });
        
        return true;
      }
    });
  }

  private async handleStartExtraction(): Promise<void> {
    if (!this.dataExtractor || !this.uiHandler) {
      throw new Error('Extractors not initialized');
    }

    try {
      const result = await this.startExtraction();
      chrome.runtime.sendMessage({
        type: 'complete',
        data: {
          successCount: result.extractedData.length,
          failedAsins: result.failedAsins
        }
      });
      console.log('Extraction complete, sent "complete" message');
    } catch (error) {
      chrome.runtime.sendMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('Extraction Error:', error instanceof Error ? error.message : error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      // Convert chrome.storage.sync.get to a proper Promise
      const settings = await new Promise<{ forecastStart: WeekStartOption }>((resolve) => {
        chrome.storage.sync.get({ forecastStart: 'week1' }, (items) => {
          resolve(items as { forecastStart: WeekStartOption })
        })
      })
      this.settings = {
        forecastStart: settings.forecastStart
      }
      console.log('Settings loaded:', this.settings)
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {
        forecastStart: 'week1'
      };
    }
  }

  private async startExtraction(): Promise<ExtractionResult> {
    if (!this.dataExtractor || !this.uiHandler) {
      throw new Error('Extractors not initialized');
    }

    try {
      const { forecastButtons, asins } = await this.dataExtractor.initialize();

      if (forecastButtons.length !== asins.length) {
        throw new Error('Mismatch between forecast buttons and ASINs.');
      }

      const buttonData = forecastButtons.map((button, index) => ({
        button: button as HTMLElement,
        asin: asins[index]
      }));

      await this.uiHandler.extract(this.dataExtractor, buttonData, asins);

      return {
        extractedData: this.uiHandler.data,
        failedAsins: this.uiHandler.failures
      };
    } catch (error: unknown) {
      console.error('Extraction failed:', error instanceof Error ? error.message : error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private observeDOMChanges(): void {
    const observer = new MutationObserver((mutations, obs) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const buttons = Array.from(
            document.querySelectorAll(
              'button.a-button-text.view-forecast-btn[data-action="view-forecast"], ' +
              'button.view-forecast[data-action="view-forecast"], ' +
              'button.view-forecast-btn[data-action="view-forecast"]'
            )
          );
          
          if (buttons.length > 0) {
            console.log('Forecast buttons detected via MutationObserver.');
            obs.disconnect(); // Stop observing once buttons are detected
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('MutationObserver initialized to detect forecast buttons.');
  }

  private logPageState(): void {
    console.log('Page State:', {
      url: window.location.href,
      readyState: document.readyState,
      bodyChildren: document.body?.children.length,
      scripts: document.scripts.length,
      iframes: document.getElementsByTagName('iframe').length,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });
  }

  // Add this helper method to the ContentScript class
  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      rect.width === 0 ||
      rect.height === 0
    );
  }

  private async handleCheckPage(sendResponse: (response: any) => void): Promise<void> {
    try {
      console.log('Starting page check...');
      
      // Define all possible button selectors
      const selectors = [
        '.mt-popover button[data-action="view-forecast"]',
        '.mt-popover .a-popover-trigger',
        'button.a-button-text[data-action="view-forecast"]',
        'button.view-forecast-btn',
        '.a-button-text:has(span.mt-text-content)'
      ];

      let buttons: Element[] = [];
      
      // Function to check if an element is a forecast button
      const isForecastButton = (el: Element): boolean => {
        const text = el.textContent?.toLowerCase().trim() || '';
        const action = el.getAttribute('data-action')?.toLowerCase() || '';
        const classes = el.className.toLowerCase();
        
        return (
          text.includes('view forecast') ||
          action.includes('view-forecast') ||
          (classes.includes('view-forecast') && el.tagName === 'BUTTON')
        );
      };

      // First try direct button search
      for (const selector of selectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          const matchingButtons = elements.filter(isForecastButton);
          
          if (matchingButtons.length > 0) {
            buttons = matchingButtons;
            console.log(`Found ${buttons.length} buttons using selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`Selector "${selector}" failed:`, error);
        }
      }

      // If no buttons found, try recursive search
      if (buttons.length === 0) {
        console.log('No buttons found with selectors, trying recursive search...');
        const walkDOM = (node: Element) => {
          if (isForecastButton(node)) {
            buttons.push(node);
          }
          node.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              walkDOM(child as Element);
            }
          });
        };
        walkDOM(document.body);
      }

      // Log detailed information about what we found
      console.log('Page check results:', {
        url: window.location.href,
        title: document.title,
        buttonsFound: buttons.length,
        buttonDetails: buttons.map(btn => ({
          text: btn.textContent?.trim(),
          tagName: btn.tagName,
          classes: btn.className,
          attributes: Object.fromEntries(
            Array.from(btn.attributes).map(attr => [attr.name, attr.value])
          ),
          rect: (btn as HTMLElement).getBoundingClientRect(),
          isVisible: this.isElementVisible(btn as HTMLElement)
        }))
      });

      const hasButtons = buttons.length > 0;
      console.log(`Page check result: ${hasButtons ? 'valid' : 'invalid'} (${buttons.length} buttons)`);
      
      sendResponse({ valid: hasButtons });
    } catch (error) {
      console.error('Error during page check:', error);
      sendResponse({ 
        valid: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

// Initialize immediately and on DOM content loaded
const initContentScript = () => {
  console.log('Initializing content script...');
  new ContentScript();
};

// Try to initialize immediately
initContentScript();

// Also initialize on DOM content loaded if not already done
document.addEventListener('DOMContentLoaded', () => {
  if (!window.contentScriptInitialized) {
    console.log('Initializing content script on DOMContentLoaded');
    initContentScript();
  }
});

export {};