const dbName = "jpdict";
const dbVersion = 1;
var db;

function openDB() {
  console.log("openDB ...");
  
  var req = indexedDB.open(dbName, dbVersion);

  req.onsuccess = function (evt) {
    console.log("openDB DONE");
    db = req.result;
  };

  req.onerror = function (evt) {
    console.error("openDB:", evt.target.errorCode);
    reject(evt.target.errorCode);
  };

  // innit db if needed.
  req.onupgradeneeded = function (evt) {
    console.error("openDB.onupgradeneeded hit in background script!");
  }

};

function lookupInDb(word, index) {
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

async function findDictonaryForm(word, dbIndex) {
  const conjugationData = findConjugations(word);
  const wordClass = conjugationData.wordClass; // i-adj/na-adj/ichidan/godan
  const stem = conjugationData.stem;
  let dictonaryForm = [];

  // in some conjugations verbs can immediately be identified as godan
  // if conjugation is more ambiguous runs the identifyVerb func. 
  switch(wordClass) {
    case "verb":
      dictonaryForm = identifyVerb(stem);
      break;
    case "ichidan": 
      dictonaryForm.push(stem.substring(0, word.length - 1) + "る");
      break;
    case "verb mu,bu,nu":
      dictonaryForm.push(
        stem + "む", 
        stem + "ぶ", 
        stem + "ぬ");
      break;
    case "verb u,ru,tsu":
      dictonaryForm.push(
        stem + "う", 
        stem + "る", 
        stem + "つ");
      break;
    case "verb ichidan,su":
      dictonaryForm.push(
        stem + "る", 
        stem + "す");
      break;
      // in these conjugations the modified trailing gana is in the detected string.
      // therefore the stem is already found only need default gana. 
    case "verb su": 
      dictonaryForm.push(stem + "す");
      break;
    case "verb ku":
      dictonaryForm.push(stem + "く");
      break;
    case "verb gu":
      dictonaryForm.push(stem + "ぐ");
      break;
    case "verb mu":
      dictonaryForm.push(stem + "む");
      break;
    case "verb bu":
      dictonaryForm.push(stem + "ぶ");
      break;
    case "verb nu":
      dictonaryForm.push(stem + "ぬ");
      break;
    case "verb u":
      dictonaryForm.push(stem + "う");
      break;
    case "verb ru":
      dictonaryForm.push(stem + "る");
      break;
    case "verb tsu":
      dictonaryForm.push(stem + "つ");
      break;
    case "i-adj":
      dictonaryForm.push(stem + "い");
      break;
    case "verb-done":
      dictonaryForm.push(stem.substring(0, word.length - 1));
      break;
    case "na-adj":
  }

  // finds first match covers edge cases like "mu,bu,nu" with same endings.
  for (const dictform of dictonaryForm){
    let result = await lookupInDb(dictform, dbIndex).catch((err) => { console.error(err) });

    if (result){
      wordData = result;
      wordData.forms = conjugationData.form;
      return wordData = result;
    } 
  }
  
  // some verbs like 食べる will be matched to bu verb, this checks for such cases.
  // likly that the conjugation name found is wrong/able to be determined. 
  // some checks to try to correct these.
  const ruVerb = stem + "る";
  let result = await lookupInDb(ruVerb, dbIndex).catch((err) => { console.error(err) })
  if (result){
    wordData = result;
    wordData.forms = conjugationData.form
    
    if (wordData.forms[0] == "imperative"){
      wordData.forms[0] = "て-form"
      return wordData;
    }

    return wordData;
  }

  // cant find conjugation.
  console.log("couldnt find word!");
  return wordData = null;
  
}

function identifyVerb(stem) {
  let dictonaryForm = []; // some verbs have same ending, can result in up to 3 possiable endings

  const endHiragana = stem.slice(-1);
  const hiraganaRE = /[ぁ-ゟ]/
  const isHiragana = hiraganaRE.test(endHiragana);
  let removeTrailGana = 0;

  if (isHiragana) {
    removeTrailGana += 1;
  }

  switch(endHiragana) {
    case "わ":
    case "い":
    case "え":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "う");
      break;
    case "た":
    case "ち":  
    case "て": 
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "つ");
      break;
    case "ら":
    case "り":
    case "れ":   
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "る");
      break;
    case "ば":
    case "び":
    case "べ":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "ぶ");
      break;
    case "ま":
    case "み":
    case "べ":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "む");
      break;
    case "か":
    case "き":
    case "け":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana)+ "く");
      break;
    case "が":
    case "ぎ":
    case "げ":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "ぐ");
      break;
    case "さ":
    case "し":
    case "せ":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "す");
      break;
    case "な":
    case "に":
    case "ね":
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "ぬ");
      break;
    default:
      dictonaryForm.push(stem.substring(0, stem.length - removeTrailGana) + "る");
      break;
  } 

  return dictonaryForm;
}

