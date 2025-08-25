// Environment configuration for AI interview system
export const config = {
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    softTokenCap: Number(process.env.NEXT_PUBLIC_LLM_SOFT_TOKEN_CAP || 12000),
  },
  
  // Helper to check if cloud LLM is available
  canUseCloudLLM: () => {
    return config.llm.provider === 'openai' && config.llm.openai.apiKey.length > 0;
  },
  
  // Get current LLM mode based on environment
  getDefaultLLMMode: () => {
    return config.canUseCloudLLM() ? 'cloud' : 'rules';
  }
};
