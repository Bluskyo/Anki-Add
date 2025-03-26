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
};

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

};
// ----

function lookupInDb(word, index){
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error("Database is not initialized yet!");
      reject("Database not initialized");
      return;
    }
  
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
        resolve(request.result);
      } else {
        reject("Not found");
      }

    };
  
  });

};

const kanjiRe = /[一-龯]/

openDb().then(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveSelection") {
      browser.storage.local.set({
          selectedText: message.text,
          sentence: "", // clears sentence from previous sentence.
          savedURL: message.url
      });
      sendResponse({ status: "success" }); // avoids "Promised response from onMessage listener went out of scope".

    } else if (message.action === "lookupWord") {
      
      const containsKanji = kanjiRe.test(message.text);

      // optimistic search:

      // if search doesnt first time, its not a noun, therefore can start finding out if word is adj or verb 
      if (containsKanji){
        lookupInDb(message.text, "kanjiIndex")
        .then((result) => {
          console.log("Result from DB:", result);
          if (result){
            sendResponse({ data: result });
          } else {
            sendResponse({ data: null });
          };
        }).catch((error) => {
          console.error(error);
          sendResponse({ data: null });
        });
      } else {
        lookupInDb(message.text, "readingIndex")
        .then((result) => {
          console.log("Result from DB:", result);
          if (result){
            sendResponse({ data: result });
          } else {
            sendResponse({ data: null });
          };
        }).catch((error) => {
          console.error(error);
          sendResponse({ data: null });
        });

      }
    }

    return true; // keeps the response channel open for async func
    
  });

});

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
    "さ" : "objective-form",
    // i-adjectives: く　-> い remove rest to find stem.
    "く" : "adverbial",
    "くない" : "negative",
    "かった" : "past",
    "くなかった" : "past negative",
    "くて" : "te-form",
    "くなくて" : "te-form negative",
    "ければ" : "provisional-form",
    "くなければ" : "provisional-form negative",
    "かったら" : "conditional",
    "くなかったら" : "conditional negative",
    "くなきゃ" : "conditional negative (colloquial)",
    // noun, na-adjectives: remove these to find stem 
    "に" : "adverbial",
    "じゃない" : "negative",
    "だった" : "past",
    "じゃなかった" : "negative"
};