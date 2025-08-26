'use client';
import { useEffect, useRef, useState } from "react";
import { newPeer, attachStream, closePeer } from "@/lib/webrtc/rtc";
import { getDb, signalingAvailable } from "@/lib/firebase/client";
import { callRef, getOffer, setAnswer, addIceCandidate, watchRemoteCandidates } from "@/lib/webrtc/signaling";

type Props = { sessionId: string };

export default function VideoViewer({ sessionId }: Props) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    let unsubCand: (()=>void)|undefined;
    (async () => {
      if (!signalingAvailable()) {
        setNote("Signaling not configured (Firebase). Viewer needs signaling.");
        return;
      }
      const db = getDb();
      const ref = await callRef(db, sessionId);
      const offer = await getOffer(ref);
      if (!offer) { setNote("No publisher offer found. Ask the candidate to Go Live first."); return; }

      const peer = newPeer();

      peer.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (remoteRef.current && stream) attachStream(remoteRef.current, stream, /*muted*/ false);
      };

      peer.onicecandidate = async (ev) => {
        if (ev.candidate) await addIceCandidate(ref, "viewer", ev.candidate.toJSON());
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await setAnswer(ref, answer);

      unsubCand = watchRemoteCandidates(ref, "viewer", async (c) => {
        try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      });

      setPc(peer);
    })();

    return () => {
      unsubCand?.();
      closePeer(pc);
    };
  }, [sessionId]);

  function toggleMute() {
    if (!remoteRef.current) return;
    remoteRef.current.muted = !remoteRef.current.muted;
  }

  return (
    <div className="p-4 rounded-2xl border bg-white/10 border-white/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-blue-200">Live Viewer</div>
        <div className="flex gap-2">
          <button 
            className="h-8 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs hover:from-blue-700 hover:to-indigo-700 shadow-glow"
            onClick={toggleMute}
          >
            Toggle Mute
          </button>
        </div>
      </div>
      <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden">
        <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
      </div>
      {note && (
        <div className="mt-3 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-300">⚠️</span>
            <p className="text-amber-200 text-xs">{note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
