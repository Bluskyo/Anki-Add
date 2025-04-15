
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
    const models = await invoke('modelNames', 6);

    if (!models.includes("AnkiAdd")){
        console.log("missing Anki note type! creating...")
        createNoteType();
    }

    const addingNote = await addNote(); //

    if (addingNote !== null) {
        browser.runtime.sendMessage({ action: "getSavedInfo"}).then(response => {
            if (response) {
                document.getElementById("status-message").textContent = `Added "${response.get("selectedText")}" to "${response.get("savedDeck")}".😊`;
            }
        }).catch(error => console.error("Error creating card!:", error));
    } else {
        browser.runtime.sendMessage({ action: "getSavedInfo"}).then(response => {
            if (response) {
                document.getElementById("status-message").textContent = `Could not add "${response.selectedText}" to "${response.savedDeck}."😔`;
            }
        });
    }

}

async function createNoteType() {
    return await invoke('createModel', 6, 
        {
            "modelName": "AnkiAdd",
            "inOrderFields": ["Word", "Furigana", "Meaning", "Sentence", "JMdictSeq", "From", "Pronunciation"],
            "css": ".card {\n  font-size: 25px;\n  --text-color: black;\n  word-wrap: break-word;\n}\n.card.night_mode {\n  font-size: 24px;\n  --text-color: white;\n  word-wrap: break-word;\n}\ndiv, a {\n  color: var(--text-color);\n}\n.big {\n  font-size: 50px;\n  text-align: center;\n}\n.medium {\n  font-size:30px;\n  text-align: center;\n}\n.small {\n  font-size: 18px;\n  text-align: center;\n}\n.tags {\n   font-size: 15px;\n    color: #00beb6;\n    margin: 5px 3px;\n }\n.tag-list {\n   font-size: 1.2rem;\n    margin-bottom: 10px;\n}",
            "isCloze": false,
            "cardTemplates": [
                {
                    "Name": "Japanese",
                    "Front": "<div class=small>{{hint:Furigana}}</div>\n<div class=big>{{Word}}</div>\n<div class=small>{{hint:Sentence}}</div>",
                    "Back": "<script>\nfunction isAndroid() {\n  return /Android/i.test(navigator.userAgent);\n}\nif (isAndroid()) {\n  document.body.classList.add(\"android\");\n} else {\n  document.body.classList.add(\"desktop\");\n}\n</script>\n<div class=\"android-only\" style=\"display: none;\">\n  <a href=\"kanjistudy://word?id={{JMdictSeq}}\">\n    <div class=small>{{Furigana}}</div>\n    <div class=big>{{Word}}</div>\n  </a>\n  <a href=\"https://jisho.org/search/{{Sentence}}\">\n    <div class=small>{{Sentence}}</div>\n  </a>\n  {{Meaning}}\n</div>\n<div class=\"desktop-only\" style=\"display: none;\">\n  <a href=\"https://jisho.org/search/{{Word}}\">\n    <div class=small>{{Furigana}}</div>\n    <div class=big>{{Word}}</div>\n  </a>\n  <a href=\"https://jisho.org/search/{{Sentence}}\">\n    <div class=small>{{Sentence}}</div>\n  </a>\n  <div class=definition>{{Meaning}}</div>\n</div>\n<script>\n  if (isAndroid()) {\n    document.querySelector(\".android-only\").style.display = \"block\";\n  } else {\n    document.querySelector(\".desktop-only\").style.display = \"block\";\n  }\n</script>\n<center>{{Pronunciation}}</center>"
                }
            ]
        }
    )
}

