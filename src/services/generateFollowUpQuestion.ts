import { generateInsight } from "@/lib/orchestrator/insight";
import { useSession } from "@/lib/store/session";

export async function generateFollowUpQuestion({
  lastAnswer,
}: {
  lastAnswer: string;
}): Promise<string> {
  // Get current session state
  const session = useSession.getState();
  
  // Reuse your insight function; just change the system instruction
  const prompt = `
You are an AI interviewer. Read the candidate's last answer and the running transcript.
Ask ONE concise, high-signal follow-up that digs deeper into *their* experience.
No pre-reading or boilerplate. No multi-part questions. 18 words max.
`;
  
  try {
    // Use the existing insight generation with a custom prompt
    const { json } = await generateInsight({
      mode: session.llmMode,
      turnId: `followup-${lastAnswer.length}-${lastAnswer.substring(0, 10).replace(/\s+/g, '')}`,
      rollingSummary: session.rollingSummary || "",
      snippet: lastAnswer,
      facts: [], // No facts for follow-up generation
      tokenBudgetLeft: Math.max(0, (session.softCap || 0) - (session.tokensUsed || 0))
    });
    
    // Return a plain question string
    return json.followup?.trim().replace(/^[""]|[""]$/g, "") || 
           "Could you give a concrete example with metrics?";
  } catch (error) {
    console.error('Failed to generate follow-up question:', error);
    // Fallback to a generic follow-up
    return "Could you give a concrete example with metrics?";
  }
}
