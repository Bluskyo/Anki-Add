const dbName = "jpdict";
const dbVersion = 1;
var db;

// innit
function openDb() {
  return new Promise((resolve, reject) => {
    console.log("openDb ...");
    
    var req = indexedDB.open(dbName, dbVersion);

    req.onsuccess = function (evt) {
      console.log("openDb DONE");
      db = req.result;
      //browser.storage.local.set({selectedText: "Highlight a word to lookup information!"});
      resolve(db);
    };

    req.onerror = function (evt) {
      console.error("openDb:", evt.target.errorCode);
      reject(evt.target.errorCode);
    };

    // innit db if needed.
    req.onupgradeneeded = function (evt) {
      console.log("openDb.onupgradeneeded");

      var store = evt.currentTarget.result.createObjectStore(
        "JMDict", { keyPath: 'id', autoIncrement: false }
      );

      store.createIndex("kanjiIndex", "kanji", { unique: false, multiEntry: true });
      store.createIndex("readingIndex", "kana", { unique: false, multiEntry: true });
      store.createIndex('meaningIndex', 'sense', { unique: false, multiEntry: true });

      const db = evt.target.result;

      console.log("Reading dictfile...");
      fetch("data/jmdict-eng-3.6.1.json")
      .then(response => response.json())
      .then(json => {
        addDataToDb(db, json.words);
      });
    }
  
  });
}

function addDataToDb(db, json){
 const transaction = db.transaction(["JMDict"], "readwrite");
 const store = transaction.objectStore("JMDict");

 transaction.oncomplete = (evt) => {
  console.timeEnd('Execution Time'); // timer end 
  console.log("Everything is added to indexedDB!");
 };

 transaction.onerror = (evt) => {
  console.log("Something went wrong!");
 };

 console.time('Execution Time'); // timer start
  json.forEach(word => {

    const wordEntry = {
      id: word.id, // Use existing ID
      kanji: word.kanji.map(entry => entry.text), 
      kanjiCommon: word.kanji.map(entry => entry.common), 
      kana: word.kana.map(entry => entry.text),  
      kanaCommon: word.kana.map(entry => entry.common),   
      sense: word.sense.map(entry => entry)
    };

    store.add(wordEntry); // id is automatically chosen as id.
  })

}
// ----

async function lookupInDb(word, index){
  return new Promise((resolve, reject) => {  
    console.log("looking up word:", word);
  
    const request = db
    .transaction(["JMDict"], "readonly")
    .objectStore("JMDict")
    .index(index)
    .get(word);
  
    request.onerror = (evt) => {
      console.log("Could not find:", word, "in db!");
      console.error("Error!:", evt.error);
      reject("Not found");
    };
  
    request.onsuccess = (evt) => {
      if(request.result) {
        browser.storage.local.set({ jmdictSeq: request.result.id });
        console.log(request.result)
        resolve(request.result);
      } else {
        reject("Not found");
      }

    };
  
  });

}

function findConjugation(word){
  // works, needs refactoring...
  let inflection = [];
  let mutations = [];
  let lastMatch = word.length;

  let conjugationData = {
    wordClass : "",
    form: "",
    stem: "",
  };

 // let result = []

  for (let i = word.length; i--;){
    inflection.unshift(word[i]); // pushes to front array to look up in dict
    const inflectionInfo = inflections[inflection.join("")]; // join to look up in dict

    // if theres a inflection matching save info 
    if (inflectionInfo) {
      console.log("found inflection:", inflectionInfo, "\non:", inflection);
      lastMatch = i; // save index of conjugation found
      conjugationData.form += inflectionInfo[0] + " ";
      conjugationData.wordClass = inflectionInfo[1];
    } else if (i <= 0 && !inflectionInfo) {
      if (mutations.includes(lastMatch)){
        conjugationData.stem = inflection.join("");
        console.log("found stem:", inflection.join(""));
      } else {
        mutations.push(lastMatch);
        i = lastMatch;
        inflection = [];
      }
    }

  }

  console.log(conjugationData);

  // could not find conjugation
  if (conjugationData.wordClass.length == 0){
    return {};
  }

  return conjugationData;  

}

function identifyVerb(wordclass, stem){
  let dictonaryForm = "";

  const endHiragana = stem.slice(-1);
  switch(endHiragana) {
    case "わ":
    case "い":
      dictonaryForm = stem.substring(-1, 1) + "う"
      break;
    case "た":
    case "ち":  
      dictonaryForm = stem.substring(-1, 1) + "つ"
      break;
    case "ら":
    case "り":
      dictonaryForm = stem.substring(-1, 1) + "る"
      break;
    case "ば":
    case "び":
      dictonaryForm = stem.substring(-1, 1) + "ぶ"
      break; 
    case "ま":
    case "み":
      dictonaryForm = stem.substring(-1, 1) + "む"
      break; 
    case "か":
    case "き":
      dictonaryForm = stem.substring(-1, 1) + "く"
      break; 
    case "が":
    case "ぎ":
      dictonaryForm = stem.substring(-1, 1) + "ぐ"
      break; 
    case "さ":
    case "し":
      dictonaryForm = stem.substring(-1, 1) + "す"
      break; 
    case "な":
    case "に":
    dictonaryForm = stem.substring(-1, 1) + "ぬ"
      break;

  }

  return dictonaryForm
}

