import { motion, AnimatePresence } from 'motion/react'
import { X, RotateCcw, RefreshCw, Loader2 } from 'lucide-react'
import { useStore } from '@/lib/store'

export function SettingsSidebar() {
  const {
    rightSidebarOpen,
    toggleRightSidebar,
    settings,
    updateSettings,
    resetSettings,
    models,
    refreshModels,
    modelsLoading,
    character,
    characterPrompt,
    updateCharacterPrompt,
  } = useStore()

  return (
    <AnimatePresence>
      {rightSidebarOpen && (
        <>
          {/* Backdrop — mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={toggleRightSidebar}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 z-50 flex h-full w-80 flex-col bg-[var(--color-surface-1)] lg:relative lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Settings
                </h2>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  {character.avatar} Editing for {character.name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={resetSettings}
                  className="grid size-8 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                  aria-label="Reset to defaults"
                  title="Reset to defaults"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={toggleRightSidebar}
                  className="grid size-8 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                  aria-label="Close settings"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="h-px bg-[var(--color-surface-3)]/40" />

            {/* Scrollable settings */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {/* Model Selection */}
              <Section title="Model">
                <div className="flex gap-2">
                  <select
                    value={settings.model}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    className="flex-1 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                  >
                    {models.length === 0 && (
                      <option value="">No models found</option>
                    )}
                    {models.map((m) => (
                      <option key={`${m.source}-${m.name}`} value={m.name}>
                        {m.badge} {m.displayName}{m.parameterSize ? ` (${m.parameterSize})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={refreshModels}
                    disabled={modelsLoading}
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
                    aria-label="Refresh models"
                  >
                    {modelsLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                </div>
                {settings.model && models.find((m) => m.name === settings.model) && (
                  <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                    {models.find((m) => m.name === settings.model)?.family}
                    {models.find((m) => m.name === settings.model)?.source === 'ollama-cloud' && ' · Ollama Cloud'}
                  </p>
                )}
              </Section>

              {/* System Prompt — PER CHARACTER */}
              <Section title={`${character.avatar} ${character.name}'s Persona`}>
                <textarea
                  value={characterPrompt}
                  onChange={(e) => updateCharacterPrompt(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  placeholder={`Enter ${character.name}'s character prompt...`}
                />
                <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                  This prompt is unique to {character.name}. Switch characters to edit theirs.
                </p>
              </Section>

              {/* User Persona */}
              <Section title="Your Persona">
                <textarea
                  value={settings.userPersona}
                  onChange={(e) => updateSettings({ userPersona: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  placeholder={"Name: ...\nAge: ...\nAppearance: ...\nPersonality: ..."}
                />
                <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                  Describe yourself so the character knows who you are. Leave blank to be anonymous.
                </p>
              </Section>

              {/* Streaming */}
              <Section title="Streaming">
                <Toggle
                  value={settings.streaming}
                  onChange={(v) => updateSettings({ streaming: v })}
                  label="Stream response"
                />
                <Toggle
                  value={settings.enableThinking}
                  onChange={(v) => updateSettings({ enableThinking: v })}
                  label="Enable thinking"
                />
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  When off, thinking models respond instantly. When on, they reason internally first (slower).
                </p>
              </Section>

              {/* Generation */}
              <Section title="Generation">
                <Slider
                  label="Temperature"
                  value={settings.temperature}
                  onChange={(v) => updateSettings({ temperature: v })}
                  min={0} max={2} step={0.05}
                  hint="Creativity. Lower = focused, higher = creative."
                />
                <Slider
                  label="Max Tokens"
                  value={settings.numPredict}
                  onChange={(v) => updateSettings({ numPredict: v })}
                  min={-1} max={8192} step={1}
                  hint="-1 = unlimited"
                  integer
                />
                <Slider
                  label="Context Window"
                  value={settings.numCtx}
                  onChange={(v) => updateSettings({ numCtx: v })}
                  min={512} max={131072} step={512}
                  hint="Tokens of context the model remembers."
                  integer
                />
              </Section>

              {/* Sampling */}
              <Section title="Sampling">
                <Slider
                  label="Top K"
                  value={settings.topK}
                  onChange={(v) => updateSettings({ topK: v })}
                  min={0} max={200} step={1}
                  hint="Number of top tokens to consider."
                  integer
                />
                <Slider
                  label="Top P"
                  value={settings.topP}
                  onChange={(v) => updateSettings({ topP: v })}
                  min={0} max={1} step={0.01}
                  hint="Nucleus sampling probability threshold."
                />
                <Slider
                  label="Min P"
                  value={settings.minP}
                  onChange={(v) => updateSettings({ minP: v })}
                  min={0} max={1} step={0.01}
                  hint="Minimum probability for token selection."
                />
                <Slider
                  label="TFS Z"
                  value={settings.tfsZ}
                  onChange={(v) => updateSettings({ tfsZ: v })}
                  min={0} max={2} step={0.05}
                  hint="Tail free sampling. 1.0 = disabled."
                />
              </Section>

              {/* Repetition */}
              <Section title="Repetition">
                <Slider
                  label="Repeat Penalty"
                  value={settings.repeatPenalty}
                  onChange={(v) => updateSettings({ repeatPenalty: v })}
                  min={0.5} max={2} step={0.05}
                  hint="Penalize repeated tokens."
                />
                <Slider
                  label="Repeat Last N"
                  value={settings.repeatLastN}
                  onChange={(v) => updateSettings({ repeatLastN: v })}
                  min={-1} max={512} step={1}
                  hint="Lookback window. -1 = full context, 0 = disabled."
                  integer
                />
              </Section>

              {/* Mirostat */}
              <Section title="Mirostat">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Mode</label>
                  <select
                    value={settings.mirostat}
                    onChange={(e) => updateSettings({ mirostat: Number(e.target.value) })}
                    className="w-full rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                  >
                    <option value={0}>Disabled</option>
                    <option value={1}>Mirostat 1</option>
                    <option value={2}>Mirostat 2</option>
                  </select>
                </div>
                {settings.mirostat > 0 && (
                  <>
                    <Slider
                      label="Tau"
                      value={settings.mirostatTau}
                      onChange={(v) => updateSettings({ mirostatTau: v })}
                      min={0} max={10} step={0.1}
                      hint="Target entropy / surprise level."
                    />
                    <Slider
                      label="Eta"
                      value={settings.mirostatEta}
                      onChange={(v) => updateSettings({ mirostatEta: v })}
                      min={0} max={1} step={0.01}
                      hint="Learning rate."
                    />
                  </>
                )}
              </Section>

              {/* Reproducibility */}
              <Section title="Reproducibility">
                <NumberInput
                  label="Seed"
                  value={settings.seed}
                  onChange={(v) => updateSettings({ seed: v })}
                  hint="-1 = random"
                />
              </Section>

              {/* Stop Sequences */}
              <Section title="Stop Sequences">
                <StopSequenceEditor
                  value={settings.stop}
                  onChange={(v) => updateSettings({ stop: v })}
                />
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Reusable setting components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Slider({
  label, value, onChange, min, max, step, hint, integer,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  hint?: string
  integer?: boolean
}) {
  const display = integer ? String(value) : value.toFixed(2)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
        <input
          type="number"
          value={display}
          onChange={(e) => {
            const v = integer ? parseInt(e.target.value) : parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          min={min}
          max={max}
          step={step}
          className="w-16 rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-right text-xs text-[var(--color-text-primary)] outline-none"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(integer ? parseInt(e.target.value) : parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="slider w-full accent-[var(--color-accent)]"
      />
      {hint && <p className="text-[10px] text-[var(--color-text-tertiary)]">{hint}</p>}
    </div>
  )
}

function NumberInput({
  label, value, onChange, hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
        className="w-full rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
      />
      {hint && <p className="text-[10px] text-[var(--color-text-tertiary)]">{hint}</p>}
    </div>
  )
}

function Toggle({
  value, onChange, label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between py-1"
      role="switch"
      aria-checked={value}
    >
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'
        }`}
      >
        <motion.div
          className="absolute top-0.5 size-4 rounded-full bg-white shadow-sm"
          animate={{ left: value ? 18 : 2 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        />
      </div>
    </button>
  )
}

function StopSequenceEditor({
  value, onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="space-y-2">
      {value.map((seq, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={seq}
            onChange={(e) => {
              const next = [...value]
              next[i] = e.target.value
              onChange(next)
            }}
            className="flex-1 rounded-lg bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
          />
          <button
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="grid size-8 place-items-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...value, ''])}
        className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        + Add stop sequence
      </button>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">
        Generation stops when any of these strings are produced.
      </p>
    </div>
  )
}
