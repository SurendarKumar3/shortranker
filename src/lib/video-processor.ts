/**
 * Video Processing Module for ShortsRanker
 * 
 * Handles video normalization, concatenation, overlay text, and audio mixing
 * using ffmpeg CLI commands.
 */

import { writeFile, mkdir, unlink, readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

export const VIDEO_CONFIG = {
  // Target output specifications for YouTube Shorts
  targetWidth: 1080,
  targetHeight: 1920,
  targetFps: 30,
  aspectRatio: "9:16",
  
  // Video encoding settings
  videoCodec: "libx264",
  videoPreset: "fast",
  videoCrf: 23, // Quality (lower = better, 18-28 recommended)
  
  // Audio encoding settings
  audioCodec: "aac",
  audioBitrate: "192k",
  audioSampleRate: 44100,
  
  // Overlay text settings
  overlayFontSize: 72,
  overlayFontColor: "white",
  overlayBorderColor: "black",
  overlayBorderWidth: 3,
  overlayFadeInDuration: 0.5,
  overlayDisplayDuration: 2.5,
  overlayFadeOutDuration: 0.5,
  
  // Processing settings
  tempDir: "/tmp/shorts-ranker",
  outputDir: "/tmp/shorts-ranker/output",
};

// ============================================================================
// Types
// ============================================================================

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
}

export interface RankedVideo {
  path: string;
  rank: number;
  description?: string;
}

export interface ProcessingResult {
  success: boolean;
  outputPath: string;
  duration: number;
  resolution: string;
  error?: string;
}

export interface FFmpegError {
  message: string;
  stderr: string;
  command: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if ffmpeg is available on the system
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute ffmpeg command with error handling
 * Captures stderr for detailed error messages
 */
async function runFFmpeg(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string };
    const ffmpegError: FFmpegError = {
      message: execError.message || "FFmpeg command failed",
      stderr: execError.stderr || "",
      command: command.substring(0, 200) + "...", // Truncate for logging
    };
    
    console.error("FFmpeg Error:", ffmpegError.message);
    console.error("FFmpeg Stderr:", ffmpegError.stderr);
    
    throw new Error(`FFmpeg failed: ${ffmpegError.stderr || ffmpegError.message}`);
  }
}

/**
 * Get detailed video information using ffprobe
 */
export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  const command = `ffprobe -v quiet -print_format json -show_streams -show_format "${videoPath}"`;
  
  try {
    const { stdout } = await runFFmpeg(command);
    const info = JSON.parse(stdout);
    
    const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    const audioStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");
    
    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      duration: parseFloat(info.format?.duration || videoStream?.duration || "0"),
      fps: evalFps(videoStream?.r_frame_rate || "30/1"),
      hasAudio: !!audioStream,
      codec: videoStream?.codec_name || "unknown",
    };
  } catch {
    // Return defaults if probe fails
    return {
      width: 0,
      height: 0,
      duration: 0,
      fps: 30,
      hasAudio: false,
      codec: "unknown",
    };
  }
}

/**
 * Parse frame rate string (e.g., "30/1" or "29.97")
 */
function evalFps(fpsString: string): number {
  if (fpsString.includes("/")) {
    const [num, den] = fpsString.split("/").map(Number);
    return den ? num / den : 30;
  }
  return parseFloat(fpsString) || 30;
}

/**
 * Ensure required directories exist
 */
export async function ensureDirectories(): Promise<void> {
  if (!existsSync(VIDEO_CONFIG.tempDir)) {
    await mkdir(VIDEO_CONFIG.tempDir, { recursive: true });
  }
  if (!existsSync(VIDEO_CONFIG.outputDir)) {
    await mkdir(VIDEO_CONFIG.outputDir, { recursive: true });
  }
}

/**
 * Clean up a directory and its contents
 */
