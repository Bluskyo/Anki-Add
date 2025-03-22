const japaneseRE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

document.addEventListener("mouseup", () => {
    let selection = window.getSelection().toString().trim();

    let isJapanese = japaneseRE.test(selection);

    if (selection.length < 6 && isJapanese){
        let currentLocation = window.location.href;
        browser.runtime.sendMessage({
            action: "saveSelection",
            text: selection,
            url: currentLocation
        }).catch(error => console.error("Error sending message:", error));
    }
});