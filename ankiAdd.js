document.addEventListener("mouseup", () => {
    let selection = window.getSelection().toString().trim();
    if (selection) {
        browser.runtime.sendMessage({ action: "sendText", text: selection }).then(() => {
        }).catch(error => console.error("Error sending message:", error));
    }
});