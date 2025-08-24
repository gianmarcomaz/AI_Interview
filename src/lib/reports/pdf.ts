// Dynamic import to avoid SSR issues
let jsPDF: any = null;

export type ReportData = {
  campaignId?: string;
  sessionId: string;
  summary?: string;
  tags: Record<string, number>;
  quotes: { ts: number; text: string }[];
};

export async function pdfReport(data: ReportData) {
  // Dynamic import to avoid SSR issues
  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in the browser');
  }
  
  if (!jsPDF) {
    try {
      const mod = await import('jspdf');
      jsPDF = (mod as any).jsPDF;
    } catch {
      throw new Error('Failed to load PDF generator');
    }
  }
  
  const doc = new jsPDF({ unit: "pt", compress: true });
  const pad = 40;
  doc.setFontSize(20);
  doc.text(`AI Interview Report`, pad, 60);
  doc.setFontSize(12);
  doc.text(`Campaign: ${data.campaignId || "-"}`, pad, 90);
  doc.text(`Session: ${data.sessionId}`, pad, 108);

  // Summary
  doc.setFontSize(14); 
  doc.text("Executive Summary", pad, 140);
  doc.setFontSize(12);
  doc.text(data.summary || "—", pad, 160, { maxWidth: 520 });

  // Tags
  doc.setFontSize(14); 
  doc.text("Tag Coverage", pad, 200);
  let y = 220; 
  const entries = Object.entries(data.tags);
  for (const [k, v] of entries.slice(0, 40)) {
    doc.text(`${k}: ${v}`, pad, y); 
    y += 16;
    if (y > 760) { 
      doc.addPage(); 
      y = 60; 
    }
  }

  // Quotes
  doc.addPage();
  y = 60; 
  doc.setFontSize(14); 
  doc.text("Selected Quotes", pad, y); 
  y += 20;
  doc.setFontSize(12);
  for (const q of data.quotes.slice(0, 10)) {
    doc.text(`[${new Date(q.ts).toLocaleString()}] ${q.text}`, pad, y, { maxWidth: 520 });
    y += 30; 
    if (y > 760) { 
      doc.addPage(); 
      y = 60; 
    }
  }

  doc.save(`report-${data.sessionId}.pdf`);
}