// returns map: wordclass: string, form: array, stem: string
function findConjugations(word) {
  let conjugationData = {
    wordClass : "",
    form: [],
    stem: "",
  };

  // check for conjugations that cant have more conjugations. only 1 letter.
  const endInflectionInfo = endInflection[word.substring(word.length - 1)]; 

  if (endInflectionInfo) {
    console.log("found end inflection:", endInflectionInfo);   
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
        console.log("WordClass detected:", conjugationData.wordClass);
        console.log("forms deteted:", conjugationData.form);
        console.log("stem deteted:", conjugationData.stem);
        return conjugationData;
      } else {
        const index = word.indexOf(lastMatch[lastMatch.length - 1]);
        const length = lastMatch[lastMatch.length - 1].length;

        inflectionInfo = inflections[word.substring(index, index + length)]; // find substring of inflection in word

        // if ta is detected after past is already found is stem! HOW TO FIX?
        if (!conjugationData.form.includes(inflectionInfo[0])){
          conjugationData.form.push(inflectionInfo[0]); //  add form to array of current forms found
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
        throw error;
    }) 
}

// inflections that doesnt have any more conjugations.
const endInflection = {
  "な" : ["imperative negative", "verb-done"], // negative from with na removed is dictonary form
  "ろ" : ["imperative", "ichidan"], 
  "せ" : ["imperative", "verb su"], 
  "け" : ["imperative", "verb ku"], 
  "げ" : ["imperative", "verb gu"], 
  "め" : ["imperative", "verb mu"], 
  "べ" : ["imperative", "verb bu"], 
  "ね" : ["imperative", "verb nu"], 
  "え" : ["imperative", "verb u"], 
  "れ" : ["imperative", "verb ru"], 
  "さ" : ["noun-form", "adj"], // can be na adj
  "く" : ["adverbial", "i-adj"], 
  "に" : ["adverbial", "na-adj"], 
  "ず" : ["ず-form", "verb"], 
};

