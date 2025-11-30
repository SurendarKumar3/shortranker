/**
 * Text-to-Speech (TTS) Service Module for ShortsRanker
 * 
 * Provides a pluggable TTS interface that can be swapped between:
 * - Mock (silent audio for testing)
 * - Hugging Face Inference API (free)
 * - ElevenLabs (premium, requires API key)
 * - Coqui TTS (local, requires Python setup)
 * 
 * The module handles long texts by splitting and concatenating audio.
 */

import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface TTSOptions {
  voice?: string;
  speed?: number; // 0.5 to 2.0
  pitch?: number; // 0.5 to 2.0
}

export interface TTSResult {
  audioPath: string;
  duration: number; // estimated in seconds
  service: string;
}

export type TTSService = "mock" | "huggingface" | "elevenlabs" | "coqui";

// ============================================================================
// Configuration
// ============================================================================

const TTS_CONFIG = {
  // Temp directory for audio files (use OS temp dir for cross-platform)
  tempDir: path.join(os.tmpdir(), "shorts-ranker", "tts"),
  
  // Maximum characters per TTS request (to handle rate limits)
  maxCharsPerChunk: 1000,
  
  // Speaking rate for duration estimation (words per minute)
  wordsPerMinute: 150,
  
  // Hugging Face TTS models (free tier)
  huggingFace: {
    apiUrl: "https://api-inference.huggingface.co/models",
    // Good quality free TTS models
    models: [
      "facebook/mms-tts-eng", // Multilingual, good quality
      "espnet/kan-bayashi_ljspeech_vits", // LJSpeech VITS
      "microsoft/speecht5_tts", // Microsoft SpeechT5
    ],
    defaultModel: "facebook/mms-tts-eng",
  },
  
  // ElevenLabs config
  elevenLabs: {
    apiUrl: "https://api.elevenlabs.io/v1/text-to-speech",
    defaultVoiceId: "pNInz6obpgDQGcFmaJgB", // Adam
  },
  
  // Audio settings
  audio: {
    sampleRate: 44100,
    format: "mp3",
  },
};

// ============================================================================
// Main TTS Function
// ============================================================================

/**
 * Convert text to speech audio file
 * 
 * @param scriptText - The text to convert to speech
 * @param outputPath - Optional custom output path (auto-generated if not provided)
 * @param options - TTS options (voice, speed, etc.)
 * @returns TTSResult with audio file path and metadata
 */
export async function textToSpeech(
  scriptText: string,
  outputPath?: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  // Determine which TTS service to use
  const service = detectTTSService();
  
  // Ensure temp directory exists
  await ensureTTSDirectory();
  
  // Generate output path if not provided
  const finalOutputPath = outputPath || path.join(
    TTS_CONFIG.tempDir,
    `tts_${Date.now()}.${TTS_CONFIG.audio.format}`
  );
  
  // Route to appropriate TTS implementation
  switch (service) {
    case "huggingface":
      return generateHuggingFaceTTS(scriptText, finalOutputPath, options);
      
    case "elevenlabs":
      return generateElevenLabsTTS(scriptText, finalOutputPath, options);
      
    case "coqui":
      return generateCoquiTTS(scriptText, finalOutputPath, options);
      
    case "mock":
    default:
      return generateMockTTS(scriptText, finalOutputPath);
  }
}

/**
 * Detect which TTS service is available based on environment
 */
function detectTTSService(): TTSService {
  // Check explicit service selection
  const explicitService = process.env.TTS_SERVICE?.toLowerCase();
  if (explicitService && ["mock", "huggingface", "elevenlabs", "coqui"].includes(explicitService)) {
    return explicitService as TTSService;
  }
  
  // Auto-detect based on available API keys
  if (process.env.ELEVENLABS_API_KEY) {
    return "elevenlabs";
  }
  
  if (process.env.HUGGINGFACE_API_KEY) {
    return "huggingface";
  }
  
  // Check if Coqui TTS is available (Python)
  // This is checked synchronously for detection
  if (process.env.USE_COQUI_TTS === "true") {
    return "coqui";
  }
  
  return "mock";
}

/**
 * Ensure TTS temp directory exists
 */
async function ensureTTSDirectory(): Promise<void> {
  if (!existsSync(TTS_CONFIG.tempDir)) {
    await mkdir(TTS_CONFIG.tempDir, { recursive: true });
  }
}

// ============================================================================
// Mock TTS (Silent Audio)
// ============================================================================

/**
 * Generate silent audio as a placeholder
 * Useful for testing without actual TTS
 */
