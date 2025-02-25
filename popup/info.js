function invoke(action, version, params={}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('error', () => reject('failed to issue request'));
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            } catch (e) {
                reject(e);
            }
        });

        xhr.open('POST', 'http://127.0.0.1:8765');
        xhr.send(JSON.stringify({action, version, params}));
    }).catch((error) => {
        console.error("Error fetching selectedDeck:", error);
    })
}

// adds the note to anki deck. 
async function makeNote(){

    //const test = fromStorage.pos.replaceAll(" ", "_")
    //const test2 = test.split("_ ").join()
    //const test3 = test2.replaceAll(",_", " ")

    const models = await invoke('modelNames', 6);

    if (!models.includes("AnkiAdd")){
        createNoteType();
    }

    const addingNote = await addNote();

    if (addingNote !== null) {

        browser.storage.local.get([
            "selectedText", 
            "selectedDeck"]).then((result) => {
            document.getElementById("status-message").textContent = `Added ${result.selectedText} to ${result.selectedDeck}.😊`;
        })
    } else {
        browser.storage.local.get([
            "selectedText", 
            "selectedDeck"]).then((result) => {
            document.getElementById("status-message").textContent = `Could not add ${result.selectedText} to ${result.selectedDeck}.😔`;
        })
    }

} 

async function createNoteType() {
    return await invoke('createModel', 6, 
        {
            "modelName": "AnkiAdd",
            "inOrderFields": ["Word", "Sentence", "JMdictSeq", "Furigana", "Meaning"],
            "css": ".card {  font-size: 25px;  text-align: center;  --text-color: black;  word-wrap: break-word; } .card.night_mode {  font-size: 24px;  text-align: center;  --text-color: white;  word-wrap: break-word; }  div, a {  color: var(--text-color); } .card a { text-decoration-color: #A1B2BA; }  .big { font-size: 50px; } .medium { font-size:30px } .small { font-size: 18px;}",
            "isCloze": false,
            "cardTemplates": [
                {
                    "Name": "Japanese",
                    "Front": "<div class=small>{{hint:Furigana}}</div><div class=big>{{Word}}</div><div class=medium>{{Sentence}}</div>",
                    "Back": '<a href="kanjistudy://word?id={{JMdictSeq}}"><div class=small>{{Furigana}}</div><div class=big>{{Word}}</div><div class=medium>{{Sentence}}</div></a><br>{{Meaning}}</div>'
                }
            ]
        }
    )
};

async function addNote() {
    const fromStorage = await browser.storage.local.get();

    if (fromStorage.meaning.length > 0){
        return await invoke('addNote', 6, {
            "note": {
                "deckName": fromStorage.selectedDeck, 
                "modelName": "AnkiAdd", 
                "fields": {
                    "Word": fromStorage.selectedText, 
                    "Sentence": fromStorage.example, 
                    "JMdictSeq": fromStorage.jmdictSeq.toString(), 
                    "Furigana": fromStorage.reading, 
                    "Meaning": fromStorage.meaning
                },
                "tags": ["AnkiAdd", fromStorage.pos],
                "options": {
                    "allowDuplicate": false,
                    "duplicateScope": "deck",
                    "duplicateScopeOptions": 
                    {
                    "deckName": "Default",
                    "checkChildren": false,
                    "checkAllModels": false}
                }
            }
        })
    } else {
        return null;
    }

    
};

async function getExample(){
    const example =  document.getElementById("example").value;

    browser.storage.local.get("selectedText").then((result) => {
    if (example.includes(result.selectedText) || example.length === 0) {
            browser.storage.local.set({example: example});
            document.getElementById("add-button").disabled = false; 
        }
        else document.getElementById("add-button").disabled = true; 
    })
};

// gets decks from anki and saves chosen deck.
invoke('deckNames', 6).then((decks) => {
    // gets the decks and display them in the popup window.
    const ankiDecksDropdDown = document.getElementById("anki-decks");

    if (decks == undefined) {

        let option = document.createElement("option");
        let optionText = document.createTextNode("Couldn't connect to Anki!");
        option.appendChild(optionText);

        ankiDecksDropdDown.appendChild(option);
    } else {
        browser.storage.local.get("selectedDeck").then((result) => {  
            const selectedDeck = result.selectedDeck;

            // if other decks are present skips the default deck.
            if(decks.length > 1){
                decks.shift();   
                if (!selectedDeck) {
                    browser.storage.local.set({ selectedDeck: decks[0]});
                }
            }

            // avoids undefined first deck and gets selected deck.
            if (selectedDeck) {
                let option = document.createElement("option");
                option.setAttribute("value", selectedDeck);
                let optionText = document.createTextNode(selectedDeck);
                option.appendChild(optionText);
        
                ankiDecksDropdDown.appendChild(option);
            }
            
            // adds rest of available decks to dropdown menu.
            for (let deck of decks) {  
                if (deck !== selectedDeck){
                    let option = document.createElement("option");
                    option.setAttribute("value", deck);
                    let optionText = document.createTextNode(deck);
                    option.appendChild(optionText);
            
                    ankiDecksDropdDown.appendChild(option);
                }
            }

            // saves picked deck. 
            document.getElementById("anki-decks").addEventListener("change", (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                browser.storage.local.set({ selectedDeck: selectedOption.text});
            })

        })
    }
});

// listens to add button on popup window.
window.onload = () => {
    document.getElementById("add-button").addEventListener("click", makeNote); //dsdaf
    document.getElementById("example").addEventListener("blur", getExample);
};

// displays saved info about word.
browser.runtime.sendMessage({ action: "getText" }).then(response => {
    if (response && response.text) {
        document.getElementById("selected-text").textContent = response.text;
        document.getElementById("reading").textContent = response.reading;
        document.getElementById("meaning").textContent = response.meaning;
        document.getElementById("tag").textContent = response.pos;
    }
}).catch(error => console.error("Error retrieving text:", error));