const inflections = {
  "よう" : ["volitional", "ichidan"],
  ///// ambigous endings (can be ichidan or godan) /////  
  "ない" : ["negative", "verb"],
  "ます" : ["polite", "verb"],
  "ません" : ["polite negative", "verb"],
  "た" : ["past", "verb"],
  "なかった" : ["past negative", "verb"],
  "ました" : ["polite past", "verb"],
  "ませんでした" : ["polite past negative", "verb"],
  "れば" : ["ば-conditional", "verb"],
  "なければ" : ["ば-conditional negative", "verb"],
  "たら" : ["たら-conditional", "verb"],
  "なかったら" : ["たら-conditional negative", "verb"],
  "なくて" : ["て-form negative", "verb"],
  "られる" : ["potential/passive", "verb"], // ru verb and ichidan
  "られない": ["potential/passive negative", "verb"], 
  "られなかった" : ["potential/passive negative past", "verb"], 
  "られ" : ["potential/passive", "verb"], //
  "て" : ["imperative", "verb tsu"], // can also be ichidan in te form, correct conjugation form after.
  "させる" : ["causative", "verb ichidan,su"], // ichidan or su verb, only stem remains in these conjugations.
  "させない" : ["causative negative", "verb ichidan,su"], 
  "させられる": ["causative-passive", "verb ichidan,su"], 
  "させられない": ["causative-passive negative", "verb ichidan,su"], 
  "たい": ["たい-form", "verb"],
  "たく": ["たい-form", "verb"],
  "ている": ["continuous", "verb"],
  "てる": ["continuous", "verb"],
  "てた": ["continuous", "verb"],
  "ましょう" : ["volitional polite", "verb"],
  "しまう" : ["てしまう-form", "verb"],
  "しまいます" : ["てしまう-form polite", "verb"],
  "しまった" : ["てしまう-form past", "verb"],
  "ちゃう" : ["てしまう-form", "verb"],
  "ちゃった" : ["てしまう-form past", "verb"],
  ////// godan only /////
  "たない" : ["negative", "verb tsu"],
  "たなかった" : ["past negative", "verb tsu"],
  "たなくて" : ["て-form negative", "verb tsu"],
  "した" : ["past", "verb su"], 
  "いた" : ["past", "verb ku"], 
  "いだ" : ["past", "verb gu"], 
  "んだ" : ["past", "verb mu,bu,nu"], 
  "った" : ["past", "verb u,ru,tsu"], 
  "して" : ["て-form", "verb su"], 
  "いて" : ["て-form", "verb ku"], 
  "いで" : ["て-form", "verb gu"], 
  "んで" : ["て-form", "verb mu,bu,nu"],
  "って" : ["て-form", "verb u,ru,tsu"], 
  // hard coded. 
  // the matching is too small if only け for example is used.
  // leading to alot of false positives.
  "ける": ["potential", "verb ku"],
  "けない": ["potential negative", "verb ku"],
  "げる": ["potential", "verb gu"],
  "げない": ["potential negative", "verb gu"],
  "める": ["potential", "verb mu"],
  "めない": ["potential negative", "verb mu"],
  "べる": ["potential", "verb bu"],
  "べない": ["potential negative", "verb bu"],
  "ねる": ["potential", "verb nu"],
  "ねない": ["potential negative", "verb nu"],
  "える": ["potential", "verb u"],
  "えない": ["potential negative", "verb u"],
  "てる": ["potential", "verb tsu"],
  "てない": ["potential negative", "verb tsu"],
  "れる": ["potential", "verb ru"],
  "れない": ["potential/passive negative", "verb"], 
  //
  "かれる": ["passive", "verb ku"],
  "かれ": ["passive", "verb ku"],
  "がれる": ["passive", "verb gu"],
  "がれ": ["passive", "verb gu"],
  "まれる": ["passive", "verb mu"],
  "まれ": ["passive", "verb mu"],
  "ばれる": ["passive", "verb bu"],
  "ばれ": ["passive", "verb bu"],
  "なれる": ["passive", "verb nu"],
  "なれ": ["passive", "verb nu"],
  "われる": ["passive", "verb u"],
  "われ": ["passive", "verb u"],
  "たれる": ["passive", "verb tsu"],
  "たれ": ["passive", "verb tsu"],
  "かせる": ["causative", "verb ku"],
  "かせ": ["causative", "verb ku"],
  "がせる": ["causative", "verb gu"],
  "がせ": ["causative", "verb gu"],
  "ませる": ["causative", "verb mu"],
  "ませ": ["causative", "verb mu"],
  "ばせる": ["causative", "verb bu"],
  "ばせ": ["causative", "verb bu"],
  "なせる": ["causative", "verb nu"],
  "なせ": ["causative", "verb nu"],
  "わせる": ["causative", "verb u"],
  "わせ": ["causative", "verb u"],
  "たせる": ["causative", "verb tsu"],
  "たせ": ["causative", "verb tsu"],
  "らせる": ["causative", "verb ru"],
  "らせ": ["causative", "verb ru"],
  "かせられる": ["causative-passive", "verb ku"],
  "かせられ": ["causative-passive", "verb ku"],
  "がせられる": ["causative-passive", "verb gu"],
  "がせられ": ["causative-passive", "verb gu"],
  "ませられる": ["causative-passive", "verb mu"],
  "ませられ": ["causative-passive", "verb mu"],
  "ばせられる": ["causative-passive", "verb bu"],
  "ばせられ": ["causative-passive", "verb bu"],
  "なせられる": ["causative-passive", "verb nu"],
  "なせられ": ["causative-passive", "verb nu"],
  "わせられる": ["causative-passive", "verb u"],
  "わせられ": ["causative-passive", "verb u"],
  "たせられる": ["causative-passive", "verb tsu"],
  "たせられ": ["causative-passive", "verb tsu"],
  "らせられる": ["causative-passive", "verb ru"],
  "らせられ": ["causative-passive", "verb ru"],
  "こう": ["volitional", "verb ku"],
  "ごう": ["volitional", "verb gu"],
  "もう": ["volitional", "verb mu"],
  "ぼう": ["volitional", "verb bu"],
  "のう": ["volitional", "verb nu"],
  "おう": ["volitional", "verb u"],
  "とう": ["volitional", "verb tsu"],
  "ろう": ["volitional", "verb ru"],
  ////// i-adjective only /////
  "くない" : ["negative", "i-adj"],
  "かった" : ["past", "i-adj"],
  "くなかった" : ["negative", "i-adj"],
  "くて" : ["て-form", "i-adj"],
  "くなくて" : ["て-form negative", "i-adj"],
  "ければ" : ["ければ-conditional", "i-adj"],
  "くなければ" : ["ければ-conditional negative", "i-adj"],
  "かったら" : ["たら-conditional", "i-adj"],
  "くなかったら" : ["たら-conditional negative", "i-adj"],
  "くなきゃ" : ["たら-conditional negative (colloquial)", "i-adj"],
  /////  na-adjective/noun only /////  
  "じゃない" : ["negative", "na-adj"],
  "だった" : ["past", "na-adj"],
  "じゃなかった" : ["negative past", "na-adj"]
};

