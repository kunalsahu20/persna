/**
 * Ollama Cloud Provider
 *
 * Connects to Ollama's hosted cloud API at https://ollama.com/api.
 * Requires an API key from https://ollama.com/settings/keys.
 * Uses the exact same API format as local Ollama — only the base URL and auth header differ.
 *
 * Cloud models have names ending in ":cloud" (e.g. "glm-5.3-flash:cloud").
 * The API key is stored in the .env file as VITE_OLLAMA_CLOUD_API_KEY.
 */

import type { AvailableModel, ProviderConfig } from './types'

/** Read API key from env — set in .env as VITE_OLLAMA_CLOUD_API_KEY */
function getApiKey(): string {
  return import.meta.env.VITE_OLLAMA_CLOUD_API_KEY ?? ''
}

/**
 * Well-known cloud models on Ollama Cloud.
 * Since Ollama Cloud doesn't have a /api/tags equivalent for listing
 * available cloud models, we maintain a curated list here.
 * Add new cloud models as they become available.
 */
const CLOUD_MODELS: Array<{ name: string; displayName: string; parameterSize: string; family: string }> = [
  // { name: 'glm-5.3-flash:cloud', displayName: 'GLM 5.3 Flash', parameterSize: 'cloud', family: 'glm' },
  // { name: 'nemotron-3-ultra:cloud', displayName: 'nemotron 3 ultra', parameterSize: '550B', family: 'nemotron' },
  // { name: 'gemma4:31b', displayName: 'Gemma 4 31B', parameterSize: '31B', family: 'gemma' },
  // { name: 'qwen3.5:72b-cloud', displayName: 'Qwen 3.5 72B', parameterSize: '72B', family: 'qwen3' },
  // { name: 'llama4:scout', displayName: 'Llama 4 Scout', parameterSize: 'cloud', family: 'llama4' },
  // { name: 'deepseek-r1:70b', displayName: 'DeepSeek R1 70B', parameterSize: '70B', family: 'deepseek' },
]

export const ollamaCloudProvider: ProviderConfig = {
  id: 'ollama-cloud',
  name: 'Ollama Cloud',

  get enabled() {
    return getApiKey().length > 0
  },

  async fetchModels(): Promise<AvailableModel[]> {
    if (!getApiKey()) return []

    // Validate the API key by making a lightweight request
    try {
      const res = await fetch('https://ollama.com/api/tags', {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        // If the cloud supports listing models, use that
        const data = await res.json()
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          return data.models.map((m: Record<string, unknown>) => {
            const details = m.details as Record<string, unknown> | undefined
            return {
              name: m.name as string,
              source: 'ollama-cloud' as const,
              displayName: (m.name as string).replace(':cloud', ' (Cloud)'),
              badge: '☁️ Cloud',
              parameterSize: details?.parameter_size as string ?? 'cloud',
              family: details?.family as string ?? '',
            }
          })
        }
      }
    } catch {
      // Cloud listing not available — fall through to curated list
    }

    // Fallback: return curated list of known cloud models
    return CLOUD_MODELS.map((m) => ({
      name: m.name,
      source: 'ollama-cloud' as const,
      displayName: m.displayName,
      badge: '☁️ Cloud',
      parameterSize: m.parameterSize,
      family: m.family,
    }))
  },

  getBaseUrl() {
    // Direct cloud access — requests go to ollama.com
    return 'https://ollama.com'
  },

  getHeaders(): Record<string, string> {
    const key = getApiKey()
    if (!key) return {}
    return {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }
  },
}
