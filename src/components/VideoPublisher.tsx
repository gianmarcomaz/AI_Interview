'use client';
import { useEffect, useRef, useState } from "react";
import { newPeer, getCameraStream, getScreenStream, attachStream, stopStream, replaceVideoTrack, closePeer } from "@/lib/webrtc/rtc";
import { getFirebase, signalingAvailable } from "@/lib/firebase/client";
import { callRef, setOffer, onAnswer, addIceCandidate, watchRemoteCandidates } from "@/lib/webrtc/signaling";
import { Button } from "@/components/ui/button";

type Props = { sessionId: string };

export default function VideoPublisher({ sessionId }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [viewerLink, setViewerLink] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [autoRec, setAutoRec] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      stopStream(localStream);
      closePeer(pc);
    };
  }, [localStream, pc]);

  async function startPreview() {
    try {
      const stream = await getCameraStream(true, true);
      setLocalStream(stream);
      if (localRef.current) attachStream(localRef.current, stream, true);
    } catch (e:any) {
      setNote(e?.message || "Camera/mic permission denied or not available.");
    }
  }

  async function stopPreview() {
    stopStream(localStream);
    setLocalStream(null);
  }

  async function goLive() {
    const hasFirebase = signalingAvailable();
    if (!hasFirebase) {
      setNote("Signaling not configured. Add Firebase env vars to enable remote streaming. Preview & recording still work.");
      if (!localStream) await startPreview();
      return;
    }

    try {
      // Ensure we have a local stream first
      if (!localStream) {
        console.log("No local stream, starting preview first...");
        await startPreview();
        if (!localStream) {
          setNote("Failed to get camera stream. Please check camera permissions.");
          return;
        }
      }

      console.log("Setting up WebRTC connection...");
      const stream = localStream;
      
      // Verify stream has tracks
      const tracks = stream.getTracks();
      console.log("Stream tracks:", tracks.length, tracks.map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
      
      if (tracks.length === 0) {
        setNote("No media tracks available. Please check camera and microphone.");
        return;
      }

      const { db } = getFirebase();
      console.log("Firebase connection established");
      
      const ref = await callRef(db, sessionId);
      console.log("Call reference created:", sessionId);
      
      const peer = newPeer();
      console.log("WebRTC peer connection created");

      // Add local tracks
      tracks.forEach(t => {
        console.log("Adding track:", t.kind, t.enabled);
        peer.addTrack(t, stream);
      });

      // Outgoing ICE
      peer.onicecandidate = async (ev) => {
        if (ev.candidate) {
          console.log("ICE candidate generated");
          await addIceCandidate(ref, "publisher", ev.candidate.toJSON());
        }
      };

      // Connection state changes
      peer.onconnectionstatechange = () => {
        console.log("Connection state:", peer.connectionState);
        if (peer.connectionState === 'failed') {
          setNote("WebRTC connection failed. Check network and try again.");
        }
      };

      // ICE connection state
      peer.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peer.iceConnectionState);
      };

      // Create & publish offer
      console.log("Creating offer...");
      const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await peer.setLocalDescription(offer);
      console.log("Local description set");
      
      await setOffer(ref, offer);
      console.log("Offer published to Firebase");

      // Listen for answer & remote ICE
      const unsubAns = onAnswer(ref, async (sdp) => {
        console.log("Answer received from viewer");
        if (peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(new RTCSessionDescription(sdp));
          console.log("Remote description set");
        }
      });
      
      const unsubCand = watchRemoteCandidates(ref, "publisher", async (c) => {
        try { 
          console.log("Remote ICE candidate received");
          await peer.addIceCandidate(new RTCIceCandidate(c)); 
        } catch (e) {
          console.error("Failed to add ICE candidate:", e);
        }
      });

      setPc(peer);
      setLive(true);
      setViewerLink(`${window.location.origin}/watch/${sessionId}`);
      setNote("Live streaming started successfully! Share the viewer link with others.");

      console.log("Live streaming setup complete");

      // Auto screen record if enabled
      if (autoRec) {
        try {
          const ss = await getScreenStream(true);
          const vt = ss.getVideoTracks()[0];
          if (vt && peer) replaceVideoTrack(peer, vt);
          const mix = new MediaStream([vt, ...(stream.getAudioTracks() ?? [])]);
          setLocalStream(mix);
          if (localRef.current) attachStream(localRef.current, mix, true);
          // start recorder
          if (recStatus === "idle") startRecording();
        } catch (e: any) { 
          setNote(e?.message || "Auto screen record failed."); 
        }
      }

      // Cleanup subscriptions if component unmounts during live session
      return () => { unsubAns(); unsubCand(); };
      
    } catch (error: any) {
      console.error("Go Live failed:", error);
      setNote(`Failed to go live: ${error.message || 'Unknown error'}`);
    }
  }

  async function stopLive() {
    // Stop recording if active
    if (recStatus === "rec") stopRecording();
    
    closePeer(pc);
    setPc(null);
    setLive(false);
  }

  async function startScreenshare() {
    try {
      const ss = await getScreenStream(true);
      const vt = ss.getVideoTracks()[0];
      if (vt && pc) replaceVideoTrack(pc, vt);

      // also show locally with existing audio tracks
      const mix = new MediaStream([vt, ...(localStream?.getAudioTracks() ?? [])]);
      setLocalStream(mix);
      if (localRef.current) attachStream(localRef.current, mix, true);
    } catch (e:any) {
      setNote(e?.message || "Screen share failed.");
    }
  }

  async function cameraAgain() {
    try {
      const cam = await getCameraStream(true, true);
      const vt = cam.getVideoTracks()[0];
      if (vt && pc) replaceVideoTrack(pc, vt);
      setLocalStream(cam);
      if (localRef.current) attachStream(localRef.current, cam, true);
    } catch (e:any) {
      setNote(e?.message || "Could not switch back to camera.");
    }
  }

  // Local recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recStatus, setRecStatus] = useState<"idle"|"rec"|"stopping">("idle");

  function startRecording() {
    if (!localStream) return;
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(localStream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `session-${sessionId}-${Date.now()}.webm`;
      a.click(); URL.revokeObjectURL(url);
      setRecStatus("idle");
    };
    rec.start(1000);
    recorderRef.current = rec;
    setRecStatus("rec");
  }

  function stopRecording() {
    if (recorderRef.current && recStatus === "rec") {
      setRecStatus("stopping");
      recorderRef.current.stop();
    }
  }

  return (
    <div className="p-6">
      {/* Video Display */}
      <div className="relative aspect-video bg-gradient-to-br from-black/60 to-gray-900/60 rounded-xl overflow-hidden mb-6 border border-white/20">
        <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {/* Video Overlay Status */}
        {!localStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-2xl">📹</span>
              </div>
              <p className="text-white/70 text-sm">Camera not active</p>
            </div>
          </div>
        )}
        
        {/* Stream Status Debug Info */}
        {localStream && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Stream Active
            </div>
            <div className="text-white/70">
              Tracks: {localStream.getTracks().length} | 
              Video: {localStream.getVideoTracks().length} | 
              Audio: {localStream.getAudioTracks().length}
            </div>
          </div>
        )}
        
        {/* Live Indicator */}
        {live && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}
        
        {/* Recording Indicator */}
        {recStatus === "rec" && (
          <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            REC
          </div>
        )}
      </div>

      {/* Auto Record Toggle */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <label className="flex items-center gap-2 text-blue-100 text-sm">
          <input 
            type="checkbox" 
            checked={autoRec} 
            onChange={e => setAutoRec(e.target.checked)}
            className="rounded border-white/20 bg-white/10"
          />
          Auto Screen Record
        </label>
        <p className="text-blue-200 text-xs mt-1 ml-6">
          When enabled, screen recording starts automatically when going live
        </p>
      </div>

{/* Control Buttons */}
<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 items-stretch auto-rows-[minmax(108px,auto)]">
  {(() => {
    // ↓ Shrunk sizes: lower min-h, tighter padding, smaller icon & type
    const tile =
      "w-full h-full min-h-[108px] !px-4 !py-3 inline-flex flex-col items-center justify-center " +
      "gap-2 rounded-2xl shadow-lg whitespace-normal text-center " +
      "transition-transform duration-150 ease-out hover:scale-[1.015] active:scale-[0.99] " +
      "focus:outline-none focus:ring-2 focus:ring-white/30";
    const icon = "text-2xl md:text-3xl shrink-0";              // was 3xl/4xl
    const label =
      "text-white font-semibold leading-[1.12] [text-wrap:balance] text-[14px] md:text-[16px] max-w-[14ch]"; // was 15/17px

    return (
      <>
        <Button onClick={startPreview} size="xl" cta="primary" shadow className={tile} aria-label="Start Preview">
          <span className={icon}>📹</span>
          <span className={label}>
            <span className="block">Start</span>
            <span className="block">Preview</span>
          </span>
        </Button>

        <Button onClick={stopPreview} size="xl" cta="slate" shadow className={tile} aria-label="Stop Preview">
          <span className={icon}>⏹️</span>
          <span className={label}>
            <span className="block">Stop</span>
            <span className="block">Preview</span>
          </span>
        </Button>

        {!live ? (
          <Button onClick={goLive} size="xl" cta="success" shadow className={tile} aria-label="Go Live">
            <span className={icon}>🔴</span>
            <span className={label}>
              <span className="block">Go</span>
              <span className="block">Live</span>
            </span>
          </Button>
        ) : (
          <Button onClick={stopLive} size="xl" cta="danger" shadow className={tile} aria-label="Stop Live">
            <span className={icon}>⏹️</span>
            <span className={label}>
              <span className="block">Stop</span>
              <span className="block">Live</span>
            </span>
          </Button>
        )}

        <Button onClick={startScreenshare} size="xl" cta="info" shadow className={tile} aria-label="Share Screen">
          <span className={icon}>🖥️</span>
          <span className={label}>
            <span className="block">Share</span>
            <span className="block">Screen</span>
          </span>
        </Button>

        <Button onClick={cameraAgain} size="xl" cta="purple" shadow className={tile} aria-label="Camera">
          <span className={icon}>📷</span>
          <span className={label}>Camera</span>
        </Button>

        {recStatus !== "rec" ? (
          <Button onClick={startRecording} size="xl" cta="cyan" shadow className={tile} aria-label="Start Recording">
            <span className={icon}>⏺️</span>
            <span className={label}>
              <span className="block">Start</span>
              <span className="block">Recording</span>
            </span>
          </Button>
        ) : (
          <Button onClick={stopRecording} size="xl" cta="amber" shadow className={tile} aria-label="Stop Recording">
            <span className={icon}>⏹️</span>
            <span className={label}>
              <span className="block">Stop</span>
              <span className="block">Recording</span>
            </span>
          </Button>
        )}
      </>
    );
  })()}
</div>




      {/* Status Messages */}
      {viewerLink && live && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <div>
              <p className="text-green-100 text-sm font-medium mb-1">Streaming Live</p>
              <p className="text-green-200 text-xs">
                Viewer link: <a className="underline hover:text-green-100 transition-colors" href={viewerLink} target="_blank" rel="noreferrer">{viewerLink}</a>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {note && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full mt-2"></div>
            <p className="text-amber-200 text-sm">{note}</p>
          </div>
        </div>
      )}
      
      {!signalingAvailable() && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Local Mode Only</p>
              <p className="text-blue-200 text-xs">
                Add Firebase environment variables to enable remote streaming. Preview and recording still work locally.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
