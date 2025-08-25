import { useState } from "react";
import { generateFollowUpQuestion } from "@/services/generateFollowUpQuestion";

export function useConversationalFlow({
  mode,
  setCurrentQuestion,
  incrementQuestionIndex,
  speakQuestion,
}: {
  mode: "structured" | "conversational",
  setCurrentQuestion: (q: { id: string; text: string }) => void,
  incrementQuestionIndex: () => void,
  speakQuestion: (text: string) => Promise<void>,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionCounter, setQuestionCounter] = useState(0);

  const onAnswerFinalized = async (finalText: string) => {
    // 1) If structured, let your existing flow handle it
    if (mode !== "conversational") return;

    // 2) Generate follow-up from transcript + last answer
    setIsGenerating(true);
    try {
      const follow = await generateFollowUpQuestion({ 
        lastAnswer: finalText,
        // Note: transcript will be fetched from the session store
      });

      // 3) Update the current question and speak it
      const newCounter = questionCounter + 1;
      setQuestionCounter(newCounter);
      const q = { id: `followup-${newCounter}`, text: follow };
      setCurrentQuestion(q);
      incrementQuestionIndex();
      await speakQuestion(follow);
    } catch (error) {
      console.error('Failed to generate follow-up question:', error);
      // Fallback to a generic follow-up
      const fallback = "Could you give a concrete example with metrics?";
      const newCounter = questionCounter + 1;
      setQuestionCounter(newCounter);
      const q = { id: `fallback-${newCounter}`, text: fallback };
      setCurrentQuestion(q);
      incrementQuestionIndex();
      await speakQuestion(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  // You can use this to disable "Next" in conversational mode while AI is thinking
  const nextDisabled = mode === "conversational" && isGenerating;

  return { onAnswerFinalized, nextDisabled, isGenerating };
}