export async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    if (existsSync(dirPath)) {
      const files = await readdir(dirPath);
      await Promise.all(
        files.map(file => unlink(path.join(dirPath, file)).catch(() => {}))
      );
      await unlink(dirPath).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Video Normalization
// ============================================================================

/**
 * Normalize a video to vertical 9:16 aspect ratio (1080x1920)
 * 
 * Process:
 * 1. Detect input dimensions and aspect ratio
 * 2. If horizontal (wider than tall), crop center to vertical
 * 3. If already vertical, scale and pad if needed
 * 4. Ensure target resolution and FPS
 * 
 * @param inputPath - Path to input video
 * @param outputPath - Path for normalized output
 * @returns VideoInfo of the normalized video
 */
export async function normalizeVideo(
  inputPath: string,
  outputPath: string
): Promise<VideoInfo> {
  const { targetWidth, targetHeight, targetFps, videoCodec, videoPreset, videoCrf, audioCodec, audioBitrate } = VIDEO_CONFIG;
  
  // Get input video info
  const inputInfo = await getVideoInfo(inputPath);
  const { width: inW, height: inH } = inputInfo;
  
  // Calculate aspect ratios
  const inputAspect = inW / inH;
  const targetAspect = targetWidth / targetHeight; // 9/16 = 0.5625
  
  let filterComplex: string;
  
  if (inputAspect > targetAspect) {
    // Input is HORIZONTAL (wider than 9:16)
    // Strategy: Crop horizontally to extract center vertical portion
    // Then scale to target resolution
    
    // Calculate crop dimensions to get 9:16 from center
    const cropWidth = Math.round(inH * targetAspect);
    const cropX = Math.round((inW - cropWidth) / 2);
    
    filterComplex = [
      // Step 1: Crop center vertical portion
      `crop=${cropWidth}:${inH}:${cropX}:0`,
      // Step 2: Scale to exact target resolution
      `scale=${targetWidth}:${targetHeight}`,
      // Step 3: Set pixel aspect ratio to 1:1
      "setsar=1",
      // Step 4: Set frame rate
      `fps=${targetFps}`,
    ].join(",");
    
  } else if (inputAspect < targetAspect) {
    // Input is MORE VERTICAL than 9:16 (taller/narrower)
    // Strategy: Scale to fit width, then pad top/bottom
    
    filterComplex = [
      // Step 1: Scale to fit within target while maintaining aspect
      `scale=${targetWidth}:-2`,
      // Step 2: Pad to exact target height (center vertically)
      `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`,
      // Step 3: Set pixel aspect ratio
      "setsar=1",
      // Step 4: Set frame rate
      `fps=${targetFps}`,
    ].join(",");
    
  } else {
    // Input already matches target aspect ratio
    // Just scale to target resolution
    
    filterComplex = [
      `scale=${targetWidth}:${targetHeight}`,
      "setsar=1",
      `fps=${targetFps}`,
    ].join(",");
  }
  
  // Build ffmpeg command
  // -y: Overwrite output without asking
  // -i: Input file
  // -vf: Video filter graph
  // -c:v: Video codec
  // -preset: Encoding speed/quality tradeoff
  // -crf: Constant Rate Factor (quality)
  // -c:a: Audio codec
  // -b:a: Audio bitrate
  // -movflags +faststart: Enable progressive download
  const command = [
    "ffmpeg -y",
    `-i "${inputPath}"`,
    `-vf "${filterComplex}"`,
    `-c:v ${videoCodec}`,
    `-preset ${videoPreset}`,
    `-crf ${videoCrf}`,
    `-c:a ${audioCodec}`,
    `-b:a ${audioBitrate}`,
    "-movflags +faststart",
    `"${outputPath}"`,
  ].join(" ");
  
  await runFFmpeg(command);
  
  return getVideoInfo(outputPath);
}

// ============================================================================
// Ranking Overlay Text
// ============================================================================

/**
 * Add ranking overlay text to a video
 * Shows "Rank #N" at top center, fading out after ~2-3 seconds
 * 
 * @param inputPath - Path to input video
 * @param outputPath - Path for output with overlay
 * @param rank - The rank number to display (1-5)
 */
export async function addRankingOverlay(
  inputPath: string,
  outputPath: string,
  rank: number
): Promise<void> {
  const {
    overlayFontSize,
    overlayFontColor,
    overlayBorderColor,
    overlayBorderWidth,
    overlayFadeInDuration,
    overlayDisplayDuration,
    overlayFadeOutDuration,
    videoCodec,
    videoPreset,
    videoCrf,
    audioCodec,
    audioBitrate,
  } = VIDEO_CONFIG;
  
  const text = `Rank \\#${rank}`;
  const totalOverlayDuration = overlayFadeInDuration + overlayDisplayDuration + overlayFadeOutDuration;
  
  // Build drawtext filter with fade effect
  // The alpha expression creates: fade in -> hold -> fade out
  const alphaExpression = [
    // Fade in: 0 to fadeInDuration
    `if(lt(t,${overlayFadeInDuration}),t/${overlayFadeInDuration}`,
    // Hold: fadeInDuration to (fadeInDuration + displayDuration)
    `,if(lt(t,${overlayFadeInDuration + overlayDisplayDuration}),1`,
    // Fade out: after displayDuration
    `,if(lt(t,${totalOverlayDuration}),(${totalOverlayDuration}-t)/${overlayFadeOutDuration}`,
    // After fade out: invisible
    `,0)))`,
  ].join("");
  
  // Drawtext filter for ranking overlay
  // fontfile: Use system font (fallback to default)
  // text: The rank text
  // fontsize: Size of text
  // fontcolor_expr: Color with alpha for fading
  // borderw: Text border width
  // bordercolor: Border color for readability
  // x: Centered horizontally
  // y: Near top of screen
  const drawTextFilter = [
    "drawtext=",
    `text='${text}'`,
    `:fontsize=${overlayFontSize}`,
    `:fontcolor_expr=${overlayFontColor}@%{eif\\:${alphaExpression}\\:d\\:2}`,
    `:borderw=${overlayBorderWidth}`,
    `:bordercolor=${overlayBorderColor}@%{eif\\:${alphaExpression}\\:d\\:2}`,
    ":x=(w-text_w)/2",
    ":y=100",
  ].join("");
  
  const command = [
    "ffmpeg -y",
    `-i "${inputPath}"`,
    `-vf "${drawTextFilter}"`,
    `-c:v ${videoCodec}`,
    `-preset ${videoPreset}`,
    `-crf ${videoCrf}`,
    `-c:a ${audioCodec}`,
    `-b:a ${audioBitrate}`,
    `"${outputPath}"`,
  ].join(" ");
  
  await runFFmpeg(command);
}

// ============================================================================
// Video Concatenation
// ============================================================================

/**
 * Sort videos by rank (descending: 5, 4, 3, 2, 1 order)
 */
export function sortVideosByRank(videos: RankedVideo[]): RankedVideo[] {
  return [...videos].sort((a, b) => b.rank - a.rank);
}

/**
 * Concatenate multiple videos into a single video using concat demuxer
 * 
 * This method is suitable for videos that have already been normalized
 * to the same format (resolution, codec, fps).
 * 
 * @param inputPaths - Array of video paths in desired order
 * @param outputPath - Path for concatenated output
 * @param tempDir - Temporary directory for concat file
 */
export async function concatenateVideos(
  inputPaths: string[],
  outputPath: string,
  tempDir: string
): Promise<void> {
  // Create concat demuxer file
  // Format: file 'path/to/video.mp4'
  const concatFilePath = path.join(tempDir, "concat_list.txt");
  const concatContent = inputPaths
    .map(p => `file '${p}'`)
    .join("\n");
  
  await writeFile(concatFilePath, concatContent);
  
  // Use concat demuxer for stream copy (fast, no re-encoding)
  // -f concat: Use concat demuxer
  // -safe 0: Allow absolute paths
  // -c copy: Copy streams without re-encoding
  const command = [
    "ffmpeg -y",
    "-f concat",
    "-safe 0",
    `-i "${concatFilePath}"`,
    "-c copy",
    `"${outputPath}"`,
  ].join(" ");
  
  await runFFmpeg(command);
}

/**
 * Concatenate videos using filter_complex (with re-encoding)
 * Use this when videos might have different properties
 */
export async function concatenateVideosWithFilter(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  const { targetWidth, targetHeight, targetFps, videoCodec, videoPreset, videoCrf, audioCodec, audioBitrate } = VIDEO_CONFIG;
  
  // Build input arguments
  const inputs = inputPaths.map(p => `-i "${p}"`).join(" ");
  
  // Build filter_complex for concatenation
  const n = inputPaths.length;
  const streamLabels = inputPaths.map((_, i) => `[${i}:v][${i}:a]`).join("");
  const filterComplex = `${streamLabels}concat=n=${n}:v=1:a=1[outv][outa]`;
  
  const command = [
    "ffmpeg -y",
    inputs,
    `-filter_complex "${filterComplex}"`,
    '-map "[outv]"',
    '-map "[outa]"',
    `-s ${targetWidth}x${targetHeight}`,
    `-r ${targetFps}`,
    `-c:v ${videoCodec}`,
    `-preset ${videoPreset}`,
    `-crf ${videoCrf}`,
    `-c:a ${audioCodec}`,
    `-b:a ${audioBitrate}`,
    `"${outputPath}"`,
  ].join(" ");
  
  await runFFmpeg(command);
}

// ============================================================================
// Audio Processing
// ============================================================================

/**
 * Create a silent audio file (placeholder when TTS is not available)
 * 
 * @param outputPath - Path for output audio file
 * @param durationSeconds - Duration of silence in seconds
 */
export async function createSilentAudio(
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  const { audioSampleRate } = VIDEO_CONFIG;
  
  // Generate silent audio using anullsrc (null audio source)
  // -f lavfi: Use libavfilter virtual input
  // -i anullsrc: Null audio source
  // -t: Duration
  // -acodec: Audio codec (mp3 for compatibility)
  const command = [
    "ffmpeg -y",
    "-f lavfi",
    `-i anullsrc=r=${audioSampleRate}:cl=stereo`,
    `-t ${durationSeconds}`,
    "-acodec libmp3lame",
    "-q:a 2",
    `"${outputPath}"`,
  ].join(" ");
  
  await runFFmpeg(command);
}

/**
 * Replace video audio with TTS voiceover (Option A)
 * Completely replaces original audio with the provided voiceover
 * 
 * @param videoPath - Path to video file
 * @param audioPath - Path to TTS audio file
 * @param outputPath - Path for output video with new audio
 */
export async function replaceVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  const { videoCodec, videoPreset, videoCrf, audioCodec, audioBitrate } = VIDEO_CONFIG;
  
  // Get durations to handle length mismatch
  const videoInfo = await getVideoInfo(videoPath);
  
  // Strategy:
  // 1. Take video stream from video file
  // 2. Take audio stream from audio file
  // 3. Use -shortest to match duration to shorter input
  // 4. If audio is shorter, it will end and video continues with silence
  
  const command = [
    "ffmpeg -y",
    `-i "${videoPath}"`,  // Input 0: video
    `-i "${audioPath}"`,  // Input 1: audio (TTS voiceover)
    "-map 0:v",           // Take video from input 0
    "-map 1:a",           // Take audio from input 1
    `-c:v ${videoCodec}`,
    `-preset ${videoPreset}`,
    `-crf ${videoCrf}`,
    `-c:a ${audioCodec}`,
    `-b:a ${audioBitrate}`,
    "-shortest",          // Cut to shorter of video/audio
    `"${outputPath}"`,
  ].join(" ");
  
  try {
    await runFFmpeg(command);
  } catch (error) {
    // Fallback: if audio has issues, try without -shortest
    console.warn("Audio replacement failed with -shortest, trying without...");
    const fallbackCommand = [
      "ffmpeg -y",
      `-i "${videoPath}"`,
      `-i "${audioPath}"`,
      "-map 0:v",
      "-map 1:a",
      `-c:v ${videoCodec}`,
      `-preset ${videoPreset}`,
      `-crf ${videoCrf}`,
      `-c:a ${audioCodec}`,
      `-b:a ${audioBitrate}`,
      `"${outputPath}"`,
    ].join(" ");
    
    await runFFmpeg(fallbackCommand);
  }
}

