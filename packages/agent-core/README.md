# @langeditor/agent-core

Framework-independent TypeScript core for LangEditor AI agent workflows:
an `AgentLoop`, a browser `AgentTransport` (fetch + SSE), a document `AgentSkill`
contract, and a unified public event protocol.

It has **no** Vue, React, Electron, DOM or model-provider dependency. UI copy and
localization live in the host plugin; this package only carries stable error
codes and machine-readable shapes.

## Exports

- Types: `AgentMessage`, `AgentImage`, `AgentToolDef`, `AgentToolCall`,
  `AgentToolResult`, `ToolExecution`, `ToolDisplay`, `AgentPhase`,
  `AgentTransport`, `AgentStreamRequest`, `AgentStreamCallbacks`,
  `AgentStreamHandle`, `AgentSkill`, `ExecutedToolCall`, `AgentLoopOptions`,
  `AgentLoopEvents`, `AgentLoopError`, `CompactionOptions`, `AgentRunResult`,
  `AgentTransportError`, `AgentErrorCode`.
- Values: `AgentLoop`, `composeSkills`, `createFetchTransport`,
  `sanitizeAgentPayload`, `normalizeErrorCode`, `DEFAULT_MAX_TURNS`,
  `COMPLETED_VIA_TOOLS_TEXT`.
- Security: `sanitizeAgentPayload` redacts API keys, URL credentials and secret
  assignments before a user message enters model context.

## AgentLoop

`AgentLoop` implements the ReAct loop: user message → model turn (text + tool
calls) → execute tools → feed results back → repeat until the model answers with
plain text. History persists across runs so follow-up questions work.

Feature highlights:

- Streaming text and reasoning deltas.
- Tool-call collection and JSON argument error handling.
- Tool execution with aborts, snapshot capture, per-tool events.
- `maxTurns`, `maxHistory`, UTF-8 byte-budget context compaction.
- `AbortController` cancellation; cancel never runs further tools.
- Failed runs roll the incomplete user message out of history.
- Degenerate-loop guards: identical-turn, all-tools-failed, tool-input parse cap.
- Empty-stream idle retry (idempotent) via the `emptyStream` flag.
- `verifyResponse` claimed-action guard, applied at most once per run.
- Phase forwarding (`onPhase`) for `requesting` / `thinking` / `responding` /
  `tool-input` / `tool-running`.

Every failure surfaces as an `AgentLoopError` with a stable `code`, never raw
English UI copy.

## AgentTransport (browser)

`createFetchTransport` streams to a single host endpoint
(`POST /api/ai/agent/stream` by default) that owns model credentials, provider
routing and tenant authorization. The browser never stores a long-lived API key.

It supports requestId, `AbortController`, connect/silence/request timeouts, SSE
parsing, `delta` / `reasoning` / `tool-call` / `done` / `error` / `ping` frames,
and normalized error codes (`timeout`, `credits`, `network`, `overloaded`,
`unauthorized`, `invalid-request`, `unknown`). Stream interruption and start
failures both invoke `onError`; cancel ends the run correctly.

## AgentSkill

A skill packages one capability domain: `systemPrompt`, `tools`,
`buildContext`, `executeTool`, `verifyResponse`. `composeSkills` merges several
skills into one, enforcing globally unique tool names. Document skills
(Word/Presentation/Spreadsheet) adapt over the LangEditor `LcDocumentSession`
boundary.

## Events

`events.ts` defines the framework-neutral public event surface
(`run-start`, `phase`, `text-delta`, `reasoning-delta`, `tool-start`,
`tool-executed`, `turn-end`, `complete`, `abort`, `error`, `accept`, `reject`,
`insert`, `regenerate`) with `runId`, `turn`, `documentSessionId`,
`documentKind` metadata on every frame. `ping` is a wire-level keepalive and is
never a user-visible event.

## Tests

```bash
pnpm test          # vitest (loop + transport + error normalization)
pnpm typecheck     # tsc --noEmit
pnpm build         # vite build → dist/
```

## License

MIT.
