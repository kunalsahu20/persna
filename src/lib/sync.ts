/**
 * Sync Layer v3 — Cross-Device Storage (Fixed)
 *
 * RULE: Server is the source of truth. Always PULL on mount, never bulk-push.
 *
 * Flow:
 * - On mount: PULL from server → seed localStorage (both PC and phone)
 * - On every user action: save to BOTH localStorage AND server (via saveData)
 * - Migration: only push if server is completely empty (first-ever run)
 *
 * This eliminates the race condition where multiple tabs/devices
 * overwrite each other's data.
 */

const API_BASE = '/api/storage'

/* ─── Core Storage Functions ─── */

/** Read a value (sync, from localStorage cache) */
export function loadData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) return JSON.parse(raw)
  } catch { /* ignore */ }
  return fallback
}

/** Debounce timers per key — prevents hammering server during streaming */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Write a value to both localStorage (instant) and server (debounced) */
export function saveData(key: string, value: unknown): void {
  // localStorage updates instantly for UI responsiveness
  localStorage.setItem(key, JSON.stringify(value))

  // Debounce server writes — wait 500ms of inactivity before saving
  const existing = debounceTimers.get(key)
  if (existing) clearTimeout(existing)

  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key)
    fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }).catch(() => {})
  }, 500))
}

/** Delete a value from both localStorage and server */
export function deleteData(key: string): void {
  localStorage.removeItem(key)
  fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  }).catch(() => {})
}

/* ─── Initial Sync ─── */

/**
 * On mount:
 * 1. Try to pull ALL data from server
 * 2. If server has velvet-chats → write everything to localStorage → return true (re-render)
 * 3. If server is empty → push localStorage to server (one-time migration) → return false
 *
 * NEVER bulk-push if server already has data. Individual saves handle ongoing sync.
 */
export async function initialSync(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}`)
    if (!res.ok) {
      console.warn('[Sync] Server returned', res.status)
      return false
    }

    const serverData: Record<string, unknown> = await res.json()
    const serverHasChats = serverData && 'velvet-chats' in serverData

    if (serverHasChats) {
      // Server has data — use it as source of truth
      for (const [key, value] of Object.entries(serverData)) {
        localStorage.setItem(key, JSON.stringify(value))
      }
      console.log(`[Sync] Pulled ${Object.keys(serverData).length} keys from server`)
      return true // re-render with server data
    }

    // Server is empty — one-time migration from localStorage
    const localKeys: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('velvet-')) {
        try {
          localKeys[key] = JSON.parse(localStorage.getItem(key) || 'null')
        } catch {
          localKeys[key] = localStorage.getItem(key)
        }
      }
    }

    if (Object.keys(localKeys).length > 0) {
      // Push each key individually
      await Promise.all(
        Object.entries(localKeys).map(([key, value]) =>
          fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
          }).catch(() => {})
        )
      )
      console.log(`[Sync] Migrated ${Object.keys(localKeys).length} keys to server (first run)`)
    }

    return false // no re-render needed, localStorage already has correct data
  } catch (err) {
    console.warn('[Sync] Server unreachable:', err)
    return false
  }
}
