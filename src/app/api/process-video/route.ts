import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import path from "path";
import {
  checkFFmpegAvailable,
  processVideoPipeline,
  cleanupDirectory,
  ensureDirectories,
  VIDEO_CONFIG,
  type RankedVideo,
} from "@/lib/video-processor";
import { textToSpeech, cleanupOldTTSFiles } from "@/lib/tts-service";

/**
 * POST /api/process-video (aka /api/generate-video)
 * 
 * Processes uploaded videos into a single ranked compilation with TTS voice-over
 * 
 * TTS Service Selection (via TTS_SERVICE env var):
 * - "mock": Silent audio placeholder (default, for testing)
 * - "huggingface": Free Hugging Face TTS API (requires HUGGINGFACE_API_KEY)
 * - "elevenlabs": Premium ElevenLabs API (requires ELEVENLABS_API_KEY)
 * - "coqui": Local Python Coqui TTS (requires Python + pip install TTS)
 * 
 * Request: multipart/form-data containing:
 * - video1 through video5 (or video_0 through video_4): Video files
 * - rankingData: JSON string with format:
 *   {
 *     videos: Array<{
 *       filename: string,
 *       rank: number,
 *       description: string
 *     }>
 *   }
 * - finalScript: string (the narration script text)
 * 
 * Response: Video blob with headers for duration/resolution
 */

interface RankingDataItem {
  filename: string;
  rank: number;
  description: string;
}

interface RankingData {
  videos: RankingDataItem[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ErrorResponse | Blob>> {
  const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const jobDir = path.join(VIDEO_CONFIG.tempDir, jobId);
  
  try {
    // Ensure directories exist
    await ensureDirectories();
    await mkdir(jobDir, { recursive: true });
    
    // Cleanup old TTS files (older than 1 hour)
    cleanupOldTTSFiles(3600000).catch(() => {});

    // Check Content-Type header
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid Content-Type", details: "Request must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    
    // Extract finalScript
    const finalScript = formData.get("finalScript") as string || formData.get("script") as string;
    if (!finalScript) {
      return NextResponse.json(
        { error: "Missing required field", details: "finalScript is required" },
        { status: 400 }
      );
    }

    // Extract rankingData (optional, but useful for ordering)
    let rankingData: RankingData | null = null;
    const rankingDataStr = formData.get("rankingData") as string;
    if (rankingDataStr) {
      try {
        rankingData = JSON.parse(rankingDataStr);
      } catch {
        console.warn("Could not parse rankingData, will use video order from form");
      }
    }

    // Collect video files (support both naming conventions)
    const videos: { file: File; rank: number; index: number; description: string }[] = [];
    
    // Try video1-video5 naming
    for (let i = 1; i <= 5; i++) {
      const video = formData.get(`video${i}`) as File;
      if (video && video.size > 0) {
        const rank = parseInt(formData.get(`rank${i}`) as string) || (6 - i);
        const description = formData.get(`description${i}`) as string || "";
        videos.push({ file: video, rank, index: i - 1, description });
      }
    }
    
    // Try video_0 to video_4 naming if not found
    if (videos.length === 0) {
      for (let i = 0; i < 5; i++) {
        const video = formData.get(`video_${i}`) as File;
        if (video && video.size > 0) {
          const rank = parseInt(formData.get(`rank_${i}`) as string) || (5 - i);
          const description = formData.get(`description_${i}`) as string || "";
          videos.push({ file: video, rank, index: i, description });
        }
      }
    }

    if (videos.length !== 5) {
      return NextResponse.json(
        { error: "Invalid request", details: `Exactly 5 videos are required. Received: ${videos.length}` },
        { status: 400 }
      );
    }

    // Save uploaded videos to temp directory
    const rankedVideos: RankedVideo[] = [];
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const ext = getFileExtension(video.file.name);
      const videoPath = path.join(jobDir, `input_${i}${ext}`);
      const buffer = Buffer.from(await video.file.arrayBuffer());
      await writeFile(videoPath, buffer);
      
      rankedVideos.push({
        path: videoPath,
        rank: video.rank,
        description: video.description,
      });
    }

    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFFmpegAvailable();
    
    if (!ffmpegAvailable) {
      // Return error if ffmpeg is not available
      await cleanupDirectory(jobDir);
      return NextResponse.json(
        { 
          error: "FFmpeg not available", 
          details: "FFmpeg is required for video processing but is not installed on this server." 
        },
        { status: 500 }
      );
    }

    // Generate TTS audio from script using the TTS service module
    console.log(`[Process Video] Generating TTS audio for job ${jobId}...`);
    const audioPath = path.join(jobDir, "voiceover.mp3");
    
    const ttsResult = await textToSpeech(finalScript, audioPath);
    console.log(`[Process Video] TTS generated using ${ttsResult.service} (${ttsResult.duration}s)`);

    // Process videos through the pipeline
    const outputPath = path.join(VIDEO_CONFIG.outputDir, `${jobId}_output.mp4`);
    
    const result = await processVideoPipeline({
      videos: rankedVideos,
      audioPath: ttsResult.audioPath,
      outputPath,
      tempDir: jobDir,
      addOverlays: true,      // Add "Rank #N" overlay text
      audioMode: "replace",   // Option A: Replace original audio with TTS
    });

    if (!result.success) {
      await cleanupDirectory(jobDir);
      return NextResponse.json(
        { error: "Video processing failed", details: result.error },
        { status: 500 }
      );
    }

    // Read the final video
    const videoBuffer = await readFile(outputPath);

    // Clean up temp files
    await cleanupDirectory(jobDir);
    
    // Schedule output file cleanup after 1 minute
    setTimeout(async () => {
      try {
        await unlink(outputPath);
      } catch {
        // Ignore cleanup errors
      }
    }, 60000);

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="shorts-ranker-${jobId}.mp4"`,
        "X-Video-Duration": result.duration.toString(),
        "X-Video-Resolution": result.resolution,
        "X-TTS-Service": ttsResult.service,
      },
    });

  } catch (error) {
    console.error("Error processing video:", error);
    
    // Cleanup on error
    await cleanupDirectory(jobDir);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isFFmpegError = errorMessage.includes("FFmpeg") || errorMessage.includes("ffmpeg");

    return NextResponse.json(
      { 
        error: isFFmpegError ? "FFmpeg processing error" : "Failed to process video", 
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext || ".mp4";
}

// Increase body size limit for video uploads
export const config = {
  api: {
    bodyParser: false,
  },
};