# GenUI Demo

A full-stack generative UI chatbot that wires [OpenUI Lang](https://www.openui.com/docs/openui-lang/overview) to a custom component library built on [Material UI](https://mui.com/material-ui/). Instead of replying with plain text, the LLM generates structured UI markup that the client renders as MUI components — cards, tables, charts, forms, tabs, accordions, alerts, lists, and more — in real time as tokens stream in.

This standalone Next.js application maps OpenUI Lang nodes onto Material UI components, with streaming responses and light/dark mode.

## How It Works

The LLM is given a system prompt that describes every available Material UI component — its name, props, and when to use it. Instead of prose, the model responds in **OpenUI Lang**, a declarative markup that maps directly to React components:

```
root = Card([header, tbl])
header = CardHeader("Q1 Sales")
tbl = Table([Col("Product"), Col("Revenue", "number")], [["Widget", 1200]])
```

On the client, `<AgentInterface />` from `@openuidev/react-ui` provides the chat interface. It uses `agUIAdapter()` for streamed text and error events. Requests still use `openAIMessageFormat` for the Cloud Chat Completions API. Threads stay in memory (no Cloud storage). `muiChatLibrary` renders each OpenUI Lang node.

```tsx
<AgentInterface llm={llm} componentLibrary={muiChatLibrary} />
```

## Architecture

```
┌────────────────────────────────────┐        ┌────────────────────────────────────┐
│   Browser                          │  HTTP  │   Next.js API Route                │
│                                    │ ──────►│                                    │
│  • <AgentInterface /> manages UI   │        │  • Loads spec.json                 │
│  • agUIAdapter()                   │◄────── │  • OpenUI Cloud Completions proxy  │
│  • muiChatLibrary renders nodes    │  SSE   │  • App tools via runChatToolLoop   │
│  • MUI ThemeProvider + CssBaseline │        │  • Streams AG-UI SSE events        │
└────────────────────────────────────┘        └────────────────────────────────────┘
```

1. The user types a message. `<AgentInterface />` invokes `llm.send()`, which `POST`s to `/api/chat` with the full thread formatted via `openAIMessageFormat`.
2. The API route loads the generated library spec, calls OpenUI Cloud's Chat Completions API, and runs app-owned tools with `runChatToolLoop`.
3. Tool calls run server-side; results are appended as `role: "tool"` messages and the loop continues until the model answers.
4. The server translates the model's Chat Completions chunks into AG-UI text events and sends failures as `RUN_ERROR` events.
5. The client parses the events with `agUIAdapter()` and renders each node as a Material UI component as it streams in. Authentication, quota, and generation failures appear in the chat instead of leaving an empty response.

The weather, stock-price, and web-search tools are local mock examples. They do not call live data providers.

## Project Structure

```
genui-demo/
├── src/
│   ├── library.ts                 # Entry the OpenUI CLI reads to generate the prompt
│   ├── app/
│   │   ├── api/chat/route.ts      # OpenUI Cloud Completions proxy + app tools
│   │   ├── page.tsx               # Mounts <AgentInterface /> + color-mode toggle
│   │   ├── layout.tsx             # Root layout with ColorModeProvider
│   │   └── globals.css            # Minimal full-height reset
│   ├── hooks/
│   │   └── use-system-theme.tsx   # MUI ThemeProvider + light/dark color mode
│   ├── lib/
│   │   └── mui-genui/             # Custom OpenUI component library (Material UI)
│   │       ├── index.tsx          # Library export — createLibrary() call
│   │       ├── theme.ts           # MUI theme factory + chart palette
│   │       ├── action.ts          # Button action Zod schemas
│   │       ├── helpers.ts         # Chart data builders for @mui/x-charts
│   │       ├── rules.ts           # Form validation rule schemas
│   │       ├── unions.ts          # Zod union types for component children
│   │       └── components/        # One file per component (MUI wrappers)
│   └── generated/
│       └── spec.json              # Auto-generated library spec — do not edit manually
└── package.json
```

## Components

The library exposes a representative subset of Material UI components mapped to OpenUI Lang:

| Category   | Components                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| Content    | `CardHeader`, `TextContent`, `Heading`, `Alert`, `List` / `ListItem`, `Separator`, `Progress` |
| Tables     | `Table` / `Col`                                                                               |
| Charts     | `BarChart`, `LineChart`, `PieChart` (via `@mui/x-charts`) with `Series` / `Slice`             |
| Forms      | `Form`, `FormControl`, `Input`, `Select` / `SelectItem`, `SwitchGroup` / `SwitchItem`         |
| Buttons    | `Button`, `Buttons`                                                                           |
| Layout     | `Tabs` / `TabItem`, `Accordion` / `AccordionItem`                                             |
| Follow-ups | `FollowUpBlock` / `FollowUpItem`                                                              |

Each component is defined with `defineComponent({ name, props, description, component })` where `props` is a Zod schema. The schema and description are serialized into `src/generated/spec.json` by `npm run generate` (the OpenUI CLI reads `src/library.ts`), and `component` renders the node with Material UI primitives.

## Theming

The app wraps everything in MUI's `ThemeProvider` + `CssBaseline` via `ColorModeProvider` (`src/hooks/use-system-theme.tsx`). It follows the OS color scheme by default and exposes a manual light/dark toggle (top-right of the screen). All generated components — and the chat surface — re-theme automatically. Customize `createAppTheme()` in `src/lib/mui-genui/theme.ts`.

## Getting Started

### Prerequisites

- Node.js 20.9 or later
- npm (the repository includes `package-lock.json`)
- An OpenUI Cloud API key (https://console.thesys.dev/keys)

### Setup

From the repository root, enter the application and install its locked dependencies:

```bash
cd genui-demo
npm ci
cp .env.example .env.local
```

Set `THESYS_API_KEY` in `.env.local` to a valid OpenUI Cloud API key. Local environment files are ignored by Git. The CLI also provides a key-generation command:

```bash
npm run generate:apiKey
```

### Develop

```bash
npm run dev
```

`npm run dev` first runs `generate` to (re)write `src/generated/spec.json` from the library, then starts Next.js on http://localhost:3000. The generated spec is not committed.

The OpenUI developer overlay is disabled by default. Set `OPENUI_DEVTOOLS=true` in `.env.local` and restart the dev server to enable it.

### Regenerate the system prompt

Whenever you add or change a component, regenerate the spec:

```bash
npm run generate
```

### Build

```bash
npm run build
npm start
```

## Adding a Component

1. Create `src/lib/mui-genui/components/<name>.tsx` and export a `defineComponent({ ... })`.
2. If it can appear inside other containers, add its `.ref` to `ContentChildUnion` in `unions.ts`.
3. Register it in the `components` array (and a `componentGroups` entry) in `index.tsx`.
4. Run `npm run generate` so the LLM learns about it.

## Verify

```bash
npm run verify
```

`verify` regenerates the component spec and runs the production build, including TypeScript checks. The `lint` script currently needs an ESLint flat configuration before it can run.