/**
 * Mix TTS voiceover with original video audio (Option B)
 * Original audio is reduced to specified volume level
 * 
 * @param videoPath - Path to video file
 * @param audioPath - Path to TTS audio file
 * @param outputPath - Path for output video with mixed audio
 * @param originalVolume - Volume level for original audio (0.0 to 1.0, default 0.3)
 * @param voiceoverVolume - Volume level for voiceover (0.0 to 1.0, default 1.0)
 */
export async function mixVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  originalVolume: number = 0.3,
  voiceoverVolume: number = 1.0
): Promise<void> {
  const { audioCodec, audioBitrate } = VIDEO_CONFIG;
  
  // Audio mixing filter:
  // [0:a] - Original video audio, reduced volume
  // [1:a] - TTS voiceover
  // amix - Mix both audio streams
  const filterComplex = [
    `[0:a]volume=${originalVolume}[a0]`,
    `[1:a]volume=${voiceoverVolume}[a1]`,
    "[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]",
  ].join(";");
  
  const command = [
    "ffmpeg -y",
    `-i "${videoPath}"`,
    `-i "${audioPath}"`,
    `-filter_complex "${filterComplex}"`,
    "-map 0:v",
    '-map "[aout]"',
    "-c:v copy",  // Copy video stream (no re-encoding)
    `-c:a ${audioCodec}`,
    `-b:a ${audioBitrate}`,
    `"${outputPath}"`,
  ].join(" ");
  
  try {
    await runFFmpeg(command);
  } catch {
    // Fallback to simple audio replacement if mixing fails
    console.warn("Audio mixing failed, falling back to replacement...");
    await replaceVideoAudio(videoPath, audioPath, outputPath);
  }
}

