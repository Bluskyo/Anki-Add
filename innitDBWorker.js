const dbName = "jpdict";
const dbVersion = 1;
var db;

onmessage = function(message) {
  if (message.data === "start") {
    console.log("Worker: received message")
    openDB();
  }
}

function openDB() {
  console.log("Worker: openDB ...");
  
  var req = indexedDB.open(dbName, dbVersion);

  req.onsuccess = function (evt) {
    console.log("Worker: Connected to DB!");
    db = req.result;
    const transaction = db.transaction(["JMDict"], "readonly");
    const store = transaction.objectStore("JMDict");
    const countRequest  = store.count();
  
    countRequest.onsuccess = () => {
      if (countRequest.result > 0) {
        console.log("Worker: DB is already populated!");
        postMessage("done"); 
      }
    }
  }

  req.onerror = function (evt) {
    console.error("Worker: openDB:", evt.target.errorCode);
  };

  // innit db if needed.
  req.onupgradeneeded = function (evt) {
    console.log("Worker: openDB.onupgradeneeded");
    db = evt.target.result;

    var store = db.createObjectStore(
      "JMDict", { keyPath: 'id', autoIncrement: false }
    );

    store.createIndex("kanjiIndex", "kanji", { unique: false, multiEntry: true });
    store.createIndex("readingIndex", "kana", { unique: false, multiEntry: true });
    store.createIndex('meaningIndex', 'sense', { unique: false, multiEntry: true });

    fetch("data/jmdictExtended.json")
    .then(response => response.json())
    .then(json => {
      innitJMdict(db, json.words);
    })

  };
}

function innitJMdict(db, json) {
 const transaction = db.transaction(["JMDict"], "readwrite");
 const store = transaction.objectStore("JMDict");

  // parsing complete
  transaction.oncomplete = (evt) => {
    console.log("Worker: Everything is added to indexedDB!");
    console.timeEnd('Execution Time'); // timer end 
    postMessage("done");
  };

  transaction.onerror = (evt) => {
    console.error("Worker: Something went wrong!");
  };

  console.time('Execution Time'); // timer start
  console.log("Worker: Reading dictfile...");
  json.forEach(word => {
    const wordEntry = {
      id: word.id, // use existing ID
      kanji: word.kanji.map(entry => entry.text), 
      kanjiCommon: word.kanji.map(entry => entry.common), 
      kana: word.kana.map(entry => entry.text),  
      kanaCommon: word.kana.map(entry => entry.common),   
      sense: word.sense.map(entry => entry),
    };

    if (word.jlptLevel){
      wordEntry.jlptLevel = word.jlptLevel.map(entry => entry);
    }

    if (word.furigana){
      wordEntry.furigana = word.furigana;
    }

    store.add(wordEntry); // id is automatically chosen as id.
  })

}