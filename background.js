browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendText") {
        browser.storage.local.set({ selectedText: message.text }).then(() => {});

        let selectedText = message.text

        fetch("http://localhost:8080/api/v1/" + selectedText)
            .then(res => {
                if (res.ok) {
                    return res.json()
                } else {
                    throw new Error("Could not find word!")
                }
            })
            .then(data => {
                browser.storage.local.set({ 
                    reading: data.reading, 
                    meaning: data.gloss,
                    pos: data.pos
                 }).then(() => {});
            })
            .catch(error => console.log("Error! ", error))
    

    } else if (message.action === "getText") {
        browser.storage.local.get([
            "selectedText", 
            "reading", 
            "meaning", 
            "pos"])
            .then((result) => {
                sendResponse({ text: result.selectedText, 
                    re: result.reading, 
                    meaning: result.meaning, 
                    pos: result.pos|| "" });
        });

        return true; // keeps the response channel open for async func
    }
});