let wordData = null;
let ankiData = {};

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch(message.action){
    case "saveSelection":
      ankiData.selectedText = message.text;
      ankiData.sentence = message.sentence; // clears sentence from previous sentence.
      ankiData.savedURL = message.url;

      const word = message.text;
      const kanjiRe = /[一-龯]/;
      const containsKanji = kanjiRe.test(word);

      // optimistic search:
      if (containsKanji){
        const result = await lookupInDb(word, "kanjiIndex").catch((err) => { console.error(err) });
        
        if (result){
          wordData = result;
        } else {
          // optimistic search failed word has a conjugation.
          const conjugationSearch =  await findDictonaryForm(word, "kanjiIndex");
          if (!conjugationSearch){
            return wordData = null;;
          }
        }
      } else {
        const result = await lookupInDb(word, "readingIndex").catch((err) => { console.error(err) });

        if (result){
          wordData = result;
        } else {
          // optimistic search failed word has a conjugation.
          const conjugationSearch =  await findDictonaryForm(word, "readingIndex");
          if (!conjugationSearch){
            return wordData = null;;
          }
        }
      }
      // fetch audio for pronunciation
      const audioFileName = await invoke("storeMediaFile", 6, {
        "url": `https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kanji=${wordData.kanji[0]}&kana=${wordData.kana[0]}`,
        "filename": `ankiAdd_${wordData.kanji[0]}_${wordData.kana[0]}.mp3`,
        "skipHash": "7e2c2f954ef6051373ba916f000168dc",
      })
      wordData.audioFileName = audioFileName;

      return wordData;
    
    case "getData":
      return wordData;
    case "getSavedInfo":
      return ankiData;
    case "getAllData":
      return [wordData, ankiData];
    case "saveSentence":
      ankiData.sentence = message.text;
      return true;
    case "saveDeck":
      ankiData.savedDeck =  message.text;
      return true;
    case "dbStatus":
      return dbIsPopulated;
  }

  return true; // keeps the response channel open for async func
});

let dbIsPopulated = false; 
const JMdictWorker = new Worker("innitDBWorker.js");

JMdictWorker.postMessage("start");
JMdictWorker.onmessage = function(message) {
  if (message.data == "done") {
    dbIsPopulated = true;
    openDB();
  }
}
