# Interview Mode Implementation

This document describes the minimal, safe, drop-in implementation for persistent interview modes and conversational flow.

## What Was Implemented

### 1. Persistent Mode Selection (`useInterviewMode` hook)
- **Location**: `src/hooks/useInterviewMode.ts`
- **Purpose**: Reads URL first, then localStorage, never overwrites explicit choices
- **Usage**: Automatically integrated into campaign dashboard and interview runner

### 2. Conversational Flow (`useConversationalFlow` hook)
- **Location**: `src/hooks/useConversationalFlow.ts`
- **Purpose**: Generates follow-up questions from candidate answers
- **Features**: 
  - Disables "Next" button while generating
  - Auto-advances when follow-up is ready
  - Integrates with existing insight generation

### 3. Follow-up Question Generation
- **Location**: `src/services/generateFollowUpQuestion.ts`
- **Purpose**: Wrapper around existing insight function for follow-ups
- **Fallback**: Generic questions if AI generation fails

### 4. Session ID Persistence
- **Implementation**: Stores real Firebase session ID in localStorage
- **Purpose**: Fixes "No transcript" issues on reports page
- **Location**: `interview:activeSessionId` in localStorage

### 5. UI Improvements
- **Agent Thinking Indicator**: Shows spinner when generating follow-ups
- **Next Button State**: Properly disabled during AI generation
- **Progress Tracking**: Accurate question counting for both modes

## How It Works

### Structured Mode (Default)
- Uses predefined question bank
- Auto-advances after answers
- Standard interview flow

### Conversational Mode
- Starts with seed question
- Generates AI follow-ups from candidate answers
- No fallback to structured questions after Q1
- Real-time question generation

### Mode Persistence
1. URL parameter `?m=conversational` sets mode
2. Stored in localStorage as `interview:mode`
3. Never overwritten by campaign settings
4. Survives page refreshes and navigation

## Integration Points

### Campaign Dashboard
- Mode selection via URL parameters
- Persistent mode storage
- Proper session creation links

### Interview Runner
- Mode-aware question handling
- Conversational flow integration
- Real session ID creation and storage

### Reports Page
- Prefers real session ID from localStorage
- Falls back to route parameter
- Eliminates "No transcript" false negatives

## Usage Examples

### Start Conversational Interview
```
/campaign/abc123?m=conversational
/i/demo123?c=abc123&m=conversational
```

### Start Structured Interview
```
/campaign/abc123?m=structured
/i/demo123?c=abc123&m=structured
```

## Technical Details

### Hooks
- `useInterviewMode`: Mode persistence and URL sync
- `useConversationalFlow`: Follow-up generation and flow control

### Services
- `generateFollowUpQuestion`: AI-powered follow-up generation
- Reuses existing insight infrastructure

### State Management
- Session store integration
- Firebase session creation
- Local storage persistence

## Benefits

1. **No Breaking Changes**: Drop-in implementation
2. **Persistent Modes**: User choices never lost
3. **Real Session IDs**: Fixes transcript loading issues
4. **AI Follow-ups**: Natural conversational flow
5. **Better UX**: Clear indicators and proper button states

## Future Enhancements

- Custom follow-up question templates
- Mode-specific interview configurations
- Advanced conversational branching
- Multi-language support for follow-ups
