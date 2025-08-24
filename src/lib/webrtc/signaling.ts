import {
  Firestore, doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, serverTimestamp, DocumentReference, Unsubscribe
} from "firebase/firestore";

export type Role = "publisher" | "viewer";

export async function callRef(db: Firestore, sessionId: string): Promise<DocumentReference> {
  const ref = doc(db, "calls", sessionId);
  await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  return ref;
}

export async function setOffer(ref: DocumentReference, sdp: RTCSessionDescriptionInit) {
  await setDoc(ref, { offer: sdp }, { merge: true });
}

export async function setAnswer(ref: DocumentReference, sdp: RTCSessionDescriptionInit) {
  await setDoc(ref, { answer: sdp }, { merge: true });
}

export async function getOffer(ref: DocumentReference) {
  const snap = await getDoc(ref);
  return snap.data()?.offer as RTCSessionDescriptionInit | undefined;
}

export function onAnswer(ref: DocumentReference, cb: (sdp: RTCSessionDescriptionInit) => void): Unsubscribe {
  return onSnapshot(ref, (snap) => {
    const ans = snap.data()?.answer as RTCSessionDescriptionInit | undefined;
    if (ans) cb(ans);
  });
}

export async function addIceCandidate(ref: DocumentReference, role: Role, candidate: RTCIceCandidateInit) {
  const coll = collection(ref, role === "publisher" ? "offerCandidates" : "answerCandidates");
  await addDoc(coll, candidate);
}

export function watchRemoteCandidates(ref: DocumentReference, role: Role, onCandidate: (c: RTCIceCandidateInit)=>void): Unsubscribe {
  const coll = collection(ref, role === "publisher" ? "answerCandidates" : "offerCandidates");
  return onSnapshot(coll, (qs) => {
    qs.docChanges().forEach(change => {
      if (change.type === "added") onCandidate(change.doc.data() as RTCIceCandidateInit);
    });
  });
}
