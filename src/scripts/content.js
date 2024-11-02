if (!window.contentScriptInitialized) {
    window.contentScriptInitialized = true;

    class ContentScript {
        constructor() {
            this.dataExtractor = new window.ForecastDataExtractor();
            this.uiHandler = new window.ForecastUIHandler();
            
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                console.log('Content Script Received Message:', message);
                if (message.action === 'START_EXTRACTION') {
                    this.startExtraction()
                        .then(result => {
                            chrome.runtime.sendMessage({
                                type: 'complete',
                                data: {
                                    successCount: result.extractedData.length,
                                    failedAsins: result.failedAsins
                                }
                            });
                            console.log('Extraction complete, sent "complete" message');
                        })
                        .catch(error => {
                            chrome.runtime.sendMessage({
                                type: 'error',
                                error: error.message || error
                            });
                            console.error('Extraction Error:', error);
                        });
                    return true;
                } else if (message.action === 'CHECK_PAGE') {
                    const hasButtons = document.querySelectorAll('.mt-popover').length > 0;
                    sendResponse({ valid: hasButtons });
                    console.log(`CHECK_PAGE response: ${hasButtons}`);
                    return true;
                }
            });
        }

        async startExtraction() {
            try {
                const { forecastButtons, asins } = await this.dataExtractor.initialize();
                console.log('Forecast Buttons and ASINs:', forecastButtons, asins);
                await this.uiHandler.extract(this.dataExtractor, forecastButtons, asins);
                return { 
                    extractedData: this.uiHandler.data, 
                    failedAsins: this.uiHandler.failures
                };
            } catch (error) {
                console.error('Start Extraction Error:', error);
                throw error;
            }
        }
    }

    // Initialize content script only once
    new ContentScript();
}

// Example of sending messages to background script
function sendMessage(type, data) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type, data },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Example usage
async function handleSomeAction() {
  try {
    // For immediate responses
    const immediateResponse = await sendMessage('immediate_action', {});
    console.log('Immediate response:', immediateResponse);

    // For async operations
    const asyncResponse = await sendMessage('async_action', {});
    console.log('Async response:', asyncResponse);
  } catch (error) {
    console.error('Error in message handling:', error);
  }
}