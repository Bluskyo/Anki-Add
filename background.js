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
        console.log("Word data:", request.result)
        resolve(request.result);
      } else {
        reject("Not found");
      }

    };
  
  });

}

// returns map: wordclass: string, form: array, stem: string
function findConjugation(word){
  let conjugationData = {
    wordClass : "",
    form: "",
    stem: "",
  };

  // check for conjugations that cant have more conjugations. only 1 letter.
  const endInflectionInfo = endInflection[word.substring(word.length - 1)]; 

  if (endInflectionInfo) {
    console.log("found inflection:", endInflectionInfo);        
    conjugationData.form.push(endInflectionInfo[0]);
    conjugationData.wordClass = endInflectionInfo[1];
    conjugationData.stem = word;
    return conjugationData;
  } 

  let inflection = []; // keeps track of current letter in word.
  let lastAttempt = []; // stores lastMatch for comparing at the end of loop.
  let lastMatch = []; // conjugations found (pushed at the end of the word)

  for (let i = word.length; i--;){
    inflection.unshift(word[i]);
    let inflectionInfo = inflections[inflection.join("")];

    if (inflectionInfo) {
      lastMatch.push(inflection.join("")); // save current inflection, can be longer, so pushed on end of word.
    } 

    if (i === 0) {
      if (lastAttempt[lastAttempt.length - 1] == lastMatch[lastMatch.length - 1]){ // finds that match is already attempted, breaks to avoid loops.
        conjugationData.stem = inflection.join(""); // rest of string has no conjugations found and have to be stem.
        console.log("forms deteted:", conjugationData.form);
        return conjugationData;
      } else {
        const index = word.indexOf(lastMatch[lastMatch.length - 1]);
        const length = lastMatch[lastMatch.length - 1].length;

        inflectionInfo = inflections[word.substring(index, index + length)]; // find substring of inflection in word

        // if ta is detected after past is already found is stem! HOW TO FIX?
        if (!conjugationData.form.includes(inflectionInfo[0])){
          conjugationData.form = inflectionInfo[0]; //  add form to array of current forms found
          conjugationData.wordClass = inflectionInfo[1]; // update wordclass to current wordclass.
        }

        console.log("found inflection:", inflectionInfo, "\non:", word.substring(index, index + length));

        lastAttempt.push(lastMatch[lastMatch.length - 1]); // update lastAttempt to avoid infinte loop.
        i = index; // go back to last known index where a inflection was found
        inflection = []; // clear inflection for finding new potential inflections.
      }
    }

  }


  return conjugationData;  
}

function identifyVerb(wordclass, form, stem){
  let dictonaryForm = []; // some verbs have same ending, can result in up to 3 possiable endings

  const endHiragana = stem.slice(-1);

  switch(endHiragana) {
    case "わ":
    case "い":
    case "え":
      dictonaryForm.push(stem.substring(-1, 1) + "う");
      break;
    case "た":
    case "ち":  
    case "て": 
      dictonaryForm.push(stem.substring(-1, 1) + "つ");
      break;
    case "ら":
    case "り":
    case "れ":     
      dictonaryForm.push(stem.substring(-1, 1) + "る");
      break;
    case "ば":
    case "び":
    case "べ":
      if (wordclass.includes("potential")){ // check
        dictonaryForm.push(stem.substring(-1, 1) + "ぶ");
      } else {
        dictonaryForm.push(stem + "る");
      }
      break;
    case "ま":
    case "み":
    case "べ":
      dictonaryForm.push(stem.substring(-1, 1) + "む");
      break;
    case "か":
    case "き":
    case "け":
      dictonaryForm.push(stem.substring(-1, 1) + "く");
      break;
    case "が":
    case "ぎ":
    case "げ":
      dictonaryForm.push(stem.substring(-1, 1) + "ぐ");
      break;
    case "さ":
    case "し":
    case "せ":
      dictonaryForm.push(stem.substring(-1, 1) + "す");
      break;
    case "な":
    case "に":
    case "ね":
      dictonaryForm.push(stem.substring(-1, 1) + "ぬ");
      break;
    default:
      dictonaryForm.push(stem + "る");
      break;
  } 

  return dictonaryForm;
}

// inflections that doesnt have any more conjugations.
const endInflection = {
  "な" : ["imperative negative", "verb-done"], // negative from with na removed is dictonary form
  "ろ" : ["imperative", "verb ichidan"], 
  "せ" : ["imperative", "verb"], 
  "け" : ["imperative", "verb"], 
  "げ" : ["imperative", "verb"], 
  "め" : ["imperative", "verb"], 
  "べ" : ["imperative", "verb"], 
  "ね" : ["imperative", "verb"], 
  "え" : ["imperative", "verb"], 
  "れ" : ["imperative", "verb"], 
  "さ" : ["objective-form", "i-adj"], 
  "く" : ["adverbial", "i-adj"], 
  "に" : ["adverbial", "na-adj"], 
};

