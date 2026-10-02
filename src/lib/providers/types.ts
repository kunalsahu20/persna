/**
 * Model Provider Types
 *
 * Shared types for all model providers (local Ollama, Ollama Cloud, future APIs).
 * Each provider implements the same interface so the rest of the app
 * doesn't care where the model runs.
 */

/** Where the model runs */
export type ModelSource = 'local' | 'ollama-cloud'
// Future: | 'openai' | 'anthropic' | 'openrouter' etc.

/** A model available for selection — from any provider */
export interface AvailableModel {
  /** Model identifier (e.g. "qwen3.5:9b" or "glm-5.3-flash:cloud") */
  name: string
  /** Where it runs */
  source: ModelSource
  /** Display label for the UI (e.g. "GLM 5.3 Flash") */
  displayName: string
  /** Badge shown in dropdown (e.g. "Local", "Cloud") */
  badge: string
  /** Parameter size if known (e.g. "9B") */
  parameterSize?: string
  /** Model family if known (e.g. "qwen3") */
  family?: string
}

/** Chat message format — same across all providers */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Provider configuration */
export interface ProviderConfig {
  /** Provider identifier */
  id: ModelSource
  /** Human-readable name */
  name: string
  /** Whether this provider is enabled (has required config like API key) */
  enabled: boolean
  /** Fetch available models from this provider */
  fetchModels: () => Promise<AvailableModel[]>
  /** Base URL for API calls */
  getBaseUrl: () => string
  /** Auth headers (if needed) */
  getHeaders: () => Record<string, string>
}
