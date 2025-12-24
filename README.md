# SubtitleGem

SubtitleGem is a powerful, web-based tool built with Next.js that leverages the Gemini API to automatically generate and edit subtitles for your videos.

## Features

- **Automated Subtitling**: Uses Gemini 1.5 Flash to generate accurate English and secondary language subtitles.
- **Smart Processing**: Automatically extracts audio from videos larger than 400MB to optimize API performance.
- **Interactive Timeline**: Fine-tune subtitle timings with a draggable timeline interface.
- **Real-time Preview**: See how your subtitles look overlaid on the video as you edit.
- **Customizable Styles**: Configure font size, color, alignment, and background for your subtitles.
- **Burn-in Export**: Prepare videos with permanent, styled subtitles (FFmpeg required).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **Video Processing**: FFmpeg (via fluent-ffmpeg)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- FFmpeg installed on your system

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd subtitlegem
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file and add your Gemini API key:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_actual_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3050](http://localhost:3050) in your browser.

## Deployment

Deploy to platforms like Vercel or Netlify. Note that for large video files, you may need to increase the serverless function timeout or use a dedicated backend if the processing exceeds platform limits.

## Testing

Run unit tests:
```bash
npm test
```

## License

MIT