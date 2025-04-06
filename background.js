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
        console.log("Word data:", request.result)
        resolve(request.result);
      } else {
        reject("Not found");
      }

    };
  
  });

}

// conjugations array is empty if non are found. 
// returns map wordclass: string, form:array, stem: string
function findConjugation(word){
  // works, needs refactoring...
  let inflection = [];
  let mutations = [];
  let lastMatch = word.length;

  let conjugationData = {
    wordClass : "",
    form: [],
    stem: "",
  };
  
  for (let i = word.length; i--;){
    inflection.unshift(word[i]); // pushes to front array to look up in dict
    if (i == word.length - 1){ // check for conjugations that cant have more conjugations. only 1 letter.
      const inflectionInfo = endInflection[inflection.join("")]; 

      // if theres a inflection matching save info 
      if (inflectionInfo) {
        console.log("found inflection:", inflectionInfo, "\non:", inflection);        
        conjugationData.form.push(inflectionInfo[0]);
        conjugationData.wordClass = inflectionInfo[1];
        conjugationData.stem = word; //.substring(0, word.length - 1);
        return conjugationData;
      } 
    }

    const inflectionInfo = inflections[inflection.join("")]; // join to look up in dict

    if (inflectionInfo) {
      console.log("found inflection:", inflectionInfo, "\non:", inflection);
      lastMatch = i; // save index of conjugation found
      if (!conjugationData.form.includes(inflectionInfo[0])) {
        conjugationData.form.push(inflectionInfo[0]);
      }
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
  console.log("forms found", conjugationData.form);

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
      dictonaryForm.push(stem.substring(-1, 1) + "ぶ");
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
  "て" : ["imperative", "verb"], 
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
  "なかった" : ["past", "verb"],
  "ました" : ["polite past", "verb"],
  "ませんでした" : ["polite", "verb"],
  "れば" : ["ba-form", "verb"],
  "なければ" : ["ba-form negative", "verb"],
  "たら" : ["tara-form", "verb"],
  "なかったら" : ["tara-form negative", "verb"],
  "なくて" : ["negative", "verb"],
  ////// ichidan  only ///// 
  "て" : ["te-form", "verb ichidan"],
  "られる" : ["potential/passive", "verb ichidan"], 
  "られ" : ["potential/passive", "verb ichidan"], 
  "させる" : ["causative", "verb ichidan"],
  "させれ" : ["causative", "verb ichidan"],
  "させ" : ["causative", "verb ichidan"],
  "させられる": ["causative-passive", "verb ichidan"],
  "させら": ["causative-passive", "verb ichidan"],
  ////// godan only /////
  "した" : ["past", "verb su"], 
  "いた" : ["past", "verb ku"], 
  "いだ" : ["past", "verb gu"], 
  "んだ" : ["past", "verb mu,bu,nu"], 
  "った" : ["past", "verb u,ru,tsu"], 

  "して" : ["te-form", "verb su"], 
  "いて" : ["te-form", "verb ku"], 
  "いで" : ["te-form", "verb gu"], 
  "んで" : ["te-form", "verb mu,bu,nu"],
  "って" : ["te-form", "verb u,ru,tsu"], 
  "れる" : ["potential", "verb"], 

  "せない" : ["potential", "verb su"], 
  "けない" : ["potential", "verb ku"], 
  "げない" : ["potential", "verb gu"], 
  "めない" : ["potential", "verb mu"], 
  "べない" : ["potential", "verb bu"], 
  "ねない" : ["potential", "verb nu"], 
  "えない" : ["potential", "verb u"], 
  "てない" : ["potential", "verb tsu"],
  "れない" : ["potential", "verb ru"], 

  //"られない" : ["potential negative", "verb ichidan"], // can be ru verb, but needs same ending.

  "れる" : ["passive", "verb"], 
  "れない" : ["passive", "verb"], 
  "せる" : ["causative", "verb"], 

  //"せない" : ["causative negative", "verb"], // ? させない

  "せられる" : ["causative passive", "verb"], 
  "せられ" : ["causative passive", "verb"], 
  "せられない" : ["causative passive", "verb"], 

  //"買え" : ["imperative", "verb"], // check ending can add to switch statement?

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
            const wordClass = conjugationData.wordClass; // i-adj/na-adj/ichidan/godan
            const stem = conjugationData.stem;
            let dictonaryForm = [];

            // in some conjugations verbs can immediately be identified as godan
            // if conjugation is more ambiguous runs the identifyVerb func. 
            switch(wordClass) {
              case "verb":
                dictonaryForm = identifyVerb(wordClass, conjugationData.form, stem);
                console.log("stem:", stem);
                console.log(dictonaryForm);
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
          }

        }

      } else if (message.action === "getData"){
        return wordData;
      }        

    return true; // keeps the response channel open for async func
    
  });

});
