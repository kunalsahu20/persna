import { Menu, Settings, Cpu } from 'lucide-react'
import { useStore } from '@/lib/store'

/** Map state mood strings to emoji for the badge */
const MOOD_EMOJI: Record<string, string> = {
  composed: '💬',
  amused: '😏',
  flustered: '😳',
  annoyed: '😤',
  relaxed: '😌',
  nervous: '😨',
  playful: '😜',
  guarded: '🛡️',
  warm: '💕',
  conflicted: '😔',
  embarrassed: '🫣',
  curious: '🤔',
  teasing: '😈',
  vulnerable: '🥺',
  happy: '😊',
  sad: '😢',
  intense: '🔥',
  skeptical: '😒',
  shy: '🫣',
}

function getMoodEmoji(mood: string): string {
  return MOOD_EMOJI[mood.toLowerCase()] ?? '💬'
}

export function CharacterHeader() {
  const { character, toggleLeftSidebar, toggleRightSidebar, settings, status, characterState } = useStore()

  return (
    <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {/* Hamburger — sidebar toggle */}
      <button
        onClick={toggleLeftSidebar}
        className="grid size-8 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
        aria-label="Open chats"
      >
        <Menu size={18} />
      </button>

      {/* Avatar with glow */}
      <div className="avatar-glow grid size-9 place-items-center rounded-full bg-[var(--color-surface-2)] text-lg select-none">
        {character.avatar}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-medium leading-tight text-[var(--color-text-primary)]">
          {character.name}
        </h1>
        <div className="flex items-center gap-2">
          {/* Online / Typing status */}
          <div className="flex items-center gap-1.5">
            {status === 'generating' ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[var(--color-accent)]" />
                </span>
                <span className="text-xs leading-tight text-[var(--color-accent)]">
                  typing…
                </span>
              </>
            ) : (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" style={{ animationDuration: '3s' }} />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-xs leading-tight text-[var(--color-text-tertiary)]">
                  Online
                </span>
              </>
            )}
          </div>

          {/* Mood badge — driven by State Engine, not keyword matching */}
          {status !== 'generating' && (
            <span className="emotion-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] transition-all">
              <span>{getMoodEmoji(characterState.mood)}</span>
              <span className="capitalize">{characterState.mood}</span>
            </span>
          )}
        </div>
      </div>

      {/* Model badge */}
      {settings.model && (
        <div className="hidden items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-text-tertiary)] sm:flex">
          <Cpu size={12} className={status === 'generating' ? 'text-[var(--color-accent)] animate-pulse' : ''} />
          <span className="max-w-24 truncate">{settings.model}</span>
        </div>
      )}

      {/* Settings toggle */}
      <button
        onClick={toggleRightSidebar}
        className="grid size-8 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
        aria-label="Settings"
      >
        <Settings size={18} />
      </button>
    </header>
  )
}

