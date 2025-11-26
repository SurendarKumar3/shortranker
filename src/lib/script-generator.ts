/**
 * AI Script Generation Module for ShortsRanker
 * 
 * Generates natural YouTube/narration style scripts for ranking videos.
 * Supports template-based generation with optional LLM polishing via Hugging Face.
 */

// ============================================================================
// Types
// ============================================================================

export interface RankingItem {
  rank: number;
  titleOrName: string;
  description?: string;
}

export interface ScriptOptions {
  topic?: string;
  style?: "energetic" | "casual" | "professional";
  includeEmojis?: boolean;
  useLLM?: boolean; // If true and HF API key is set, polish with LLM
}

export interface ScriptResult {
  script: string;
  wasPolished: boolean;
  wordCount: number;
  estimatedDuration: number; // seconds
}

// ============================================================================
// Configuration
// ============================================================================

const SCRIPT_CONFIG = {
  // Speaking rate for duration estimation (words per minute)
  wordsPerMinute: 150,
  
  // Hugging Face API endpoint for text generation
  huggingFaceAPI: "https://api-inference.huggingface.co/models",
  
  // Default model for text generation (free tier compatible)
  defaultModel: "mistralai/Mistral-7B-Instruct-v0.2",
  
  // Fallback models if primary is unavailable
  fallbackModels: [
    "HuggingFaceH4/zephyr-7b-beta",
    "google/flan-t5-large",
  ],
};

// ============================================================================
// Template-Based Script Generation
// ============================================================================

/**
 * Generate a ranking script from ranking data
 * 
 * @param rankingData - Array of items with rank, title, and description
 * @param topic - Optional topic for context (e.g., "gaming clips", "best goals")
 * @returns ScriptResult with the generated script
 */
export async function generateRankingScript(
  rankingData: RankingItem[],
  topic?: string,
  options: ScriptOptions = {}
): Promise<ScriptResult> {
  const {
    style = "energetic",
    includeEmojis = true,
    useLLM = false,
  } = options;
  
  // Sort by rank descending (5, 4, 3, 2, 1)
  const sortedData = [...rankingData].sort((a, b) => b.rank - a.rank);
  
  // Generate base script from template
  let script = generateTemplateScript(sortedData, topic || options.topic, style, includeEmojis);
  
  // Optionally polish with LLM
  let wasPolished = false;
  if (useLLM && process.env.HUGGINGFACE_API_KEY) {
    try {
      const polishedScript = await polishScriptWithLLM(script, topic);
      if (polishedScript) {
        script = polishedScript;
        wasPolished = true;
      }
    } catch (error) {
      console.warn("LLM polishing failed, using template script:", error);
    }
  }
  
  const wordCount = script.split(/\s+/).length;
  const estimatedDuration = Math.ceil((wordCount / SCRIPT_CONFIG.wordsPerMinute) * 60);
  
  return {
    script,
    wasPolished,
    wordCount,
    estimatedDuration,
  };
}

/**
 * Generate script using templates (no external API required)
 */
function generateTemplateScript(
  items: RankingItem[],
  topic?: string,
  style: "energetic" | "casual" | "professional" = "energetic",
  includeEmojis: boolean = true
): string {
  const topicText = topic ? ` ${topic}` : " clips";
  const emoji = includeEmojis;
  
  // Select intro based on style
  const intro = getIntro(topicText, style, emoji);
  
  // Generate ranking sections
  let rankingSections = "";
  for (const item of items) {
    const rankIntro = getRankIntro(item.rank, style, emoji);
    const description = item.description?.trim() 
      ? item.description 
      : getDefaultDescription(item.rank, item.titleOrName, style);
    
    rankingSections += `\n\n${rankIntro}\n${description}`;
  }
  
  // Select outro based on style
  const outro = getOutro(style, emoji);
  
  return intro + rankingSections + outro;
}

/**
 * Get intro text based on style
 */
