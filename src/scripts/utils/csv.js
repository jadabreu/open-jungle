class CsvGenerator {
  constructor() {
    this.headers = ['ASIN', 'Week', 'Forecast'];
  }

  generateCsv(data) {
    try {
      const csvContent = [
        this.headers.join(','),
        ...this.formatDataRows(data)
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      throw new Error(`CSV generation failed: ${error.message}`);
    }
  }

  formatDataRows(data) {
    const rows = [];
    for (const [asin, forecasts] of data.entries()) {
      forecasts.forEach((forecast, week) => {
        rows.push(`${asin},${week + 1},${forecast}`);
      });
    }
    return rows;
  }
}

export default CsvGenerator; 