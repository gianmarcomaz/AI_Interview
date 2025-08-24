export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
];

export function newPeer(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export async function getCameraStream(audio = true, video = true): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio, video });
}

export async function getScreenStream(audio = false): Promise<MediaStream> {
  // Some browsers allow system audio with audio:true
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio });
}

export function attachStream(videoEl: HTMLVideoElement, stream: MediaStream, muted = true) {
  videoEl.srcObject = stream;
  videoEl.playsInline = true;
  videoEl.muted = muted;
  void videoEl.play().catch(() => {});
}

export function stopStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop());
}

export function replaceVideoTrack(pc: RTCPeerConnection, newVideoTrack: MediaStreamTrack) {
  const sender = pc.getSenders().find(s => s.track?.kind === "video");
  if (sender) sender.replaceTrack(newVideoTrack);
}

export function closePeer(pc?: RTCPeerConnection | null) {
  try { pc?.getSenders().forEach(s => s.track?.stop()); } catch {}
  try { pc?.getReceivers().forEach(r => r.track?.stop()); } catch {}
  try { pc?.close(); } catch {}
}