function getIntro(
  topicText: string, 
  style: "energetic" | "casual" | "professional",
  emoji: boolean
): string {
  const intros = {
    energetic: [
      `What's up everyone! ${emoji ? "🔥" : ""} Welcome back to the channel. Today we're counting down the top 5${topicText} that absolutely blew our minds. Let's get into it!`,
      `Hey there! ${emoji ? "👋" : ""} You're about to see the most incredible${topicText} ranked from number 5 all the way to number 1. Trust me, you don't want to miss the top spot!`,
      `Welcome to today's countdown! ${emoji ? "🎬" : ""} We've got 5 amazing${topicText} to show you, and I guarantee number 1 will leave you speechless. Let's go!`,
    ],
    casual: [
      `Hey, what's going on? So today I'm ranking the top 5${topicText}. Let's see what we've got.`,
      `Alright, so I put together my top 5${topicText} for you. Let me know if you agree with this list.`,
      `Hey everyone. Today we're looking at my top 5${topicText}. Some of these might surprise you.`,
    ],
    professional: [
      `Welcome. Today we present a curated selection of the top 5${topicText}, ranked for your consideration.`,
      `In this presentation, we'll be examining the top 5${topicText}, carefully selected and ranked.`,
      `Thank you for joining us. Today's countdown features the top 5${topicText} in our collection.`,
    ],
  };
  
  const options = intros[style];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get rank introduction text
 */
function getRankIntro(
  rank: number, 
  style: "energetic" | "casual" | "professional",
  emoji: boolean
): string {
  const energeticIntros: Record<number, string[]> = {
    5: [
      `${emoji ? "🔹" : ""} Kicking things off at number 5...`,
      `${emoji ? "🔹" : ""} Starting our countdown at number 5, we have...`,
      `${emoji ? "🔹" : ""} Coming in at number 5 to get us started...`,
    ],
    4: [
      `${emoji ? "🔸" : ""} Moving up to number 4...`,
      `${emoji ? "🔸" : ""} At number 4, things are heating up...`,
      `${emoji ? "🔸" : ""} Sliding into the number 4 spot...`,
    ],
    3: [
      `${emoji ? "🥉" : ""} Now we're getting serious! At number 3...`,
      `${emoji ? "🥉" : ""} The bronze medal goes to number 3...`,
      `${emoji ? "🥉" : ""} Claiming the number 3 spot...`,
    ],
    2: [
      `${emoji ? "🥈" : ""} So close to the top! At number 2...`,
      `${emoji ? "🥈" : ""} The runner-up at number 2...`,
      `${emoji ? "🥈" : ""} Just barely missing the top spot, at number 2...`,
    ],
    1: [
      `${emoji ? "🥇" : ""} And finally, the moment you've been waiting for! Number 1 is...`,
      `${emoji ? "🥇" : ""} The undisputed champion at number 1...`,
      `${emoji ? "🥇" : ""} Taking the crown at number 1, we have...`,
    ],
  };
  
  const casualIntros: Record<number, string[]> = {
    5: ["At number 5...", "Starting off at 5...", "Kicking us off..."],
    4: ["Number 4...", "Moving to 4...", "At 4 we have..."],
    3: ["Now at number 3...", "The 3 spot goes to...", "Coming in at 3..."],
    2: ["Almost at the top, number 2...", "Just missing first, at 2...", "The runner-up..."],
    1: ["And number 1...", "Taking the top spot...", "My number 1 pick..."],
  };
  
  const professionalIntros: Record<number, string[]> = {
    5: ["Beginning at position five...", "In fifth position...", "Our fifth entry..."],
    4: ["At position four...", "Moving to fourth place...", "Fourth in our ranking..."],
    3: ["In third position...", "Our bronze placement...", "At number three..."],
    2: ["In second position...", "Our silver placement...", "Taking second place..."],
    1: ["Our top selection...", "In first position...", "The leading entry..."],
  };
  
  const intros = style === "energetic" ? energeticIntros : 
                 style === "casual" ? casualIntros : professionalIntros;
  
  const options = intros[rank] || [`At number ${rank}...`];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get default description for a rank
 */
function getDefaultDescription(
  rank: number, 
  title: string,
  style: "energetic" | "casual" | "professional"
): string {
  const cleanTitle = title.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  
  const energeticDescriptions: Record<number, string[]> = {
    5: [
      `This one kicks off our list perfectly. ${cleanTitle} sets the bar high right from the start!`,
      `A solid entry to begin our countdown. ${cleanTitle} shows us what we're working with!`,
    ],
    4: [
      `Now we're talking! ${cleanTitle} really impressed us and earned this spot.`,
      `Things are getting better. ${cleanTitle} brings the heat at number 4!`,
    ],
    3: [
      `This is where it gets competitive. ${cleanTitle} is absolutely top-tier content!`,
      `On the podium at number 3! ${cleanTitle} definitely deserves this recognition.`,
    ],
    2: [
      `So incredibly close to the top! ${cleanTitle} is absolutely phenomenal. Any other day, this could've been number 1!`,
      `The runner-up is no joke. ${cleanTitle} had us on the edge of our seats!`,
    ],
    1: [
      `The champion! ${cleanTitle} blew everything else out of the water. This is peak content right here!`,
      `Absolutely unbeatable! ${cleanTitle} earned this spot and then some. Simply incredible!`,
    ],
  };
  
  const casualDescriptions: Record<number, string[]> = {
    5: [`${cleanTitle} is a good starting point.`, `Solid pick with ${cleanTitle}.`],
    4: [`${cleanTitle} is really good.`, `I liked ${cleanTitle} a lot.`],
    3: [`${cleanTitle} is excellent.`, `Really impressed by ${cleanTitle}.`],
    2: [`${cleanTitle} almost took the top spot.`, `So close! ${cleanTitle} is amazing.`],
    1: [`${cleanTitle} is my favorite.`, `Had to give it to ${cleanTitle}. The best!`],
  };
  
  const professionalDescriptions: Record<number, string[]> = {
    5: [`${cleanTitle} demonstrates notable qualities that merit inclusion.`],
    4: [`${cleanTitle} exhibits commendable attributes worthy of recognition.`],
    3: [`${cleanTitle} stands out with exceptional merit and quality.`],
    2: [`${cleanTitle} presents outstanding characteristics, narrowly missing first.`],
    1: [`${cleanTitle} exemplifies the highest standard in this category.`],
  };
  
  const descriptions = style === "energetic" ? energeticDescriptions :
                       style === "casual" ? casualDescriptions : professionalDescriptions;
  
  const options = descriptions[rank] || [`An impressive entry that deserves recognition.`];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get outro text based on style
 */
function getOutro(style: "energetic" | "casual" | "professional", emoji: boolean): string {
  const outros = {
    energetic: [
      `\n\nAnd that wraps up our top 5! ${emoji ? "🙌" : ""} If you enjoyed this countdown, smash that like button and subscribe for more content like this. Drop a comment below telling me which one was YOUR favorite. See you in the next one!`,
      `\n\nThere you have it, folks! The ultimate top 5. ${emoji ? "💯" : ""} Did your favorite make the list? Let me know in the comments! Don't forget to like and subscribe if you want more countdowns. Peace!`,
      `\n\nWhat a list! ${emoji ? "🔥" : ""} If you made it this far, you're a real one. Hit that subscribe button and turn on notifications so you never miss a countdown. Until next time!`,
    ],
    casual: [
      `\n\nSo that's my top 5. Let me know in the comments what you think. See you next time.`,
      `\n\nThat's the list. Would love to hear your thoughts. Thanks for watching.`,
      `\n\nAnd that's it! Hope you enjoyed. Leave a comment with your picks.`,
    ],
    professional: [
      `\n\nThis concludes our presentation of the top 5 selections. We welcome your feedback and comments.`,
      `\n\nThank you for your attention. We hope you found this ranking informative and engaging.`,
      `\n\nThis concludes our ranking. We appreciate your viewership and welcome your perspectives.`,
    ],
  };
  
  const options = outros[style];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================================================
// LLM Integration (Hugging Face)
// ============================================================================

/**
 * Polish/paraphrase script using Hugging Face Inference API
 * This is optional and requires HUGGINGFACE_API_KEY environment variable
 */
async function polishScriptWithLLM(
  baseScript: string,
  topic?: string
): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  const prompt = buildPolishPrompt(baseScript, topic);
  
  // Try primary model, then fallbacks
  const models = [SCRIPT_CONFIG.defaultModel, ...SCRIPT_CONFIG.fallbackModels];
  
  for (const model of models) {
    try {
      const response = await fetch(
        `${SCRIPT_CONFIG.huggingFaceAPI}/${model}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 1500,
              temperature: 0.7,
              top_p: 0.9,
              do_sample: true,
              return_full_text: false,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.text();
        console.warn(`Model ${model} unavailable:`, errorData);
        continue; // Try next model
      }
      
      const data = await response.json();
      const generatedText = Array.isArray(data) 
        ? data[0]?.generated_text 
        : data?.generated_text;
      
      if (generatedText && generatedText.length > 100) {
        return cleanLLMOutput(generatedText);
      }
    } catch (error) {
      console.warn(`Error with model ${model}:`, error);
      continue;
    }
  }
  
  return null; // All models failed
}

/**
 * Build prompt for LLM script polishing
 */
function buildPolishPrompt(baseScript: string, topic?: string): string {
  const topicContext = topic ? ` about ${topic}` : "";
  
  return `<s>[INST] You are a professional YouTube script writer. Rewrite the following countdown video script${topicContext} to make it more engaging and natural-sounding while keeping the same structure and information. Keep the same ranking order and general content, but improve the flow and add personality.

Original script:
${baseScript}

Rewritten script: [/INST]`;
}

/**
 * Clean up LLM output
 */
function cleanLLMOutput(text: string): string {
  // Remove any instruction artifacts
  let cleaned = text
    .replace(/<\/?s>/g, "")
    .replace(/\[INST\]|\[\/INST\]/g, "")
    .replace(/^(Rewritten script:|Here's|Here is)[:\s]*/i, "")
    .trim();
  
  // Ensure it starts with a proper opening
  if (!cleaned.match(/^(What|Hey|Welcome|Alright|Hi|Hello)/i)) {
    // Find the first sentence that looks like an intro
    const introMatch = cleaned.match(/(What|Hey|Welcome|Alright|Hi|Hello)[^.!?]*[.!?]/i);
    if (introMatch) {
      const introIndex = cleaned.indexOf(introMatch[0]);
      if (introIndex > 0) {
        cleaned = cleaned.substring(introIndex);
      }
    }
  }
  
  return cleaned;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate script duration in seconds
 * Based on typical speaking rate of 150 words per minute
 */
export function estimateScriptDuration(script: string): number {
  const wordCount = script.split(/\s+/).length;
  return Math.ceil((wordCount / SCRIPT_CONFIG.wordsPerMinute) * 60);
}

/**
 * Split script into segments by rank (useful for timing with video segments)
 */
export function splitScriptByRank(script: string): {
  intro: string;
  ranks: { rank: number; text: string }[];
  outro: string;
} {
  const lines = script.split("\n\n");
  const intro = lines[0] || "";
  const outro = lines[lines.length - 1] || "";
  
  const ranks: { rank: number; text: string }[] = [];
  
  for (let i = 1; i < lines.length - 1; i++) {
    const text = lines[i];
    // Try to extract rank number
    const rankMatch = text.match(/number\s*(\d)|#(\d)|position\s*(\d)|(\d)\s*spot/i);
    if (rankMatch) {
      const rank = parseInt(rankMatch[1] || rankMatch[2] || rankMatch[3] || rankMatch[4]);
      if (rank >= 1 && rank <= 5) {
        ranks.push({ rank, text });
      }
    }
  }
  
  return { intro, ranks, outro };
}
