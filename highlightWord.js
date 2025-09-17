const japaneseRE = /([ぁ-んァ-ン一-龯])/;

function isSentence(selection){
    if (selection.length >= 15) return true;
    const regex = /[\s。？！、…　]/;
    if (regex.test(selection)) return true;

    return false;
}

// if text is highlighted, japanese and ctrl is held down search for word.
document.addEventListener("mouseup", (e) => { 
    let selection = document.getSelection();
    let selectedText = document.getSelection().toString().trim();
    let containsJP = japaneseRE.test(selectedText);

    const currentElement = document.activeElement;

    const websiteURL = window.location.href;

    // checks html input tag, getselection cant read these.
    if (selectedText == "" && currentElement.tagName === "TEXTAREA" || currentElement.tagName === "INPUT") {  
        const selectionStart = currentElement.selectionStart;
        const selectionEnd = currentElement.selectionEnd;

        containsJP = japaneseRE.test(currentElement.value);

        if (currentElement.value && containsJP){
            selectedText =  currentElement.value.substring(selectionStart, selectionEnd);

            if (!selectedText) return false;

            if(!isSentence(selectedText)) {
                browser.runtime.sendMessage({
                    action: "saveSelection",
                    text: selectedText,
                    sentence: currentElement.value,
                    url: websiteURL
                }).catch(error => console.error("Error sending message:", error));
            }
        }
    } else if (containsJP) {
        const textNode = selection.focusNode.textContent;

        if(!isSentence(selectedText)) {
            // attempts to automatically get the sentence the word was taken from. 
            // stopping at "。" to complete the sentence
            let sentence = "";
            const match = textNode.match(/[^。]*。?/g); 
            
            if (match){
                sentence = match.find(str => str.includes(selection)) || "";
            }

            browser.runtime.sendMessage({
                action: "saveSelection",
                text: selectedText,
                sentence: sentence,
                url: websiteURL
            }).catch(error => console.error("Error sending message:", error));
        }

    }
    
});