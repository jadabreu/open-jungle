export type WeekStartOption = 'week1' | 'currentWeek'

export interface ForecastData {
  week: number
  year: number
  units: number
}

export interface ForecastItem {
  asin: string
  startWeek: number
  startYear: number
  forecasts: ForecastData[]
}

export interface BackgroundState {
  extractedData: ForecastItem[] | null
  failedAsins: string[]
  isExtracting: boolean
  isLoading: boolean
}

export interface StoreDataMessage {
  action: 'storeData'
  data: ForecastItem[]
}

export type ChromeMessage = StoreDataMessage 

export interface Settings {
  forecastStart: WeekStartOption
} 