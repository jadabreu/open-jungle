/// <reference types="chrome" />

/**
 * Centralized script injection utility.
 */
export class ScriptInjector {
  /**
   * Injects specified scripts into a target tab.
   * @param tabId - The ID of the target tab.
   * @param files - Array of script file paths to inject.
   */
  static async injectScripts(tabId: number, files: string[]): Promise<void> {
    try {
      console.log(`Injecting scripts into tab ${tabId}:`, files);
      
      // Check if we have the scripting permission
      const hasPermissions = await new Promise<boolean>((resolve) => {
        chrome.permissions.contains({
          permissions: ['scripting'],
          origins: [
            'https://sellercentral.amazon.com/*',
            'https://sellercentral-europe.amazon.com/*',
            'https://sellercentral-japan.amazon.com/*'
          ]
        }, resolve);
      });
      
      if (!hasPermissions) {
        throw new Error('Missing scripting permission');
      }

      // Inject each script in sequence
      for (const file of files) {
        try {
          console.log(`Attempting to inject ${file}...`);
          const result = await chrome.scripting.executeScript({
            target: { tabId },
            files: [file]
          });
          console.log(`Successfully injected ${file}`, result);
        } catch (error) {
          const details = error instanceof Error ? error.message : JSON.stringify(error);
          console.error(`Failed to inject ${file}:`, {
            error,
            details,
            file,
            tabId
          });
          throw new Error(`Failed to inject ${file}: ${details}`);
        }
      }
    } catch (error) {
      const errorDetails = error instanceof Error ? 
        { message: error.message, stack: error.stack } : 
        { error };
      console.error('Script injection failed:', errorDetails);
      throw error;
    }
  }
} 