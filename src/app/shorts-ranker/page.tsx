"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Upload, 
  X, 
  GripVertical, 
  Play, 
  Sparkles, 
  Download, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Video,
  Clock,
  Monitor,
  AlertCircle,
  CheckCircle2,
  FileVideo
} from "lucide-react";
import { toast } from "sonner";

interface VideoFile {
  id: string;
  file: File;
  thumbnail: string;
  name: string;
  description: string;
  rank: number;
  duration?: number;
  resolution?: { width: number; height: number };
}

type Step = "upload" | "rank" | "generate" | "complete";

export default function ShortsRankerPage() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [editableScript, setEditableScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<{ duration: number; resolution: string; ttsService?: string } | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateThumbnail = (file: File): Promise<{ thumbnail: string; duration: number; resolution: { width: number; height: number } }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg");
        const duration = video.duration;
        const resolution = { width: video.videoWidth, height: video.videoHeight };
        URL.revokeObjectURL(video.src);
        resolve({ thumbnail, duration, resolution });
      };
      video.onerror = () => {
        resolve({ thumbnail: "", duration: 0, resolution: { width: 0, height: 0 } });
      };
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter((f) => f.type.startsWith("video/"));
    
    if (videos.length + videoFiles.length > 5) {
      setError("You can only upload exactly 5 videos");
      toast.error("You can only upload exactly 5 videos");
      return;
    }

    setError("");
    
    const newVideos: VideoFile[] = [];
    for (const file of videoFiles) {
      const { thumbnail, duration, resolution } = await generateThumbnail(file);
      const usedRanks = [...videos, ...newVideos].map(v => v.rank);
      const availableRank = [1, 2, 3, 4, 5].find(r => !usedRanks.includes(r)) || 1;
      
      newVideos.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        thumbnail,
        name: file.name,
        description: "",
        rank: availableRank,
        duration,
        resolution,
      });
    }

    setVideos((prev) => [...prev, ...newVideos]);
    
    if (videos.length + newVideos.length === 5) {
      toast.success("All 5 videos uploaded! Ready to rank.");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [videos.length]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const handleRankDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleRankDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const sortedVideos = [...videos].sort((a, b) => b.rank - a.rank);
    const newVideos = [...sortedVideos];
    const draggedVideo = newVideos[draggedIndex];
    newVideos.splice(draggedIndex, 1);
    newVideos.splice(index, 0, draggedVideo);
    
    const updatedVideos = newVideos.map((v, i) => ({ ...v, rank: 5 - i }));
    setVideos(updatedVideos);
    setDraggedIndex(index);
  };

  const handleRankDragEnd = () => {
    setDraggedIndex(null);
  };

  const updateRank = (id: string, newRank: number) => {
    setVideos((prev) => {
      const videoWithNewRank = prev.find(v => v.rank === newRank && v.id !== id);
      const currentVideo = prev.find(v => v.id === id);
      
      if (!currentVideo) return prev;
      
      return prev.map((v) => {
        if (v.id === id) return { ...v, rank: newRank };
        if (videoWithNewRank && v.id === videoWithNewRank.id) return { ...v, rank: currentVideo.rank };
        return v;
      });
    });
  };

  const updateDescription = (id: string, description: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, description } : v))
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateScript = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const videoData = videos.map((v) => ({
        tempId: v.id,
        title: v.name,
        rank: v.rank,
        description: v.description || undefined,
      }));

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          videos: videoData,
          options: {
            style: "energetic",
            includeEmojis: false, // Disable emojis for TTS compatibility
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to generate script");
      }
      
      setGeneratedScript(data.script);
      setEditableScript(data.script);
      setCurrentStep("generate");
      
      toast.success(`Script generated! (${data.wordCount} words, ~${data.estimatedDuration}s)`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate script";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const processVideo = async () => {
    setIsProcessing(true);
    setError("");
    setProcessingStatus("Preparing video files...");

    try {
      const formData = new FormData();
      
      // Sort videos by rank (5 to 1, so rank 5 first in the compilation)
      const sortedVideos = [...videos].sort((a, b) => b.rank - a.rank);
      
      // Add videos with both naming conventions for compatibility
      sortedVideos.forEach((video, index) => {
        formData.append(`video_${index}`, video.file);
        formData.append(`rank_${index}`, video.rank.toString());
        formData.append(`description_${index}`, video.description || "");
      });
      
      // Add ranking data as JSON
      const rankingData = {
        videos: sortedVideos.map(v => ({
          filename: v.name,
          rank: v.rank,
          description: v.description || ""
        }))
      };
      formData.append("rankingData", JSON.stringify(rankingData));
      formData.append("finalScript", editableScript);

      setProcessingStatus("Uploading videos to server...");

      const response = await fetch("/api/process-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.details || data.error || "Failed to process video");
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      setProcessingStatus("Downloading compiled video...");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      // Get video info from response headers
      const duration = response.headers.get("X-Video-Duration");
      const resolution = response.headers.get("X-Video-Resolution");
      const ttsService = response.headers.get("X-TTS-Service");
      
      // Calculate total duration from videos if not in headers
      const totalDuration = duration 
        ? parseFloat(duration) 
        : videos.reduce((acc, v) => acc + (v.duration || 0), 0);
      
      setVideoInfo({
        duration: totalDuration,
        resolution: resolution || "1080x1920",
        ttsService: ttsService || "mock"
      });
      
      setCurrentStep("complete");
      toast.success("Video compilation complete! 🎬");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process video";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  const getRankColor = (rank: number) => {
    const colors: Record<number, string> = {
      1: "bg-gradient-to-r from-yellow-400 to-amber-500 text-black",
      2: "bg-gradient-to-r from-gray-300 to-gray-400 text-black",
      3: "bg-gradient-to-r from-amber-600 to-amber-700 text-white",
      4: "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
      5: "bg-gradient-to-r from-purple-500 to-purple-600 text-white",
    };
    return colors[rank] || "bg-gray-500 text-white";
  };

  const getAvailableRanks = () => {
    return [1, 2, 3, 4, 5];
  };

  const hasValidRanks = () => {
    const ranks = videos.map(v => v.rank).sort();
    return ranks.length === 5 && 
           ranks.every((r, i) => r === i + 1) && 
           new Set(ranks).size === 5;
  };

  const canProceedToRank = videos.length === 5;
  const canGenerateScript = hasValidRanks();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3 flex-wrap">
            <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" />
            <span>ShortsRanker</span>
            <span className="text-purple-400">–</span>
            <span className="text-gray-300 text-xl md:text-2xl lg:text-3xl">Rank & Merge Your Shorts</span>
          </h1>
          <p className="text-gray-300 text-lg">
            Upload 5 videos, rank them, and create an AI-powered compilation
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 md:gap-4">
            {[
              { step: "upload", label: "Step 1: Upload", icon: Upload },
              { step: "rank", label: "Step 2: Rank", icon: GripVertical },
              { step: "generate", label: "Step 3: Script", icon: Sparkles },
              { step: "complete", label: "Step 4: Download", icon: Download },
            ].map(({ step, label, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                    currentStep === step
                      ? "bg-purple-500 text-white"
                      : ["upload", "rank", "generate", "complete"].indexOf(currentStep) >
                        ["upload", "rank", "generate", "complete"].indexOf(step)
                      ? "bg-green-500 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline text-sm font-medium">{label}</span>
                </div>
                {index < 3 && (
                  <div className="w-8 md:w-12 h-0.5 bg-gray-700 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 justify-center">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload */}
        {currentStep === "upload" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Step 1: Upload Your Videos ({videos.length}/5)
                </CardTitle>
                <p className="text-gray-400 text-sm">
                  Select exactly 5 vertical videos (MP4 preferred). Each video should be in 9:16 aspect ratio.
                </p>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-purple-400 bg-purple-500/20"
                      : "border-slate-600 hover:border-purple-500 hover:bg-slate-700/30"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/mov,video/webm,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  />
                  <Video className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                  <p className="text-white text-lg font-medium mb-2">
                    Drag & drop your vertical videos here
                  </p>
                  <p className="text-gray-400 text-sm">
                    or click to browse • Supports MP4, MOV, WebM • 9:16 recommended
                  </p>
                </div>

                {/* Video Previews */}
                {videos.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-white font-medium mb-4">Uploaded Videos</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {videos.map((video) => (
                        <div
                          key={video.id}
                          className="relative group rounded-lg overflow-hidden bg-slate-700 aspect-[9/16]"
                        >
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt={video.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVideo(video.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-white text-xs truncate">{video.name}</p>
                            {video.duration ? (
                              <p className="text-gray-400 text-xs">{formatDuration(video.duration)}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {videos.length > 0 && videos.length < 5 && (
                  <p className="text-amber-400 text-sm mt-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please upload {5 - videos.length} more video{5 - videos.length > 1 ? 's' : ''} to continue
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep("rank")}
                disabled={!canProceedToRank}
                className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                Continue to Ranking
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Rank */}
        {currentStep === "rank" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Step 2: Assign Ranks and Descriptions
                </CardTitle>
                <p className="text-gray-400 text-sm">
                  Assign a unique rank (1-5) to each video using the dropdown. Add descriptions for the voice-over.
                  Drag to reorder or use dropdowns. #5 appears first, #1 is the winner!
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {videos
                    .sort((a, b) => b.rank - a.rank)
                    .map((video, index) => (
                      <div
                        key={video.id}
                        draggable
                        onDragStart={() => handleRankDragStart(index)}
                        onDragOver={(e) => handleRankDragOver(e, index)}
                        onDragEnd={handleRankDragEnd}
                        className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-slate-600 cursor-move transition-all hover:border-purple-500 ${
                          draggedIndex === index ? "opacity-50 scale-95" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <GripVertical className="w-6 h-6 text-gray-400 flex-shrink-0 hidden md:block" />
                          
                          <div className="flex-shrink-0">
                            <Select
                              value={video.rank.toString()}
                              onValueChange={(value) => updateRank(video.id, parseInt(value))}
                            >
                              <SelectTrigger className={`w-20 h-12 ${getRankColor(video.rank)} border-0 font-bold text-lg`}>
                                <SelectValue placeholder="Rank" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {getAvailableRanks().map((rank) => (
                                  <SelectItem 
                                    key={rank} 
                                    value={rank.toString()}
                                    className="text-white hover:bg-slate-700"
                                  >
                                    #{rank}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-16 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-slate-600">
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt={video.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium truncate">
                              {video.name}
                            </p>
                            {video.duration ? (
                              <span className="text-gray-400 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(video.duration)}
                              </span>
                            ) : null}
                          </div>
                          <Textarea
                            placeholder="Add a description/reason for this ranking (e.g., 'Amazing comeback play!' or 'Incredible timing!')"
                            value={video.description}
                            onChange={(e) =>
                              updateDescription(video.id, e.target.value)
                            }
                            rows={2}
                            className="bg-slate-600/50 border-slate-500 text-white placeholder:text-gray-400 resize-none"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {!hasValidRanks() && (
                  <p className="text-amber-400 text-sm mt-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please ensure each video has a unique rank from 1-5 (no duplicates)
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                onClick={() => setCurrentStep("upload")}
                variant="outline"
                className="border-slate-600 text-gray-300 hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={generateScript}
                disabled={!canGenerateScript || isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Voice-Over Script
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Generate Script */}
        {currentStep === "generate" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Step 3: Review & Edit Voice-Over Script
                </CardTitle>
                <p className="text-gray-400 text-sm">
                  Review the generated script below. You can edit it before generating the final video.
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editableScript}
                  onChange={(e) => setEditableScript(e.target.value)}
                  rows={12}
                  disabled={isProcessing}
                  className="bg-slate-900/50 border-slate-600 text-gray-200 font-sans text-sm leading-relaxed resize-none disabled:opacity-50"
                  placeholder="Your voice-over script will appear here..."
                />
                <div className="flex items-center justify-between mt-4">
                  <p className="text-gray-400 text-sm">
                    This script will be converted to speech and overlaid on your video compilation.
                  </p>
                  <Button
                    onClick={() => setEditableScript(generatedScript)}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Reset to Original
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                onClick={() => setCurrentStep("rank")}
                variant="outline"
                disabled={isProcessing}
                className="border-slate-600 text-gray-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Edit Rankings
              </Button>
              <Button
                onClick={processVideo}
                disabled={isProcessing || !editableScript.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Video...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Generate Final Video
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-8">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                    <div className="text-center">
                      <p className="text-white font-medium">Processing your video...</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {processingStatus || "This may take a few minutes depending on video length."}
                      </p>
                    </div>
                    <div className="w-full max-w-md bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full animate-pulse w-3/4" />
                    </div>
                    <div className="text-xs text-gray-500 text-center max-w-md">
                      Steps: Normalizing videos → Adding overlays → Concatenating → Generating TTS → Mixing audio
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === "complete" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  Step 4: Your Video is Ready!
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center py-8">
                <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                  <FileVideo className="w-12 h-12 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Compilation Complete! 🎬
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Your ranked video compilation with AI voice-over is ready to download.
                  Share it on YouTube Shorts, TikTok, or Instagram Reels!
                </p>

                {/* Video Info */}
                {videoInfo && (
                  <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="w-5 h-5 text-purple-400" />
                      <span>Duration: {formatDuration(videoInfo.duration)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Monitor className="w-5 h-5 text-purple-400" />
                      <span>Resolution: {videoInfo.resolution}</span>
                    </div>
                    {videoInfo.ttsService && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <span>TTS: {videoInfo.ttsService}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={downloadUrl}
                    download="shorts-ranker-compilation.mp4"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download MP4
                  </a>
                  <Button
                    onClick={() => {
                      // Revoke old URL to free memory
                      if (downloadUrl) {
                        URL.revokeObjectURL(downloadUrl);
                      }
                      setVideos([]);
                      setGeneratedScript("");
                      setEditableScript("");
                      setDownloadUrl("");
                      setVideoInfo(null);
                      setError("");
                      setCurrentStep("upload");
                    }}
                    variant="outline"
                    className="border-slate-600 text-gray-300 hover:bg-slate-700"
                  >
                    Create Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}