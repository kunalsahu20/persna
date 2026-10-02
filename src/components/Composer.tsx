import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUp, Square, AlertCircle } from 'lucide-react'
import { useStore } from '@/lib/store'

export function Composer() {
  const { sendMessage, stopGeneration, status, errorMessage, settings } = useStore()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isGenerating = status === 'generating'
  const canSend = input.trim().length > 0 && !isGenerating && !!settings.model

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  // Soft auto-focus — no scroll jump, just ready to type
  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true })
  }, [])

  // Re-focus after generation finishes so user can immediately type
  useEffect(() => {
    if (status === 'idle') {
      textareaRef.current?.focus({ preventScroll: true })
    }
  }, [status])

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSend) return
    sendMessage(input.trim())
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    // Re-focus after sending
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true })
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-[var(--color-surface-3)]/40 bg-[var(--color-surface-0)]">
      {/* Error bar */}
      <AnimatePresence>
        {status === 'error' && errorMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 pt-2 text-xs text-[var(--color-danger)] sm:px-6">
              <AlertCircle size={14} className="shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3 sm:px-6"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={settings.model ? 'Write a message…' : 'Select a model in Settings first'}
          rows={1}
          disabled={isGenerating || !settings.model}
          className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] disabled:opacity-50"
          aria-label="Message input"
        />

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={stopGeneration}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-danger)] text-white transition-colors hover:brightness-110"
              aria-label="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              type="submit"
              disabled={!canSend}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-text-tertiary)]"
              aria-label="Send message"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
