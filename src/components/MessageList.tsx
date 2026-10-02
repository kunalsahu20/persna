import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Volume2, VolumeX, Copy, Check, RefreshCw } from 'lucide-react'
import { useStore } from '@/lib/store'
import { parseMessageParagraphs } from '@/lib/parse-message'
import { timeAgo } from '@/lib/time'
import type { Message, MessageSegment } from '@/types'

function getParagraphs(msg: Message): MessageSegment[][] {
  if (msg.rawContent) {
    const parsed = parseMessageParagraphs(msg.rawContent)
    if (parsed.length > 0) return parsed
  }
  return msg.segments.length > 0 ? [msg.segments] : []
}

/* ─── Character message ─── */
function CharacterMessage({ message, isLast }: { message: Message; isLast: boolean }) {
  const { character } = useStore()
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const paragraphs = getParagraphs(message)

  const handleCopy = async () => {
    const text = message.rawContent || message.segments.map((s) => s.text).join('\n')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard write failures in non-secure contexts
    }
  }

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    const text = message.rawContent || message.segments.map((s) => s.text).join(' ')
    // Strip markdown markers for cleaner TTS
    const clean = text.replace(/[*~"]/g, '')
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="avatar-glow mt-1 hidden size-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-base select-none sm:grid">
        {character.avatar}
      </div>

      {/* Message bubble card — glassmorphism */}
      <div className="msg-card group relative min-w-0 flex-1 rounded-2xl p-4 sm:p-5">
        {/* Header with character name */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-accent)] uppercase">
              {character.name}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {character.tagline}
            </span>
          </div>
        </div>

        {/* Paragraphs with inline segments */}
        <div className="space-y-3.5">
          {paragraphs.map((para, pIdx) => {
            const isLastPara = pIdx === paragraphs.length - 1

            return (
              <p key={pIdx} className="leading-relaxed text-[15px]">
                {para.map((seg, sIdx) => {
                  const isLastSeg = isLastPara && sIdx === para.length - 1
                  const showCursor = isLastSeg && message.isStreaming

                  const segClass =
                    seg.type === 'narration'
                      ? 'msg-narration'
                      : seg.type === 'thought'
                        ? 'msg-thought'
                        : 'msg-dialogue'

                  return (
                    <span
                      key={sIdx}
                      className={`${segClass} ${showCursor ? 'streaming-cursor' : ''} ${message.isStreaming ? 'word-fade-in' : ''}`}
                    >
                      {seg.text}
                      {sIdx < para.length - 1 ? ' ' : ''}
                    </span>
                  )
                })}
              </p>
            )
          })}
        </div>

        {/* Action bar + timestamp */}
        {!message.isStreaming && (
          <div className="mt-3 flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-[var(--color-text-tertiary)] select-none">
              {timeAgo(message.timestamp)}
            </span>
            <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              {isLast && (
                <RegenerateButton />
              )}
              <button
                onClick={handleSpeak}
                className="grid size-7 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                title={speaking ? 'Stop speech' : 'Read aloud'}
                aria-label={speaking ? 'Stop speech' : 'Read aloud'}
              >
                {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button
                onClick={handleCopy}
                className="grid size-7 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                title="Copy message"
                aria-label="Copy message"
              >
                {copied ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Regenerate button ─── */
function RegenerateButton() {
  const { regenerateLastResponse, status } = useStore()
  if (status === 'generating') return null

  return (
    <button
      onClick={regenerateLastResponse}
      className="grid size-7 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
      title="Regenerate response"
      aria-label="Regenerate response"
    >
      <RefreshCw size={14} />
    </button>
  )
}

/* ─── User message ─── */
function UserMessage({ message }: { message: Message }) {
  const content = message.rawContent || message.segments.map((s) => s.text).join('\n')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col items-end gap-1"
    >
      <div className="max-w-[85%] rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-text-primary)] shadow-sm sm:max-w-[70%]">
        {content}
      </div>
      <span className="mr-1 text-[10px] text-[var(--color-text-tertiary)] select-none">
        {timeAgo(message.timestamp)}
      </span>
    </motion.div>
  )
}

/* ─── Typing indicator ─── */
function TypingIndicator() {
  const { character } = useStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3"
    >
      <div className="hidden size-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-base select-none sm:grid">
        {character.avatar}
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-[var(--color-surface-1)] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block size-2 rounded-full bg-[var(--color-accent)]"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Empty state ─── */
function EmptyState() {
  const { character, settings, createChat } = useStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
      <div className="grid size-14 place-items-center rounded-full bg-[var(--color-surface-2)] text-2xl select-none">
        {character.avatar}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Start a conversation with {character.name}
      </p>
      <button
        onClick={createChat}
        className="rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        Start Opening Scenario
      </button>
      {!settings.model && (
        <p className="text-xs text-[var(--color-danger)]">
          No model selected — open Settings to choose one
        </p>
      )}
    </div>
  )
}

/* ─── Message List ─── */
export function MessageList() {
  const { messages, status } = useStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isTyping =
    status === 'generating' &&
    // Show typing dots until the first real content token arrives.
    // An isStreaming message with empty segments is just a placeholder —
    // the model hasn't produced any visible text yet.
    messages.every((m) => !m.isStreaming || m.segments.length === 0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  if (messages.length === 0) return <EmptyState />

  // Find the last character message index for the regenerate button
  const lastCharIdx = messages.reduce(
    (acc, m, i) => (m.role === 'character' ? i : acc),
    -1,
  )

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        {messages.map((msg, idx) => {
          // Hide the empty streaming placeholder — typing dots handle that state
          if (msg.isStreaming && msg.segments.length === 0) return null

          return msg.role === 'character' ? (
            <CharacterMessage
              key={msg.id}
              message={msg}
              isLast={idx === lastCharIdx}
            />
          ) : (
            <UserMessage key={msg.id} message={msg} />
          )
        })}

        <AnimatePresence>
          {isTyping && <TypingIndicator />}
        </AnimatePresence>


        <div ref={bottomRef} />
      </div>
    </div>
  )
}
