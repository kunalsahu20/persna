/**
 * Lightweight keyword-based mood detection from AI response text.
 * Scans for emotional cue words/phrases and returns the dominant mood.
 * No LLM call needed — runs instantly on the raw response text.
 */

export interface Mood {
  emoji: string
  label: string
}

const MOOD_PATTERNS: { mood: Mood; keywords: RegExp }[] = [
  { mood: { emoji: '😳', label: 'Flustered' }, keywords: /blush|flush|heat\s+(rush|spread|creep)|cheeks\s+(burn|warm|red)|face\s+(burn|warm|hot)|embarrass|mortif/i },
  { mood: { emoji: '💕', label: 'Warm' }, keywords: /smile\s+(soft|warm|gentle)|heart\s+(flutter|skip|warm|melt|pound)|tender|affection|fond(ly|ness)/i },
  { mood: { emoji: '😏', label: 'Amused' }, keywords: /smirk|grin|chuckle|laugh|snort|amuse|can't\s+help|bite.*(lip|smile)|corner.*(mouth|lip)/i },
  { mood: { emoji: '😤', label: 'Annoyed' }, keywords: /annoy|irritat|frustrat|roll.*(eyes|my\s+eyes)|scoff|huff|clench.*(jaw|teeth|fist)|narrow.*(eyes|my\s+eyes)/i },
  { mood: { emoji: '😨', label: 'Nervous' }, keywords: /nerv|anxious|swallow\s+hard|throat\s+tight|stomach\s+(drop|knot|churn|flip|twist)|hands?\s+(shak|trembl)|fidget/i },
  { mood: { emoji: '🥺', label: 'Vulnerable' }, keywords: /vulnerab|exposed|small\s+voice|voice\s+(crack|break|small|quiet|waver)|tear|sting.*(eye|behind)|chest\s+(tight|ache)/i },
  { mood: { emoji: '😊', label: 'Happy' }, keywords: /happy|beam|bright(en|ly)|light\s+up|genuine\s+(smile|laugh|grin)|joy|delight|warm(th|ing)/i },
  { mood: { emoji: '😒', label: 'Skeptical' }, keywords: /skeptic|doubt|suspicious|eyebrow\s+(raise|arch|lift|cock)|really\?|sure\s+about|you\s+serious/i },
  { mood: { emoji: '🫣', label: 'Shy' }, keywords: /shy|look\s+away|avoid.*(eyes|gaze|eye\s+contact)|glance\s+(down|away)|duck.*(head|face)|hide/i },
  { mood: { emoji: '😌', label: 'Relaxed' }, keywords: /relax|exhale|breathe|sigh\s+(of\s+relief|softly|quietly)|lean\s+back|settle|at\s+ease|comfortable/i },
  { mood: { emoji: '🔥', label: 'Intense' }, keywords: /intens|pulse\s+(race|quicken|hammer)|breath\s+(catch|hitch)|electric|shiver|goosebump|skin\s+(tingle|prickle)/i },
  { mood: { emoji: '😔', label: 'Sad' }, keywords: /sad|sorrow|lonely|miss\s+(you|her|him)|hollow|empty|weight\s+in.*(chest|heart)|heavy\s+(sigh|silence)/i },
]

const DEFAULT_MOOD: Mood = { emoji: '💬', label: 'Composed' }

/**
 * Detect the dominant mood from a message's raw text.
 * Returns the first matching mood pattern, or 'Composed' as default.
 */
export function detectMood(text: string): Mood {
  if (!text || text.length < 20) return DEFAULT_MOOD

  for (const { mood, keywords } of MOOD_PATTERNS) {
    if (keywords.test(text)) return mood
  }

  return DEFAULT_MOOD
}
