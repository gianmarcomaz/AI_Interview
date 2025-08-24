'use client';

let engine: any = null;
let initializing = false;
let initPromise: Promise<any> | null = null;

export async function localLLMInit() {
  if (typeof window === 'undefined') return null;
  if (engine) return engine;
  if (initPromise) return initPromise;
  initializing = true;
  initPromise = (async () => {
    try {
      console.log("[webllm] Starting initialization...");
      
      // Check if WebLLM is available
      if (typeof window !== 'undefined' && !(window as any).navigator?.gpu) {
        throw new Error("WebGPU not supported - WebLLM requires WebGPU support");
      }
      
      const mod = await import("@mlc-ai/web-llm");
      console.log("[webllm] Module loaded:", Object.keys(mod));
      
      const CreateMLCEngine = (mod as any).CreateMLCEngine;
      if (!CreateMLCEngine) {
        throw new Error("CreateMLCEngine not found in module");
      }
      
      // Try known prebuilt model IDs with correct API: CreateMLCEngine(modelId, options?)
      const prebuilt = (mod as any).prebuiltAppConfig;
      const modelIds = [
        "Phi-3.5-mini-instruct-q4f16_1-MLC",
        "Llama-2-7b-chat-q4f16_1-MLC",
      ];

      let lastError: any = null;

      for (const modelId of modelIds) {
        // First try with prebuilt appConfig
        try {
          console.log("[webllm] Trying model with appConfig:", modelId);
          engine = await CreateMLCEngine(modelId, { appConfig: prebuilt, temperature: 0.2, top_p: 0.9 });
          if (engine && engine.chat) {
            console.log("[webllm] Engine created successfully:", modelId);
            return engine;
          }
          throw new Error("Engine created but chat method not available");
        } catch (e1) {
          console.warn("[webllm] Model failed with appConfig, retrying without:", modelId, e1);
          lastError = e1;
        }

        // Then try without appConfig
        try {
          console.log("[webllm] Trying model without appConfig:", modelId);
          engine = await CreateMLCEngine(modelId, { temperature: 0.2, top_p: 0.9 });
          if (engine && engine.chat) {
            console.log("[webllm] Engine created successfully:", modelId);
            return engine;
          }
          throw new Error("Engine created but chat method not available");
        } catch (e2) {
          console.warn("[webllm] Model failed without appConfig:", modelId, e2);
          lastError = e2;
        }
      }

      throw lastError || new Error("All model initializations failed");
      
    } catch (e) {
      console.error("[webllm] All initialization attempts failed:", e);
      engine = null;
      return null;
    } finally {
      initializing = false;
      initPromise = null;
    }
  })();
  return initPromise;
}

export async function localLLM(prompt: string) {
  if (typeof window === 'undefined') {
    return { schema_version:1, turn_id:"", summary:"Needs human review", tags:["review"], flags:["format_fix"] };
  }
  
  try {
    if (!engine) {
      console.log("[webllm] No engine, attempting initialization...");
      await localLLMInit();
    }
    
    if (!engine || !engine.chat) {
      console.warn("[webllm] Engine not available, using enhanced fallback");
      return generateFallbackInsight(prompt);
    }
    
    console.log("[webllm] Attempting to generate insight...");
    const res = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });
    
    const txt = res.choices?.[0]?.message?.content || "{}";
    try { 
      const parsed = JSON.parse(txt);
      console.log("[webllm] Successfully generated insight:", parsed);
      return parsed;
    } catch (parseError) { 
      console.warn("[webllm] Failed to parse response, using raw text");
      return { 
        schema_version: 1, 
        turn_id: "", 
        summary: txt || "Response received but format unclear", 
        tags: ["response"], 
        flags: ["format_fix"] 
      };
    }
  } catch (error) {
    console.warn("[webllm] Local LLM failed, using enhanced fallback:", error);
    return generateFallbackInsight(prompt);
  }
}

function generateFallbackInsight(prompt: string) {
  // Analyze the prompt to provide more useful fallback insights
  const text = prompt.toLowerCase();
  let summary = "AI model unavailable - using fallback analysis";
  const tags: string[] = ["fallback"];
  const flags: string[] = ["model_unavailable"];
  
  // Simple keyword analysis for better fallback insights
  if (text.includes("experience") || text.includes("work")) {
    summary = "Candidate discussing work experience - review needed for detailed analysis";
    tags.push("experience", "work");
  } else if (text.includes("skill") || text.includes("technology")) {
    summary = "Candidate discussing skills/technology - review needed for technical assessment";
    tags.push("skills", "technology");
  } else if (text.includes("project") || text.includes("achievement")) {
    summary = "Candidate discussing projects/achievements - review needed for impact analysis";
    tags.push("projects", "achievements");
  } else if (text.includes("challenge") || text.includes("problem")) {
    summary = "Candidate discussing challenges/problems - review needed for problem-solving assessment";
    tags.push("challenges", "problem-solving");
  }
  
  return {
    schema_version: 1,
    turn_id: "",
    summary,
    tags,
    flags
  };
}


