# Forecast Data Extractor 🚀

A Chrome Extension that automates the extraction of forecast data from Amazon's Restock Inventory Recommendations page. Get your forecast data in a clean CSV format with just one click!

## 🎯 Features

- **Automated Data Extraction**: Automatically extracts mean forecast data for each ASIN
- **40-Week Forecast**: Captures full 40-week forecast data
- **CSV Export**: Generates a clean, ready-to-use CSV file
- **Progress Tracking**: Real-time progress indicators during extraction
- **Error Handling**: Comprehensive error detection and reporting

## 📊 Output Format

The extension generates a CSV file with the following structure:
```
ASIN,Week 1,Week 2,Week 3,...,Week 40
B123456789,100,150,200,...,500
B987654321,75,125,175,...,450
```

## 🚀 Installation

1. Download the extension from [Chrome Web Store] (coming soon)
2. Or install manually:
   - Clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## 💡 How to Use

1. Navigate to Amazon's Restock Inventory Recommendations page
2. Click the extension icon in your browser
3. Click "Extract Data"
4. Wait for the extraction to complete
5. The CSV file will download automatically

## 🛠️ Technical Details

### Core Components
- **Data Extractor**: Handles the core data extraction logic
- **UI Handler**: Manages user interface and interactions
- **Background Processor**: Handles data processing and CSV generation
- **Content Script**: Coordinates between UI and extraction logic

### Dependencies
- Chrome Extensions API
- DOM Manipulation APIs
- File Download API

## 🔒 Security

- Minimal permissions model
- Content script isolation
- Secure message passing
- Data validation at each step

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 📫 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/jadabreu/capy-tools/issues) on GitHub.

---
Made with ❤️ by [jadabreu](https://github.com/jadabreu) 