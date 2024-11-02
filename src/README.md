# Forecast Data Extractor - Implementation Guide

## Overview

This Chrome Extension automates the extraction of forecast data from Amazon's Restock Inventory Recommendations page. It extracts the mean forecast data for each ASIN and generates a CSV file with the following format:

```
ASIN,Week 1,Week 2,Week 3,...,Week 40
B123456789,100,150,200,...,500
B987654321,75,125,175,...,450
```

## Critical Components

### 1. Data Extraction Process (`scripts/utils/extractor.js`)
- **Core Functionality:**
  - Locates "View forecast" buttons on the page
  - Extracts ASINs from row data
  - Converts graph coordinates to actual forecast values
  - **Critical Methods:**
    - `extractMeanForecastData()`: Extracts data points from the mean forecast line
    - `initializeConversionParameters()`: Sets up y-axis scale conversion
    - `convertYToUnits()`: Converts y-coordinates to actual unit values

### 2. UI Handler (`scripts/forecastExtractor.js`)
- **Key Operations:**
  - Opens forecast view for each ASIN
  - Sets slider to 40-week view
  - Extracts and stores data
  - **Critical Methods:**
    - `setSliderTo40Weeks()`: Must maintain exact pixel calculations (690px)
    - `processASIN()`: Core extraction sequence
    - `extract()`: Main orchestration method

### 3. Background Processing (`scripts/background.js`)
- **Data Handling:**
  - Stores extracted data
  - Generates CSV in the required format:
    - One row per ASIN
    - Weekly forecasts as columns
  - Handles automatic download

### 4. Content Script (`scripts/content.js`)
- **Integration:**
  - Initializes extraction components
  - Manages communication between UI and extraction logic
  - Handles page validation

## Critical DOM Selectors

These selectors must be maintained for the extension to function:

```javascript
// Forecast button identification
'.mt-popover'
'.a-popover-trigger.a-declarative'
'span.mt-text-content'
'tr.mt-row'

// Graph elements
'.forecast-chart-main'
'g.brush'
'#line-Mean'
'.yAxis .tick'
```

## Data Flow

1. **Initialization:**
   - User clicks "Extract Data"
   - Content script validates page
   - UI handler prepares extraction

2. **For Each ASIN:**
   - Click "View forecast"
   - Wait for chart elements
   - Set 40-week view
   - Extract mean forecast data
   - Close forecast view
   - Update progress

3. **Data Processing:**
   - Collect all ASIN data
   - Generate CSV
   - Auto-download result

## Critical Dependencies

1. **DOM Structure:**
   - Amazon's forecast chart structure
   - Data row attributes containing ASINs
   - Mean forecast line element

2. **Browser APIs:**
   - Chrome Extensions API
   - DOM Manipulation
   - File Download API

## Maintenance Guidelines

### What Not to Change:
1. **Slider Positioning:**
   - The 690px offset for 40-week view is calibrated
   - Changes may affect data accuracy

2. **Data Structure:**
   - The ASIN and units array format
   - CSV generation format

3. **Message Flow:**
   - The sequence of progress updates
   - The completion and error handling chain

### What Can Be Modified:
1. **UI Elements:**
   - Visual styling
   - Progress indicators
   - Error messages

2. **Performance:**
   - Sleep durations
   - Timeout values
   - Error retry logic

## Error Handling

The extension implements comprehensive error handling for:
- Missing DOM elements
- Failed data extraction
- Invalid data formats
- Network issues

Each error is caught and reported to maintain stability.

## Performance Considerations

- Asynchronous operations prevent UI blocking
- Mutation observers for reliable element detection
- Cleanup after each ASIN processing
- Memory management through state reset

## Security Notes

- Minimal permissions model
- Content script isolation
- Secure message passing
- Data validation at each step

## Version Control

Current Version: 1.0
- Stable extraction logic
- Automated CSV generation
- Streamlined user interface
- Reliable error handling

## Testing Requirements

Before any changes:
- Verify all critical selectors
- Test with various ASIN counts
- Validate CSV format
- Check error scenarios
