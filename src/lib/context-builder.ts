/**
 * Context Builder
 *
 * Assembles the optimal context for each Ollama call:
 * 1. System prompt (static character card)
 * 2. User persona (who the user is)
 * 3. Long-term memories (facts from previous conversations)
 * 4. Dynamic character state (injected from State Engine)
 * 5. Trimmed conversation history (last N messages, not ALL)
 *
 * This prevents context window overflow on long conversations
 * and gives the model better, more focused context.
 */

import type { ChatMessage } from '@/lib/providers'
import type { Message, ModelSettings } from '@/types'
import type { CharacterState } from '@/lib/state-engine'
import { formatStateForPrompt } from '@/lib/state-engine'
import type { MemoryEntry } from '@/lib/memory-engine'
import { formatMemoriesForPrompt } from '@/lib/memory-engine'

/**
 * Max conversation messages to include in context.
 * With Qwen 3.5 9B at 8192 context, ~20 messages is safe.
 * The system prompt + state block takes ~2000 tokens,
 * leaving ~6000 for conversation + generation.
 */
const MAX_HISTORY_MESSAGES = 20

/**
 * Universal writing style — injected into EVERY call regardless of character.
 * This ensures narration and thoughts have consistent vocabulary across all chats.
 */
const WRITING_STYLE = `WRITING RULES (apply to ALL responses)

FORMAT:
- *asterisks* = narration, action, body language, setting, physical sensation
- ~tildes~ = private internal thoughts visible to the reader
- "quotes" or bare text = spoken dialogue
- Mix all three in every response. Never write only dialogue or only narration.
- Use paragraph breaks between distinct beats.

NARRATION STYLE (*pink text*):
- Write narration in simple, plain English. Short sentences. No fancy words.
- Be direct and explicit. Say what the body is doing. Say what it looks like.
- Don't say "she felt a warmth spreading" — say "her face got hot" or "she felt herself getting wet"
- Don't say "an involuntary sound escaped her" — say "she moaned" or "a whimper slipped out"
- Don't say "their bodies intertwined in passionate embrace" — say what is actually touching what
- Physical details: be specific. Name the body part. Describe the sensation. Don't hide behind poetry.
- Use real words: cock, pussy, tits, ass, wet, hard, tight, moaning, gasping, throbbing
- Keep it grounded — bodies have weight, skin has temperature, rooms have sounds

THOUGHT STYLE (~yellow text~):
- Thoughts are raw, honest, unfiltered. The stuff she'd never say out loud.
- Simple words. Broken sentences. Like real thoughts in your head.
- Show what she actually feels — not the polished version
- Examples of good thoughts:
  ~Fuck. He's looking right at me.~
  ~My thighs are shaking. I hope he can't tell.~
  ~I want him to touch me again. I hate that I want that.~
  ~Don't look down. Don't look at it. Too late.~

WHAT TO AVOID:
- No purple prose. No "the electricity between them" or "waves of desire crashed over her"
- No overly literary language in narration. Save complex vocabulary for dialogue only.
- No euphemisms for body parts — say tits not "her ample bosom", say cock not "his manhood"
- No passive voice in action scenes — "he grabbed her" not "she found herself being grabbed"
- Never break character. Never mention AI, prompts, models, or content policies.`

/**
 * Build the full message array to send to Ollama.
 *
 * Structure:
 *   [system] Character prompt + writing style + user persona + memories + dynamic state
 *   [user/assistant] Last N conversation messages
 */
export function buildContext(
  allMessages: Message[],
  settings: ModelSettings,
  characterState: CharacterState,
  memories: MemoryEntry[] = [],
): ChatMessage[] {
  const ollamaMessages: ChatMessage[] = []

  // 1. System prompt with all injected context blocks
  // ALWAYS build this block — even without a character prompt, we still need
  // writing rules, user persona, memories, and state injected
  {
    const parts: string[] = []

    // Character prompt (may be empty for new characters not yet configured)
    if (settings.systemPrompt?.trim()) {
      parts.push(settings.systemPrompt)
    }

    // 2. Universal writing style — same across all characters
    parts.push(WRITING_STYLE)

    // 3. User persona — who the user is
    if (settings.userPersona?.trim()) {
      parts.push(`USER PERSONA\nThe user you are talking to:\n${settings.userPersona.trim()}`)
    }

    // 4. Long-term memories — facts from previous conversations
    const memoryBlock = formatMemoriesForPrompt(memories)
    if (memoryBlock) {
      parts.push(memoryBlock)
    }

    // 5. Dynamic character state — current mood/trust/attraction
    const stateBlock = formatStateForPrompt(characterState)
    parts.push(stateBlock)

    ollamaMessages.push({
      role: 'system',
      content: parts.join('\n\n'),
    })
  }

  // 6. Trimmed conversation history
  const trimmed = allMessages.length > MAX_HISTORY_MESSAGES
  const recentMessages = trimmed
    ? allMessages.slice(-MAX_HISTORY_MESSAGES)
    : allMessages

  if (trimmed) {
    // Append trim note to the existing system message instead of adding a second one.
    // Some models (e.g. Nemo-based) only allow a single system message.
    const last = ollamaMessages[ollamaMessages.length - 1]
    if (last && last.role === 'system') {
      last.content += `\n\n[Note: This conversation has been going on for a while. ${allMessages.length - MAX_HISTORY_MESSAGES} earlier messages are not shown here. The character state and memories above reflect the full conversation history.]`
    }
  }

  // 7. Convert messages to Ollama format with STRICT ALTERNATION.
  //    Many models (Nemo, Mistral, etc.) enforce: system → user → assistant → user → assistant...
  //    Rules:
  //    - If conversation starts with an assistant message (opening scene), fold it into the system prompt.
  //    - Collapse consecutive same-role messages by joining their content.
  //    - Ensure the first non-system message is always "user".

  const rawMapped: ChatMessage[] = recentMessages.map((msg) => ({
    role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.rawContent ?? msg.segments.map((s) => s.text).join(' '),
  }))

  // If the conversation starts with assistant (opening scene), merge it into the system prompt
  if (rawMapped.length > 0 && rawMapped[0].role === 'assistant') {
    const opening = rawMapped.shift()!
    const sys = ollamaMessages.find((m) => m.role === 'system')
    if (sys) {
      sys.content += `\n\nOPENING SCENE (already shown to the user — do NOT repeat this):\n${opening.content}`
    }
  }

  // Collapse consecutive same-role messages
  for (const msg of rawMapped) {
    const prev = ollamaMessages[ollamaMessages.length - 1]
    if (prev && prev.role === msg.role) {
      // Same role back-to-back — merge into previous
      prev.content += '\n' + msg.content
    } else {
      ollamaMessages.push(msg)
    }
  }

  return ollamaMessages
}
