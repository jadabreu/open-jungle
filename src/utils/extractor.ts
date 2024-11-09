// Constants for configuration
const CONSTANTS = {
  VIEW_FORECAST_TEXT: 'view forecast',
  WEEKS_PER_YEAR: 52,
  MILLISECONDS_PER_DAY: 86400000
} as const

// Types for forecast data
interface ForecastButton {
  button: HTMLElement
  asin: string
}

interface YAxisTick {
  y: number
  value: number
}

interface ForecastDataPoint {
  week: number
  year: number
  units: number
}

interface ConversionParameters {
  slope: number
  intercept: number
}

/**
 * Extracts and processes forecast data from the Amazon UI
 */
export class ForecastDataExtractor {
  /**
   * Initializes the extractor and locates necessary UI elements
   * @returns Promise containing forecast buttons and ASINs
   */
  public async initialize(): Promise<{ forecastButtons: ForecastButton[], asins: string[] }> {
    try {
      const forecastButtons = this.locateForecastButtons()
      const asins = this.extractAsins()
      return { forecastButtons, asins }
    } catch (error) {
      throw new Error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Extracts forecast data for a specific ASIN
   * @param asin - The ASIN to extract data for
   * @returns Promise of forecast data points
   */
  public async extractForecastData(asin: string): Promise<ForecastDataPoint[]> {
    try {
      const data = await this.extractMeanForecastData()
      return data
    } catch (error) {
      throw new Error(
        `Data extraction failed for ASIN ${asin}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Locates all forecast buttons in the UI
   */
  private locateForecastButtons(): ForecastButton[] {
    const buttons = Array.from(document.querySelectorAll('.mt-popover'))
      .map(container => {
        const button = container.querySelector('.mt-popover-button')
        const asin = container.getAttribute('data-asin')
        if (button && asin) {
          return { button, asin }
        }
      })
    return buttons.filter(button => button) as ForecastButton[]
  }

  /**
   * Extracts ASINs from the UI
   * @returns Array of ASIN strings
   */
  private extractAsins(): string[] {
    const asins = Array.from(document.querySelectorAll('.mt-popover'))
      .map(container => container.getAttribute('data-asin'))
      .filter((asin): asin is string => asin !== null)
    return asins
  }

  /**
   * Extracts mean forecast data from the UI
   * @returns Promise of forecast data points
   */
  /**
   * Extracts mean forecast data from the UI
   * @returns Promise of forecast data points
   * @throws Error if forecast data cannot be extracted
   */
  private async extractMeanForecastData(): Promise<ForecastDataPoint[]> {
    try {
      const forecastData: ForecastDataPoint[] = []
      const chartContainer = document.querySelector('.forecast-chart')
      
      if (!chartContainer) {
        throw new Error('Forecast chart container not found')
      }

      const dataPoints = chartContainer.querySelectorAll('.data-point')
      
      dataPoints.forEach((point) => {
        const weekAttr = point.getAttribute('data-week')
        const yearAttr = point.getAttribute('data-year')
        const unitsAttr = point.getAttribute('data-units')

        if (!weekAttr || !yearAttr || !unitsAttr) {
          return // Skip invalid data points
        }

        forecastData.push({
          week: parseInt(weekAttr, 10),
          year: parseInt(yearAttr, 10),
          units: parseFloat(unitsAttr)
        })
      })

      if (forecastData.length === 0) {
        throw new Error('No valid forecast data points found')
      }

      return forecastData
    } catch (error) {
      throw new Error(
        `Failed to extract mean forecast data: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
} 