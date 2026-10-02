import type { MessageSegment } from '@/types'

/**
 * Parse a single paragraph/line into typed segments.
 *
 * Rules:
 *   - ~text in tildes~        → reaction / inner feeling / sensation (warm amber italic)
 *   - *text in asterisks*    → scenario / narration / action (soft blush pink italic)
 *   - "text in quotes"       → spoken dialogue (crisp white regular)
 *   - Bare text (no markers) → spoken dialogue (crisp white regular)
 *
 * If a ~ or * opens but never closes, everything after it is treated as that type
 * until end of paragraph. This handles AI responses that forget to close markers.
 */
export function parseMessageContent(raw: string): MessageSegment[] {
  if (!raw.trim()) return []

  // Check if the text has any formatting markers at all
  const hasMarkers = /[~*"]/.test(raw)
  if (!hasMarkers) {
    return [{ type: 'dialogue', text: raw.trim() }]
  }

  const segments: MessageSegment[] = []

  // Pattern matches:
  // 1. ~text~        (thought, closed)
  // 2. ~text$         (thought, unclosed — till end of string)
  // 3. *text*        (narration, closed)
  // 4. *text$         (narration, unclosed — till end of string)
  // 5. "text"        (dialogue, closed)
  // 6. bare text     (dialogue, no markers)
  const pattern = /(~[^~]+~)|(~[^~]+$)|(\*[^*]+\*)|(\*[^*]+$)|("(?:[^"\\]|\\.)*")|([^~*"]+)/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(raw)) !== null) {
    const [full] = match

    if (match[1]) {
      // ~text~ (closed thought)
      const text = full.slice(1, -1).trim()
      if (text) segments.push({ type: 'thought', text })
    } else if (match[2]) {
      // ~text (unclosed thought — runs to end)
      const text = full.slice(1).trim()
      if (text) segments.push({ type: 'thought', text })
    } else if (match[3]) {
      // *text* (closed narration)
      const text = full.slice(1, -1).trim()
      if (text) segments.push({ type: 'narration', text })
    } else if (match[4]) {
      // *text (unclosed narration — runs to end)
      const text = full.slice(1).trim()
      if (text) segments.push({ type: 'narration', text })
    } else if (match[5]) {
      // "text" (dialogue)
      const text = full.slice(1, -1).trim()
      if (text) segments.push({ type: 'dialogue', text })
    } else if (match[6]) {
      // bare text (dialogue)
      const text = full.trim()
      if (text) segments.push({ type: 'dialogue', text })
    }
  }

  // Merge consecutive segments of the same type
  const merged: MessageSegment[] = []
  for (const seg of segments) {
    const prev = merged[merged.length - 1]
    if (prev && prev.type === seg.type) {
      prev.text += ' ' + seg.text
    } else {
      merged.push({ ...seg })
    }
  }

  return merged.length > 0 ? merged : [{ type: 'dialogue', text: raw.trim() }]
}

/**
 * Splits raw message text into paragraphs (by double newlines),
 * and parses each paragraph into typed segments.
 */
export function parseMessageParagraphs(raw: string): MessageSegment[][] {
  if (!raw.trim()) return []
  const blocks = raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((block) => parseMessageContent(block))
}