// ============================================================================
// Complete Processing Pipeline
// ============================================================================

export interface ProcessingOptions {
  videos: RankedVideo[];
  audioPath: string;
  outputPath: string;
  tempDir: string;
  addOverlays?: boolean;
  audioMode?: "replace" | "mix";
  originalAudioVolume?: number;
}

/**
 * Complete video processing pipeline
 * 
 * 1. Sort videos by rank (5, 4, 3, 2, 1)
 * 2. Normalize each video to 1080x1920 @ 30fps
 * 3. Add ranking overlay text to each video (optional)
 * 4. Concatenate all videos
 * 5. Add TTS audio (replace or mix)
 * 6. Output final MP4
 * 
 * @param options - Processing options
 * @returns ProcessingResult with output info
 */
export async function processVideoPipeline(
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const {
    videos,
    audioPath,
    outputPath,
    tempDir,
    addOverlays = true,
    audioMode = "replace",
    originalAudioVolume = 0.3,
  } = options;
  
  await ensureDirectories();
  
  try {
    // Step 1: Sort videos by rank (5, 4, 3, 2, 1 order)
    console.log("Step 1: Sorting videos by rank...");
    const sortedVideos = sortVideosByRank(videos);
    
    // Step 2: Normalize each video
    console.log("Step 2: Normalizing videos to 1080x1920...");
    const normalizedPaths: string[] = [];
    
    for (let i = 0; i < sortedVideos.length; i++) {
      const video = sortedVideos[i];
      const normalizedPath = path.join(tempDir, `normalized_${i}.mp4`);
      
      console.log(`  Normalizing video ${i + 1}/${sortedVideos.length} (Rank #${video.rank})...`);
      await normalizeVideo(video.path, normalizedPath);
      normalizedPaths.push(normalizedPath);
    }
    
    // Step 3: Add ranking overlays (optional)
    let overlayPaths = normalizedPaths;
    
    if (addOverlays) {
      console.log("Step 3: Adding ranking overlays...");
      overlayPaths = [];
      
      for (let i = 0; i < sortedVideos.length; i++) {
        const video = sortedVideos[i];
        const overlayPath = path.join(tempDir, `overlay_${i}.mp4`);
        
        console.log(`  Adding overlay for Rank #${video.rank}...`);
        await addRankingOverlay(normalizedPaths[i], overlayPath, video.rank);
        overlayPaths.push(overlayPath);
      }
    }
    
    // Step 4: Concatenate videos
    console.log("Step 4: Concatenating videos...");
    const concatenatedPath = path.join(tempDir, "concatenated.mp4");
    await concatenateVideos(overlayPaths, concatenatedPath, tempDir);
    
    // Step 5: Add TTS audio
    console.log("Step 5: Adding TTS audio...");
    
    if (audioMode === "replace") {
      await replaceVideoAudio(concatenatedPath, audioPath, outputPath);
    } else {
      await mixVideoAudio(concatenatedPath, audioPath, outputPath, originalAudioVolume);
    }
    
    // Step 6: Get final video info
    console.log("Step 6: Getting final video info...");
    const finalInfo = await getVideoInfo(outputPath);
    
    console.log("Processing complete!");
    
    return {
      success: true,
      outputPath,
      duration: finalInfo.duration,
      resolution: `${finalInfo.width}x${finalInfo.height}`,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Processing pipeline failed:", errorMessage);
    
    return {
      success: false,
      outputPath: "",
      duration: 0,
      resolution: "",
      error: errorMessage,
    };
  }
}

/**
 * Read the final video file as a buffer
 */
export async function readVideoFile(videoPath: string): Promise<Buffer> {
  return readFile(videoPath);
}
