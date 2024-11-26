/// <reference types="chrome" />

import { BackgroundState, ForecastData, ForecastItem, WeekStartOption, Settings, ForecastType } from '../types/index.js'

declare namespace chrome {
  export namespace runtime {
    interface Port {
      name: string
      onMessage: chrome.events.Event<(message: any) => void>
      onDisconnect: chrome.events.Event<() => void>
      postMessage: (message: any) => void
      disconnect: () => void
    }
    
    function getURL(path: string): string
    const onMessage: chrome.events.Event<
      (message: any, sender: any, sendResponse: (response?: any) => void) => void
    >
    const onConnect: chrome.events.Event<(port: Port) => void>
    const lastError: chrome.runtime.LastError | undefined
    interface LastError {
      message: string
    }
    function sendMessage(message: any, callback?: (response?: any) => void): void
  }

  export namespace downloads {
    function download(options: {
      url: string
      filename: string
      saveAs?: boolean
    }): Promise<number>
  }

  export namespace tabs {
    interface Tab {
      id?: number
      url?: string
    }
    const onUpdated: chrome.events.Event<
      (tabId: number, changeInfo: { status?: string }, tab: Tab) => void
    >
    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>
    function sendMessage(tabId: number, message: any, callback?: (response: any) => void): void
  }

  export namespace action {
    const onClicked: chrome.events.Event<(tab: chrome.tabs.Tab) => void>
  }

  export namespace storage {
    interface StorageChange {
      newValue?: any
      oldValue?: any
    }

    interface StorageArea {
      get<T = any>(keys?: string | string[] | { [key: string]: T }): Promise<{ [key: string]: T }>
      set(items: object): Promise<void>
    }

    interface SyncStorageArea extends StorageArea {
      // Add specific sync storage methods if needed
    }

    const sync: SyncStorageArea
    const local: StorageArea
    const managed: StorageArea

    const onChanged: chrome.events.Event<
      (changes: { [key: string]: StorageChange }, areaName: string) => void
    >
  }

  export namespace windows {
    interface Window {
      id?: number
      type?: string
      url?: string
    }

    interface CreateData {
      url?: string | string[]
      type?: 'normal' | 'popup' | 'panel'
      width?: number
      height?: number
      left?: number
      top?: number
      focused?: boolean
      state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
    }

    function create(createData: CreateData): Promise<Window>
    function getAll(getInfo?: { populate?: boolean }): Promise<Window[]>
    function remove(windowId: number): Promise<void>
    function get(windowId: number): Promise<Window>
    function update(windowId: number, updateInfo: { focused?: boolean }): Promise<Window>
    const onRemoved: chrome.events.Event<(windowId: number) => void>
  }

  export namespace events {
    interface Event<T extends Function> {
      addListener(callback: T): void
      removeListener(callback: T): void
      hasListener(callback: T): boolean
    }
  }
}

console.log('Background service worker initialized');

let state: BackgroundState = {
  extractedData: null,
  failedAsins: [],
  isExtracting: false,
  isLoading: false
}

let storedForecastData: ForecastItem[] = [];

class CsvGenerator {
  protected headers: string[]

