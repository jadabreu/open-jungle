declare global {
  interface Window {
    contentScriptInitialized: boolean
    ForecastDataExtractor: new () => ForecastDataExtractor
    ForecastUIHandler: new () => ForecastUIHandler
    helpers: {
      waitForElement: (selector: string) => Promise<Element>
      sleep: (ms: number) => Promise<void>
    }
  }

  // ... other global interfaces if necessary ...
}

interface ForecastButton {
  id: string
  label: string
  // Add other relevant properties based on actual button structure
}

interface ForecastData {
  week: number
  quantity: number
  year?: number
}

interface ForecastDataExtractor {
  initialize(): Promise<{ forecastButtons: ForecastButton[]; asins: string[] }>
  extractForecastData(asin: string): Promise<ForecastData[]>
  fetchForecastsFromPage(asin: string): Promise<ForecastData[]>
  // Add other methods with precise types if necessary
}

interface ForecastUIHandler {
  extract(
    dataExtractor: ForecastDataExtractor,
    forecastButtons: ForecastButton[],
    asins: string[]
  ): Promise<void>
  data: Array<{ asin: string; forecasts: ForecastData[] }>
  failures: string[]
  // Add other properties/methods with precise types if necessary
}

export {} 