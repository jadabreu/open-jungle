/// <reference types="chrome" />

declare global {
  namespace chrome {
    export interface SidePanel {
      setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
      open(options: { tabId: number }): Promise<void>;
    }
    export const sidePanel: SidePanel;
  }
}

import { BackgroundState, ForecastData, ForecastItem, WeekStartOption, Settings, ForecastType } from '../types/index.js'

// Initialize state
let state: BackgroundState = {
  extractedData: null,
  failedAsins: [],
  isExtracting: false,
  isLoading: false
}

let storedForecastData: ForecastItem[] = [];

// Initialize side panel behavior when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

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
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_LOADING') {
    state.isLoading = message.loading;
    // Broadcast loading state change
    chrome.runtime.sendMessage({ 
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
  return false;
});

// CSV Generation and Download Functions
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
      const result = await new Promise<{ forecastStart?: WeekStartOption }>((resolve) => {
        chrome.storage.sync.get('forecastStart', resolve);
      });
      const forecastStart = result.forecastStart || 'currentWeek';
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
      const result = await new Promise<{ forecastStart?: WeekStartOption }>((resolve) => {
        chrome.storage.sync.get('forecastStart', resolve);
      });
      const forecastStart = result.forecastStart || 'currentWeek';
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