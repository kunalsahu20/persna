/**
 * Memory Engine
 *
 * Extracts and stores long-term facts about the user and the relationship
 * across conversations. After each AI response, we extract key facts
 * in the background and persist them per-character in localStorage.
 *
 * Before each AI call, relevant memories are injected into the context
 * so the character "remembers" things from previous conversations.
 */

import { type ChatMessage } from '@/lib/providers'
import type { ModelSettings } from '@/types'

/* ─── Types ─── */
export interface MemoryEntry {
  id: string
  fact: string          // the extracted fact
  category: 'user' | 'relationship' | 'event' | 'preference' | 'secret'
  importance: number    // 1-10, used for pruning
  createdAt: number
}

/* ─── Extraction Prompt ─── */
const MEMORY_EXTRACTION_PROMPT = `You are a memory extractor. Given the latest messages from a roleplay conversation, extract any NEW important facts worth remembering long-term.

Focus on:
- Facts about the USER (name, age, appearance, preferences, habits, likes, dislikes)
- Relationship milestones (first meeting, first kindness, first touch, confessions)
- Important events (user defended character, a fight, a gift, a promise)
- Preferences expressed (favorite things, things they hate, opinions)
- Secrets shared (things told in confidence)

Rules:
- Only extract NEW facts not already known
- Keep each fact as a single clear sentence
- Do not extract trivial things (greetings, small talk)
- Do not extract things the character said — only things ABOUT the user or the relationship
- Maximum 3 facts per extraction (quality over quantity)
- If nothing noteworthy happened, return an empty array

Output ONLY valid JSON array, no explanation:
[
  {"fact": "short clear sentence", "category": "user|relationship|event|preference|secret", "importance": 1-10}
]

If nothing new is worth remembering, output: []`

import { saveData, loadData, deleteData } from '@/lib/sync'

/* ─── Storage ─── */
const STORAGE_PREFIX = 'velvet-memories-'

export function loadMemories(characterId: string): MemoryEntry[] {
  return loadData<MemoryEntry[]>(STORAGE_PREFIX + characterId, [])
}

export function saveMemories(characterId: string, memories: MemoryEntry[]): void {
  saveData(STORAGE_PREFIX + characterId, memories)
}

export function deleteMemories(characterId: string): void {
  deleteData(STORAGE_PREFIX + characterId)
}

/* ─── Deduplication ─── */
function isDuplicate(existing: MemoryEntry[], newFact: string): boolean {
  const normalized = newFact.toLowerCase().trim()
  return existing.some((m) => {
    const existingNorm = m.fact.toLowerCase().trim()
    // Exact match
    if (existingNorm === normalized) return true
    // High overlap (80%+ of words match)
    const newWords = new Set(normalized.split(/\s+/))
    const existingWords = existingNorm.split(/\s+/)
    const overlap = existingWords.filter((w) => newWords.has(w)).length
    return overlap / Math.max(existingWords.length, 1) > 0.8
  })
}

/* ─── Extract Memories ─── */
export async function extractMemories(
  recentMessages: ChatMessage[],
  existingMemories: MemoryEntry[],
  settings: ModelSettings,
): Promise<MemoryEntry[]> {
  if (!settings.model) return []

  // Only use the last 6 messages for extraction (the new stuff)
  const contextMessages = recentMessages.slice(-6)
  if (contextMessages.length < 2) return []

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        options: { temperature: 0.1, num_predict: 512 },
        messages: [
          { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Existing memories (do NOT re-extract these):\n${
              existingMemories.map((m) => `- ${m.fact}`).join('\n') || '(none yet)'
            }\n\nNew messages to analyze:\n${contextMessages
              .map((m) => `${m.role}: ${m.content}`)
              .join('\n\n')}\n\nExtract new facts as JSON array.`,
          },
        ],
      }),
    })

    const data = await response.json()
    const content = data?.message?.content?.trim() ?? ''

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const extracted: Array<{ fact: string; category: string; importance: number }> =
      JSON.parse(jsonMatch[0])

    if (!Array.isArray(extracted) || extracted.length === 0) return []

    // Filter duplicates and create entries
    const newMemories: MemoryEntry[] = []
    for (const item of extracted) {
      if (!item.fact || typeof item.fact !== 'string') continue
      if (isDuplicate(existingMemories, item.fact)) continue
      if (isDuplicate(newMemories, item.fact)) continue

      newMemories.push({
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fact: item.fact,
        category: (['user', 'relationship', 'event', 'preference', 'secret'].includes(item.category)
          ? item.category
          : 'event') as MemoryEntry['category'],
        importance: Math.min(10, Math.max(1, item.importance || 5)),
        createdAt: Date.now(),
      })
    }

    return newMemories
  } catch (err) {
    console.warn('[MemoryEngine] Extraction failed:', err)
    return []
  }
}

/* ─── Format Memories for Prompt Injection ─── */
const MAX_MEMORIES_IN_PROMPT = 30

export function formatMemoriesForPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) return ''

  // Sort by importance (desc), then recency (desc)
  const sorted = [...memories]
    .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt)
    .slice(0, MAX_MEMORIES_IN_PROMPT)

  // Group by category for readability
  const grouped: Record<string, string[]> = {}
  for (const mem of sorted) {
    if (!grouped[mem.category]) grouped[mem.category] = []
    grouped[mem.category].push(mem.fact)
  }

  const categoryLabels: Record<string, string> = {
    user: 'About the user',
    relationship: 'Relationship',
    event: 'Past events',
    preference: 'Preferences',
    secret: 'Secrets shared',
  }

  let output = 'LONG-TERM MEMORY\nThese are things you remember from previous conversations. Reference them naturally when relevant — do not list them or force them into conversation.\n\n'

  for (const [cat, facts] of Object.entries(grouped)) {
    output += `${categoryLabels[cat] || cat}:\n`
    for (const fact of facts) {
      output += `- ${fact}\n`
    }
    output += '\n'
  }

  return output.trim()
}
