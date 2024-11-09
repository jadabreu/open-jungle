/**
 * Helper utilities for DOM manipulation and timing
 * @module Helpers
 */

/**
 * Options for waiting for an element
 */
export interface WaitForElementOptions {
  timeout?: number;
  rootElement?: Element | Document;
}

/**
 * Mouse event parameters
 */
export interface MouseEventParams {
  x: number;
  y: number;
}

/**
 * Creates a promise that resolves after specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Waits for an element to appear in the DOM
 * @param selector - CSS selector to find element
 * @param options - Configuration options
 * @returns Promise resolving to found element or null
 */
export const waitForElement = (
  selector: string,
  { timeout = 10000, rootElement = document }: WaitForElementOptions = {}
): Promise<Element | null> => {
  return new Promise((resolve) => {
    const element = rootElement.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = rootElement.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(
      rootElement instanceof Document ? rootElement.body : rootElement,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      }
    );

    setTimeout(() => {
      observer.disconnect();
      resolve(rootElement.querySelector(selector));
    }, timeout);
  });
}

/**
 * Simulates a mouse event on an element
 * @param element - Target DOM element
 * @param eventType - Type of mouse event to simulate
 * @param params - Mouse event coordinates
 */
function simulateMouseEvent(
  element: Element,
  eventType: string,
  { x, y }: MouseEventParams
): void {
  const event = new MouseEvent(eventType, {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  element.dispatchEvent(event);
}

// Attach functions to window.helpers

declare global {
  interface Window {
    helpers: {
      sleep: typeof sleep;
      waitForElement: typeof waitForElement;
      simulateMouseEvent: typeof simulateMouseEvent;
    };
  }
}

window.helpers = {
  sleep,
  waitForElement,
  simulateMouseEvent,
};

export {}