import { Component, type ErrorInfo, type ReactNode } from 'react'
import { StoreProvider } from '@/lib/store'
import { CharacterHeader } from '@/components/CharacterHeader'
import { MessageList } from '@/components/MessageList'
import { Composer } from '@/components/Composer'
import { ChatSidebar } from '@/components/ChatSidebar'
import { SettingsSidebar } from '@/components/SettingsSidebar'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[var(--color-surface-1)] p-6">
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
              Something went wrong
            </h2>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)] font-mono break-words">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Reset Cache & Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ChatLayout() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar — chat history */}
      <ChatSidebar />

      {/* Main chat area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Ambient accent glow at top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 60% 100% at 50% 0%, oklch(0.65 0.12 10 / 0.15), transparent)',
          }}
        />

        <CharacterHeader />

        <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/20 to-transparent" />

        <MessageList />

        <Composer />
      </div>

      {/* Right sidebar — settings */}
      <SettingsSidebar />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ChatLayout />
      </StoreProvider>
    </ErrorBoundary>
  )
}