async function generateMockTTS(
  scriptText: string,
  outputPath: string
): Promise<TTSResult> {
  // Estimate duration based on word count
  const wordCount = scriptText.split(/\s+/).length;
  const duration = Math.max(10, Math.ceil((wordCount / TTS_CONFIG.wordsPerMinute) * 60));
  
  try {
    // Prefer ffmpeg if available (keeps existing behavior)
    try {
      await execAsync("ffmpeg -version");
      // Generate silent audio using ffmpeg
      const command = [
        "ffmpeg -y",
        "-f lavfi",
        `-i anullsrc=r=${TTS_CONFIG.audio.sampleRate}:cl=stereo`,
        `-t ${duration}`,
        "-acodec libmp3lame",
        "-q:a 2",
        `\"${outputPath}\"`,
      ].join(" ");

      await execAsync(command);

      console.log(`[TTS Mock] Generated silent audio via ffmpeg: ${duration}s for ${wordCount} words`);

      return {
        audioPath: outputPath,
        duration,
        service: "mock",
      };
    } catch {
      // ffmpeg not available — write a silent WAV file directly
      const sampleRate = TTS_CONFIG.audio.sampleRate;
      const channels = 2;
      const bitsPerSample = 16;
      const byteRate = sampleRate * channels * bitsPerSample / 8;
      const blockAlign = channels * bitsPerSample / 8;
      const numSamples = sampleRate * duration;
      const dataSize = numSamples * blockAlign;

      // WAV header (44 bytes)
      const header = Buffer.alloc(44);
      header.write("RIFF", 0); // ChunkID
      header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
      header.write("WAVE", 8); // Format
      header.write("fmt ", 12); // Subchunk1ID
      header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
      header.writeUInt16LE(1, 20); // AudioFormat (PCM)
      header.writeUInt16LE(channels, 22); // NumChannels
      header.writeUInt32LE(sampleRate, 24); // SampleRate
      header.writeUInt32LE(byteRate, 28); // ByteRate
      header.writeUInt16LE(blockAlign, 32); // BlockAlign
      header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
      header.write("data", 36); // Subchunk2ID
      header.writeUInt32LE(dataSize, 40); // Subchunk2Size

      // Create silent PCM buffer (zeros)
      const silence = Buffer.alloc(dataSize, 0);

      // Ensure directory exists
      await ensureTTSDirectory();
      // If outputPath doesn't end with .wav, switch to .wav so content matches
      if (!outputPath.toLowerCase().endsWith('.wav')) {
        outputPath = outputPath.replace(/\.[^.]+$/, '.wav');
      }
      // Write header + silence
      await writeFile(outputPath, Buffer.concat([header, silence]));

      console.log(`[TTS Mock] Generated silent WAV (no ffmpeg): ${duration}s at ${outputPath}`);

      return {
        audioPath: outputPath,
        duration,
        service: "mock",
      };
    }
  } catch (error) {
    console.error("[TTS Mock] Failed to generate silent audio:", error);
    throw new Error(`Mock TTS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============================================================================
// Hugging Face TTS (Free)
// ============================================================================

/**
 * Generate TTS using Hugging Face Inference API (free tier)
 * Handles long texts by splitting into chunks
 */
async function generateHuggingFaceTTS(
  scriptText: string,
  outputPath: string,
  options: TTSOptions
): Promise<TTSResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    console.warn("[TTS HuggingFace] No API key, falling back to mock");
    return generateMockTTS(scriptText, outputPath);
  }
  
  const model = process.env.HUGGINGFACE_TTS_MODEL || TTS_CONFIG.huggingFace.defaultModel;
  
  try {
    // Split long text into chunks
    const chunks = splitTextIntoChunks(scriptText, TTS_CONFIG.maxCharsPerChunk);
    
    if (chunks.length === 1) {
      // Single chunk - direct generation
      await generateHuggingFaceChunk(chunks[0], outputPath, model, apiKey);
    } else {
      // Multiple chunks - generate and concatenate
      const chunkPaths: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = outputPath.replace(/\.[^.]+$/, `_chunk${i}.wav`);
        await generateHuggingFaceChunk(chunks[i], chunkPath, model, apiKey);
        chunkPaths.push(chunkPath);
        
        // Small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Concatenate chunks
      await concatenateAudioFiles(chunkPaths, outputPath);
      
      // Cleanup chunk files
      for (const chunkPath of chunkPaths) {
        await unlink(chunkPath).catch(() => {});
      }
    }
    
    const wordCount = scriptText.split(/\s+/).length;
    const duration = Math.ceil((wordCount / TTS_CONFIG.wordsPerMinute) * 60);
    
    console.log(`[TTS HuggingFace] Generated audio: ${duration}s using ${model}`);
    
    return {
      audioPath: outputPath,
      duration,
      service: "huggingface",
    };
  } catch (error) {
    console.error("[TTS HuggingFace] Failed:", error);
    // Fallback to mock
    console.warn("[TTS HuggingFace] Falling back to mock TTS");
    return generateMockTTS(scriptText, outputPath);
  }
}

/**
 * Generate single TTS chunk via Hugging Face API
 */
async function generateHuggingFaceChunk(
  text: string,
  outputPath: string,
  model: string,
  apiKey: string
): Promise<void> {
  const response = await fetch(
    `${TTS_CONFIG.huggingFace.apiUrl}/${model}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
      }),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }
  
  const audioBuffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(audioBuffer));
}

// ============================================================================
// ElevenLabs TTS (Premium)
// ============================================================================

/**
 * Generate TTS using ElevenLabs API
 * Higher quality but requires paid API key
 */
