const jpRe = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

document.addEventListener("mouseup", () => {
    let selection = window.getSelection().toString().trim();

    let isJapanese = jpRe.test(selection);

    if (selection.length < 20 && isJapanese){
        browser.runtime.sendMessage({ action: "sendText", text: selection }).then(() => {
        }).catch(error => console.error("Error sending message:", error));
    }
});