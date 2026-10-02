import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  ChatSession,
  Message,
  ModelSettings,
  GenerationStatus,
  Character,
} from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import { parseMessageContent } from '@/lib/parse-message'
import { fetchAllModels, streamChat, type AvailableModel, type ChatMessage } from '@/lib/providers'
import { CHARACTER_REGISTRY, getCharacter, createOpeningMessage, createDefaultMessage } from '@/mock-data'
import { generateId } from '@/lib/uuid'
import { playSendSound, playReceiveSound, hapticTap } from '@/lib/sounds'
import {
  type CharacterState,
  DEFAULT_STATE,
  extractState,
  loadState,
  saveState,
  deleteState,
} from '@/lib/state-engine'
import { buildContext } from '@/lib/context-builder'
import {
  loadMemories,
  saveMemories,
  extractMemories,
} from '@/lib/memory-engine'
import { saveData, loadData, initialSync } from '@/lib/sync'

/* ─── Persistence keys ─── */
const STORAGE_KEY_CHATS = 'velvet-chats'
const STORAGE_KEY_SETTINGS_PREFIX = 'velvet-settings'

function createInitialSession(characterId: string): ChatSession {
  const char = getCharacter(characterId)
  return {
    id: generateId(),
    title: char.tagline.split('·')[1]?.trim() || 'New Chat',
    characterId: char.id,
    messages: [createOpeningMessage(char)],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function loadChats(): ChatSession[] {
  try {
    const parsed = loadData<ChatSession[] | null>(STORAGE_KEY_CHATS, null)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c: ChatSession) => {
        if (!c.messages || c.messages.length === 0) {
          return { ...c, messages: [createDefaultMessage()] }
        }
        return c
      })
    }
  } catch { /* ignore */ }
  return [createInitialSession('default')]
}

function saveChats(chats: ChatSession[]) {
  saveData(STORAGE_KEY_CHATS, chats)
}

function settingsKey(characterId: string): string {
  return `${STORAGE_KEY_SETTINGS_PREFIX}-${characterId}`
}

/* ── Global settings (model, temperature, userPersona — shared across ALL characters) ── */
const STORAGE_KEY_GLOBAL_SETTINGS = 'velvet-settings-global'

