/**
 * Framework-independent types shared by the agent loop, its transports and the
 * document-domain skills. Nothing in this module may import Vue, React, DOM
 * helpers, Electron or a model provider. UI concerns (labels, tooltips, error
 * copy) belong to the host plugin locale layer; this layer only carries stable
 * error codes and machine-readable shapes.
 */

/** JSON-Schema described tool exposed to the model. */
export interface AgentToolDef {
  name: string
  description: string
  /** JSON Schema (object) describing the tool input. */
  inputSchema: Record<string, unknown>
}

export interface AgentToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  /** Parse error when the model emitted invalid input JSON; the loop feeds back an is_error result for retry instead of aborting the run. */
  inputError?: string | undefined
  /** The argument stream was cut off by the token limit (stop_reason max_tokens); the loop asks the model to split the call instead of "fixing JSON". */
  truncated?: boolean | undefined
}

export interface AgentToolResult {
  id: string
  /** tool name (Gemini addresses function responses by name, not id). */
  name: string
  output: string
  isError?: boolean | undefined
}

/** Inline image attached to a user turn, fed to vision-capable providers as multimodal input. */
export interface AgentImage {
  /** raw base64 (no data: URL prefix) */
  base64: string
  /** e.g. "image/png" */
  mime: string
}

export type AgentMessage =
  | { role: 'user'; text: string; images?: AgentImage[] | undefined }
  | {
      role: 'assistant'
      text: string
      toolCalls?: AgentToolCall[] | undefined
      /** Opaque vendor thinking captured during the turn; stored so interleaved-thinking models keep it in the loop. */
      reasoning?: string | undefined
    }
  | { role: 'tool'; results: AgentToolResult[] }

/**
 * Side-channel display data: UI-only, never merged into messages sent to the LLM.
 * kind='images' → image grid; kind='links' → link list; kind='text' → extra text.
 */
export interface ToolDisplay {
  kind: 'images' | 'links' | 'text'
  /** entry list for images / links modes */
  items?: Array<{ url: string; title?: string; thumb?: string }>
  /** extra text for text mode */
  text?: string
}

/** Outcome of one tool execution. */
export interface ToolExecution {
  /** result text fed back to the model */
  output: string
  isError?: boolean
  /** true when the tool changed the underlying artifact (document / sheet / deck) */
  mutated?: boolean
  /** short human-readable label for activity UI */
  summary: string
  /**
   * Side-channel display: for UI only, never enters the LLM context.
   * Ignored when tool results are assembled into an AgentMessage.
   */
  display?: ToolDisplay
}

// ---- run phase (drives the in-progress status line in chat UIs) ----

export type AgentPhaseKind =
  /** request sent, waiting for the model's first content block */
  | 'requesting'
  | 'thinking'
  | 'responding'
  /** the model is streaming tool arguments with no visible text */
  | 'tool-input'
  | 'tool-running'

export interface AgentPhase {
  kind: AgentPhaseKind
  toolName?: string | undefined
}

// ---- LLM transport (how one model turn is streamed; the host supplies the impl) ----

export interface AgentStreamRequest {
  system: string
  messages: AgentMessage[]
  tools: AgentToolDef[]
}

export interface AgentStreamCallbacks {
  onDelta(text: string): void
  /** raw model reasoning delta; the loop stores it on the assistant message for interleaved-thinking echo */
  onReasoning?(text: string): void
  /** complete parsed tool call (arguments finished streaming). Optional: a turn may request no tools. */
  onToolCall?(call: AgentToolCall): void
  /** Phase changes within the model stream (requesting / thinking / responding / tool-input / tool-running). */
  onPhase?(phase: AgentPhase): void
  /** normalized stop reason of the turn ('max_tokens' = cut off by the token limit); transports may omit this */
  onStopReason?(reason: string): void
  onDone(): void
  onError(error: AgentTransportError): void
}

export interface AgentStreamHandle {
  /** Stable id assigned by the transport to this model request. */
  requestId?: string
  /** abort the in-flight turn; the transport must still emit onDone afterwards */
  cancel(): void
}

export interface AgentTransport {
  stream(request: AgentStreamRequest, callbacks: AgentStreamCallbacks): AgentStreamHandle
}

// ---- stable normalized error contract (copy is localized by the host, not here) ----

/**
 * Machine-readable error class surfaced by transports. Consumer plugins map a
 * code to a localized message; the loop itself only branches on `code` and
 * never on hardcoded user-facing text.
 */
export type AgentErrorCode =
  'timeout' | 'credits' | 'network' | 'overloaded' | 'unauthorized' | 'invalid-request' | 'unknown'

export interface AgentTransportError {
  /** stable machine code the UI can localize */
  code: AgentErrorCode
  /** optional detail (raw provider or server message); not intended as user-facing copy */
  message?: string
  /** true when the stream produced no content and may be retried idempotently */
  emptyStream?: boolean
}

/** Shift a code into the known normalized set. */
export function normalizeErrorCode(code: string | undefined | null): AgentErrorCode {
  switch (code) {
    case 'timeout':
    case 'credits':
    case 'network':
    case 'overloaded':
    case 'unauthorized':
    case 'invalid-request':
      return code
    default:
      return 'unknown'
  }
}