  protected getWeekNumber(): number {
    const now = new Date()
    const oneJan = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil((((now.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7)
    return week
  }

  constructor() {
    this.headers = ['ASIN']
  }

  public async generateCsv(data: ForecastItem[]): Promise<string> {
    try {
      const { forecastStart } = await chrome.storage.sync.get({ forecastStart: 'currentWeek' }) as { forecastStart: WeekStartOption }
      console.log('Generating CSV with data:', data, 'forecastStart:', forecastStart)
      
      const firstItem = data[0]
      if (!firstItem?.forecasts?.length) {
        throw new Error('No forecast data available')
      }

      // Generate headers based on setting
      if (forecastStart === 'week1') {
        this.headers = ['ASIN']
        for (let i = 1; i <= 52; i++) {
          this.headers.push(`Week ${i}`)
        }
      } else {
        const startWeek = firstItem.forecasts[0].week
        this.headers = ['ASIN']
        let week = startWeek
        for (let i = 0; i < 52; i++) {
          this.headers.push(`Week ${week}`)
          week = week === 52 ? 1 : week + 1
        }
      }
      
      const csvContent = [
        this.headers.join(','),
        ...this.formatDataRows(data, forecastStart)
      ].join('\n')
      
      return csvContent
    } catch (error) {
      console.error('CSV Generation Error:', error)
      throw new Error(`CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  protected formatDataRows(data: ForecastItem[], forecastStart: WeekStartOption): string[] {
    const rows: string[] = []
    
    for (const item of data) {
      if (!item.forecasts || !Array.isArray(item.forecasts)) {
        console.error('Invalid forecast data for ASIN:', item.asin, 'Data:', item)
        continue
      }

      const row = [item.asin]
      const orderedForecasts = new Array(52).fill('')
      
      if (forecastStart === 'week1') {
        // For week1 mode, place each forecast in its actual week slot
        item.forecasts
          .filter(forecast => forecast.type === 'mean')
          .forEach(forecast => {
            // Calculate correct position in the 52-week array
            let position = forecast.week - 1
            if (position >= 52) {
              position = position - 52
            }
            orderedForecasts[position] = forecast.units.toString()
          })
      } else {
        // Updated "Current Week" mode positioning
        const currentWeek = this.getWeekNumber()
        item.forecasts
          .filter(forecast => forecast.type === 'mean')
          .forEach((forecast, index) => {
            let position = (forecast.week - currentWeek + 52) % 52
            orderedForecasts[position] = forecast.units.toString()
          })
      }
      
      row.push(...orderedForecasts)
      rows.push(row.join(','))
    }
    
    return rows
  }
}

class BufferCsvGenerator extends CsvGenerator {
  public async generateCsv(data: ForecastItem[]): Promise<string> {
    try {
      const { forecastStart } = await chrome.storage.sync.get({ forecastStart: 'currentWeek' }) as { forecastStart: WeekStartOption }
      console.log('Generating Buffer CSV with data:', data, 'forecastStart:', forecastStart)
      
      const firstItem = data[0]
      if (!firstItem?.forecasts?.length) {
        throw new Error('No forecast data available')
      }

      // Generate headers based on setting
      if (forecastStart === 'week1') {
        this.headers = ['ASIN', 'Type']
        for (let i = 1; i <= 52; i++) {
          this.headers.push(`Week ${i}`)
        }
      } else {
        const startWeek = firstItem.forecasts[0].week
        this.headers = ['ASIN', 'Type']
        let week = startWeek
        for (let i = 0; i < 52; i++) {
          this.headers.push(`Week ${week}`)
          week = week === 52 ? 1 : week + 1
        }
      }
      
      const csvContent = [
        this.headers.join(','),
        ...this.formatDataRows(data, forecastStart)
      ].join('\n')
      
      return csvContent
    } catch (error) {
      console.error('Buffer CSV Generation Error:', error)
      throw new Error(`Buffer CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  protected formatDataRows(data: ForecastItem[], forecastStart: WeekStartOption): string[] {
    const rows: string[] = []
    const Z_VALUE = 1.2816
    
    for (const item of data) {
      if (!item.forecasts || !Array.isArray(item.forecasts)) {
        console.error('Invalid forecast data for ASIN:', item.asin, 'Data:', item)
        continue
      }

      // Arrays for mean and standard deviation values
      const meanForecasts = new Array(52).fill('')
      const stdDevForecasts = new Array(52).fill('')
      
      if (forecastStart === 'week1') {
        // Group forecasts by week
        const weekMap = new Map<number, { mean: number; optimistic: number }>()
        
        item.forecasts.forEach(forecast => {
          let position = forecast.week - 1
          if (position >= 52) {
            position = position - 52
          }
          
          if (!weekMap.has(position)) {
            weekMap.set(position, { mean: 0, optimistic: 0 })
          }
          const weekData = weekMap.get(position)!
          
          if (forecast.type === 'mean') {
            weekData.mean = forecast.units
          } else if (forecast.type === 'optimistic') {
            weekData.optimistic = forecast.units
          }
        })

        // Fill both mean and standard deviation arrays
        weekMap.forEach((weekData, position) => {
          if (weekData.mean && weekData.optimistic) {
            meanForecasts[position] = weekData.mean.toString()
            const stdDev = (weekData.optimistic - weekData.mean) / Z_VALUE
            stdDevForecasts[position] = stdDev.toFixed(2)
          }
        })
      } else {
        const currentWeek = this.getWeekNumber()
        // Group forecasts by relative position
        const positionMap = new Map<number, { mean: number; optimistic: number }>()
        
        item.forecasts.forEach(forecast => {
          const position = (forecast.week - currentWeek + 52) % 52
          
          if (!positionMap.has(position)) {
            positionMap.set(position, { mean: 0, optimistic: 0 })
          }
          const posData = positionMap.get(position)!
          
          if (forecast.type === 'mean') {
            posData.mean = forecast.units
          } else if (forecast.type === 'optimistic') {
            posData.optimistic = forecast.units
          }
        })

        // Fill both mean and standard deviation arrays
        positionMap.forEach((posData, position) => {
          if (posData.mean && posData.optimistic) {
            meanForecasts[position] = posData.mean.toString()
            const stdDev = (posData.optimistic - posData.mean) / Z_VALUE
            stdDevForecasts[position] = stdDev.toFixed(2)
          }
        })
      }
      
      // Add mean row
      const meanRow = [item.asin, 'Mean']
      meanRow.push(...meanForecasts)
      rows.push(meanRow.join(','))

      // Add standard deviation row
      const stdDevRow = [item.asin, 'Standard Deviation']
      stdDevRow.push(...stdDevForecasts)
      rows.push(stdDevRow.join(','))

      // Add empty row between ASINs
      rows.push('')
    }
    
    return rows
  }
}

async function downloadBufferCSV() {
  try {
    const csvGenerator = new BufferCsvGenerator();
    const csvContent = await csvGenerator.generateCsv(storedForecastData);
    
    // Convert CSV content to base64
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: `buffer_data_${timestamp}.csv`,
      saveAs: true
    });
  } catch (error) {
    console.error('Error generating/downloading buffer CSV:', error);
    throw error;
  }
}

// Add window tracking
let popupWindowId: number | null = null;

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_LOADING') {
    state.isLoading = message.loading;
    // Use the broadcast function
    broadcastToPopup({ 
      type: 'LOADING_STATE_CHANGED', 
      loading: message.loading 
    });
    sendResponse({ success: true });
    return false;
  }
  
  if (message.action === 'storeData') {
    try {
      storedForecastData = message.data;
      console.log('Forecast data stored:', storedForecastData.length, 'items');
      if (message.downloadNow) {
        downloadForecastCSV();
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error storing data:', error);
      sendResponse({ error: 'Failed to store data' });
    }
    return true;
  }
  
  if (message.action === 'downloadForecast') {
    try {
      if (storedForecastData.length === 0) {
        sendResponse({ error: 'No forecast data available' });
        return true;
      }
      downloadForecastCSV();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error downloading forecast:', error);
      sendResponse({ error: 'Failed to download forecast' });
    }
    return true;
  }
  
  if (message.action === 'downloadBuffer') {
    try {
      if (storedForecastData.length === 0) {
        sendResponse({ error: 'No forecast data available' });
        return true;
      }
      downloadBufferCSV();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error downloading buffer data:', error);
      sendResponse({ error: 'Failed to download buffer data' });
    }
    return true;
  }
  
  // For other messages, respond synchronously
  return false
})

async function downloadForecastCSV() {
  try {
    const csvGenerator = new CsvGenerator();
    const csvContent = await csvGenerator.generateCsv(storedForecastData);
    
    // Convert CSV content to base64
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: `forecast_data_${timestamp}.csv`,
      saveAs: true
    });
  } catch (error) {
    console.error('Error generating/downloading CSV:', error);
    throw error;
  }
}

