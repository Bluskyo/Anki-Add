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
      reject("Not found");
    };
  
    request.onsuccess = (evt) => {
      browser.storage.local.set({ jmdictSeq: request.result.id });
      resolve(request.result);
    };
  
  });

};

const kanjiRe = /[一-龯]/

openDb().then(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveSelection") {
      browser.storage.local.set({
          selectedText: message.text,
          savedURL: message.url
      });
    } else if (message.action === "lookupWord") {
      
      const containsKanji = kanjiRe.test(message.text);

      // optimistic search:
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
