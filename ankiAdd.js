const japaneseRE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

// if text is highlighted, japanese and ctrl is held down search for word.
document.addEventListener("mouseup", (e) => {
    if(e.ctrlKey){
        let selection = document.getSelection();
        let selectedText = selection.toString().trim();
        let containsJP = japaneseRE.test(selectedText);

        const currentElement = document.activeElement;
        const currentLocation = window.location.href;
    
        // checks input tag, getselection cant read these.
        if (selectedText == "" && currentElement.tagName === "TEXTAREA" || currentElement.tagName === "INPUT"){  
            const selectionStart = currentElement.selectionStart;
            const selectionEnd = currentElement.selectionEnd;
    
            containsJP = japaneseRE.test(currentElement.value);
    
            if (currentElement.value && containsJP){
                selectedText =  currentElement.value.substring(selectionStart, selectionEnd);
                browser.runtime.sendMessage({
                    action: "saveSelection",
                    text: selectedText,
                    sentence: "",
                    url: currentLocation
                }).catch(error => console.error("Error sending message:", error));
            }
        } else if (selectedText.length <= 10 && containsJP) {
            const textNode = selection.focusNode.parentNode.innerText;

            // matches everything the not in [。] after that counts every proceeding match devided by "。".
            let sentence = "";
            const match = textNode.match(/[^。]*。?/g); 
            
            if (match){
                sentence = match.find(str => str.includes(selection)) || "";
            }

            browser.runtime.sendMessage({
                action: "saveSelection",
                text: selectedText,
                sentence: sentence,
                url: currentLocation
            }).catch(error => console.error("Error sending message:", error));
        }
    } 

});