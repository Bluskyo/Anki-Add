browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendText") {
        browser.storage.local.set({ selectedText: message.text }).then(() => {});

        let selectedText = message.text

        fetch("http://localhost:8080/api/v1/" + selectedText)
            .then(res => {
                if (res.ok) {
                    return res.json()
                } else if (res.status == 404) {
                    throw new Error("Could not find word!")
                }
            })
            .then(data => {
                browser.storage.local.set({ 
                    selectedText: message.text,
                    reading: data.reading, 
                    meaning: data.gloss,
                    pos: data.pos,
                    jmdictSeq: data.entry_seq
                 }).then(() => {});
            })
            .catch(() =>                 
                browser.storage.local.set({ 
                    selectedText: `Could not find: "${message.text}"`,
                    reading: "", 
                    meaning: "",
                    pos: "",
                    jmdictSeq: ""
                 }).then(() => {})
            )

    } else if (message.action === "getText") {
        browser.storage.local.get([
            "selectedText", 
            "reading", 
            "meaning", 
            "pos",
            "jmdictSeq"])
            .then((result) => {
                sendResponse({ 
                    text: result.selectedText, 
                    reading: result.reading, 
                    meaning: result.meaning, 
                    pos: result.pos,
                    jmdictSeq: result.entry_seq || "" });
        });

        return true; // keeps the response channel open for async func
    }
});
