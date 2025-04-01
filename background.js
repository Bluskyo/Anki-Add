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

function identifyWord(word){
  // works, needs refactoring...
  let inflection = [];
  let mutations = [];
  let lastHit = word.length;

  let result = []

  for (let i = word.length; i--;){
    inflection.unshift(word[i]); // pushes to front array to look up in dict
    const value = adjFormNames[inflection.join("")]; // join to look up in dict

    if (value) {
      console.log("found inflection:", value, "\non:", inflection);
      lastHit = i; // save index of conjugation found
      if (!result.includes(value[1])){
        result.push(value[1])
      }
    } else if (i <= 0 && !value) {
      if (mutations.includes(lastHit)){
        result.push(inflection.join(""));
        console.log("found stem:", inflection.join(""));
        break;
      } else {
        mutations.push(lastHit);
        i = lastHit;
        inflection = [];
      }
    }

  }

  // could not find conjugation
  if (result.length == 0){
    return [];
  }

  console.log(result)

  return result;  // array [0: wordclass 1: stem]

}

const formNames = {
  "ない" : "negative",
  "ます" : "polite",
  "ません" : "polite negative",
  "た" : ["past", "verb"], // multiple
  "なかった" : ["past negative", "verb"],
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

const adjFormNames = {
   // adjectives:
   "さ" : ["objective-form", "i-adj"],
   // i-adjectives: く -> い remove rest to find stem.
   "く" : ["adverbial", "i-adj"],
   "くない" : ["negative", "i-adj"],
   "かった" : ["past", "i-adj"],
   "くなかった" : ["past negative", "i-adj"],
   "くて" : ["te-form", "i-adj"],
   "くなくて" : ["te-form negative", "i-adj"],
 
   // verbs can also have:
   "ければ" : ["provisional-form", "i-adj"],
   "くなければ" : ["provisional-form negative", "i-adj"],
   "かったら" : ["conditional", "i-adj"],
   "くなかったら" : ["conditional negative", "i-adj"],
   "くなきゃ" : ["conditional negative (colloquial)", "i-adj"],
   //
 
   "に" : ["adverbial", "na-adj"],
   "じゃない" : ["negative", "na-adj"],
   "だった" : ["past", "na-adj"],
   "じゃなかった" : ["negative past", "na-adj"]
}

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
            const conjugationData = identifyWord(word);
            if (conjugationData.length <= 0) { // couldnt find conjugation
              return wordData = null;
            }
            const wordClass = conjugationData[0]; // i-adj/na-adj/ichidan/godan
            let stem = conjugationData[1]

            switch(wordClass) {
              case "i-adj":
                stem += "い";
              case "na-adj":
              case "noun":
            }

            let result = await lookupInDb(stem, "kanjiIndex").catch((err) => { console.error(err) });

            if (result){
              wordData = result;
            } else {
              wordData = null;
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
        console.log("getting data:", wordData)
        return wordData;
      }        

    return true; // keeps the response channel open for async func
    
  });

});
