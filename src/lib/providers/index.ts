/**
 * Provider Registry
 *
 * Central hub that manages all model providers.
 * - Fetches models from all enabled providers
 * - Merges them into a single list for the UI dropdown
 * - Routes requests to the correct provider based on model source
 *
 * To add a new provider in the future:
 * 1. Create a new file in providers/ implementing ProviderConfig
 * 2. Import and add it to the PROVIDERS array below
 * That's it — it will appear in the model dropdown automatically.
 */

import type { AvailableModel, ChatMessage, ModelSource, ProviderConfig } from './types'
import { localOllamaProvider } from './ollama-local'
import { ollamaCloudProvider } from './ollama-cloud'
import type { ModelSettings } from '@/types'

/* ─── All registered providers ─── */
const PROVIDERS: ProviderConfig[] = [
  localOllamaProvider,
  ollamaCloudProvider,
  // Future: openaiProvider, anthropicProvider, openrouterProvider, etc.
]

/* ─── Model Registry (tracks which provider owns which model) ─── */
const modelSourceMap = new Map<string, ModelSource>()

/** Fetch models from ALL enabled providers and merge into one list */
export async function fetchAllModels(): Promise<AvailableModel[]> {
  const results = await Promise.allSettled(
    PROVIDERS
      .filter((p) => p.enabled)
      .map((p) => p.fetchModels()),
  )

  const allModels: AvailableModel[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const model of result.value) {
        allModels.push(model)
        modelSourceMap.set(model.name, model.source)
      }
    }
  }

  return allModels
}

/** Get which provider a model belongs to */
export function getModelSource(modelName: string): ModelSource {
  return modelSourceMap.get(modelName) ?? 'local'
}

/** Get the provider config for a model */
function getProvider(modelName: string): ProviderConfig {
  const source = getModelSource(modelName)
  return PROVIDERS.find((p) => p.id === source) ?? localOllamaProvider
}

/** Build Ollama-compatible options from our settings */
function buildOptions(settings: ModelSettings) {
  const opts: Record<string, unknown> = {}
  if (settings.temperature !== 0.8) opts.temperature = settings.temperature
  if (settings.topK !== 40) opts.top_k = settings.topK
  if (settings.topP !== 0.9) opts.top_p = settings.topP
  if (settings.minP !== 0.05) opts.min_p = settings.minP
  if (settings.repeatPenalty !== 1.1) opts.repeat_penalty = settings.repeatPenalty
  if (settings.repeatLastN !== 64) opts.repeat_last_n = settings.repeatLastN
  if (settings.numPredict !== -1) opts.num_predict = settings.numPredict
  if (settings.numCtx !== 8192) opts.num_ctx = settings.numCtx
  if (settings.seed !== -1) opts.seed = settings.seed
  if (settings.mirostat !== 0) opts.mirostat = settings.mirostat
  if (settings.mirostatTau !== 5.0) opts.mirostat_tau = settings.mirostatTau
  if (settings.mirostatEta !== 0.1) opts.mirostat_eta = settings.mirostatEta
  if (settings.tfsZ !== 1.0) opts.tfs_z = settings.tfsZ
  if (settings.stop.length > 0) opts.stop = settings.stop
  return opts
}

/**
 * Stream a chat response — automatically routes to the correct provider.
 * Works identically for local and cloud models because Ollama uses
 * the same API format everywhere.
 */
export async function streamChat(
  messages: ChatMessage[],
  settings: ModelSettings,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal: AbortSignal,
) {
  const provider = getProvider(settings.model)
  const baseUrl = provider.getBaseUrl()
  const headers = provider.getHeaders()

  try {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      stream: settings.streaming,
      options: buildOptions(settings),
    }
    // Only send `think` when explicitly enabled — many models crash
    // with "Unable to generate parser" if they receive think:false
    // because their template doesn't have a thinking block.
    if (settings.enableThinking) {
      body.think = true
    }

    // DEBUG: log what we're sending (remove after fixing rudy-nemo issue)
    console.log('[streamChat] provider:', provider.name, 'baseUrl:', baseUrl)
    console.log('[streamChat] body:', JSON.stringify(body, null, 2))

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[streamChat] FULL ERROR:', text)
      throw new Error(`${provider.name} error ${res.status}: ${text}`)
    }

    if (!settings.streaming) {
      const data = await res.json()
      onToken(data.message?.content ?? '')
      onDone()
      return
    }

    // Streaming: NDJSON
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          const content = chunk.message?.content
          if (typeof content === 'string' && content.length > 0) {
            onToken(content)
          }
          if (chunk.done) {
            onDone()
            return
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    onDone()
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      onDone()
    } else {
      onError(err as Error)
    }
  }
}

/* Re-export types */
export type { AvailableModel, ChatMessage, ModelSource } from './types'
