"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  doc, getDoc, collection, getDocs, orderBy, query,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { useSession } from "@/lib/store/session";
import { generateFinalSummary } from "@/lib/orchestrator/insight";
import ReportsClient from "./ReportsClient";

type TxItem = { role: "user"|"ai"; text: string };

export default function ReportsPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();

  const sessionId = String(params?.sessionId || "");
  const c = searchParams?.get("c") || undefined;
  const campaignId = typeof c === "string" ? c : undefined;

  const { db } = getFirebase();

  const {
    setTranscript,
    finalSummary, setFinalSummary,
    llmMode, tokensUsed, softCap,
  } = useSession() as any;

  const [loading, setLoading] = useState(false);

  // --- Load transcript from Firestore if store is empty ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!sessionId) return;
      if (useSession.getState().transcript?.length) return;

      setLoading(true);
      try {
        // 1) Try top-level array (matches your Firebase dump)
        const sRef = doc(db, "sessions", sessionId);
        const snap = await getDoc(sRef);
        let tx: TxItem[] = [];

        if (snap.exists()) {
          const data: any = snap.data();
          const arr = Array.isArray(data?.transcripts) ? data.transcripts : [];
          tx = arr
            .map((t: any) => ({
              role: (t?.speaker === "cand" ? "user" : "ai") as "user" | "ai",
              text: t?.textClean || t?.textRaw || "",
            }))
            .filter((t: { role: string; text: string }) => t.text);
        }

        // 2) Fallback: subcollection `transcripts` ordered by tEnd
        if (!tx.length) {
          const qRef = query(
            collection(db, "sessions", sessionId, "transcripts"),
            orderBy("segment.tEnd", "asc")
          );
          const docs = await getDocs(qRef);
          tx = docs.docs
            .map(d => d.data()?.segment)
            .filter(Boolean)
            .map((s: any) => ({
              role: (s?.speaker === "cand" ? "user" : "ai") as "user" | "ai",
              text: s?.textClean || s?.textRaw || "",
            }))
            .filter((t) => t.text);
        }

        if (mounted && tx.length) setTranscript(tx);
      } catch (err) {
        console.error("Failed to load transcript:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [db, sessionId, setTranscript]);

  // --- Build/ensure a final summary on demand ---
  async function ensureSummary() {
    if (finalSummary) return finalSummary;
    const storeTranscript = useSession.getState().transcript || [];
    if (!storeTranscript.length) {
      alert("No transcript to summarize");
      throw new Error("no_transcript");
    }

    // Convert Turn[] to TxItem[] for the summary generation
    const tx: TxItem[] = storeTranscript.map((t: any) => ({
      role: (t.final ? "user" : "ai") as "user" | "ai",
      text: t.text
    }));

    const tokenBudgetLeft = Math.max(0, (softCap || 0) - (tokensUsed || 0));
    const { json } = await generateFinalSummary({
      mode: llmMode,
      sessionId,
      transcript: tx,
      insights: (useSession.getState().insights || []) as any[],
      tokenBudgetLeft,
    });
    setFinalSummary(json);
    return json;
  }

  async function onGeneratePDF() {
    try {
      const summary = await ensureSummary();
      const { pdfReport } = await import("@/lib/reports/pdf"); // client-only
      await pdfReport({
        sessionId,
        campaignId,
        summary: summary?.overview ?? summary?.summary,
        tags: useSession.getState().tagTally,
        quotes: (useSession.getState().transcript || [])
          .slice(-10)
          .map((t: any) => ({ ts: t.ts, text: t.text })),
      } as any);
    } catch (e) {
      alert((e as Error).message || "Failed to generate PDF");
    }
  }

  async function onGeneratePPT() {
    try {
      const summary = await ensureSummary();
      const { pptReport } = await import("@/lib/reports/ppt"); // client-only
      await pptReport({
        sessionId,
        campaignId,
        summary: summary?.overview ?? summary?.summary,
        tags: useSession.getState().tagTally,
        quotes: (useSession.getState().transcript || [])
          .slice(-10)
          .map((t: any) => ({ ts: t.ts, text: t.text })),
      } as any);
    } catch (e) {
      alert((e as Error).message || "Failed to generate PowerPoint");
    }
  }

  return (
    <>
      <ReportsClient
        sessionId={sessionId}
        campaignId={campaignId}
        loading={loading}
        onGeneratePDF={onGeneratePDF}
        onGeneratePPT={onGeneratePPT}
      />
      {/* Optional floating actions—even if ReportsClient has its own buttons */}
      {/* <div className="fixed bottom-6 right-6 z-40 flex gap-3">
        <button onClick={onGeneratePDF} className="btn-primary">Generate PDF</button>
        <button onClick={onGeneratePPT} className="btn-secondary">Generate PowerPoint</button>
      </div> */}
    </>
  );
}
