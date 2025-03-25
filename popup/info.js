
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
            "inOrderFields": ["Word", "Furigana", "Meaning", "Sentence", "JMdictSeq", "From"],
            "css": ".card {  font-size: 25px;  text-align: center;  --text-color: black;  word-wrap: break-word; } .card.night_mode {  font-size: 24px;  text-align: center;  --text-color: white;  word-wrap: break-word; }  div, a {  color: var(--text-color); } .card a { text-decoration-color: #A1B2BA; }  .big { font-size: 50px; padding-bottom: 10px } .medium { font-size:30px } .small { font-size: 18px;}",
            "isCloze": false,
            "cardTemplates": [
                {
                    "Name": "Japanese",
                    "Front": "<div class=small>{{hint:Furigana}}</div><div class=big>{{Word}}</div><div class=small>{{Sentence}}</div>",
                    "Back": '<script>function isAndroid() {return /Android/i.test(navigator.userAgent);}if (isAndroid()) {document.body.classList.add("android");} else {document.body.classList.add("desktop");}</script><div class="android-only" style="display: none;"><a href="kanjistudy://word?id={{JMdictSeq}}"><div class=small>{{Furigana}}</div><div class=big>{{Word}}</div><div class=small>{{Sentence}}</div></a><br>{{Meaning}}</div></div><div class="desktop-only" style="display: none;"><a href="https://jisho.org/word/{{Word}}"><div class=small>{{Furigana}}</div><div class=big>{{Word}}</div><div class=small>{{Sentence}}</div></a><br>{{Meaning}}</div></div><script>if (isAndroid()) {document.querySelector(".android-only").style.display = "block";} else {document.querySelector(".desktop-only").style.display = "block";}</script>'
                }
            ]
        }
    )
};

