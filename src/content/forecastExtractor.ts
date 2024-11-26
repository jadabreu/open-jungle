import { WeekStartOption, ForecastData, ForecastItem } from '../types/index.js';
import { waitForElement, sleep, MouseEventParams, WaitForElementOptions } from '../utils/helpers';

declare global {
  interface Window {
    ForecastDataExtractor: typeof ForecastDataExtractor;
    ForecastUIHandler: typeof ForecastUIHandler;
    helpers: {
      waitForElement: (
        selector: string, 
        options?: WaitForElementOptions
      ) => Promise<Element | null>;
      sleep: typeof sleep;
      simulateMouseEvent: (
        element: Element, 
        eventType: string, 
        params: MouseEventParams
      ) => void;
    };
  }
}

export {} // Convert file to module

/// <reference types="chrome" />

/**
 * ForecastDataExtractor is responsible for extracting forecast data for a given ASIN.
 */
export class ForecastDataExtractor {
  constructor() {
    console.log('ForecastDataExtractor initialized');
  }

  /**
   * Extracts forecast data for a specific ASIN.
   * @param asin - The ASIN to extract data for.
   * @returns A promise that resolves to an array of forecast data points.
   */
  async extractForecastData(asin: string): Promise<ForecastData[]> {
    try {
      const forecasts = await this.fetchForecastsFromPage(asin);
      return forecasts;
    } catch (error) {
      console.error(`Failed to extract data for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Fetches forecast data from the current page.
   * @param asin - The ASIN to fetch data for.
   * @returns A promise that resolves to an array of forecast data points.
   */
  private async fetchForecastsFromPage(asin: string): Promise<ForecastData[]> {
    try {
      console.log(`Fetching forecasts for ASIN ${asin}...`);

      // Get the forecast start setting using Promise
      const settings = await new Promise<{ forecastStart: WeekStartOption }>((resolve) => {
        chrome.storage.sync.get({ forecastStart: 'currentWeek' }, (items) => {
          resolve(items as { forecastStart: WeekStartOption });
        });
      });
      
      const forecastStart = settings.forecastStart;
      console.log('Using forecast start mode:', forecastStart);

      // Wait for the mean line to appear
      const path = await waitForElement('#line-Mean', { timeout: 5000 });
      if (!path?.getAttribute('d')) {
        throw new Error('Mean forecast line not found.');
      }

      // Get other forecast lines
      const lastYearPath = document.querySelector('#line-Lastyear');
      const pessimisticPath = document.querySelector('#line-Pessimistic');
      const optimisticPath = document.querySelector('#line-Optimistic');

      // Get Y-axis scale from the current graph view
      const yAxisTicks = Array.from(document.querySelectorAll('.yAxis .tick'))
        .map(tick => {
          const transform = tick.getAttribute('transform');
          const yMatch = transform?.match(/translate\(0,([0-9.]+)\)/);
          const y = yMatch ? parseFloat(yMatch[1]) : null;
          
          const text = tick.querySelector('text');
          const value = text ? parseFloat(text.textContent?.replace(/,/g, '') || '') : null;
          
          return (y !== null && value !== null) ? { y, value } : null;
        })
        .filter((tick): tick is { y: number, value: number } => tick !== null);

      if (yAxisTicks.length < 2) {
        throw new Error('Unable to determine Y-axis scale');
      }

      // Sort by Y coordinate (top to bottom)
      yAxisTicks.sort((a, b) => a.y - b.y);

      // Helper function to extract points from a path
      const extractPointsFromPath = (pathElement: Element | null): { x: number, y: number }[] => {
        if (!pathElement) return [];
        
        const pathData = pathElement.getAttribute('d');
        if (!pathData) return [];

        return pathData
          .split(/(?=[ML])/)
          .map(segment => {
            const [x, y] = segment.slice(1).trim().split(',').map(Number);
            return { x, y };
          })
          .filter(point => !isNaN(point.y));
      };

      // Helper function to convert points to forecast data
      const convertPointsToForecasts = (points: { x: number, y: number }[]): ForecastData[] => {
        const currentWeek = this.getCurrentWeekNumber();
        const currentYear = new Date().getFullYear();
        
        return points.map((point, index) => {
          // Find the two closest tick marks
          let lowerTick = yAxisTicks[0];
          let upperTick = yAxisTicks[yAxisTicks.length - 1];

          for (let i = 0; i < yAxisTicks.length - 1; i++) {
            if (yAxisTicks[i].y <= point.y && point.y <= yAxisTicks[i + 1].y) {
              lowerTick = yAxisTicks[i];
              upperTick = yAxisTicks[i + 1];
              break;
            }
          }

          // Linear interpolation between the two closest tick marks
          const percentage = (point.y - lowerTick.y) / (upperTick.y - lowerTick.y);
          const value = lowerTick.value + percentage * (upperTick.value - lowerTick.value);

          // Calculate actual calendar week and year
          let weekNumber = currentWeek + index;
          let year = currentYear;
          
          if (weekNumber > 52) {
            weekNumber = weekNumber - 52;
            year++;
          }

          return {
            week: weekNumber,
            year,
            units: Math.round(value),
            type: 'mean' // Default type
          };
        });
      };

      // Extract points from all paths
      const meanPoints = extractPointsFromPath(path);
      const lastYearPoints = extractPointsFromPath(lastYearPath);
      const pessimisticPoints = extractPointsFromPath(pessimisticPath);
      const optimisticPoints = extractPointsFromPath(optimisticPath);

      // Convert all points to forecast data
      const meanForecasts = convertPointsToForecasts(meanPoints).map(f => ({ ...f, type: 'mean' as const }));
      const lastYearForecasts = convertPointsToForecasts(lastYearPoints).map(f => ({ ...f, type: 'lastYear' as const }));
      const pessimisticForecasts = convertPointsToForecasts(pessimisticPoints).map(f => ({ ...f, type: 'pessimistic' as const }));
      const optimisticForecasts = convertPointsToForecasts(optimisticPoints).map(f => ({ ...f, type: 'optimistic' as const }));

      // Combine all forecasts
      const allForecasts = [
        ...meanForecasts,
        ...lastYearForecasts,
        ...pessimisticForecasts,
        ...optimisticForecasts
      ];

      // For currentWeek mode, we need to reorder the data to start from current week
      if (forecastStart === 'currentWeek') {
        // Find the index of current week
        const currentWeek = this.getCurrentWeekNumber();
        const currentYear = new Date().getFullYear();
        
        const currentWeekIndex = allForecasts.findIndex(f => 
          f.week === currentWeek && 
          f.year === currentYear && 
          f.type === 'mean'
        );
        
        if (currentWeekIndex !== -1) {
          // Reorder array to start from current week
          const reordered = [
            ...allForecasts.slice(currentWeekIndex),
            ...allForecasts.slice(0, currentWeekIndex)
          ];
          return reordered;
        }
      }
      
      // For week1 mode or if reordering failed, return as is
      return allForecasts;

    } catch (error: unknown) {
      console.error(`Error fetching forecasts for ASIN ${asin}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private getCurrentWeekNumber(): number {
    // Find the week label in Amazon's UI
    const weekLabel = document.querySelector('.forecast-week-label');
    if (weekLabel) {
      const match = weekLabel.textContent?.match(/Week (\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    // Fallback: Calculate current week
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    return week;
  }

  /**
   * Initializes the data extractor by locating forecast buttons and extracting ASINs.
   * @returns An object containing forecast buttons and corresponding ASINs.
   */
  async initialize(): Promise<{ forecastButtons: Element[], asins: string[] }> {
    try {
      console.log('Initializing ForecastDataExtractor...');
      const buttons = await this.locateForecastButtons();
      const asins = await this.extractAsins(buttons);
      
      console.log('Initialization complete:', {
        buttonsFound: buttons.length,
        asinsFound: asins.length
      });

      return { forecastButtons: buttons, asins };
    } catch (error) {
      console.error('Initialization failed:', error);
      throw new Error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Locates forecast buttons on the page.
   * @returns An array of forecast button elements.
   */
  private async locateForecastButtons(): Promise<Element[]> {
    console.log('Locating forecast buttons...');
    
    // Try to find buttons using mt-popover containers first
    const mtPopovers = document.querySelectorAll('.mt-popover');
    console.log(`Found ${mtPopovers.length} .mt-popover elements`);

    if (mtPopovers.length > 0) {
      const buttons = Array.from(mtPopovers)
        .map(container => {
          const button = container.querySelector('.a-popover-trigger.a-declarative');
          if (!button) return null;

          const span = button.querySelector('span.mt-text-content');
          if (span && span.textContent?.trim().toLowerCase() === 'view forecast') {
            return button;
          }
          return null;
        })
        .filter((btn): btn is Element => btn !== null);

      if (buttons.length > 0) {
        console.log(`Found ${buttons.length} valid forecast buttons`);
        return buttons;
      }
    }

    // If no buttons found with primary method, try alternative selectors
    const alternativeSelectors = [
      'button[data-action="view-forecast"]',
      '.a-button-text[data-action="view-forecast"]',
      'button.view-forecast-btn',
      '.mt-popover .a-popover-trigger',
      '.a-button-text:has(span.mt-text-content)'
    ];

    for (const selector of alternativeSelectors) {
      try {
        const elements = Array.from(document.querySelectorAll(selector));
        const validButtons = elements.filter(el => {
          const text = el.textContent?.toLowerCase().trim() || '';
          return text.includes('view forecast');
        });

        if (validButtons.length > 0) {
          console.log(`Found ${validButtons.length} buttons using selector: ${selector}`);
          return validButtons;
        }
      } catch (error) {
        console.log(`Selector "${selector}" failed:`, error);
      }
    }

    // If still no buttons found, try recursive search
    console.log('Trying recursive DOM search for forecast buttons...');
    const buttons: Element[] = [];
    const walkDOM = (node: Element) => {
      const text = node.textContent?.toLowerCase().trim() || '';
      const action = node.getAttribute('data-action')?.toLowerCase() || '';
      
      if (
        (text.includes('view forecast') && node.tagName === 'BUTTON') ||
        action === 'view-forecast'
      ) {
        buttons.push(node);
      }
      
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          walkDOM(child as Element);
        }
      });
    };
    
    walkDOM(document.body);

    if (buttons.length === 0) {
      throw new Error('No "View forecast" buttons found.');
    }

    console.log(`Found ${buttons.length} buttons through recursive search`);
    return buttons;
  }

  /**
   * Extracts ASINs from the forecast buttons.
   * @returns An array of ASIN strings.
   */
  private async extractAsins(buttons: Element[]): Promise<string[]> {
    console.log('Extracting ASINs...');
    
    const asins: string[] = [];
    
    for (const button of buttons) {
      try {
        // Try to find ASIN from the closest row
        const row = button.closest('tr.mt-row');
        if (row) {
          const rowData = row.getAttribute('data-row-data');
          if (rowData) {
            const { asin } = JSON.parse(rowData.replace(/&quot;/g, '"'));
            if (asin) {
              asins.push(asin);
              continue;
            }
          }
        }

        // Fallback: Try to find ASIN from other attributes
        const asinAttr = button.getAttribute('data-asin') || 
                        button.closest('[data-asin]')?.getAttribute('data-asin');
        
        if (asinAttr) {
          asins.push(asinAttr);
        }
      } catch (error) {
        console.error('Error extracting ASIN for button:', error);
      }
    }

    if (asins.length !== buttons.length) {
      throw new Error(`Found ${buttons.length} buttons but only ${asins.length} ASINs`);
    }

    console.log(`Extracted ${asins.length} ASINs`);
    return asins;
  }
}

/**
 * ForecastUIHandler manages the UI interactions required for data extraction.
 */
export class ForecastUIHandler {
  data: ForecastItem[]
  failures: string[];
  private headers: string[];

  constructor() {
    this.data = [];
    this.failures = [];
    this.headers = [];
  }

  private getCurrentWeekNumber(): number {
    const weekLabel = document.querySelector('.forecast-week-label');
    if (weekLabel) {
      const match = weekLabel.textContent?.match(/Week (\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    return week;
  }

  /**
   * Initiates the extraction process by interacting with UI elements.
   * @param dataExtractor - An instance of ForecastDataExtractor.
   * @param buttons - Array of forecast buttons with associated ASINs.
   * @param asins - Array of ASIN strings.
   */
  async extract(
    dataExtractor: ForecastDataExtractor,
    buttons: Array<{ button: HTMLElement; asin: string }>,
    asins: string[]
  ): Promise<void> {
    try {
      // Send message to disable UI
      await chrome.runtime.sendMessage({ type: 'SET_LOADING', loading: true });
      
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
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage({
              type: 'progress',
              data: {
                current: processed,
                total: total,
                currentAsin: asin
              }
            }, () => resolve());
          });
        } catch (error) {
          console.warn('Progress message failed:', error);
        }

        const success = await this.processASIN(button as HTMLElement, asin, dataExtractor);
        if (!success) this.failures.push(asin);
        
        processed++;
        
        if (processed < total) {
          await sleep(200);
        }
      }

      try {
        await new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({
            type: 'progress',
            data: {
              current: processed,
              total: total,
              currentAsin: 'Complete'
            }
          }, () => resolve());
        });
      } catch (error) {
        console.warn('Final progress message failed:', error);
      }
      console.log('All ASINs processed');

      if (this.data.length === 0) {
        throw new Error('No forecast data was extracted.');
      }

      try {
        await new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'storeData',
            data: this.data,
            failures: this.failures
          }, () => resolve());
        });
        console.log('Extraction data sent to background script');
      } catch (error) {
        console.error('Failed to send data to background script:', error);
        throw error;
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      throw error;
    } finally {
      // Always re-enable UI when done
      await chrome.runtime.sendMessage({ type: 'SET_LOADING', loading: false });
    }
  }

  /**
   * Opens the forecast view by clicking the button.
   * @param button - The forecast button element.
   */
  async openForecastView(button: HTMLElement): Promise<void> {
    console.log('Opening forecast view...');
    button.click();

    // Reduced timeout from 5000 to 3000ms
    await Promise.race([
      Promise.all([
        waitForElement('.forecast-chart-main', { timeout: 3000 }),
        waitForElement('g.brush', { timeout: 3000 })
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout opening forecast view')), 3000)
      )
    ]);
  }

  /**
   * Closes the forecast view.
   * @param button - The forecast button element to close the view.
   */
  async closeForecastView(button: HTMLElement): Promise<void> {
    const popover = document.querySelector('div.a-popover[aria-modal="true"]');
    const closeButton = document.querySelector('button[data-action="a-popover-close"]') as HTMLElement;
    
    if (!closeButton || !popover) {
      throw new Error('Close button or popover not found');
    }
    
    closeButton.click();
    
    // Reduced timeout from 1000 to 500ms
    await this.waitForElementToDisappear('.a-popover[aria-modal="true"]', 500);
  }

  private async waitForElementToDisappear(selector: string, timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      
      if (!element) {
        return true;
      }
      
      const isHidden = 
        (element as HTMLElement).style.display === 'none' || 
        (element as HTMLElement).style.visibility === 'hidden' ||
        element.hasAttribute('aria-hidden') ||
        element.classList.contains('hidden') ||
        !(element as HTMLElement).offsetParent;
      
      if (isHidden) {
        return true;
      }
      
      await sleep(100);
    }
    
    throw new Error(`Timeout waiting for element ${selector} to disappear`);
  }

  /**
   * Sets the slider to 40 weeks view.
   * @returns Promise<boolean> indicating success
   */
  async setSliderTo40Weeks(): Promise<boolean> {
    const brush = await waitForElement('g.brush', { timeout: 800 }); // Reduced from 1000ms
    if (!brush) throw new Error('Brush element not found');

    const resizeE = brush.querySelector('g.resize.e');
    if (!resizeE) throw new Error('Resize element not found');

    const { left } = brush.getBoundingClientRect();
    const desiredX = left + 690;
    const currentY = (resizeE as HTMLElement).getBoundingClientRect().top + 10;

    // Combine mouse events for faster execution
    window.helpers.simulateMouseEvent(resizeE as HTMLElement, 'mousedown', { x: desiredX - 10, y: currentY });
    window.helpers.simulateMouseEvent(document.documentElement, 'mousemove', { x: desiredX, y: currentY });
    window.helpers.simulateMouseEvent(document.documentElement, 'mouseup', { x: desiredX, y: currentY });

    // Reduced timeout from 1000 to 800ms
    await Promise.race([
      Promise.all([
        waitForElement('#line-Mean', { timeout: 800 }),
        waitForElement('.yAxis .tick', { timeout: 800 })
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout setting slider')), 800)
      )
    ]);

    return true;
  }

  /**
   * Simulates a mouse event on an element.
   * @param element - The target DOM element.
   * @param eventType - Type of mouse event to simulate.
   * @param params - Mouse event coordinates.
   */
  private simulateMouseEvent(element: HTMLElement, eventType: string, params: MouseEventParams): void {
    const event = new MouseEvent(eventType, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: params.x,
      clientY: params.y
    });
    element.dispatchEvent(event);
  }

  /**
   * Processes a single ASIN by opening the forecast view, setting the slider, extracting data, and closing the view.
   * @param button - The forecast button element.
   * @param asin - The ASIN to process.
   * @param dataExtractor - An instance of ForecastDataExtractor.
   * @returns Promise<boolean> indicating success.
   */
  async processASIN(
    button: HTMLElement, 
    asin: string, 
    dataExtractor: ForecastDataExtractor
  ): Promise<boolean> {
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
          units: point.units,
          type: point.type
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

  /**
   * Sleeps for a specified duration.
   * @param ms - Milliseconds to sleep.
   */
  private sleep(ms: number): Promise<void> {
    return sleep(ms);
  }

  /**
   * Sets the headers for CSV generation based on forecast data.
   * @param data - Array of ForecastItems.
   * @param forecastStart - Starting week option.
   * @returns CSV content as a string.
   */
  generateCSV(data: ForecastItem[], forecastStart: WeekStartOption): string {
    try {
      if (data.length === 0) {
        throw new Error('No data available to generate CSV.');
      }

      // Generate headers
      this.headers = ['ASIN'];
      const currentWeek = this.getCurrentWeekNumber();
      
      if (forecastStart === 'week1') {
        // Week 1 mode: Week 1 to Week 52
        for (let week = 1; week <= 52; week++) {
          this.headers.push(`Week ${week}`);
        }
      } else {
        // Current Week mode: start from current week
        let week = currentWeek;
        for (let i = 0; i < 52; i++) {
          this.headers.push(`Week ${week}`);
          week = week === 52 ? 1 : week + 1;
        }
      }

      // Generate CSV content
      const csvContent = [
        this.headers.join(','),
        ...this.formatDataRows(data, forecastStart)
      ].join('\n');

      return csvContent;
    } catch (error: unknown) {
      console.error('CSV Generation Error:', error);
      throw new Error(`CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatDataRows(data: ForecastItem[], forecastStart: WeekStartOption): string[] {
    const rows: string[] = [];
    const currentWeek = this.getCurrentWeekNumber();

    for (const item of data) {
      if (!item.forecasts || !Array.isArray(item.forecasts)) {
        console.error('Invalid forecast data for ASIN:', item.asin);
        continue;
      }

      const row = [item.asin];
      const orderedForecasts = new Array(52).fill('');

      if (forecastStart === 'week1') {
        // For Week 1 mode: place each forecast in its corresponding week slot
        item.forecasts.forEach(forecast => {
          if (forecast.week > 0 && forecast.week <= 52) {
            orderedForecasts[forecast.week - 1] = forecast.units.toString();
          }
        });
      } else {
        // For Current Week mode: reorganize data to start from current week
        const forecastMap = new Map<number, string>();
        
        // First, map each forecast to its week number
        item.forecasts.forEach(forecast => {
          forecastMap.set(forecast.week, forecast.units.toString());
        });

        // Then fill the orderedForecasts array starting from current week
        let week = currentWeek;
        for (let i = 0; i < 52; i++) {
          const value = forecastMap.get(week);
          if (value) {
            orderedForecasts[i] = value;
          }
          week = week === 52 ? 1 : week + 1;
        }
      }

      row.push(...orderedForecasts);
      rows.push(row.join(','));
    }

    return rows;
  }

  async updateProgress(current: number, total: number, currentAsin: string): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        chrome.runtime.sendMessage({
          type: 'progress',
          data: { current, total, currentAsin }
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('Progress update failed:', chrome.runtime.lastError)
          }
          resolve()
        })
      } catch (error) {
        console.warn('Progress update failed:', error)
        resolve() // Continue even if progress update fails
      }
    })
  }

  async sendDataToBackground(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          action: 'storeData',
          data: this.data,
          failures: this.failures,
          downloadNow: false
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send data to background script:', chrome.runtime.lastError)
            reject(chrome.runtime.lastError)
            return
          }
          if (response?.error) {
            reject(new Error(response.error))
            return
          }
          console.log('Extraction data sent to background script')
          resolve()
        })
      } catch (error) {
        console.error('Failed to send data to background script:', error)
        reject(error)
      }
    })
  }
}

// Attach classes to the global window object
declare global {
  interface Window {
    ForecastDataExtractor: typeof ForecastDataExtractor;
    ForecastUIHandler: typeof ForecastUIHandler;
  }
}

window.ForecastDataExtractor = ForecastDataExtractor;
window.ForecastUIHandler = ForecastUIHandler;

export {}; 