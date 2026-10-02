/**
 * Local Ollama Provider
 *
 * Connects to Ollama running on localhost:11434.
 * No API key needed. Models are pulled/managed locally.
 */

import type { AvailableModel, ProviderConfig } from './types'

const BASE = '/ollama' // Proxied via Vite to localhost:11434

export const localOllamaProvider: ProviderConfig = {
  id: 'local',
  name: 'Local (Ollama)',
  enabled: true, // Always enabled — no API key needed

  async fetchModels(): Promise<AvailableModel[]> {
    try {
      const res = await fetch(`${BASE}/api/tags`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.models ?? []).map((m: Record<string, unknown>) => {
        const details = m.details as Record<string, unknown> | undefined
        return {
          name: m.name as string,
          source: 'local' as const,
          displayName: m.name as string,
          badge: '💻 Local',
          parameterSize: details?.parameter_size as string ?? '',
          family: details?.family as string ?? '',
        }
      })
    } catch {
      // Ollama not running — no local models
      return []
    }
  },

  getBaseUrl() {
    return BASE
  },

  getHeaders() {
    return {} // No auth for local
  },
}