const inflections = {
  ////// ichidan /////
  "ない" : ["negative", "verb"],
  "ます" : ["polite", "verb"],
  "ません" : ["polite negative", "verb"],
  //"た" : ["past", "verb"], Works bad with godan
  "なかった" : ["past negative", "verb"],
  "ました" : ["polite past", "verb"],
  "ませんでした" : ["polite negative", "verb"],
  "て" : ["te-form", "verb"],
  "なくて" : ["te-form negative", "verb"],
  "られる" : ["potential/passive", "verb"], 
  "られ" : ["potential/passive", "verb"], 
  "られない" : ["potential/passive negative", "verb"],
  "させる" : ["causative", "verb"],
  "させれ" : ["causative", "verb"],
  "させない" : ["causative negative", "verb"],
  "させられる": ["causative-passive", "verb"],
  "させらない": ["causative-passive negative", "verb"],
  "ろ" : ["imperative", "verb"],
  "な" : ["imperative negative", "verb"],
  "れば" : ["conditional ba-form", "verb"],
  "なければ" : ["conditional ba-form negative", "verb"],
  "たら" : ["conditional tara-form", "verb"],
  "なかったら" : ["conditional tara-form negative", "verb"],
  ////// godan only/////
  // just have to try and lookup all possiable 2-3 endings after finding word ends with んだ
  // exceptions past:
  // する 	した
  // くる 	きた
  // 行く 行った
  "した" : ["past", "verb"], 
  "いた" : ["past", "verb"], 
  "いだ" : ["past", "verb"], 
  "んだ" : ["past", "verb"], 
  "った" : ["past", "verb"], 
  // teforms
  // exceptions past:
  // する 	して
  // くる 	きて
  // 行く 行って
  "って" : ["te-form", "verb"], 
  "いて" : ["te-form", "verb"], 
  "して" : ["te-form", "verb"], 
  "いで" : ["te-form", "verb"], 
  "んで" : ["te-form", "verb"], 
  // can just redirect all endings of a stem? 持ち 持っ 持っ ending just to つ?
  // imperative form affermative just changes hiragana. what do?
  

};

const adjFormNames = {
  // i-adjectives: く -> い remove rest to find stem.
  "さ" : ["objective-form", "i-adj"],
  "く" : ["adverbial", "i-adj"],
  "くない" : ["negative", "i-adj"],
  "かった" : ["past", "i-adj"],
  "くなかった" : ["past negative", "i-adj"],
  "くて" : ["te-form", "i-adj"],
  "くなくて" : ["te-form negative", "i-adj"],
  "ければ" : ["provisional-form", "i-adj"],
  "くなければ" : ["provisional-form negative", "i-adj"],
  "かったら" : ["conditional", "i-adj"],
  "くなかったら" : ["conditional negative", "i-adj"],
  "くなきゃ" : ["conditional negative (colloquial)", "i-adj"],
  // na-adjectives/nouns
  "に" : ["adverbial", "na-adj"],
  "じゃない" : ["negative", "na-adj"],
  "だった" : ["past", "na-adj"],
  "じゃなかった" : ["negative past", "na-adj"]
};

// refactor lookup should happen in background script.
openDb().then(() => {
  let wordData;

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "saveSelection") {
      browser.storage.local.set({
          selectedText: message.text,
          sentence: "", // clears sentence from previous sentence.
          savedURL: message.url
      });
      
        const word = message.text;
        const kanjiRe = /[一-龯]/;
        const containsKanji = kanjiRe.test(word);

        // optimistic search:
        if (containsKanji){

          let result = await lookupInDb(word, "kanjiIndex").catch((err) => { console.error(err) });

          if (result){
            return wordData = result;
          } else {
            // optimistic search failed word has a conjugation.
            const conjugationData = findConjugation(word);
            if (conjugationData.length <= 0) { // couldnt find conjugation
              return wordData = null;
            }
            const wordClass = conjugationData.wordClass; // i-adj/na-adj/ichidan/godan
            let stem = conjugationData.stem

            switch(wordClass) {
              case "verb":
                const dictonaryForm = identifyVerb(wordClass, stem)
                stem = dictonaryForm;
                //stem += "る";
                break;
              case "i-adj":
                stem += "い";
                break;
              case "na-adj":
              case "noun":
            }

            let result = await lookupInDb(stem, "kanjiIndex").catch((err) => { console.error(err) });

            if (result){
              return wordData = result;
            } else {
              return wordData = null;
            }
          }
        } else {
          let result = await lookupInDb(word, "readingIndex");

          if (result){
            return wordData = result;
          } else {
            return wordData = null;
          }
        }


      } else if (message.action === "getData"){
        //console.log("getting data:", wordData)
        return wordData;
      }        

    return true; // keeps the response channel open for async func
    
  });

});
