# Persna

An immersive AI companion chat app. Persistent characters with long-term memory, evolving emotional state, and a screenplay-style presentation layer that separates narration, spoken dialogue, and a character's private thoughts.

> **18+ only.** This software is built for uncensored adult roleplay between consenting adults. It ships with a strict age requirement, no user accounts, and a hard boundary against any content involving minors. See [Content Policy](#content-policy).

---

## What it is

Most chat apps put a model behind a text box. Persna is built around three things that make a character feel persistent rather than stateless:

- **Long-term memory** — facts about you and the relationship are extracted after each exchange and re-injected into later conversations, scoped per character.
- **Dynamic state** — mood, trust, attraction, irritation, and unresolved threads are re-derived from the conversation every turn, so personality doesn't collapse toward the tone of the last few messages.
- **A presentation layer** — the model writes in a screenplay convention that the UI parses and styles, so narration, dialogue, and inner thought read distinctly instead of blurring into a wall of text.

Everything runs locally by default. Chats, memories, and character state are stored on your own machine.

---

## Features

**Characters**
- Multi-character registry with per-character system prompts, opening scenes, and accent colours
- Prompt isolation — switching characters never bleeds one character's prompt into another
- Per-character memory scope: each character remembers only what happened with them

**Conversation**
- Token-by-token streaming with cancellation and regenerate
- Strict `system → user → assistant` alternation with automatic same-role collapsing, applied because several model families reject malformed message arrays
- Opening scenes are folded into the system prompt so the first turn is always a valid user message
- Parsed, colour-coded rendering of `*narration*`, `~inner thought~`, and `"dialogue"`
- Copy, read-aloud (Web Speech API), and regenerate actions per message

**Memory & state**
- Background fact extraction after each reply — never blocks the response
- Deduplication on write, importance scoring, and category grouping (user / relationship / event / preference / secret)
- Structured character state: mood, energy, trust, irritation, attraction, vulnerability, current topic, unresolved threads, internal conflict
- Context builder trims history to a safe window and injects state plus memories as a single system message

**Models**
- Provider registry with a common interface — local Ollama and Ollama Cloud today, additional providers are a single file plus one array entry
- Full sampling parameter control (temperature, top-k, top-p, min-p, repeat penalty, mirostat, TFS, seed, context size, stop sequences)
- Optional thinking-block support, sent only when the selected model's template supports it

**Interface**
- Responsive three-pane layout: chat history, conversation, settings
- Sidebar chat list with pinning, auto-titling from the first message
- Optimistic local persistence with debounced background sync for cross-device use

---

## Requirements

- **Node.js** 20 or newer
- **[Ollama](https://ollama.com)** running locally, with at least one model pulled

For a good uncensored roleplay experience you want a model with a permissive fine-tune. Pull one before starting:

```bash
ollama pull qwen3.5:9b
```

Any model in `ollama list` will appear in the model picker automatically.

---

## Setup

Clone the repository and install dependencies:

```bash
npm install
```

Create your environment file from the template:

```bash
cp .env.example .env
```

Start the app — this runs the Vite dev server and the local storage API together:

```bash
npm run dev
```

Open `http://localhost:5173`. Pick a model in the settings pane and start a conversation.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_OLLAMA_CLOUD_API_KEY` | Enables Ollama Cloud models. Leave blank for local-only. |
| `VITE_RENDER_API_URL` | Base URL of the image/video render worker. |

> **Security note.** Any variable prefixed `VITE_` is embedded in the client bundle and is therefore **public**. Only put keys here that you are willing to expose. Cloud keys belong on a server proxy — this is tracked in the roadmap.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server + storage API concurrently |
| `npm run dev:vite` | Frontend only |
| `npm run dev:api` | Storage API only |
| `npm run build` | Type-check and produce a production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run Oxlint |

---

## Architecture

```
src/
├── types.ts                  # Shared domain types + default sampling settings
├── mock-data.ts              # Character registry and opening scenes
├── App.tsx                   # Layout shell + error boundary
├── components/
│   ├── CharacterHeader.tsx   # Active character banner
│   ├── ChatSidebar.tsx       # Chat history, pinning, character switcher
│   ├── MessageList.tsx       # Message rendering, streaming states, actions
│   ├── Composer.tsx          # Input and send controls
│   └── SettingsSidebar.tsx   # Model, sampling, and prompt controls
└── lib/
    ├── store.tsx             # Application state, generation orchestration
    ├── context-builder.ts    # Assembles the per-request message array
    ├── memory-engine.ts      # Fact extraction, dedup, prompt formatting
    ├── state-engine.ts       # Structured character-state extraction
    ├── parse-message.ts      # Screenplay-convention parser
    ├── sync.ts               # localStorage cache + server persistence
    ├── providers/            # Model provider registry (local, cloud)
    ├── sounds.ts             # Send/receive audio cues and haptics
    └── time.ts, uuid.ts, mood.ts
```

### How a single reply flows

1. The user's message is appended and rendered immediately.
2. `buildContext()` assembles one system message containing the character prompt, shared writing rules, the user persona, retrieved long-term memories, and the current character state — followed by the last N conversation messages, trimmed and normalised for strict role alternation.
3. The provider registry resolves the model to its owner and streams the response over NDJSON.
4. Tokens are parsed into typed segments and re-rendered as they arrive; the first token triggers the receive cue.
5. After the response completes, state and memory extraction run in the background and persist. Neither delays what the user sees.

### Design decisions worth knowing

- **Single system message.** Several model families reject more than one. All injected context is concatenated into one block, and the trim notice is appended to it rather than added as a second message.
- **Opening scenes fold into the system prompt.** A conversation that begins with an assistant message is invalid for strict templates, so the opening is absorbed into the system block and the first real turn is always the user's.
- **Extraction is fire-and-forget.** Memory and state extraction are deliberately off the response path. A slow or failed extraction degrades continuity gracefully instead of stalling the chat.
- **Storage is server-first.** On mount the client pulls the server's copy and treats it as authoritative, then writes through to both localStorage (instant) and the API (debounced). This avoids multi-device overwrite races.

---

## Roadmap

- [ ] **Image and video generation** — local ComfyUI worker, identity-locked characters, asynchronous in-world media delivery
- [ ] **Proactive messages** — characters that message first, grounded in unresolved threads and long-term memory
- [ ] **Semantic memory** — embedding-based retrieval and conflict superseding, replacing flat importance-ranked injection
- [ ] **Server-side inference** — move model calls behind an API so keys stay off the client
- [ ] **Accounts and persistence** — user-scoped storage on SQLite/Postgres, replacing the shared JSON-file store
- [ ] **Voice** — TTS replies and speech input
- [ ] **Payments** — subscription tiers with usage budgets

---

## Content Policy

**This project is for adults only. It is not for use by anyone under 18.**

Absolute and non-negotiable:

- **No content involving minors.** Any sexual or romantic content involving anyone under 18 is prohibited without exception. This applies to characters, roleplay, generated imagery, and user input alike.
- **No real people** depicted in sexual content without consent.
- **No content that sexualises real, identifiable minors** through any framing, including fictional or "aged-up" scenarios.

Beyond that floor, this is an uncensored creative writing tool and the content is the user's responsibility. Users are expected to comply with the laws of their own jurisdiction. The maintainers do not review, store, or transmit user conversations — by default they never leave your machine.

If you intend to deploy this as a hosted service, you are responsible for age assurance, content moderation, and platform compliance in your jurisdiction.

---

## Contributing

Issues and pull requests are welcome. Before opening a PR:

- Run `npm run lint` and `npm run build` — both must pass clean.
- Keep dependencies minimal. Prefer the framework, the platform, or an existing dependency over a new package.
- Match the existing code style: commented module headers, `@/` path aliases, Tailwind utility classes with CSS custom properties for theming.
- Do not commit secrets, `.env` files, or anything under `data/`.

---

## License

Released under the [Persna Source-Available License](LICENSE) — free for personal, non-commercial use. Commercial use, resale, and hosted deployment require prior written permission.

The short version: use it, modify it, learn from it, share it with the licence intact. Don't sell it or run it as a paid service without asking first.
