# ShortsRanker 🏆

Create epic countdown videos in minutes! Upload 5 clips, rank them #5 to #1, and let AI generate the perfect voice-over for your compilation.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![FFmpeg](https://img.shields.io/badge/FFmpeg-required-green)

## ✨ Features

- **Upload 5 Videos**: Drag & drop interface for vertical video uploads
- **Rank & Describe**: Assign rankings #5 to #1 with custom descriptions
- **AI Script Generation**: Automatically generates engaging countdown narration
- **Text-to-Speech**: Multiple TTS options (mock, Hugging Face, ElevenLabs, Coqui)
- **Video Processing**: FFmpeg-powered video normalization, overlay text, and audio mixing
- **Download**: Get your final 1080x1920 vertical MP4 compilation

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generate-script/     # AI script generation endpoint
│   │   │   └── route.ts
│   │   ├── generate-video/      # Alias for process-video
│   │   │   └── route.ts
│   │   └── process-video/       # Video processing + TTS endpoint
│   │       └── route.ts
│   ├── shorts-ranker/           # Main application page
│   │   └── page.tsx
│   ├── layout.tsx               # Root layout with Toaster
│   └── page.tsx                 # Landing page
├── components/
│   └── ui/                      # Shadcn UI components
├── lib/
│   ├── script-generator.ts      # AI script generation module
│   ├── tts-service.ts           # Text-to-Speech service module
│   ├── video-processor.ts       # FFmpeg video processing module
│   └── utils.ts                 # Utility functions
└── hooks/                       # Custom React hooks
```

## 🚀 Getting Started

### Prerequisites

1. **Node.js 18+** or **Bun** runtime
2. **FFmpeg** (required for video processing)

#### Installing FFmpeg

```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ffmpeg

# macOS (with Homebrew)
brew install ffmpeg

# Windows (with Chocolatey)
choco install ffmpeg

# Verify installation
ffmpeg -version
```

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd shortsranker

# Install dependencies
npm install
# or
bun install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## ⚙️ Environment Variables

Create a `.env.local` file with these variables:

```bash
# =============================================================================
# TTS (Text-to-Speech) Configuration
# =============================================================================

# Choose TTS service: mock | huggingface | elevenlabs | coqui
# Default: mock (generates silent audio for testing)
TTS_SERVICE=mock

# Hugging Face API Key (FREE - for TTS and optional LLM script polishing)
# Get your key: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=

# Hugging Face TTS Model (optional)
# Options: facebook/mms-tts-eng, espnet/kan-bayashi_ljspeech_vits, microsoft/speecht5_tts
HUGGINGFACE_TTS_MODEL=facebook/mms-tts-eng

# ElevenLabs API Key (PREMIUM - high quality TTS)
# Get your key: https://elevenlabs.io/
ELEVENLABS_API_KEY=

# ElevenLabs Voice ID (optional, defaults to "Adam" voice)
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Enable local Coqui TTS (requires Python + pip install TTS)
USE_COQUI_TTS=false
```

### TTS Service Options

| Service | Cost | Quality | Setup |
|---------|------|---------|-------|
| `mock` | Free | Silent placeholder | None (default) |
| `huggingface` | Free | Good | API key required |
| `elevenlabs` | Paid | Excellent | API key required |
| `coqui` | Free | Good | Python + TTS library |

## 🔧 API Endpoints

### POST `/api/generate-script`

Generates a YouTube-style countdown script.

**Request:**
```json
{
  "videos": [
    { "tempId": "abc123", "title": "Amazing Clip", "rank": 1, "description": "Best play ever!" },
    { "tempId": "def456", "title": "Great Moment", "rank": 2 }
  ],
  "topic": "gaming highlights",
  "options": {
    "style": "energetic",
    "includeEmojis": false,
    "useLLM": true
  }
}
```

**Response:**
```json
{
  "script": "What's up everyone! Welcome back...",
  "wasPolished": true,
  "wordCount": 250,
  "estimatedDuration": 100
}
```

### POST `/api/process-video` (or `/api/generate-video`)

Processes videos into a compilation with TTS voice-over.

**Request:** `multipart/form-data`
- `video_0` through `video_4`: Video files
- `rank_0` through `rank_4`: Rank numbers
- `description_0` through `description_4`: Descriptions
- `rankingData`: JSON string with video metadata
- `finalScript`: The narration script text

**Response:** Video blob (MP4) with headers:
- `X-Video-Duration`: Duration in seconds
- `X-Video-Resolution`: e.g., "1080x1920"
- `X-TTS-Service`: TTS service used

## 📊 Processing Pipeline

1. **Upload**: Receive 5 video files via multipart/form-data
2. **Normalize**: Convert all videos to 1080x1920 @ 30fps
3. **Overlay**: Add "Rank #N" text overlay to each video
4. **Concatenate**: Join videos in order (5→4→3→2→1)
5. **TTS**: Generate voice-over audio from script
6. **Mix Audio**: Replace original audio with TTS
7. **Output**: Return final MP4 file

## ⚠️ Known Limitations

### Technical Limitations

1. **FFmpeg Required**: Video processing will not work without FFmpeg installed
2. **Server Memory**: Processing 5 videos simultaneously requires ~2-4GB RAM
3. **Processing Time**: Expect 1-5 minutes depending on video lengths and server specs
4. **File Size**: Large videos (>100MB each) may cause timeouts

### Video Constraints

- **Maximum Videos**: Exactly 5 videos required
- **Recommended Length**: Each video should be under 60 seconds
- **Aspect Ratio**: Videos are automatically cropped/scaled to 9:16
- **Format Support**: MP4, MOV, WebM (MP4 recommended)

### TTS Limitations

- **Mock Mode**: Produces silent audio (for testing only)
- **Hugging Face**: Rate limits on free tier
- **ElevenLabs**: Character limits based on subscription
- **Coqui**: Requires Python environment setup

## 🚀 Deployment Considerations

### Server Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 10GB+ for temp files during processing
- **FFmpeg**: Must be installed and in PATH

### Platform-Specific Notes

#### Vercel
- ❌ Not recommended (serverless timeout limits, no FFmpeg)

#### Railway / Render
- ✅ Works well with Docker deployment
- Include FFmpeg in Dockerfile

#### Self-Hosted (VPS)
- ✅ Best option for production
- Install FFmpeg directly on server
- Consider dedicated video processing server

### Docker Deployment

```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Resource Cleanup

The application automatically cleans up:
- Temp files after processing
- Output files after 1 minute
- Old TTS files older than 1 hour

## 🛠️ Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📝 License

MIT License - feel free to use for personal or commercial projects.

---

Built with ❤️ using Next.js 15, TypeScript, FFmpeg, and AI