// needs error handling.
async function addNote() {
    browser.runtime.sendMessage({ action: "getAllData" }).then(response => {
        if (response) {
            const wordData = response[0];
            let word = wordData.kanji[0];
            const furigana = wordData.kana[0];
            const meaning = document.getElementById("description").innerHTML;  
            const savedInfo = response[1];  
            const savedUrl = savedInfo.get("savedURL");
            const savedDeck = savedInfo.get("savedDeck")


            // formatting for tags in anki
            let allTags = [];
            for (const definition of wordData.sense) {
                for (const tag of definition.partOfSpeech){
                    allTags.push(tagsDict[tag]);
                }                 
            } 
            const ankiFormat = allTags.join(",").replace(/ /g, "_");
            const ankiTags = ankiFormat.replace(/,/g, " ");  

            // marking word in example sentence logic:
            const sentence = savedInfo.get("sentence"); 
            if (useReading){ // for highlighting word in anki
                word = furigana; // uses reading instead of kanji.
            } 
            const regex = new RegExp(word, "g"); 
            const formattedSentence = sentence.replace(regex, `<mark>${word}</mark>`);
            
            // adds all info to anki note.
            if (meaning.length > 0){
                return invoke('addNote', 6, {
                    "note": {
                        "deckName": savedDeck, 
                        "modelName": "AnkiAdd",
                        "fields": {
                            "Word": word, 
                            "Sentence": formattedSentence,
                            "JMdictSeq": response[0].id, 
                            "Furigana": furigana, 
                            "Meaning": meaning,
                            "From": savedUrl 
                        },
                        "tags": ["AnkiAdd", ankiTags],
                        "options": { // duplication scope
                            "allowDuplicate": false,
                            "duplicateScope": "deck",
                            "duplicateScopeOptions": 
                            {
                            "deckName": "Default", // savedDeck
                            "checkChildren": false,
                            "checkAllModels": false }
                        },
                        "audio": [{
                            "url": `https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kanji=${word}&kana=${furigana}`,
                            "filename": `ankiAdd_${word}_${furigana}.mp3`,
                            "skipHash": "7e2c2f954ef6051373ba916f000168dc",
                            "fields": [
                                "Pronunciation"
                            ]
                        }],
                    }
                }).catch((error) => {
                    console.error(error);
                });
            }

        }
    }).catch(error => console.error("Error retrieving data:", error));

}

// prevents sentences that does not include the word from being added.
function getSentence(){
    let word = document.getElementById("selected-text").textContent.split(",")[0];
    const reading = document.getElementById("reading").textContent.split(",")[0];

    if (useReading){ // for highlighting word in anki
        word = reading; // uses reading instead of kanji.
    } 

    let sentence = document.getElementById("sentence").value;

    if (sentence.includes(word) || sentence.length == 0) {
        sentence = sentence.replace(/ /g, '<br>');
        browser.runtime.sendMessage({
            action: "saveSentence",
            text: sentence
        }).catch(error => console.error("Error saving message:", error));

        document.getElementById("add-button").disabled = false; 
    } else document.getElementById("add-button").disabled = true; 
}

function handleChange(){
    useReading = !useReading;
    getSentence(); // updates sentence for checking input field.
}

// gets decks from anki and saves chosen deck.
invoke('deckNames', 6).then((decks) => {
        // gets the decks and display them in the popup window.
        const ankiDecksDropdDown = document.getElementById("anki-decks");

        if (decks == undefined) {
            let option = document.createElement("option");
            let optionText = document.createTextNode("Couldn't connect to Anki! Is Anki connect installed?");
            option.appendChild(optionText);

            ankiDecksDropdDown.appendChild(option);
        } else { 
            browser.runtime.sendMessage({ action: "getSavedInfo" }).then(response => {
                const selectedDeck = response.get("savedDeck");

                // if other decks are present skips the default deck.
                if(decks.length > 1){
                    decks.shift();   
                    if (!selectedDeck) {
                        browser.runtime.sendMessage({ action: "saveDeck",  text: decks[0]});
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
                    browser.runtime.sendMessage({ action: "saveDeck",  text: selectedOption.text});
                })

            });

        }
    }
)

// listens to add button on popup window.
window.onload = () => {
    document.getElementById("add-button").addEventListener("click", makeNote);
    document.getElementById("sentence").addEventListener("input", getSentence);
    document.getElementById("kana-reading").addEventListener("change", handleChange); // reverses bool for using kana reading
}

