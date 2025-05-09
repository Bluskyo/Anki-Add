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

    fetch("data/jmdict-eng-3.6.1.json")
    .then(response => response.json())
    .then(json => {
      addJMdict(db, json.words);
    })

  };
}

function addJMdict(db, json) {
 const transaction = db.transaction(["JMDict"], "readwrite");
 const store = transaction.objectStore("JMDict");

  transaction.oncomplete = (evt) => {
    console.log("Worker: Everything is added to indexedDB!");
    console.timeEnd('Execution Time'); // timer end 

    fetch("data/JLPTWords.json")
    .then(response => response.json())
    .then(json => {
     // start adding additional data to dictonary (jlpt/furigana)
      addJLPTLevel(db, json);

      const furiganaWorker = new Worker("furiganaWorker.js");
      furiganaWorker.postMessage("start");
      furiganaWorker.onmessage = function(message) {
        if (message.data == "done") {
          console.log("Worker: furigana-Worker DONE")
        }
      }

    })
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
      sense: word.sense.map(entry => entry)
    };

    store.add(wordEntry); // id is automatically chosen as id.
  })

}

function addJLPTLevel(db, json) {
  console.log("Worker: Adding JLPT levels!")
  console.time('Execution Time'); // timer start

  const totalWords = Object.keys(json).length;

  let processedCount = 0;
  let notFoundCount = [];

  const objectStore  = db
  .transaction(["JMDict"], "readwrite")
  .objectStore("JMDict")

  for (const word in json) {  
    const kanjiRe = /[一-龯]/;
    const containsKanji = kanjiRe.test(word);
    let index;

    if (containsKanji){
      index = objectStore.index("kanjiIndex");
    } else {
      index = objectStore.index("readingIndex");
    }

    const request = index.get(word);

    request.onerror = (evt) => {
      console.log("Could not find:", word, "in db!");
      console.error("Error!:", evt.error);
    };
  
    request.onsuccess = (evt) => {
      const entry = request.result;
      processedCount++;

      if (entry){
        const indexName = index.name;
        // some words have different levels 
        // on the word in hiragana and kanji
        if (entry.JLPT_Levels){
          entry.JLPT_Levels.push({ [indexName]:json[word] });
        } else {
          entry.JLPT_Levels = [{ [indexName]:json[word] }];
        }

        const updateRequest = objectStore.put(entry);
        updateRequest.onsuccess = () => {
          //console.log(`updated word! ${updateRequest.result}`)
        }

      } else {
        //console.log("could not find entry!")
        notFoundCount.push(word);
      }

      if (totalWords == processedCount){
        console.log("Worker: JLPT levels added!");
        console.timeEnd('Execution Time'); // timer end 
        postMessage("done"); 
      }

    };
    
  }

}