async function generateElevenLabsTTS(
  scriptText: string,
  outputPath: string,
  options: TTSOptions
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("[TTS ElevenLabs] No API key, falling back to mock");
    return generateMockTTS(scriptText, outputPath);
  }
  
  const voiceId = options.voice || 
                  process.env.ELEVENLABS_VOICE_ID || 
                  TTS_CONFIG.elevenLabs.defaultVoiceId;
  
  try {
    // ElevenLabs handles long text internally
    const response = await fetch(
      `${TTS_CONFIG.elevenLabs.apiUrl}/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: scriptText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            speed: options.speed || 1.0,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    await writeFile(outputPath, Buffer.from(audioBuffer));
    
    const wordCount = scriptText.split(/\s+/).length;
    const duration = Math.ceil((wordCount / TTS_CONFIG.wordsPerMinute) * 60);
    
    console.log(`[TTS ElevenLabs] Generated audio: ${duration}s using voice ${voiceId}`);
    
    return {
      audioPath: outputPath,
      duration,
      service: "elevenlabs",
    };
  } catch (error) {
    console.error("[TTS ElevenLabs] Failed:", error);
    throw new Error(`ElevenLabs TTS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============================================================================
// Coqui TTS (Local Python)
// ============================================================================

/**
 * Generate TTS using local Coqui TTS (Python)
 * Requires: pip install TTS
 */
async function generateCoquiTTS(
  scriptText: string,
  outputPath: string,
  options: TTSOptions
): Promise<TTSResult> {
  try {
    // Check if Python TTS is available
    const checkCmd = "python3 -c \"from TTS.api import TTS; print('OK')\"";
    
    try {
      await execAsync(checkCmd);
    } catch {
      console.warn("[TTS Coqui] Python TTS not installed, falling back to mock");
      return generateMockTTS(scriptText, outputPath);
    }
    
    // Write script to temp file (to avoid shell escaping issues)
    const scriptPath = outputPath.replace(/\.[^.]+$/, "_script.txt");
    await writeFile(scriptPath, scriptText);
    
    // Generate TTS using Python script
    const pythonScript = `
import sys
from TTS.api import TTS

# Initialize TTS with a basic English model
tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)

# Read text from file
with open("${scriptPath}", "r") as f:
    text = f.read()

# Generate audio
tts.tts_to_file(text=text, file_path="${outputPath}")
print("OK")
`;
    
    const pythonScriptPath = outputPath.replace(/\.[^.]+$/, "_tts.py");
    await writeFile(pythonScriptPath, pythonScript);
    
    // Run Python TTS
    const { stdout, stderr } = await execAsync(`python3 "${pythonScriptPath}"`, {
      timeout: 300000, // 5 minute timeout for long texts
    });
    
    if (stderr && !stderr.includes("UserWarning")) {
      console.warn("[TTS Coqui] Warnings:", stderr);
    }
    
    // Cleanup temp files
    await unlink(scriptPath).catch(() => {});
    await unlink(pythonScriptPath).catch(() => {});
    
    const wordCount = scriptText.split(/\s+/).length;
    const duration = Math.ceil((wordCount / TTS_CONFIG.wordsPerMinute) * 60);
    
    console.log(`[TTS Coqui] Generated audio: ${duration}s`);
    
    return {
      audioPath: outputPath,
      duration,
      service: "coqui",
    };
  } catch (error) {
    console.error("[TTS Coqui] Failed:", error);
    console.warn("[TTS Coqui] Falling back to mock TTS");
    return generateMockTTS(scriptText, outputPath);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Split text into chunks for TTS processing
 * Splits at sentence boundaries when possible
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxChars) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // Handle sentences longer than maxChars
      if (sentence.length > maxChars) {
        // Split by words
        const words = sentence.split(/\s+/);
        currentChunk = "";
        
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxChars) {
            currentChunk += (currentChunk ? " " : "") + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Concatenate multiple audio files using ffmpeg
 */
async function concatenateAudioFiles(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  const tempDir = path.dirname(outputPath);
  const listPath = path.join(tempDir, `concat_${Date.now()}.txt`);
  
  // Create concat file list
  const listContent = inputPaths.map(p => `file '${p}'`).join("\n");
  await writeFile(listPath, listContent);
  
  // Concatenate using ffmpeg
  const command = [
    "ffmpeg -y",
    "-f concat",
    "-safe 0",
    `-i "${listPath}"`,
    "-acodec libmp3lame",
    "-q:a 2",
    `"${outputPath}"`,
  ].join(" ");
  
  try {
    await execAsync(command);
  } finally {
    await unlink(listPath).catch(() => {});
  }
}

/**
 * Get audio file duration using ffprobe
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Clean up TTS temp files older than specified age
 */
export async function cleanupOldTTSFiles(maxAgeMs: number = 3600000): Promise<void> {
  try {
    const { readdir, stat } = await import("fs/promises");
    
    if (!existsSync(TTS_CONFIG.tempDir)) {
      return;
    }
    
    const files = await readdir(TTS_CONFIG.tempDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TTS_CONFIG.tempDir, file);
      const stats = await stat(filePath);
      
      if (now - stats.mtimeMs > maxAgeMs) {
        await unlink(filePath).catch(() => {});
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