async function addNote() {
    const fromStorage = await browser.storage.local.get();

    const word = document.getElementById("selected-text").textContent.split(",")[0]; // Temperary: should be able to choose this.
    const furigana = document.getElementById("reading").textContent.split(",")[0];
    const meaning = document.getElementById("meaning").textContent;
    const tags = document.getElementById("tag").textContent;
    const savedURL = fromStorage.savedURL;



    // for highlighting word in anki
    const sentence = fromStorage.sentence; 
    const regex = new RegExp(word, "g"); // globalflag to match every occurence
    const formattedSentence = sentence.replace(regex, `<mark>${word}</mark>`);

    // adds all info to anki note.
    if (meaning.length > 0){
        return await invoke('addNote', 6, {
            "note": {
                "deckName": fromStorage.selectedDeck, 
                "modelName": "AnkiAdd", 
                "fields": {
                    "Word": word, 
                    "Sentence": formattedSentence, 
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

// prevents sentences that does not include the word from being added.
function getSentence(){
    let sentence =  document.getElementById("sentence").value;

    sentence = sentence.replace(/ /g, '<br>');

    browser.storage.local.get("selectedText").then((result) => {
    if (sentence.includes(result.selectedText) || sentence.length === 0) {
            browser.storage.local.set({sentence: sentence});
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
    document.getElementById("sentence").addEventListener("blur", getSentence);
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
    "v5uru":"Godan verb - Uru old class verb (old form of Eru)",
    "v2g-s":"Nidan verb (lower class) with 'gu' ending (archaic)",
    "dei":"deity",
    "ship":"ship name",
    "leg":"legend",
    "bra":"Brazilian",
    "music":"music",
    "quote":"quotation",
    "pref":"prefix",
    "ktb":"Kantou-ben",
    "rK":"rarely used kanji form",
    "derog":"derogatory",
    "abbr":"abbreviation",
    "exp":"expressions (phrases, clauses, etc.)",
    "astron":"astronomy",
    "v2g-k":"Nidan verb (upper class) with 'gu' ending (archaic)",
    "aux-v":"auxiliary verb",
    "ctr":"counter",
    "surg":"surgery",
    "baseb":"baseball",
    "serv":"service",
    "genet":"genetics",
    "geogr":"geography",
    "dent":"dentistry",
    "v5k-s":"Godan verb - Iku/Yuku special class",
    "horse":"horse racing",
    "ornith":"ornithology",
    "v2w-s":"Nidan verb (lower class) with 'u' ending and 'we' conjugation (archaic)",
    "sK":"search-only kanji form",
    "rk":"rarely used kana form",
    "hob":"Hokkaido-ben",
    "male":"male term or language",
    "motor":"motorsport",
    "vidg":"video games",
    "n-pref":"noun, used as a prefix",
    "n-suf":"noun, used as a suffix",
    "suf":"suffix",
    "hon":"honorific or respectful (sonkeigo) language",
    "biol":"biology",
    "pol":"polite (teineigo) language",
    "vulg":"vulgar expression or word",
    "v2n-s":"Nidan verb (lower class) with 'nu' ending (archaic)",
    "mil":"military",
    "golf":"golf",
    "min":"mineralogy",
    "X":"rude or X-rated term (not displayed in educational software)",
    "sk":"search-only kana form",
    "jpmyth":"Japanese mythology",
    "sl":"slang",
    "fict":"fiction",
    "art":"art, aesthetics",
    "stat":"statistics",
    "cryst":"crystallography",
    "pathol":"pathology",
    "photo":"photography",
    "food":"food, cooking",
    "n":"noun (common) (futsuumeishi)",
    "thb":"Touhoku-ben",
    "fish":"fishing",
    "v5r-i":"Godan verb with 'ru' ending (irregular verb)",
    "arch":"archaic",
    "v1":"Ichidan verb",
    "bus":"business",
    "tv":"television",
    "euph":"euphemistic",
    "embryo":"embryology",
    "v2y-k":"Nidan verb (upper class) with 'yu' ending (archaic)",
    "uk":"word usually written using kana alone",
    "rare":"rare term",
    "v2a-s":"Nidan verb with 'u' ending (archaic)",
    "hanaf":"hanafuda",
    "figskt":"figure skating",
    "agric":"agriculture",
    "given":"given name or forename, gender not specified",
    "physiol":"physiology",
    "v5u-s":"Godan verb with 'u' ending (special class)",
    "chn":"children's language",
    "ev":"event",
    "adv":"adverb (fukushi)",
    "prt":"particle",
    "vi":"intransitive verb",
    "v2y-s":"Nidan verb (lower class) with 'yu' ending (archaic)",
    "kyb":"Kyoto-ben",
    "vk":"Kuru verb - special class",
    "grmyth":"Greek mythology",
    "vn":"irregular nu verb",
    "electr":"electronics",
    "gardn":"gardening, horticulture",
    "adj-kari":"'kari' adjective (archaic)",
    "vr":"irregular ru verb, plain form ends with -ri",
    "vs":"noun or participle which takes the aux. verb suru",
    "internet":"Internet",
    "vt":"transitive verb",
    "cards":"card games",
    "stockm":"stock market",
    "vz":"Ichidan verb - zuru verb (alternative form of -jiru verbs)",
    "aux":"auxiliary",
    "v2h-s":"Nidan verb (lower class) with 'hu/fu' ending (archaic)",
    "kyu":"Kyuushuu-ben",
    "noh":"noh",
    "econ":"economics",
    "rommyth":"Roman mythology",
    "ecol":"ecology",
    "n-t":"noun (temporal) (jisoumeishi)",
    "psy":"psychiatry",
    "proverb":"proverb",
    "company":"company name",
    "poet":"poetical term",
    "ateji":"ateji (phonetic) reading",
    "paleo":"paleontology",
    "v2h-k":"Nidan verb (upper class) with 'hu/fu' ending (archaic)",
    "civeng":"civil engineering",
    "go":"go (game)",
    "adv-to":"adverb taking the 'to' particle",
    "ent":"entomology",
    "unc":"unclassified",
    "unclass":"unclassified name",
    "on-mim":"onomatopoeic or mimetic word",
    "yoji":"yojijukugo",
    "n-adv":"adverbial noun (fukushitekimeishi)",
    "print":"printing",
    "form":"formal or literary term",
    "obj":"object",
    "osb":"Osaka-ben",
    "adj-shiku":"'shiku' adjective (archaic)",
    "Christn":"Christianity",
    "hum":"humble (kenjougo) language",
    "obs":"obsolete term",
    "relig":"religion",
    "iK":"word containing irregular kanji usage",
    "v2k-s":"Nidan verb (lower class) with 'ku' ending (archaic)",
    "conj":"conjunction",
    "v2s-s":"Nidan verb (lower class) with 'su' ending (archaic)",
    "geol":"geology",
    "geom":"geometry",
    "anat":"anatomy",
    "nab":"Nagano-ben",
    "ski":"skiing",
    "hist":"historical term",
    "fam":"familiar language",
    "myth":"mythology",
    "gramm":"grammar",
    "v2k-k":"Nidan verb (upper class) with 'ku' ending (archaic)",
    "id":"idiomatic expression",
    "v5aru":"Godan verb - -aru special class",
    "psyanal":"psychoanalysis",
    "comp":"computing",
    "creat":"creature",
    "ik":"word containing irregular kana usage",
    "oth":"other",
    "v-unspec":"verb unspecified",
    "io":"irregular okurigana usage",
    "work":"work of art, literature, music, etc. name",
    "adj-ix":"adjective (keiyoushi) - yoi/ii class",
    "phil":"philosophy",
    "doc":"document",
    "math":"mathematics",
    "pharm":"pharmacology",
    "adj-nari":"archaic/formal form of na-adjective",
    "v2r-k":"Nidan verb (upper class) with 'ru' ending (archaic)",
    "adj-f":"noun or verb acting prenominally",
    "adj-i":"adjective (keiyoushi)",
    "audvid":"audiovisual",
    "rkb":"Ryuukyuu-ben",
    "adj-t":"'taru' adjective",
    "v2r-s":"Nidan verb (lower class) with 'ru' ending (archaic)",
    "Buddh":"Buddhism",
    "biochem":"biochemistry",
    "v2b-k":"Nidan verb (upper class) with 'bu' ending (archaic)",
    "vs-s":"suru verb - special class",
    "surname":"family or surname",
    "physics":"physics",
    "place":"place name",
    "v2b-s":"Nidan verb (lower class) with 'bu' ending (archaic)",
    "kabuki":"kabuki",
    "prowres":"professional wrestling",
    "product":"product name",
    "vs-c":"su verb - precursor to the modern suru",
    "tsug":"Tsugaru-ben",
    "adj-ku":"'ku' adjective (archaic)",
    "telec":"telecommunications",
    "vs-i":"suru verb - included",
    "v2z-s":"Nidan verb (lower class) with 'zu' ending (archaic)",
    "organization":"organization name",
    "char":"character",
    "engr":"engineering",
    "logic":"logic",
    "v2m-s":"Nidan verb (lower class) with 'mu' ending (archaic)",
    "col":"colloquial",
    "archeol":"archeology",
    "cop":"copula",
    "num":"numeric",
    "aviat":"aviation",
    "aux-adj":"auxiliary adjective",
    "m-sl":"manga slang",
    "fem":"female term or language",
    "MA":"martial arts",
    "finc":"finance",
    "v1-s":"Ichidan verb - kureru special class",
    "v2m-k":"Nidan verb (upper class) with 'mu' ending (archaic)",
    "manga":"manga",
    "shogi":"shogi",
    "group":"group",
    "adj-no":"nouns which may take the genitive case particle 'no'",
    "adj-na":"adjectival nouns or quasi-adjectives (keiyodoshi)",
    "sens":"sensitive",
    "law":"law",
    "vet":"veterinary terms",
    "mahj":"mahjong",
    "v4b":"Yodan verb with 'bu' ending (archaic)",
    "rail":"railway",
    "v4g":"Yodan verb with 'gu' ending (archaic)",
    "elec":"electricity, elec. eng.",
    "film":"film",
    "mining":"mining",
    "v4h":"Yodan verb with 'hu/fu' ending (archaic)",
    "v4k":"Yodan verb with 'ku' ending (archaic)",
    "v4m":"Yodan verb with 'mu' ending (archaic)",
    "v4n":"Yodan verb with 'nu' ending (archaic)",
    "sumo":"sumo",
    "v4s":"Yodan verb with 'su' ending (archaic)",
    "v4r":"Yodan verb with 'ru' ending (archaic)",
    "person":"full name of a particular person",
    "v4t":"Yodan verb with 'tsu' ending (archaic)",
    "boxing":"boxing",
    "oK":"word containing out-dated kanji or kanji usage",
    "cloth":"clothing",
    "joc":"jocular, humorous term",
    "politics":"politics",
    "v2t-k":"Nidan verb (upper class) with 'tsu' ending (archaic)",
    "tsb":"Tosa-ben",
    "v5b":"Godan verb with 'bu' ending",
    "ling":"linguistics",
    "bot":"botany",
    "v2t-s":"Nidan verb (lower class) with 'tsu' ending (archaic)",
    "v5g":"Godan verb with 'gu' ending",
    "med":"medicine",
    "v5k":"Godan verb with 'ku' ending",
    "mech":"mechanical engineering",
    "v5n":"Godan verb with 'nu' ending",
    "v5m":"Godan verb with 'mu' ending",
    "v2d-k":"Nidan verb (upper class) with 'dzu' ending (archaic)",
    "v5r":"Godan verb with 'ru' ending",
    "v5t":"Godan verb with 'tsu' ending",
    "v5s":"Godan verb with 'su' ending",
    "v5u":"Godan verb with 'u' ending",
    "Shinto":"Shinto",
    "station":"railway station",
    "chmyth":"Chinese mythology",
    "dated":"dated term",
    "v2d-s":"Nidan verb (lower class) with 'dzu' ending (archaic)",
    "psych":"psychology",
    "adj-pn":"pre-noun adjectival (rentaishi)",
    "ok":"out-dated or obsolete kana usage",
    "met":"meteorology",
    "chem":"chemistry",
    "sports":"sports",
    "zool":"zoology",
    "int":"interjection (kandoushi)",
    "tradem":"trademark",
    "net-sl":"Internet slang",
    "n-pr":"proper noun",
    "archit":"architecture",
    "ksb":"Kansai-ben",
    "pn":"pronoun",
    "gikun":"gikun (meaning as reading) or jukujikun (special kanji reading)"
};

const verbFormNames = {
"ない" : "negative",
"ます" : "polite",
"ません" : "polite negative",
"た" : "past", // multiple
"なかった" : "past negative",
"ました" : "polite past",
"ませんでした" : "polite negative",
"て" : "te-form",
"なくて" : "te-form negative",
//"れる" : "potential", // multiple
//"れない" : "potential negative",
//"ない1" : "passive",
//"ない2" : "passive negative",
//"ない3" : "causative",
//"ない4" : "causative negative",
"せられる" : "causative passive",
"せられない" : "causative passive negative",
//"ない5" : "negative",
"な" : "imperative negative",
"れば" : "conditional ba-form", // multiple
"なければ" : "conditional ba-form negative",
"たら" : "conditional tara-form",
"なかったら" : "conditional ba-form negative",

};

const adjectiveFormNames = {
    // i-adjectives:
    "くない" : "negative",
    "かった" : "past",
    "くなかった" : "past negative",
    // na-adjectives:
    "じゃない" : "negative",
    "だった" : "past",
    "じゃなかった" : "negative",
};