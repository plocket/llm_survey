/** For each llm, calculate the consistency between different
 * versions of each response */

const fs = require('fs');
const readline = require('readline');
const path = require('path');


let debug = false;

function run() {
  /** Calculate the consistency of every model. */

  let prompt_data = [ get_prompt_data() ];
  const prompt1_models = prompt_data[0].models;
  // Add consistency scores
  for ( let model of prompt1_models ) {

    if (model.name === `gpt-3.5-turbo` ) { debug = true; }
    else { debug = false; }

    model.consistency = compare(model);
    // console.log(`${model.name} consistency:`, model.consistency);
  }

  prompt1_models.sort(function (a, b) { return b.consistency - a.consistency })
  for ( let model of prompt1_models ) {
    console.log(`${model.name} consistency:`, model.consistency);
  }

}


function get_prompt_data() {
  /** Get the relevant json data for each model */

  // Construct the path to the JSONL file
  // Assuming the file is in the parent directory of the current working directory
  const current_working_directory = process.cwd();
  const filePath = path.join(current_working_directory, 'llm_log.jsonl');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  console.log(`num lines:`, lines.length);

  // With a .jsonl file, we have to read the file line by line
  let prompt = 'todo';
  let models = [];
  lines.forEach((line, index) => {
    if (line.trim() === '') return; // Skip empty lines

    try {
      // Get just the data we need
      const modelData = JSON.parse(line);
      // console.log(modelData);
      models.push({
        name: modelData.model,
        responses: modelData.messages
      });
    } catch (parseErr) {
      console.error(`Error parsing JSON (line ${index + 1}):`, parseErr);
    }
  });

  console.log(`Finished getting data for the models. Number of models:`, models.length);
  return { prompt, models };
};


function compare (model) {
  // Only compare adjacent models. NP complete issues otherwise?

  // Get difference consistency
  let diffs_sum = 0;
  let num_diffs = 1;
  // Get similarity consistency
  let sames_sum = 0;
  let nums_same = 1;
  // console.log(model);
  // .responses are ["messages"]
  for ( let resp_i = 0; resp_i < model.responses.length; resp_i++ ) {
    const resp1 = model.responses[ resp_i ];
    // Compare last to first
    const resp2 = model.responses[ resp_i + 1 ] || model.responses[0];

    // "assistant" is the llm response, "user" is the prompt
    if (resp1["role"] !== "assistant") {
      continue; // Skip this loop
    }

    let { important_words1, important_words2 } = remove_common_words(resp1.content, resp2.content);
    let { unique1, unique2 } = get_internally_unique_words(important_words1, important_words2);

    let diffs_ratio = get_diffs_ratio(unique1, unique2);
    diffs_sum += diffs_ratio;
    num_diffs += 1;

    let sames_ratio = get_sames_ratio(unique1, unique2);
    sames_sum += sames_ratio;
    nums_same += 1;
  }

  const avg_diff = diffs_sum / num_diffs;
  let diff_consistency = 1 - avg_diff;

  const sames_consistency = sames_sum / nums_same;

  // Combine those somehow?
  const consistency = (diff_consistency + sames_consistency) / 2; // (sames_consistency) // (diff_consistency) // diff_consistency + sames_consistency or... // (diff_consistency + sames_consistency) / 2;
  return consistency;
}


function get_diffs_ratio(words1, words2) {
  /** Get the difference between response 1 and response 2.
   *
   * Expects 2 arrays of strings. */
  // const { diffs1, diffs2 } = get_diffs(words1, words2);
  const diffs1 = words1.filter(word => !words2.includes(word));
  const diffs2 = words1.filter(word => !words2.includes(word));
  if ( debug ) {
    console.log(`diffs1:`, JSON.stringify(diffs1, null, 2), `diffs2:`, JSON.stringify(diffs2, null, 2));
  }
  return (diffs1.length + diffs2.length) / (words1.length + words2.length);
}


