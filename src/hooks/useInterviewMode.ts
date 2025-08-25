import { useEffect, useMemo, useState } from "react";

export type InterviewMode = "structured" | "conversational";

export function useInterviewMode() {
  const [mode, setMode] = useState<InterviewMode>(() => {
    // Only run on client side
    if (typeof window === "undefined") return "structured";
    
    const url = new URL(window.location.href);
    const m = url.searchParams.get("m");
    if (m === "structured" || m === "conversational") return m;
    
    const saved = localStorage.getItem("interview:mode");
    return (saved === "structured" || saved === "conversational") ? saved : "structured";
  });

  // Persist only when *user/session* sets it — not when loading old campaign settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("interview:mode", mode);
    }
  }, [mode]);

  return useMemo(() => ({ mode, setMode }), [mode]);
}
