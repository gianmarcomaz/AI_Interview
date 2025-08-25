# AI Interview System Setup

This document explains how to set up the AI-moderated interview system in the terac-ai-interviewer project.

## Environment Configuration

Create a `.env.local` file in the project root with the following variables:

```bash
# LLM Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_LLM_SOFT_TOKEN_CAP=12000
```

### Environment Variables Explained

- **LLM_PROVIDER**: Set to "openai" for OpenAI API integration
- **OPENAI_API_KEY**: Your OpenAI API key (starts with "sk-")
- **OPENAI_MODEL**: The model to use (default: gpt-4o-mini for cost optimization)
- **NEXT_PUBLIC_LLM_SOFT_TOKEN_CAP**: Maximum tokens per session before switching to rules mode

## How It Works

### 1. AI Insights After Each Answer
- After every final user answer, the system generates an AI insight
- Insights include: summary (≤120 chars), tags (≤3), citations (≤3)
- If OpenAI API is unavailable, falls back to rules-based insights

### 2. Token Budget Management
- Each session has a soft token cap (default: 12,000 tokens)
- When exceeded, automatically switches to rules mode
- No more cloud LLM calls for the rest of the session

### 3. Final Session Summary
- At interview end, generates a comprehensive summary
- Includes: overview, strengths, risks, and topics
- Uses cloud LLM if budget allows, otherwise rules fallback

### 4. Fallback Rules Mode
- Zero-cost heuristics when cloud LLM unavailable
- Pattern-based insights (e.g., performance metrics, leadership indicators)
- Ensures system always works regardless of API status

## Usage

1. **Start Interview**: Click "Start Interview" button
2. **Answer Questions**: Speak naturally - insights generate automatically
3. **View Insights**: See real-time AI analysis in the transcript pane
4. **Complete Interview**: Click "Generate Final Report" when done
5. **View Report**: Navigate to the reports page for final summary

## Cost Optimization

- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Token Budget**: 12,000 tokens ≈ $0.01-0.02 per session
- **Rules Fallback**: Zero cost when budget exceeded
- **Browser STT/TTS**: Free (no server audio processing)

## Troubleshooting

### No Insights Generated
- Check if OPENAI_API_KEY is set in .env.local
- Verify API key is valid and has credits
- Check browser console for error messages

### Always in Rules Mode
- Verify environment variables are loaded
- Check if token budget is exceeded
- Ensure .env.local is in project root

### API Errors
- Verify OpenAI API key is correct
- Check API rate limits and quotas
- Ensure internet connectivity

## Development

The system automatically detects environment configuration and adapts:
- With API key: Cloud LLM mode with token budgeting
- Without API key: Rules mode only (zero cost)
- Token cap exceeded: Automatic fallback to rules mode
