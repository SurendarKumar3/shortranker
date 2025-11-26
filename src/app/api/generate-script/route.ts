import { NextRequest, NextResponse } from "next/server";
import { 
  generateRankingScript, 
  estimateScriptDuration,
  type RankingItem,
  type ScriptOptions
} from "@/lib/script-generator";

/**
 * POST /api/generate-script
 * 
 * Generates a natural, YouTube-style ranking script for video compilation
 * Uses template-based generation with optional LLM polishing via Hugging Face
 * 
 * Request Body (JSON):
 * {
 *   videos: Array<{
 *     tempId: string,           // temporary client-side id
 *     title: string,            // video title or filename
 *     rank: number,             // 1-5 (1 = best, 5 = start of countdown)
 *     description?: string      // optional reason/description for ranking
 *   }>,
 *   topic?: string,             // optional topic (e.g., "funny clips", "best goals")
 *   options?: {
 *     style?: "energetic" | "casual" | "professional",
 *     includeEmojis?: boolean,
 *     useLLM?: boolean          // if true, polish with Hugging Face LLM
 *   }
 * }
 * 
 * Response (JSON):
 * {
 *   script: string,             // full narration text
 *   wasPolished: boolean,       // whether LLM was used
 *   wordCount: number,
 *   estimatedDuration: number   // in seconds
 * }
 */

interface VideoInput {
  tempId: string;
  title: string;
  rank: number;
  description?: string;
}

interface GenerateScriptRequest {
  videos: VideoInput[];
  topic?: string;
  options?: ScriptOptions;
}

interface GenerateScriptResponse {
  script: string;
  wasPolished: boolean;
  wordCount: number;
  estimatedDuration: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateScriptResponse | ErrorResponse>> {
  try {
    const body = await request.json() as GenerateScriptRequest;
    const { videos, topic, options = {} } = body;

    // Validation
    if (!videos || !Array.isArray(videos)) {
      return NextResponse.json(
        { error: "Invalid request", details: "videos array is required" },
        { status: 400 }
      );
    }

    if (videos.length !== 5) {
      return NextResponse.json(
        { error: "Invalid request", details: "Exactly 5 videos are required" },
        { status: 400 }
      );
    }

    // Validate each video object
    for (const video of videos) {
      if (!video.tempId || typeof video.tempId !== "string") {
        return NextResponse.json(
          { error: "Invalid request", details: "Each video must have a tempId string" },
          { status: 400 }
        );
      }
      if (!video.title || typeof video.title !== "string") {
        return NextResponse.json(
          { error: "Invalid request", details: "Each video must have a title string" },
          { status: 400 }
        );
      }
      if (typeof video.rank !== "number" || video.rank < 1 || video.rank > 5) {
        return NextResponse.json(
          { error: "Invalid request", details: "Each video must have a rank between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Validate unique ranks
    const ranks = videos.map(v => v.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== 5) {
      return NextResponse.json(
        { error: "Invalid request", details: "All ranks must be unique (1-5)" },
        { status: 400 }
      );
    }

    // Convert to RankingItem format
    const rankingData: RankingItem[] = videos.map(v => ({
      rank: v.rank,
      titleOrName: v.title,
      description: v.description,
    }));

    // Generate script using the script generator module
    const result = await generateRankingScript(rankingData, topic, {
      ...options,
      // Enable LLM polishing if API key is available and not explicitly disabled
      useLLM: options.useLLM ?? !!process.env.HUGGINGFACE_API_KEY,
    });

    return NextResponse.json({
      script: result.script,
      wasPolished: result.wasPolished,
      wordCount: result.wordCount,
      estimatedDuration: result.estimatedDuration,
    });
  } catch (error) {
    console.error("Error generating script:", error);
    return NextResponse.json(
      { error: "Failed to generate script", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}