let useReading = false;
// looksup selected word and displays info in popup. 
// displays saved info about word.
browser.runtime.sendMessage({ action: "getData"}).then(response => {
    if (response) {
        document.getElementById("selected-text").innerHTML = `<p class=kanji>`+ response.kanji.join(", ") + `</p>`;
        document.getElementById("reading").innerHTML = `<p class=readings>` + response.kana.join(", ") + `</p>`;

        let meaning = `<ol>`;
        for (let definition of response.sense){
            if (definition.misc.length > 0) {
                meaning  += '<span class="tags">' +
                definition.partOfSpeech.map(pos => tagsDict[pos]).join(", ") + " | " +
                definition.misc.map(misc => tagsDict[misc]).join(", ") + '</span>' + '<li class="tag-list">' + 
                definition.gloss.map(meaning => meaning.text).join("; ") + '</li>';
            } else {
                meaning  += '<span class="tags">' + 
                definition.partOfSpeech.map(pos => tagsDict[pos]).join(", ") + '</span>' + '<li class="tag-list">' + 
                definition.gloss.map(meaning => meaning.text).join("; ") + '</li>';
            }
        }
        meaning += `</ol>`;
        document.getElementById("description").innerHTML = meaning;

        // shows common tag for common words.
        const kanjis = response.kanjiCommon;
        const readings = response.kanaCommon;
        if (kanjis.includes(true) || readings.includes(true) ) {
            document.getElementById("additional-info").innerHTML = `<b>` + "common word" + `</b>`;
        }

        // if word is usually written in kana, auto tick checkbox.
        const usuallyKana = response.sense[0].misc[0]; 
        if (usuallyKana == "uk") {
            useReading = true;
            document.getElementById("kana-reading").checked = true;
        }
    } else {
        browser.runtime.sendMessage({ action: "getSavedInfo"}).then(response => {
            const word = response.get("selectedText");
            if (word){
                document.getElementById("reading").innerHTML = `Could not find "${word}" in dictonary!`;

            } else {
                document.getElementById("reading").innerHTML = "Select a word to look up!";
            }
        });

    }
}).catch(error => console.error("Error retrieving text:", error));