const inflections = {
  /////  verbs /////  
  "ない" : ["negative", "verb"],
  "ます" : ["polite", "verb"],
  "ません" : ["polite negative", "verb"],
  "た" : ["past", "verb"],
  "なかった" : ["past negative", "verb"],
  "ました" : ["polite past", "verb"],
  "ませんでした" : ["polite past", "verb"],
  "れば" : ["ba-form", "verb"],
  "なければ" : ["ba-form negative", "verb"],
  "たら" : ["tara-form", "verb"],
  "なかったら" : ["tara-form negative", "verb"],
  "なくて" : [" te-form negative", "verb"],
  ////// ichidan  only ///// 
  "て" : ["te-form", "verb ichidan"], /// te issue
  "られる" : ["potential/passive", "verb ichidan"], 
  "られ" : ["potential/passive", "verb ichidan"], 
  "させる" : ["causative", "verb ichidan"],
  "させ" : ["causative", "verb ichidan"],
  "させられる": ["causative-passive", "verb ichidan"],
  "させられ": ["causative-passive", "verb ichidan"],
  ////// godan only /////
  //"した" : ["past", "verb su"], 
  //"いた" : ["past", "verb ku"], 
  //"いだ" : ["past", "verb gu"], 
  //"んだ" : ["past", "verb mu,bu,nu"], 
  "った" : ["past", "verb u,ru,tsu"], 
  //"して" : ["te-form", "verb su"], 
  //"いて" : ["te-form", "verb ku"], 
  //"いで" : ["te-form", "verb gu"], 
  //"んで" : ["te-form", "verb mu,bu,nu"],
  //"って" : ["te-form", "verb u,ru,tsu"], 
  //"れる" : ["potential", "verb"], 
  //"せない" : ["potential", "verb su"], 
  //"けない" : ["potential", "verb ku"], 
  //"げない" : ["potential", "verb gu"], 
  //"めない" : ["potential", "verb mu,bu,nu"], 
  //"べない" : ["potential", "verb mu,bu,nu"], 
  //"ねない" : ["potential", "verb mu,bu,nu"], 
  //"えない" : ["potential", "verb u,ru,tsu"], 
  //"てない" : ["potential", "verb u,ru,tsu"],
  //"れない" : ["potential", "verb u,ru,tsu"], 
  //"られない" : ["potential", "verb ichidan"], // can be ru verb, but needs same ending.
  //"れる" : ["passive", "verb"], 
  //"れない" : ["passive", "verb"], 
  //"せる" : ["causative", "verb"], 
  //"せない" : ["causative negative", "verb"], // させな ?
  //"せられる" : ["causative passive", "verb"], 
  //"せられ" : ["causative passive", "verb"], 
  //"せられない" : ["causative passive", "verb"], 
  //"て" : ["imperative", "verb"], // clashes with te form. needs additional check. /// ichidan te form and tsu verb clash
  ////// i-adjective only /////  
  "くない" : ["negative", "i-adj"],
  "かった" : ["past", "i-adj"],
  "くなかった" : ["negative", "i-adj"],
  "くて" : ["te-form", "i-adj"],
  "くなくて" : ["negative", "i-adj"],
  "ければ" : ["provisional-form", "i-adj"],
  "くなければ" : ["provisional-form negative", "i-adj"],
  "かったら" : ["conditional", "i-adj"],
  "くなかったら" : ["conditional negative", "i-adj"],
  "くなきゃ" : ["conditional negative (colloquial)", "i-adj"],
  /////  na-adjective/noun only /////  
  "じゃない" : ["negative", "na-adj"],
  "だった" : ["past", "na-adj"],
  "じゃなかった" : ["negative past", "na-adj"]
};

// refactor lookup should happen in background script.
openDb().then(() => {
  let wordData;
  const savedInfo = new Map();

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    switch(message.action){
      case "saveSelection":
        savedInfo.set("selectedText", message.text);
        savedInfo.set("sentence", ""); // clears sentence from previous sentence.
        savedInfo.set("savedURL", message.url);
  
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
            const wordClass = conjugationData.wordClass; // i-adj/na-adj/ichidan/godan
            const stem = conjugationData.stem;
            let dictonaryForm = [];
  
            // in some conjugations verbs can immediately be identified as godan
            // if conjugation is more ambiguous runs the identifyVerb func. 
            switch(wordClass) {
              case "verb":
                dictonaryForm = identifyVerb(wordClass, conjugationData.form, stem);
                break;
              case "verb ichidan":
                if(conjugationData.form.includes("imperative")){
                  dictonaryForm.push(stem.substring(0, word.length - 1) + "る");
                } else dictonaryForm.push(stem + "る");
                break;
              case "verb mu,bu,nu":
                dictonaryForm.push(
                  stem.substring(-1, 1) + "む", 
                  stem.substring(-1, 1) + "ぶ", 
                  stem.substring(-1, 1) + "ぬ");
                break;
              case "verb u,ru,tsu":
                dictonaryForm.push(
                  stem.substring(-1, 1) + "う", 
                  stem.substring(-1, 1) + "る", 
                  stem.substring(-1, 1) + "つ");
                break;
              case "i-adj":
                dictonaryForm.push(stem + "い");
                break;
              case "verb-done":
                dictonaryForm.push(stem.substring(0, word.length - 1));
                break;
              case "na-adj":
              case "noun":
  
            }
  
            // finds first match covers edge cases like "mu,bu,nu" with same endings.
            for (const dictform of dictonaryForm){
              let result = await lookupInDb(dictform, "kanjiIndex").catch((err) => { console.error(err) });
  
              if (result){
                return wordData = result;
              } 
            }
  
            // cant find conjugation.
            return wordData = null;
          }
        } else {
          let result = await lookupInDb(word, "readingIndex");
          if (result){
            return wordData = result;
          } else {
            return wordData = null;
          }}
      case "getData":
        return wordData;
      case "getSavedInfo":
        return savedInfo;
      case "getAllData":
        return [wordData, savedInfo];
      case "saveSentence":
        savedInfo.set("sentence", message.text);
        return true;
      case "saveDeck":
        savedInfo.set("savedDeck", message.text);
        return true;
    }

    return true; // keeps the response channel open for async func
    
  });

});
