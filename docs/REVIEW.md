# Technical Implementation Details

## Data Access
1. The extension only accesses the forecast graph data visible to the logged-in seller
2. No access to sensitive customer data
3. All data processing happens locally

## Permission Usage
- activeTab permission:
  - Only activated when user clicks "Extract Data"
  - Used instead of broader <all_urls> permission
  - Automatically revoked when tab closes
  - Limited to current Amazon tab only
  - Required for:
    - Reading graph DOM elements
    - Clicking forecast buttons
    - Extracting coordinate data
    - Processing graph data

- amazon.com host permission: Used to:
  - Access forecast graph elements
  - Read graph coordinate data
  - Extract mean forecast values
- No data is sent outside the user's browser

## Security Measures
1. Content script isolation
2. No external API calls
3. Local data processing only
4. Minimal permission scope:
   - activeTab instead of broader permissions
   - No background persistence
   - No cross-tab access
   - No data retention between sessions

## Testing Instructions
1. Log into Amazon Seller Central
2. Navigate to Restock Inventory Recommendations
3. Click extension icon
4. Click "Extract Data"
5. Verify CSV output matches visible forecast data
6. Verify extension only activates when requested
7. Verify permissions are released after use