function loadGlobalSettings(): ModelSettings {
  try {
    // Try new global key first
    const parsed = loadData<Partial<ModelSettings> | null>(STORAGE_KEY_GLOBAL_SETTINGS, null)
    if (parsed) return { ...DEFAULT_SETTINGS, ...parsed }
    // Migration: try old per-character or legacy keys
    const legacy = loadData<Partial<ModelSettings> | null>('velvet-settings', null)
    if (legacy) return { ...DEFAULT_SETTINGS, ...legacy }
    // Try any existing per-character settings (migration from previous architecture)
    const oliviaSettings = loadData<Partial<ModelSettings> | null>(settingsKey('olivia'), null)
    if (oliviaSettings) return { ...DEFAULT_SETTINGS, ...oliviaSettings }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveGlobalSettings(settings: ModelSettings) {
  saveData(STORAGE_KEY_GLOBAL_SETTINGS, settings)
}

/* ── Per-character system prompt (ONLY the prompt, separate from model settings) ── */
const PROMPT_KEY_PREFIX = 'velvet-prompt'

function loadCharacterPrompt(characterId: string): string {
  try {
    const saved = loadData<string | null>(`${PROMPT_KEY_PREFIX}-${characterId}`, null)
    if (saved !== null) return saved
    // Migration: try loading from old per-character settings (for same characterId only)
    const oldSettings = loadData<Partial<ModelSettings> | null>(settingsKey(characterId), null)
    if (oldSettings?.systemPrompt) return oldSettings.systemPrompt
    // Migration: only for 'olivia' or 'default' — don't bleed Olivia's prompt into Camille
    if (characterId === 'olivia' || characterId === 'default') {
      const legacy = loadData<Partial<ModelSettings> | null>('velvet-settings', null)
      if (legacy?.systemPrompt) return legacy.systemPrompt
    }
  } catch { /* ignore */ }
  return '' // New characters start with an empty prompt, not another character's
}

function saveCharacterPrompt(characterId: string, prompt: string) {
  saveData(`${PROMPT_KEY_PREFIX}-${characterId}`, prompt)
}

/* ─── Context shape ─── */
interface AppStore {
  // Chats
  chats: ChatSession[]
  activeChatId: string | null
  activeChat: ChatSession | null
  createChat: () => void
  createChatForCharacter: (characterId: string) => void
  deleteChat: (id: string) => void
  togglePin: (id: string) => void
  setActiveChat: (id: string) => void

  // Messages
  messages: Message[]
  sendMessage: (text: string) => void
  regenerateLastResponse: () => void
  stopGeneration: () => void
  status: GenerationStatus
  errorMessage: string | null

  // Models
  models: AvailableModel[]
  refreshModels: () => Promise<void>
  modelsLoading: boolean

  // Settings (global — shared across all characters)
  settings: ModelSettings
  updateSettings: (partial: Partial<ModelSettings>) => void
  resetSettings: () => void

  // Character prompt (per-character — separate from global settings)
  characterPrompt: string
  updateCharacterPrompt: (prompt: string) => void

  // UI
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void

  // Characters
  characters: Character[]
  character: Character
  characterState: CharacterState
}

const StoreContext = createContext<AppStore | null>(null)

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/* ─── Provider ─── */
export function StoreProvider({ children }: { children: ReactNode }) {
  const characters = CHARACTER_REGISTRY

  // ── Chats ──
  const [chats, setChats] = useState<ChatSession[]>(loadChats)
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const saved = loadChats()
    return saved.length > 0 ? saved[0].id : null
  })

  // Guard: block ALL saves until sync completes
  const syncDoneRef = useRef(false)

  // Persist chats — only after sync is done
  useEffect(() => {
    if (syncDoneRef.current) saveChats(chats)
  }, [chats])

  // ── Cross-device sync: always pull from server ──
  useEffect(() => {
    initialSync().then((serverHadData) => {
      if (serverHadData) {
        // Server data is now in localStorage — reload everything
        const synced = loadChats()
        setChats(synced)
        const firstId = synced.length > 0 ? synced[0].id : null
        setActiveChatId(firstId)
        // Reload global settings + character prompt
        setSettings(loadGlobalSettings())
        const firstCharId = synced.length > 0 ? synced[0].characterId : characters[0].id
        setCharacterPrompt(loadCharacterPrompt(getCharacter(firstCharId).id))
      }
      // Unlock save effects AFTER sync is complete
      syncDoneRef.current = true
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null
  const messages = activeChat?.messages ?? []

  // Derive current character from the active chat
  const character = getCharacter(activeChat?.characterId ?? characters[0].id)

  const createChatForCharacter = useCallback((characterId: string) => {
    const session = createInitialSession(characterId)
    setChats((prev) => [session, ...prev])
    setActiveChatId(session.id)
  }, [])

  const createChat = useCallback(() => {
    // Default: create chat for the current character
    createChatForCharacter(character.id)
  }, [character.id, createChatForCharacter])

  const deleteChat = useCallback((id: string) => {
    deleteState(id) // Clean up persisted character state
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== id)
      if (remaining.length === 0) {
        const fresh = createInitialSession(characters[0].id)
        setActiveChatId(fresh.id)
        return [fresh]
      }
      setActiveChatId((current) => (current === id ? remaining[0].id : current))
      return remaining
    })
  }, [characters])

  const togglePin = useCallback((id: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    )
  }, [])

  const setActiveChat = useCallback((id: string) => {
    setActiveChatId(id)
  }, [])

  // ── Messages ──
  const updateChatMessages = useCallback(
    (chatId: string, updater: (msgs: Message[]) => Message[]) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, messages: updater(c.messages), updatedAt: Date.now() }
            : c,
        ),
      )
    },
    [],
  )

  // Auto-title: use first user message
  const autoTitle = useCallback(
    (chatId: string, text: string) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId && (c.title === 'New Chat' || c.title === 'Cafeteria' || c.title === 'Beach house')
            ? { ...c, title: text.slice(0, 50) + (text.length > 50 ? '…' : '') }
            : c,
        ),
      )
    },
    [],
  )

  // ── Models ──
  const [models, setModels] = useState<AvailableModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const refreshModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const list = await fetchAllModels()
      setModels(list)
      // Auto-select first model if none selected
      setSettings((prev) => {
        if (!prev.model && list.length > 0) {
          return { ...prev, model: list[0].name }
        }
        return prev
      })
    } catch (err) {
      console.error('Failed to fetch models:', err)
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // Load models on mount
  useEffect(() => { refreshModels() }, [refreshModels])

  // ── Settings (GLOBAL — shared across all characters) ──
  const [settings, setSettings] = useState<ModelSettings>(loadGlobalSettings)

  // Save global settings when they change
  useEffect(() => {
    if (syncDoneRef.current) saveGlobalSettings(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<ModelSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  const resetSettings = useCallback(() => {
    const model = settings.model // keep current model
    setSettings({ ...DEFAULT_SETTINGS, model })
  }, [settings.model])

  // ── Character Prompt (PER-CHARACTER — only this switches) ──
  const [characterPrompt, setCharacterPrompt] = useState<string>(() =>
    loadCharacterPrompt(getCharacter(loadChats()[0]?.characterId ?? 'olivia').id)
  )

  // Always keep a ref to the latest prompt so the switch effect reads fresh value
  const characterPromptRef = useRef(characterPrompt)
  useEffect(() => { characterPromptRef.current = characterPrompt }, [characterPrompt])

  // Track the previous character ID so we can save THEIR prompt before switching
  const prevCharIdRef = useRef(character.id)

  // When the character changes: save old character's prompt, then load new character's prompt
  useEffect(() => {
    if (prevCharIdRef.current !== character.id) {
      // Save the OLD character's prompt using the ref (always has the latest value)
      if (syncDoneRef.current) {
        saveCharacterPrompt(prevCharIdRef.current, characterPromptRef.current)
      }
      // Now switch to the new character's prompt
      prevCharIdRef.current = character.id
      setCharacterPrompt(loadCharacterPrompt(character.id))
    }
  }, [character.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save current character's prompt whenever it changes (keystrokes in the textarea)
  const savePromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateCharacterPrompt = useCallback((prompt: string) => {
    setCharacterPrompt(prompt)
    // Debounce save — don't hammer storage on every keystroke
    if (savePromptTimer.current) clearTimeout(savePromptTimer.current)
    savePromptTimer.current = setTimeout(() => {
      if (syncDoneRef.current) saveCharacterPrompt(character.id, prompt)
    }, 400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id])

  // ── Generation ──
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setStatus('idle')
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!settings.model) return

      setErrorMessage(null)

      // Auto-create chat if none exists
      let chatId: string
      if (activeChatId) {
        chatId = activeChatId
      } else {
        const session = createInitialSession(character.id)
        chatId = session.id
        setChats((prev) => [session, ...prev])
        setActiveChatId(chatId)
      }

      // Add user message
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        segments: [{ type: 'dialogue', text }],
        rawContent: text,
        timestamp: Date.now(),
      }
      updateChatMessages(chatId, (msgs) => [...msgs, userMsg])

      // Sensory feedback — send
      playSendSound()
      hapticTap(30)
      autoTitle(chatId, text)

      // Prepare context for Ollama using Context Builder + State Engine
      const existingChat = chats.find((c) => c.id === chatId)
      const allMessages = [...(existingChat?.messages ?? []), userMsg]

      // Load persisted character state for this chat
      const currentState = loadState(chatId)

      // Resolve which character this chat belongs to
      const chatCharacter = getCharacter(existingChat?.characterId ?? character.id)

      // Load long-term memories scoped to this character
      const memories = loadMemories(chatCharacter.id)

      // Merge: global settings (model, temp, userPersona) + this character's system prompt
      const prompt = loadCharacterPrompt(chatCharacter.id)
      const effectiveSettings: ModelSettings = { ...settings, systemPrompt: prompt }

      // Build optimized context: system prompt + persona + memories + state + trimmed history
      const ollamaMessages = buildContext(allMessages, effectiveSettings, currentState, memories)

      // Start generation — typing dots show automatically while
      // the streaming message has no segments yet
      setStatus('generating')

      const responseId = generateId()
      let accumulated = ''

      // Add empty assistant message (this replaces the typing dots with streaming text)
      updateChatMessages(chatId, (msgs) => [
        ...msgs,
        {
          id: responseId,
          role: 'character',
          segments: [],
          rawContent: '',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ])

      const controller = new AbortController()
      abortControllerRef.current = controller

      let firstTokenFired = false

      await streamChat(
        ollamaMessages,
        settings,
        // onToken
        (token) => {
          // Sensory feedback — first token arrival
          if (!firstTokenFired) {
            firstTokenFired = true
            playReceiveSound()
            hapticTap(50)
          }

          accumulated += token
          const segments = parseMessageContent(accumulated)
          updateChatMessages(chatId, (msgs) =>
            msgs.map((m) =>
              m.id === responseId
                ? { ...m, segments, rawContent: accumulated }
                : m,
            ),
          )
        },
        // onDone
        () => {
          updateChatMessages(chatId, (msgs) =>
            msgs.map((m) =>
              m.id === responseId ? { ...m, isStreaming: false } : m,
            ),
          )
          setStatus('idle')

          // Post-response: extract updated character state in background
          // This is a quick non-streaming call (~0.5s) that runs after the response
          // is fully displayed, so it doesn't add latency to the user experience.
          const postMessages: ChatMessage[] = allMessages.map((m) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.rawContent ?? m.segments.map((s) => s.text).join(' '),
          }))
          // Add the response that was just generated
          if (accumulated) {
            postMessages.push({ role: 'assistant', content: accumulated })
          }
          extractState(postMessages, settings).then((newState) => {
            saveState(chatId, newState)
            setCharacterState(newState)
          })

          // Extract long-term memories in background (scoped to this chat's character)
          const existingMemories = loadMemories(chatCharacter.id)
          extractMemories(postMessages, existingMemories, settings).then((newMemories) => {
            if (newMemories.length > 0) {
              saveMemories(chatCharacter.id, [...existingMemories, ...newMemories])
            }
          })
        },
        // onError
        (err) => {
          setErrorMessage(err.message)
          updateChatMessages(chatId, (msgs) =>
            msgs.map((m) =>
              m.id === responseId ? { ...m, isStreaming: false } : m,
            ),
          )
          setStatus('error')
        },
        controller.signal,
      )
    },
    [activeChatId, settings, chats, character.id, updateChatMessages, autoTitle],
  )

  // ── Regenerate last response ──
  const regenerateLastResponse = useCallback(() => {
    if (status === 'generating' || !activeChatId) return
    const chat = chats.find((c) => c.id === activeChatId)
    if (!chat || chat.messages.length < 2) return

    // Find the last user message (skip any trailing character messages)
    const msgs = [...chat.messages]
    // Remove last character message
    while (msgs.length > 0 && msgs[msgs.length - 1].role === 'character') {
      msgs.pop()
    }
    const lastUserMsg = msgs[msgs.length - 1]
    if (!lastUserMsg || lastUserMsg.role !== 'user') return

    const userText = lastUserMsg.rawContent ?? lastUserMsg.segments.map((s) => s.text).join(' ')

    // Remove the last character response from the chat
    updateChatMessages(activeChatId, (existing) => {
      const trimmed = [...existing]
      while (trimmed.length > 0 && trimmed[trimmed.length - 1].role === 'character') {
        trimmed.pop()
      }
      // Also remove the user message — sendMessage will re-add it
      if (trimmed.length > 0 && trimmed[trimmed.length - 1].role === 'user') {
        trimmed.pop()
      }
      return trimmed
    })

    // Re-send
    sendMessage(userText)
  }, [activeChatId, chats, status, updateChatMessages, sendMessage])

  // ── UI ──
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const toggleLeftSidebar = useCallback(() => setLeftSidebarOpen((v) => !v), [])
  const toggleRightSidebar = useCallback(() => setRightSidebarOpen((v) => !v), [])

  // ── Character state (loaded from persistence, updated after each response) ──
  const [characterState, setCharacterState] = useState<CharacterState>(() =>
    activeChatId ? loadState(activeChatId) : { ...DEFAULT_STATE },
  )

  // Reload state when switching chats
  useEffect(() => {
    if (activeChatId) {
      setCharacterState(loadState(activeChatId))
    } else {
      setCharacterState({ ...DEFAULT_STATE })
    }
  }, [activeChatId])

  const store: AppStore = {
    chats,
    activeChatId,
    activeChat,
    createChat,
    createChatForCharacter,
    deleteChat,
    togglePin,
    setActiveChat,
    messages,
    sendMessage,
    regenerateLastResponse,
    stopGeneration,
    status,
    errorMessage,
    models,
    refreshModels,
    modelsLoading,
    settings,
    updateSettings,
    resetSettings,
    characterPrompt,
    updateCharacterPrompt,
    leftSidebarOpen,
    rightSidebarOpen,
    toggleLeftSidebar,
    toggleRightSidebar,
    characters,
    character,
    characterState,
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