function get_sames_ratio(words1, words2) {
  /** Get the difference between response 1 and response 2.
   *
   * Expects 2 arrays of strings. */
  const sames1 = words1.filter(word => words2.includes(word));
  const sames2 = words1.filter(word => words2.includes(word));
  if ( debug ) {
    console.log(`sames1:`, sames1, `sames2:`, sames2);
  }
  return (sames1.length + sames2.length) / (words1.length + words2.length);
}


// To remove common words
// https://stackoverflow.com/a/23303099
let stopWords1 = ["a", "able", "about", "across", "after", "all", "almost", "also", "am", "among", "an", "and", "any", "are", "as", "at", "be", "because", "been", "but", "by", "can", "cannot", "could", "dear", "did", "do", "does", "either", "else", "ever", "every", "for", "from", "get", "got", "had", "has", "have", "he", "her", "hers", "him", "his", "how", "however", "i", "if", "in", "into", "is", "it", "its", "just", "least", "let", "like", "likely", "may", "me", "might", "most", "must", "my", "neither", "no", "nor", "not", "of", "off", "often", "on", "only", "or", "other", "our", "own", "rather", "said", "say", "says", "she", "should", "since", "so", "some", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "tis", "to", "too", "twas", "us", "wants", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "yet", "you", "your", "ain't", "aren't", "can't", "could've", "couldn't", "didn't", "doesn't", "don't", "hasn't", "he'd", "he'll", "he's", "how'd", "how'll", "how's", "i'd", "i'll", "i'm", "i've", "isn't", "it's", "might've", "mightn't", "must've", "mustn't", "shan't", "she'd", "she'll", "she's", "should've", "shouldn't", "that'll", "that's", "there's", "they'd", "they'll", "they're", "they've", "wasn't", "we'd", "we'll", "we're", "weren't", "what'd", "what's", "when'd", "when'll", "when's", "where'd", "where'll", "where's", "who'd", "who'll", "who's", "why'd", "why'll", "why's", "won't", "would've", "wouldn't", "you'd", "you'll", "you're", "you've"];
// https://github.com/fergiemcdowall/stopword/blob/d6b2d8a7619c6c25b6e43547f5063f8ca83a8eb9/dist/stopword.cjs.js#L2708
stopWords1.concat([ "another", "before", "being", "between", "both", "came", "come", "each", "here", "himself", "make", "many", "more", "much", "never", "now", "out", "over", "same", "still", "such", "take", "those", "through", "under", "up", "very", "way", "well" ])
// It's faster if you create the regex just once
let stopWordsRegex = new RegExp(/\b(?:the|it is|we all|an?|by|to|you|[mh]e|she|they|we...)\b/, `ig`)

function remove_common_words(resp1, resp2) {
  /** Expects 2 strings, returns object with 2 strings */
  return {
    important_words1: resp1.replace(stopWordsRegex, ''),
    important_words2: resp2.replace(stopWordsRegex, ''),
  }
}

function get_internally_unique_words(words1, words2) {
  /** Expects 2 strings, returns object with 2 arrays */
  // Split the passages into arrays of words
  const words1_list = words1.split(/\W/);
  const words2_list = words2.split(/\W/);

  // Make each list unique
  return {
    unique1: Array.from(new Set(words1_list)),
    unique2: Array.from(new Set(words2_list)),
  }
}


function get_diffs(uniqueWords1, uniqueWords2) {
  /** Expects 2 arrays of strings, returns an object with 2 ints. */

    // For both, get all the words in what that is not in the other

    // // Not supported by node
    // let diff1 = uniqueWords1.difference(uniqueWords2);
    // let diff2 = uniqueWords2.difference(uniqueWords1);
    // Supported by node
    let diffs1 = uniqueWords1.filter(word => !uniqueWords2.includes(word));
    let diffs2 = uniqueWords2.filter(word => !uniqueWords1.includes(word));

    return { diffs1, diffs2 };
    // // console.log( 'diff', diff1, diff2 );

    // // console.log(`size1:`, uniqueWords1.size, `diff1_size:`, diff1.length)

    // // Return the counts of unique words in both passages (for both meanings of the word here)
    // return {
    //     // size1: uniqueWords1.size,
    //     // size2: uniqueWords2.size,
    //     diff1_size: diff1.length,
    //     diff2_size: diff2.length
    // };
}





run();