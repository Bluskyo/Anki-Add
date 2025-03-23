
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
};

// adds the note to anki deck. 
async function makeNote(){

    //const test = fromStorage.pos.replaceAll(" ", "_")
    //const test2 = test.split("_ ").join()
    //const test3 = test2.replaceAll(",_", " ")

    const models = await invoke('modelNames', 6);

    if (!models.includes("AnkiAdd")){
        console.log("missing Anki note type! creating...")
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

};

async function createNoteType() {
    return await invoke('createModel', 6, 
        {
            "modelName": "AnkiAdd",
            "inOrderFields": ["Word", "Sentence", "JMdictSeq", "Furigana", "Meaning", "From"],
            "css": ".card {  font-size: 25px;  text-align: center;  --text-color: black;  word-wrap: break-word; } .card.night_mode {  font-size: 24px;  text-align: center;  --text-color: white;  word-wrap: break-word; }  div, a {  color: var(--text-color); } .card a { text-decoration-color: #A1B2BA; }  .big { font-size: 50px; } .medium { font-size:30px } .small { font-size: 18px;}",
            "isCloze": false,
            "cardTemplates": [
                {
                    "Name": "Japanese",
                    "Front": "<div class=small>{{hint:Furigana}}</div><div class=big>{{Word}}</div><div class=medium>{{Sentence}}</div>",
                    "Back": '<script>function isAndroid() {return /Android/i.test(navigator.userAgent);}if (isAndroid()) {document.body.classList.add("android");} else {document.body.classList.add("desktop");}</script><div class="android-only" style="display: none;"><a href="kanjistudy://word?id={{JMdictSeq}}"><div class=small>{{Furigana}}</div><div class=big>{{Word}}</div><div class=medium>{{Sentence}}</div></a><br>{{Meaning}}</div></div><div class="desktop-only" style="display: none;"><a href="https://jisho.org/word/{{Word}}"><div class=small>{{Furigana}}</div><div class=big>{{Word}}</div><div class=medium>{{Sentence}}</div></a><br>{{Meaning}}</div></div><script>if (isAndroid()) {document.querySelector(".android-only").style.display = "block";} else {document.querySelector(".desktop-only").style.display = "block";}</script>'
                }
            ]
        }
    )
};

async function addNote() {
    const fromStorage = await browser.storage.local.get();

    const word = document.getElementById("selected-text").textContent.split(",")[0]; // Temperary: should be able to choose this.
    const furigana = document.getElementById("reading").textContent;
    const meaning = document.getElementById("meaning").textContent;
    const tags = document.getElementById("tag").textContent;
    const savedURL = fromStorage.savedURL;

    if (meaning.length > 0){
        return await invoke('addNote', 6, {
            "note": {
                "deckName": fromStorage.selectedDeck, 
                "modelName": "AnkiAdd", 
                "fields": {
                    "Word": word, 
                    "Sentence": fromStorage.example, 
                    "JMdictSeq": fromStorage.jmdictSeq, 
                    "Furigana": furigana, 
                    "Meaning": meaning,
                    "From": savedURL
                },
                "tags": ["AnkiAdd", tags],
                "options": {
                    "allowDuplicate": false,
                    "duplicateScope": "deck",
                    "duplicateScopeOptions": 
                    {
                    "deckName": "Default",
                    "checkChildren": false,
                    "checkAllModels": false }
                }
            }
        })
    } else {
        return null;
    }

    
};

function getExample(){
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
    document.getElementById("add-button").addEventListener("click", makeNote);
    document.getElementById("example").addEventListener("blur", getExample);
}

// looksup selected word and displays info in popup. 
browser.storage.local.get("selectedText").then((result) => {
    // displays saved info about word.
    browser.runtime.sendMessage({ action: "lookupWord", text: result.selectedText }).then(response => {
        if (response.data) {
            const allMeanings = [];
            const allTags = [];

            for (const definition of response.data.sense) {
                const strMeaning  = definition.gloss.map(meaning => meaning.text).join("; ");
                allMeanings.push(strMeaning);
            }

            for (const definition of response.data.sense) {
                for (const tag of definition.partOfSpeech){
                    const value = tagsDict[tag];
                    if (!value) console.log("Could not find tag:", tag);
                    allTags.push(value);
                };
            }

            document.getElementById("selected-text").textContent = response.data.kanji;
            document.getElementById("reading").textContent = response.data.kana;
            document.getElementById("meaning").textContent = allMeanings;
            document.getElementById("tag").textContent = allTags;
        };

    }).catch(error => console.error("Error retrieving text:", error));
})

const tagsDict = {
    "v5uru": "Godan verb - Uru old class verb (old form of Eru)",
    "v2g-s": "Nidan verb (lower class) with 'gu' ending (archaic)",
    "dei": "deity",
    "ship": "ship name",
    "leg": "legend",
    "bra": "Brazilian",
    "music": "music",
    "quote": "quotation",
    "pref": "prefix",
    "ktb": "Kantou-ben",
    "rK": "rarely used kanji form",
    "derog": "derogatory",
    "abbr": "abbreviation",
    "exp": "expressions (phrases, clauses, etc.)",
    "astron": "astronomy",
    "v2g-k": "Nidan verb (upper class) with 'gu' ending (archaic)",
    "aux-v": "auxiliary verb",
    "ctr": "counter",
    "surg": "surgery",
    "baseb": "baseball",
    "serv": "service",
    "genet": "genetics",
    "geogr": "geography",
    "dent": "dentistry",
    "v5k-s": "Godan verb - Iku/Yuku special class",
    "horse": "horse racing",
    "ornith": "ornithology",
    "v2w-s": "Nidan verb (lower class) with 'u' ending and 'we' conjugation (archaic)",
    "sK": "search-only kanji form",
    "rk": "rarely used kana form",
    "hob": "Hokkaido-ben",
    "male": "male term or language",
    "motor": "motorsport",
    "vidg": "video games",
    "n-pref": "noun, used as a prefix",
    "n-suf": "noun, used as a suffix",
    "suf": "suffix",
    "hon": "honorific or respectful (sonkeigo) language",
    "biol": "biology",
    "pol": "polite (teineigo) language",
    "vulg": "vulgar expression or word",
    "v2n-s": "Nidan verb (lower class) with 'nu' ending (archaic)",
    "mil": "military",
    "golf": "golf",
    "min": "mineralogy",
    "X": "rude or X-rated term (not displayed in educational software)",
    "sk": "search-only kana form",
    "jpmyth": "Japanese mythology",
    "sl": "slang",
    "fict": "fiction",
    "art": "art, aesthetics",
    "stat": "statistics",
    "cryst": "crystallography",
    "pathol": "pathology",
    "photo": "photography",
    "food": "food, cooking",
    "n": "noun (common) (futsuumeishi)",
    "thb": "Touhoku-ben",
    "fish": "fishing",
    "v5r-i": "Godan verb with 'ru' ending (irregular verb)",
    "arch": "archaic",
    "v1": "Ichidan verb",
    "bus": "business",
    "tv": "television",
    "euph": "euphemistic",
    "embryo": "embryology",
    "v2y-k": "Nidan verb (upper class) with 'yu' ending (archaic)",
    "uk": "word usually written using kana alone",
    "rare": "rare term",
    "v2a-s": "Nidan verb with 'u' ending (archaic)",
    "hanaf": "hanafuda",
    "figskt": "figure skating",
    "agric": "agriculture",
    "given": "given name or forename, gender not specified",
    "physiol": "physiology",
    "v5u-s": "Godan verb with 'u' ending (special class)",
    "chn": "children's language",
    "ev": "event",
    "adv": "adverb (fukushi)",
    "prt": "particle",
    "vi": "intransitive verb",
    "v2y-s": "Nidan verb (lower class) with 'yu' ending (archaic)",
    "kyb": "Kyoto-ben",
    "vk": "Kuru verb - special class",
    "grmyth": "Greek mythology",
    "vn": "irregular nu verb",
    "electr": "electronics",
    "gardn": "gardening, horticulture",
    "adj-kari": "'kari' adjective (archaic)",
    "vr": "irregular ru verb, plain form ends with -ri",
    "vs": "noun or participle which takes the aux. verb suru",
    "internet": "Internet",
    "vt": "transitive verb",
    "cards": "card games",
    "stockm": "stock market",
    "vz": "Ichidan verb - zuru verb (alternative form of -jiru verbs)",
    "aux": "auxiliary",
    "v2h-s": "Nidan verb (lower class) with 'hu/fu' ending (archaic)",
    "kyu": "Kyuushuu-ben",
    "noh": "noh",
    "econ": "economics",
    "rommyth": "Roman mythology",
    "ecol": "ecology",
    "n-t": "noun (temporal) (jisoumeishi)",
    "psy": "psychiatry",
    "proverb": "proverb",
    "company": "company name",
    "poet": "poetical term",
    "ateji": "ateji (phonetic) reading",
    "paleo": "paleontology",
    "v2h-k": "Nidan verb (upper class) with 'hu/fu' ending (archaic)",
    "civeng": "civil engineering",
    "go": "go (game)",
    "adv-to": "adverb taking the 'to' particle",
    "ent": "entomology",
    "unc": "unclassified",
    "on-mim": "onomatopoeic or mimetic word",
    "yoji": "yojijukugo",
    "n-adv": "adverbial noun (fukushitekimeishi)",
    "print": "printing",
    "form": "formal or literary term",
    "osb": "Osaka-ben",
    "adj-shiku": "'shiku' adjective (archaic)",
    "Christn": "Christianity",
    "hum": "humble (kenjougo) language",
    "obs": "obsolete term",
    "relig": "religion",
    "iK": "word containing irregular kanji usage",
    "conj": "conjunction",
    "geol": "geology",
    "anat": "anatomy",
    "nab": "Nagano-ben",
    "hist": "historical term",
    "fam": "familiar language",
    "myth": "mythology",
    "gramm": "grammar",
    "id": "idiomatic expression",
    "psyanal": "psychoanalysis",
    "comp": "computing",
    "creat": "creature",
    "ik": "word containing irregular kana usage",
    "adj-i": "adjective (keiyoushi)",
    "Shinto": "Shinto",
    "psych": "psychology",
    "adj-pn": "pre-noun adjectival (rentaishi)",
    "met": "meteorology",
    "chem": "chemistry",
    "sports": "sports",
    "zool": "zoology",
    "int": "interjection (kandoushi)",
    "tradem": "trademark",
    "net-sl": "Internet slang",
    "n-pr": "proper noun",
    "archit": "architecture",
    "pn": "pronoun",
    "gikun": "gikun (meaning as reading) or jukujikun (special kanji reading)",
    // missing tag for some reason?:
    "adj-na": "na-adjective (keiyodoshi)",
    "adj-no": "Noun which may take the genitive case particle 'no'"

  };