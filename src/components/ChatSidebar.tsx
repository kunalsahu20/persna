import { motion, AnimatePresence } from 'motion/react'
import { Plus, Pin, PinOff, Trash2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getCharacter } from '@/mock-data'

export function ChatSidebar() {
  const {
    chats,
    activeChatId,
    createChatForCharacter,
    deleteChat,
    togglePin,
    setActiveChat,
    leftSidebarOpen,
    toggleLeftSidebar,
    characters,
  } = useStore()

  const pinnedChats = chats.filter((c) => c.pinned)
  const unpinnedChats = chats.filter((c) => !c.pinned)

  return (
    <AnimatePresence>
      {leftSidebarOpen && (
        <>
          {/* Backdrop — mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={toggleLeftSidebar}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 left-0 z-50 flex h-full w-72 flex-col bg-[var(--color-surface-1)] lg:relative lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
                Chats
              </h2>
              <button
                onClick={toggleLeftSidebar}
                className="grid size-8 place-items-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] lg:hidden"
                aria-label="Close sidebar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="h-px bg-[var(--color-surface-3)]/40" />

            {/* Character Cards */}
            <div className="px-3 py-3 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] px-1 mb-2">
                Characters
              </p>
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => { createChatForCharacter(char.id); toggleLeftSidebar() }}
                  className="group flex w-full items-center gap-2.5 rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-left transition-all hover:bg-[var(--color-surface-3)] active:scale-[0.98]"
                  title={`New chat with ${char.name}`}
                >
                  <span className="text-lg">{char.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[var(--color-text-primary)]">{char.name}</div>
                    <div className="truncate text-[10px] text-[var(--color-text-tertiary)]">{char.tagline}</div>
                  </div>
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-3)]/60 text-[var(--color-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
                    <Plus size={12} />
                  </span>
                </button>
              ))}
            </div>

            <div className="h-px bg-[var(--color-surface-3)]/40" />

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {chats.length === 0 && (
                <p className="px-2 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                  No chats yet. Pick a character above!
                </p>
              )}

              {/* Pinned */}
              {pinnedChats.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 px-2 text-[10px] font-medium tracking-widest uppercase text-[var(--color-text-tertiary)]">
                    Pinned
                  </p>
                  {pinnedChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      id={chat.id}
                      title={chat.title}
                      characterId={chat.characterId}
                      pinned={chat.pinned}
                      active={chat.id === activeChatId}
                      messageCount={chat.messages.length}
                      onSelect={() => { setActiveChat(chat.id); toggleLeftSidebar() }}
                      onDelete={() => deleteChat(chat.id)}
                      onTogglePin={() => togglePin(chat.id)}
                    />
                  ))}
                </div>
              )}

              {/* Regular */}
              {unpinnedChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  id={chat.id}
                  title={chat.title}
                  characterId={chat.characterId}
                  pinned={chat.pinned}
                  active={chat.id === activeChatId}
                  messageCount={chat.messages.length}
                  onSelect={() => { setActiveChat(chat.id); toggleLeftSidebar() }}
                  onDelete={() => deleteChat(chat.id)}
                  onTogglePin={() => togglePin(chat.id)}
                />
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Chat list item ─── */
function ChatItem({
  title,
  characterId,
  pinned,
  active,
  messageCount,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  id: string
  title: string
  characterId: string
  pinned: boolean
  active: boolean
  messageCount: number
  onSelect: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const char = getCharacter(characterId)

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]/50'
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Character avatar instead of generic icon */}
      <span className="shrink-0 text-sm">{char.avatar}</span>

      <div className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="block truncate text-[10px] text-[var(--color-text-tertiary)]">
          {char.name}
        </span>
      </div>

      {messageCount > 0 && (
        <span className="shrink-0 text-[10px] text-[var(--color-text-tertiary)]">
          {messageCount}
        </span>
      )}

      {/* Actions — visible on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin() }}
          className="grid size-6 place-items-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          aria-label={pinned ? 'Unpin chat' : 'Pin chat'}
        >
          {pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="grid size-6 place-items-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
          aria-label="Delete chat"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
