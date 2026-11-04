import type { AgentImage, AgentPhase, AgentToolCall, ToolExecution } from './types'

/**
 * Framework-neutral public agent lifecycle events surfaced by the AI Workbench
 * plugin. These replace the legacy AIConversationEvent shape and are emitted
 * on the Web Component's `lc-ai` CustomEvent and mapped to React props/events.
 *
 * Three layers are deliberately distinct:
 *  - Transport events: low-level streaming frames (delta / reasoning / tool-call).
 *  - Agent events: AgentLoop semantic lifecycle (run-start / phase / tool-start / …).
 *  - User action events: accept / reject / insert / regenerate.
 *
 * `ping` is a wire-level keepalive and is never emitted as a user-visible UI event.
 */

export type AgentUiMode = 'word' | 'presentation' | 'spreadsheet' | 'default'

export type AgentWorkbenchEventType =
  | 'run-start'
  | 'phase'
  | 'text-delta'
  | 'reasoning-delta'
  | 'tool-start'
  | 'tool-executed'
  | 'turn-end'
  | 'complete'
  | 'abort'
  | 'error'
  | 'accept'
  | 'reject'
  | 'insert'
  | 'regenerate'

export interface AgentWorkbenchEventBase {
  /** One user initiated Workbench run. */
  runId: string
  /** Server-side streaming request id for the current model turn. */
  requestId?: string
  turn: number
  documentSessionId: string
  documentKind: string
  mode: AgentUiMode
}

export interface AgentWorkbenchTextDeltaEvent extends AgentWorkbenchEventBase {
  type: 'text-delta'
  text: string
}

export interface AgentWorkbenchReasoningDeltaEvent extends AgentWorkbenchEventBase {
  type: 'reasoning-delta'
  reasoning: string
}

export interface AgentWorkbenchPhaseEvent extends AgentWorkbenchEventBase {
  type: 'phase'
  phase: AgentPhase
}

export interface AgentWorkbenchToolStartEvent extends AgentWorkbenchEventBase {
  type: 'tool-start'
  toolName: string
  toolCall: AgentToolCall
}

export interface AgentWorkbenchToolExecutedEvent extends AgentWorkbenchEventBase {
  type: 'tool-executed'
  toolName: string
  toolCall: AgentToolCall
  toolExecution: ToolExecution
  mutated: boolean
  /** The runtime can restore the pre-run document snapshot. */
  rollbackAvailable?: boolean
}

export interface AgentWorkbenchTurnEndEvent extends AgentWorkbenchEventBase {
  type: 'turn-end'
}

export interface AgentWorkbenchCompleteEvent extends AgentWorkbenchEventBase {
  type: 'complete'
  text: string
  summary?: string
}

export interface AgentWorkbenchAbortEvent extends AgentWorkbenchEventBase {
  type: 'abort'
  text?: string
}

export interface AgentWorkbenchErrorEvent extends AgentWorkbenchEventBase {
  type: 'error'
  /** stable machine code the host localizes */
  errorCode?: string
  error?: string
}

export interface AgentWorkbenchRunStartEvent extends AgentWorkbenchEventBase {
  type: 'run-start'
  source?: AgentWorkbenchMessageSourceShape
}

export interface AgentWorkbenchUserActionEvent extends AgentWorkbenchEventBase {
  type: 'accept' | 'reject' | 'insert' | 'regenerate'
  text?: string
}

export type AgentWorkbenchEvent =
  | AgentWorkbenchRunStartEvent
  | AgentWorkbenchPhaseEvent
  | AgentWorkbenchTextDeltaEvent
  | AgentWorkbenchReasoningDeltaEvent
  | AgentWorkbenchToolStartEvent
  | AgentWorkbenchToolExecutedEvent
  | AgentWorkbenchTurnEndEvent
  | AgentWorkbenchCompleteEvent
  | AgentWorkbenchAbortEvent
  | AgentWorkbenchErrorEvent
  | AgentWorkbenchUserActionEvent

/** Selection/document context snapshot the panel attaches to a user turn. */
export interface AgentWorkbenchMessageSourceShape {
  mode: 'selection' | 'document'
  from?: number
  to?: number
  label?: string
}

/** Inline image attachment carried into a user turn (base64, no data: prefix). */
export type AgentWorkbenchImage = AgentImage

export type {
  AgentMessage,
  AgentPhase as AgentWorkbenchPhase,
  AgentToolCall,
  AgentToolDef,
  AgentToolResult,
  ToolExecution,
} from './types'
