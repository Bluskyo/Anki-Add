browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendText") {
        browser.storage.local.set({ selectedText: message.text }).then(() => {});
    } 
    else if (message.action === "getText") {
        browser.storage.local.get("selectedText").then((result) => {
            sendResponse({ text: result.selectedText || "" });
        });

        return true; // keeps the response channel open for async func
    }
});
