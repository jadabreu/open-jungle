window.helpers = {
    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    waitForElement: function(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                return resolve(element);
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });

            setTimeout(() => {
                observer.disconnect();
                const finalCheck = document.querySelector(selector);
                resolve(finalCheck);
            }, timeout);
        });
    },

    simulateMouseEvent: function(element, eventType, x, y) {
        const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        element.dispatchEvent(event);
    }
};