// Listen for tab updates to reset state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    state = {
      extractedData: null,
      failedAsins: [],
      isExtracting: false,
      isLoading: false
    }
    console.log('Background state reset due to tab loading:', tabId)
  }
})

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked, opening window.html')
  chrome.windows.create({
    url: chrome.runtime.getURL('window.html'),
    type: 'popup',
    width: 400,
    height: 600,
    focused: true
  }).then((window) => {
    popupWindowId = window.id || null;
    if (popupWindowId) {
      // Wait a short moment for the window to initialize
      setTimeout(() => {
        chrome.runtime.sendMessage({ 
          type: 'LOADING_STATE_CHANGED', 
          loading: state.isLoading 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Initial loading state message failed:', chrome.runtime.lastError)
          }
        });
      }, 500);
    }
  });
})

// Track window closure
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});

// Update message broadcasting
function broadcastToPopup(message: any) {
  if (popupWindowId) {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Failed to send message to popup:', chrome.runtime.lastError)
        if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
          popupWindowId = null
        }
      }
    })
  }
}

chrome.runtime.onConnect.addListener((port) => {
  console.log(`Connected to port: ${port.name}`);
  
  port.onMessage.addListener((msg) => {
    console.log('Received message on port:', msg);
    // Handle incoming messages here
  });

  port.onDisconnect.addListener(() => {
    console.log(`Port ${port.name} disconnected.`);
  });
});