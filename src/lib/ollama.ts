import type { OllamaModel, ModelSettings } from '@/types'

const BASE = '/ollama'

/** Fetch available models from Ollama */
export async function fetchModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE}/api/tags`)
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
  const data = await res.json()
  return (data.models ?? []).map((m: Record<string, unknown>) => ({
    name: m.name as string,
    size: m.size as number,
    parameterSize: (m.details as Record<string, unknown>)?.parameter_size as string ?? '',
    quantization: (m.details as Record<string, unknown>)?.quantization_level as string ?? '',
    family: (m.details as Record<string, unknown>)?.family as string ?? '',
    contextLength: (m.details as Record<string, unknown>)?.context_length as number ?? 0,
  }))
}

/** Build Ollama options from our settings */
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat response from Ollama.
 * Yields content tokens as they arrive.
 * Returns via callback to allow abort.
 */
export async function streamChat(
  messages: ChatMessage[],
  settings: ModelSettings,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal: AbortSignal,
) {
  try {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      stream: settings.streaming,
      options: buildOptions(settings),
      // Disable thinking by default for fast responses.
      // Thinking models (like Qwen 3.5) will otherwise spend minutes
      // reasoning internally before producing any visible output.
      think: settings.enableThinking ?? false,
    }

    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama error ${res.status}: ${text}`)
    }

    if (!settings.streaming) {
      // Non-streaming: single JSON response
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

          // Content tokens (the actual response text)
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
