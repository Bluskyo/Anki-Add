const dbName = "jpdict";
const dbVersion = 1;
var db;

onmessage = function(message) {
  if (message.data === "start") {
    console.log("furigana-Worker: received message")
    openDB();
  }
}

function openDB() {
  console.log("furigana-Worker: openDB ...");
  
  var req = indexedDB.open(dbName, dbVersion);

  req.onsuccess = function (evt) {
    console.log("furigana-Worker: Connected to DB!");
    db = req.result;

    fetch("data/JmdictFurigana.json")
    .then(response => response.json())
    .then(json => {
      addFurigana(db, json);
    })
  }

  req.onerror = function (evt) {
    console.error("furigana-Worker: openDB:", evt.target.errorCode);
  };

  // innit db if needed.
  req.onupgradeneeded = function (evt) {
    console.error("furigana-Worker: openDB.onupgradeneeded!");
  };
}

function addFurigana(db, json) {
  console.log("furigana-Worker: Adding furigana data!")
  console.time('Execution Time'); // timer start

  const totalWords = Object.keys(json).length;

  let processedCount = 0;
  let notFoundCount = [];

  const objectStore  = db
  .transaction(["JMDict"], "readwrite")
  .objectStore("JMDict")

  const index = objectStore.index("kanjiIndex");

  for (const object of json) {
    const word = object.text;
    const request = index.get(word);

    request.onerror = (evt) => {
      console.log("furigana-Worker: Could not find:", word, "in db!");
      console.error("furigana-Worker: Error!:", evt.error);
    };
  
    request.onsuccess = (evt) => {
      const entry = request.result;
      const furigana = object.furigana;
      processedCount++;

      if (entry){
        entry.furigana = furigana;

        const updateRequest = objectStore.put(entry);

        updateRequest.onsuccess = () => {
          //console.log(`updated word! ${updateRequest.result}`)
        }

      } else {
        notFoundCount.push(word);
      }

      if (totalWords == processedCount){
        console.log("furigana-Worker: Furigana data added!");
        console.timeEnd('Execution Time'); // timer end 
        postMessage("done"); 
      }

    };
    
  }

}