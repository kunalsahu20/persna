/**
 * Character State Engine
 *
 * Tracks the character's evolving emotional/relationship state across a conversation.
 * After each AI response, we make a quick non-streaming Ollama call to extract
 * the current state as structured JSON. This state is then injected into the
 * next prompt so the model knows how the character is currently feeling.
 *
 * This replaces the hardcoded keyword-based mood detection with dynamic,
 * model-driven state awareness.
 */

import type { ChatMessage } from '@/lib/providers'
import type { ModelSettings } from '@/types'

/* ─── Character State Interface ─── */
export interface CharacterState {
  mood: string             // e.g. "amused", "flustered", "annoyed", "relaxed"
  energy: string           // "high" | "medium" | "low"
  trust: string            // "guarded" | "warming" | "comfortable" | "intimate"
  irritation: number       // 0-10
  attraction: number       // 0-10
  vulnerability: number    // 0-10 (how emotionally exposed she feels)
  currentTopic: string     // what they're currently talking about
  unresolvedThreads: string[]  // things left hanging
  internalConflict: string // what the character is struggling with internally right now
}

export const DEFAULT_STATE: CharacterState = {
  mood: 'neutral',
  energy: 'medium',
  trust: 'guarded',
  irritation: 0,
  attraction: 0,
  vulnerability: 3,
  currentTopic: 'Just met',
  unresolvedThreads: [],
  internalConflict: '',
}

/* ─── State Extraction Prompt ─── */
const STATE_EXTRACTION_PROMPT = `You are a conversation analyst. Given the last few messages of a roleplay conversation, extract the main character's current emotional and relationship state.

Output ONLY valid JSON with this exact structure, no explanation:
{
  "mood": "one word describing dominant emotion (e.g. amused, flustered, annoyed, relaxed, nervous, playful, guarded, warm, conflicted, embarrassed, anxious, aroused, vulnerable)",
  "energy": "high or medium or low",
  "trust": "guarded or warming or comfortable or intimate",
  "irritation": 0-10,
  "attraction": 0-10,
  "vulnerability": 0-10,
  "currentTopic": "brief description of what they are talking about right now",
  "unresolvedThreads": ["anything left hanging or unresolved"],
  "internalConflict": "what the character is internally struggling with right now, if anything"
}

Be accurate based on the actual conversation content. Do not invent things not present in the conversation.`

/**
 * Extract character state from the recent conversation using Ollama.
 * Makes a quick non-streaming call with only the last few messages.
 */
export async function extractState(
  recentMessages: ChatMessage[],
  settings: ModelSettings,
): Promise<CharacterState> {
  try {
    // Only send last 6 messages for context (enough for state, keeps it fast)
    const contextMessages = recentMessages.slice(-6)

    const messages: ChatMessage[] = [
      { role: 'system', content: STATE_EXTRACTION_PROMPT },
      {
        role: 'user',
        content: `Here are the recent messages:\n\n${contextMessages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n\n')}\n\nExtract the character's current state as JSON.`,
      },
    ]

    const res = await fetch('/ollama/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
        options: {
          temperature: 0.3,  // Low temp for consistent JSON output
          num_predict: 300,  // State JSON is small
        },
      }),
    })

    if (!res.ok) {
      console.warn('State extraction failed:', res.status)
      return DEFAULT_STATE
    }

    const data = await res.json()
    const content = data.message?.content ?? ''

    // Extract JSON from the response (handle markdown code blocks too)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('No JSON found in state extraction response')
      return DEFAULT_STATE
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and clamp numeric fields
    return {
      mood: String(parsed.mood || 'composed'),
      energy: ['high', 'medium', 'low'].includes(parsed.energy) ? parsed.energy : 'medium',
      trust: ['guarded', 'warming', 'comfortable', 'intimate'].includes(parsed.trust)
        ? parsed.trust
        : 'warming',
      irritation: clamp(Number(parsed.irritation) || 0, 0, 10),
      attraction: clamp(Number(parsed.attraction) || 0, 0, 10),
      vulnerability: clamp(Number(parsed.vulnerability) || 0, 0, 10),
      currentTopic: String(parsed.currentTopic || 'general conversation'),
      unresolvedThreads: Array.isArray(parsed.unresolvedThreads)
        ? parsed.unresolvedThreads.map(String)
        : [],
      internalConflict: String(parsed.internalConflict || ''),
    }
  } catch (err) {
    console.warn('State extraction error:', err)
    return DEFAULT_STATE
  }
}

/**
 * Format the character state into a string block that gets injected
 * into the system prompt for the next turn.
 */
export function formatStateForPrompt(state: CharacterState): string {
  return `CURRENT CHARACTER STATE (internal — do not mention these labels directly)

Mood: ${state.mood}
Energy: ${state.energy}
Trust level: ${state.trust}
Irritation: ${state.irritation}/10
Attraction: ${state.attraction}/10
Vulnerability: ${state.vulnerability}/10
Current topic: ${state.currentTopic}
${state.unresolvedThreads.length > 0 ? `Unresolved: ${state.unresolvedThreads.join(', ')}` : ''}
${state.internalConflict ? `Internal conflict: ${state.internalConflict}` : ''}

Use this state to naturally influence the character's behavior, tone, body language, and dialogue. Do not explicitly state these values. Let them show through actions and words.`
}

import { saveData, loadData, deleteData } from '@/lib/sync'

/* ─── Persistence ─── */
const STATE_STORAGE_PREFIX = 'velvet-state-'

export function loadState(chatId: string): CharacterState {
  return loadData<CharacterState>(STATE_STORAGE_PREFIX + chatId, { ...DEFAULT_STATE })
}

export function saveState(chatId: string, state: CharacterState) {
  saveData(STATE_STORAGE_PREFIX + chatId, state)
}

export function deleteState(chatId: string) {
  deleteData(STATE_STORAGE_PREFIX + chatId)
}

/* ─── Util ─── */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
