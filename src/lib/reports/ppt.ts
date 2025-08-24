// src/lib/reports/ppt.ts
// Client-only PPT export that loads PptxGenJS' browser bundle at runtime.
// Avoids Next/Webpack resolving 'node:*' and TS deep subpath type errors.

declare global {
    interface Window {
      PptxGenJS?: any; // UMD attaches here
    }
  }
  
  export type DeckData = {
    campaignId?: string;
    sessionId: string;
    summary?: string;
    tags: Record<string, number>;
    quotes: { ts: number; text: string }[];
  };
  
  const LOCAL_BUNDLE = "/vendor/pptxgen.bundle.js"; // optional: host in /public/vendor
  const CDN_BUNDLE =
    "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
  
  let loadingPromise: Promise<any> | null = null;
  
  function injectScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  
  async function ensurePptxCtor(): Promise<any> {
    if (typeof window === "undefined") {
      throw new Error("pptReport must run in the browser.");
    }
    if (window.PptxGenJS) return window.PptxGenJS;
  
    // De-dupe concurrent loads
    if (!loadingPromise) {
      loadingPromise = (async () => {
        // Try local copy first (if you add /public/vendor/pptxgen.bundle.js)
        try {
          await injectScript(LOCAL_BUNDLE);
        } catch {
          // Fallback to CDN
          await injectScript(CDN_BUNDLE);
        }
        if (!window.PptxGenJS) {
          throw new Error("PptxGenJS not found after loading script.");
        }
        return window.PptxGenJS;
      })();
    }
    return loadingPromise;
  }
  
  /**
   * Generate and download a PPTX report for a session.
   * Safe to call from client components (pages with 'use client').
   */
  export async function pptReport(data: DeckData) {
    const PptxGenJSCtor = await ensurePptxCtor();
    const pptx = new PptxGenJSCtor();
  
    const add = (slide: any, text: string, opts: any) =>
      slide.addText(text && String(text).trim() ? text : "—", opts);
  
    // 1) Title
    let s = pptx.addSlide();
    add(s, "AI Interview Report", { x: 0.5, y: 0.6, w: 9, h: 1, fontSize: 32, bold: true });
    add(s, `Campaign: ${data.campaignId ?? "-"}`, { x: 0.5, y: 1.7, w: 9, h: 0.5, fontSize: 18 });
    add(s, `Session: ${data.sessionId}`, { x: 0.5, y: 2.2, w: 9, h: 0.5, fontSize: 18 });
  
    // 2) Executive Summary
    s = pptx.addSlide();
    add(s, "Executive Summary", { x: 0.5, y: 0.6, w: 9, h: 0.6, fontSize: 24, bold: true });
    add(s, data.summary ?? "—", { x: 0.5, y: 1.3, w: 9, h: 4.5, fontSize: 16 });
  
    // 3) Tag Coverage
    s = pptx.addSlide();
    add(s, "Tag Coverage", { x: 0.5, y: 0.6, w: 9, h: 0.6, fontSize: 24, bold: true });
    const tagsText =
      Object.entries(data.tags ?? {})
        .slice(0, 24)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n") || "—";
    add(s, tagsText, { x: 0.5, y: 1.3, w: 9, h: 5, fontSize: 16 });
  
    // 4) Selected Quotes
    s = pptx.addSlide();
    add(s, "Selected Quotes", { x: 0.5, y: 0.6, w: 9, h: 0.6, fontSize: 24, bold: true });
    const quotesText =
      (data.quotes ?? [])
        .slice(0, 8)
        .map((q) => `[${new Date(q.ts).toLocaleString()}] ${q.text}`)
        .join("\n\n") || "—";
    add(s, quotesText, { x: 0.5, y: 1.3, w: 9, h: 5, fontSize: 16 });
  
    await pptx.writeFile({ fileName: `deck-${data.sessionId}.pptx` });
  }
  