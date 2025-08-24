# Terac AI Interviewer

A production-ready, $0-cost MVP of an AI Interviewer built with Next.js 14, TypeScript, Tailwind CSS, and modern web APIs.

## Features

### Day 1 Scope ✅
- **Campaign Wizard**: Create campaigns with name, objective, and mode (structured/conversational)
- **Campaign Dashboard**: View campaign details, generate share links, and embed snippets
- **CSV Upload**: Upload candidate lists to generate invite links locally
- **Interview Runner**: Full TTS/STT interview experience with browser APIs
- **Embed Widget**: Embed interviews in any website via iframe
- **Local Storage**: Everything runs in-memory with exportable links

### Video Streaming Features 🎥
- **Video Publisher**: Camera preview, live streaming, screen sharing, and local recording
- **Video Viewer**: Watch live interviews remotely via WebRTC
- **WebRTC Integration**: P2P video streaming with Firebase signaling (optional)
- **Local Recording**: Download interview videos as WebM files
- **Screen Sharing**: Switch between camera and screen capture

### Technical Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Custom components (shadcn/ui compatible)
- **Speech**: Web Speech API (TTS/STT)
- **Data Processing**: PapaParse for CSV handling
- **IDs**: nanoid for unique identifiers
- **Video Streaming**: WebRTC with Firebase signaling
- **AI Insights**: Local/Cloud LLM with RAG support

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Chrome browser (for best WebRTC and speech recognition support)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd terac-ai-interviewer
   pnpm install
   ```

2. **Start development server:**
   ```bash
   pnpm dev
   ```

3. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Firebase Setup (Optional - for Live Video Streaming)

To enable live video streaming between candidates and viewers:

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)
2. **Enable Firestore Database** (Spark free tier is sufficient)
3. **Create a `.env.local` file** in the project root:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```
4. **Restart the dev server** after adding environment variables

**Note**: Without Firebase, video preview and local recording still work, but live streaming to viewers won't be available.

## Usage

### 1. Create a Campaign
- Fill in campaign name, objective, and mode
- Click "Create" to generate a unique campaign ID
- You'll be redirected to the campaign dashboard

### 2. Campaign Dashboard
- **Share Link**: Copy the generated interview link
- **Embed Snippet**: Copy the HTML/JS code for website integration
- **CSV Upload**: Upload candidate lists (name, email) to generate invite links
- **Stats**: View placeholder metrics (Day 1)

### 3. Run an Interview
- Use the share link: `/i/[sessionId]?c=[campaignId]`
- Click "Start" to begin TTS/STT
- Use "Repeat" to re-ask questions
- Use "Next" to advance to follow-up or next question
- View real-time transcript with timestamps

### 4. Embed Integration
- Copy the embed snippet from campaign dashboard
- Paste into any HTML page
- The interview will appear as an iframe

### 5. Video Streaming
- **For Candidates**: Use the Video Publisher panel during interviews
  - Click "Start Preview" to see your camera feed
  - Click "Go Live" to start streaming (requires Firebase)
  - Use "Share Screen" to show your screen instead of camera
  - Click "Start Recording" to capture video locally
- **For Viewers**: Use the viewer link provided by the candidate
  - Navigate to `/watch/[sessionId]` to watch live
  - Use "Toggle Mute" to control audio
  - Requires the candidate to be live streaming

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Campaign creation wizard
│   ├── campaign/[id]/     # Campaign dashboard
│   ├── embed/[id]/        # Embed page
│   ├── i/[sessionId]/     # Interview runner
│   └── watch/[sessionId]/ # Live video viewer
├── components/             # React components
│   ├── ui/                # Basic UI components
│   ├── AgentPane.tsx      # Question display
│   ├── ControlsBar.tsx    # Interview controls
│   ├── TranscriptPane.tsx # Transcript display
│   ├── InsightsPane.tsx   # Insights (placeholder)
│   ├── CSVUpload.tsx      # CSV processing
│   ├── VideoPublisher.tsx # Video streaming for candidates
│   └── VideoViewer.tsx    # Video viewing for remote viewers
├── lib/                   # Core functionality
│   ├── fsm/              # Agent state machine
│   ├── stt/              # Speech-to-text
│   ├── tts/              # Text-to-speech
│   ├── store/            # Zustand state
│   ├── util/             # Utility functions
│   ├── webrtc/           # WebRTC video streaming
│   │   ├── rtc.ts        # WebRTC peer connections
│   │   └── signaling.ts  # Firebase signaling
│   └── firebase/         # Firebase client
│       └── client.ts     # Firebase configuration
└── public/                # Static assets
    └── embed.js          # Embed script
```

## Testing Video Streaming

### Without Firebase (Local Only)
1. Visit `/i/test123` (any session ID)
2. Click "Start Preview" - you should see your camera feed
3. Click "Start Recording" - speak for a few seconds
4. Click "Stop Recording" - a WebM file will download
5. "Go Live" will show a note about Firebase not being configured

### With Firebase (Live Streaming)
1. Set up Firebase environment variables (see setup above)
2. Visit `/i/live001` in one tab
3. Click "Go Live" - you should see a viewer link
4. Open the viewer link in another tab/device
5. You should see the live video stream
6. Try "Share Screen" to switch to screen capture
7. Click "Camera" to switch back to camera

### Troubleshooting
- **Camera not working**: Ensure camera permissions are granted
- **No video**: Check browser console for errors
- **Streaming fails**: Verify Firebase configuration and network connectivity
- **NAT issues**: WebRTC may fail across strict NATs - test on same network first

## API Endpoints

- `GET /` - Campaign creation wizard
- `GET /campaign/[id]` - Campaign dashboard
- `GET /i/[sessionId]` - Interview runner
- `GET /embed/[campaignId]` - Embed page
- `GET /embed.js` - Embed script

## Browser Compatibility

- **TTS**: Most modern browsers (Chrome, Firefox, Safari, Edge)
- **STT**: Chrome/Chromium browsers (Web Speech API)
- **Fallback**: Graceful degradation with clear error messages

## Development

### Scripts
```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

### Key Dependencies
- `zustand`: State management
- `papaparse`: CSV parsing
- `nanoid`: Unique ID generation
- `zod`: Runtime validation (ready for Day 2)

## Day 2 Roadmap

- **Database Integration**: Persistent storage for campaigns and responses
- **AI Insights**: Real-time analysis and scoring
- **Advanced FSM**: Dynamic question generation and follow-ups
- **Analytics**: Detailed metrics and reporting
- **User Management**: Authentication and role-based access

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Deploy automatically on push
3. Free tier supports all Day 1 features

### Other Platforms
- Netlify, Railway, or any Node.js hosting
- Update `next.config.ts` if needed

## Troubleshooting

### STT Not Working
- Ensure you're using Chrome/Chromium
- Check microphone permissions
- Verify HTTPS in production

### TTS Issues
- Check browser console for errors
- Verify speech synthesis is enabled
- Test with different browsers

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `pnpm install`
- Check Node.js version compatibility

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check browser console for errors
2. Verify all dependencies are installed
3. Ensure Node.js 18+ compatibility
4. Test with Chrome browser for STT features
"# AI_Interview" 