const tagsDict = { 
    "v5uru":"Godan verb - Uru old class verb (old form of Eru)",
    "v2g-s":"Nidan verb (lower class) with ぐ ending (archaic)",
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
    "exp":"expression",
    "astron":"astronomy",
    "v2g-k":"Nidan verb (upper class) with ぐ ending (archaic)",
    "aux-v":"auxiliary verb",
    "ctr":"counter",
    "surg":"surgery",
    "baseb":"baseball",
    "serv":"service",
    "genet":"genetics",
    "geogr":"geography",
    "dent":"dentistry",
    "v5k-s":"Godan verb Iku/Yuku (special class)",
    "horse":"horse racing",
    "ornith":"ornithology",
    "v2w-s":"Nidan verb (lower class) with う ending and ゑ conjugation (archaic)",
    "sK":"search-only kanji form",
    "rk":"rarely used kana form",
    "hob":"Hokkaido-ben",
    "male":"male term or language",
    "motor":"motorsport",
    "vidg":"video games",
    "n-pref":"noun used as a prefix",
    "n-suf":"noun used as a suffix",
    "suf":"suffix",
    "hon":"honorific or respectful (sonkeigo) language",
    "biol":"biology",
    "pol":"polite (teineigo) language",
    "vulg":"vulgar expression or word",
    "v2n-s":"Nidan verb (lower class) with ぬ ending (archaic)",
    "mil":"military",
    "golf":"golf",
    "min":"mineralogy",
    "X":"rude or X-rated term (not displayed in educational software)",
    "sk":"search-only kana form",
    "jpmyth":"Japanese mythology",
    "sl":"slang",
    "fict":"fiction",
    "art":"art; aesthetics",
    "stat":"statistics",
    "cryst":"crystallography",
    "pathol":"pathology",
    "photo":"photography",
    "food":"food; cooking",
    "n":"noun",
    "thb":"Touhoku-ben",
    "fish":"fishing",
    "v5r-i":"Godan verb with る ending (irregular verb)",
    "arch":"archaic",
    "v1":"Ichidan verb",
    "bus":"business",
    "tv":"television",
    "euph":"euphemistic",
    "embryo":"embryology",
    "v2y-k":"Nidan verb (upper class) with ゆ ending (archaic)",
    "uk":"usually kana",
    "rare":"rare term",
    "v2a-s":"Nidan verb with う ending (archaic)",
    "hanaf":"hanafuda",
    "figskt":"figure skating",
    "agric":"agriculture",
    "given":"given name or forename. Gender not specified",
    "physiol":"physiology",
    "v5u-s":"Godan verb with う ending (special class)",
    "chn":"children's language",
    "ev":"event",
    "adv":"adverb",
    "prt":"particle",
    "vi":"intransitive verb",
    "v2y-s":"Nidan verb (lower class) with ゆ ending (archaic)",
    "kyb":"Kyoto-ben",
    "vk":"Kuru verb - special class",
    "grmyth":"Greek mythology",
    "vn":"irregular ぬ verb",
    "electr":"electronics",
    "gardn":"gardening; horticulture",
    "adj-kari":"'kari' adjective (archaic)",
    "vr":"irregular る verb; plain form ends with り",
    "vs":"Suru verb",
    "internet":"Internet",
    "vt":"transitive verb",
    "cards":"card games",
    "stockm":"stock market",
    "vz":"Ichidan verb - zuru verb (alternative form of -じる verbs)",
    "aux":"auxiliary",
    "v2h-s":"Nidan verb (lower class) with ふ ending (archaic)",
    "kyu":"Kyuushuu-ben",
    "noh":"noh",
    "econ":"economics",
    "rommyth":"Roman mythology",
    "ecol":"ecology",
    "n-t":"noun (temporal)",
    "psy":"psychiatry",
    "proverb":"proverb",
    "company":"company name",
    "poet":"poetical term",
    "ateji":"ateji (phonetic) reading",
    "paleo":"paleontology",
    "v2h-k":"Nidan verb (upper class) with ふ ending (archaic)",
    "civeng":"civil engineering",
    "go":"go (game)",
    "adv-to":"adverb taking the と particle",
    "ent":"entomology",
    "unc":"unclassified",
    "unclass":"unclassified name",
    "on-mim":"onomatopoeic",
    "yoji":"yojijukugo",
    "n-adv":"adverbial-noun",
    "print":"printing",
    "form":"formal or literary term",
    "obj":"object",
    "osb":"Osaka-ben",
    "adj-shiku":"'shiku' adjective (archaic)",
    "Christn":"Christianity",
    "hum":"humble language",
    "obs":"obsolete term",
    "relig":"religion",
    "iK":"word containing irregular kanji usage",
    "v2k-s":"Nidan verb (lower class) with く ending (archaic)",
    "conj":"conjunction",
    "v2s-s":"Nidan verb (lower class) with す ending (archaic)",
    "geol":"geology",
    "geom":"geometry",
    "anat":"anatomy",
    "nab":"Nagano-ben",
    "ski":"skiing",
    "hist":"historical term",
    "fam":"familiar language",
    "myth":"mythology",
    "gramm":"grammar",
    "v2k-k":"Nidan verb (upper class) with く ending (archaic)",
    "id":"idiomatic expression",
    "v5aru":"Godan verb ある (special class)",
    "psyanal":"psychoanalysis",
    "comp":"computing",
    "creat":"creature",
    "ik":"word containing irregular kana usage",
    "oth":"other",
    "v-unspec":"verb unspecified",
    "io":"irregular okurigana usage",
    "work":"work of art; literature; music",
    "adj-ix":"adjective - よい/いい class",
    "phil":"philosophy",
    "doc":"document",
    "math":"mathematics",
    "pharm":"pharmacology",
    "adj-nari":"archaic/formal form of な-adjective",
    "v2r-k":"Nidan verb (upper class) with る ending (archaic)",
    "adj-f":"noun or verb acting prenominally",
    "adj-i":"い-adjective",
    "audvid":"audiovisual",
    "rkb":"Ryuukyuu-ben",
    "adj-t":"taru-adjective",
    "v2r-s":"Nidan verb (lower class) with る ending (archaic)",
    "Buddh":"Buddhism",
    "biochem":"biochemistry",
    "v2b-k":"Nidan verb (upper class) with ぶ ending (archaic)",
    "vs-s":"suru verb (special class)",
    "surname":"family or surname",
    "physics":"physics",
    "place":"place name",
    "v2b-s":"Nidan verb (lower class) with ぶ ending (archaic)",
    "kabuki":"kabuki",
    "prowres":"professional wrestling",
    "product":"product name",
    "vs-c":"su verb precursor to the modern suru",
    "tsug":"Tsugaru-ben",
    "adj-ku":"'ku' adjective (archaic)",
    "telec":"telecommunications",
    "vs-i":"suru verb - included",
    "v2z-s":"Nidan verb (lower class) with ず ending (archaic)",
    "organization":"organization name",
    "char":"character",
    "engr":"engineering",
    "logic":"logic",
    "v2m-s":"Nidan verb (lower class) with む ending (archaic)",
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
    "v1-s":"Ichidan verb kureru (special class)",
    "v2m-k":"Nidan verb (upper class) with む ending (archaic)",
    "manga":"manga",
    "shogi":"shogi",
    "group":"group",
    "adj-no":"noun which may take the genitive case particle の",
    "adj-na":"な-adjective",
    "sens":"sensitive",
    "law":"law",
    "vet":"veterinary terms",
    "mahj":"mahjong",
    "v4b":"Yodan verb with ぶ ending (archaic)",
    "rail":"railway",
    "v4g":"Yodan verb with ぐ ending (archaic)",
    "elec":"electricity; elec. eng.",
    "film":"film",
    "mining":"mining",
    "v4h":"Yodan verb with ふ ending (archaic)",
    "v4k":"Yodan verb with く ending (archaic)",
    "v4m":"Yodan verb with む ending (archaic)",
    "v4n":"Yodan verb with ぬ ending (archaic)",
    "sumo":"sumo",
    "v4s":"Yodan verb with す ending (archaic)",
    "v4r":"Yodan verb with る ending (archaic)",
    "person":"full name of a particular person",
    "v4t":"Yodan verb with つ ending (archaic)",
    "boxing":"boxing",
    "oK":"word containing out-dated kanji or kanji usage",
    "cloth":"clothing",
    "joc":"jocular; humorous term",
    "politics":"politics",
    "v2t-k":"Nidan verb (upper class) with つ ending (archaic)",
    "tsb":"Tosa-ben",
    "v5b":"Godan verb with ぶ ending",
    "ling":"linguistics",
    "bot":"botany",
    "v2t-s":"Nidan verb (lower class) with つ ending (archaic)",
    "v5g":"Godan verb with ぐ ending",
    "med":"medicine",
    "v5k":"Godan verb with く ending",
    "mech":"mechanical engineering",
    "v5n":"Godan verb with ぬ ending",
    "v5m":"Godan verb with む ending",
    "v2d-k":"Nidan verb (upper class) with づ ending (archaic)",
    "v5r":"Godan verb with る ending",
    "v5t":"Godan verb with つ ending",
    "v5s":"Godan verb with す ending",
    "v5u":"Godan verb with う ending",
    "Shinto":"Shinto",
    "station":"railway station",
    "chmyth":"Chinese mythology",
    "dated":"dated term",
    "v2d-s":"Nidan verb (lower class) with づ ending (archaic)",
    "psych":"psychology",
    "adj-pn":"pre-noun adjectival",
    "ok":"out-dated or obsolete kana usage",
    "met":"meteorology",
    "chem":"chemistry",
    "sports":"sports",
    "zool":"zoology",
    "int":"interjection",
    "tradem":"trademark",
    "net-sl":"Internet slang",
    "n-pr":"proper noun",
    "archit":"architecture",
    "ksb":"Kansai-ben",
    "pn":"pronoun",
    "gikun":"gikun (meaning as reading) or jukujikun (special kanji reading)"
};
  