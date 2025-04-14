const japaneseRE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

document.addEventListener("mouseup", () => {
    let selection = document.getSelection().toString().trim();
    const currentElement = document.activeElement;
    const selectionStart = currentElement.selectionStart;
    const selectionEnd = currentElement.selectionEnd;

    if (selection == ""){ // checks input tag, getselection cant read these.
        const input = currentElement.value;
        if (input){
            selection = input.substring(selectionStart, selectionEnd);
        }
    }
    
    let containsJP = japaneseRE.test(selection);

    if (selection.length <= 20 && containsJP){
        let currentLocation = window.location.href;
        browser.runtime.sendMessage({
            action: "saveSelection",
            text: selection,
            url: currentLocation
        }).catch(error => console.error("Error sending message:", error));
    }
});