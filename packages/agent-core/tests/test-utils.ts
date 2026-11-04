import type {
  AgentPhase,
  AgentStreamCallbacks,
  AgentStreamHandle,
  AgentStreamRequest,
  AgentToolCall,
  AgentToolDef,
  AgentTransport,
  AgentTransportError,
} from '../src/types'

export type AgentTransportStep =
  | { type: 'delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; call: AgentToolCall }
  | { type: 'phase'; phase: AgentPhase }
  | { type: 'done'; stopReason?: string }
  | { type: 'error'; error: AgentTransportError }

/**
 * A controllable transport: `stream()` stores the callbacks in an array so the
 * test can push delta / tool-call / done / error frames with full control over
 * timing (including simulating multiple model turns).
 */
export function pushableTransport(): {
  transport: AgentTransport
  requests: AgentStreamRequest[]
  emit(i: number, step: AgentTransportStep): void
  act(cb: (emit: (step: AgentTransportStep) => void, callbacks: AgentStreamCallbacks) => void): void
  cancelAll: () => void
} {
  const requests: AgentStreamRequest[] = []
  const handles: Array<{ callbacks: AgentStreamCallbacks; cancel: () => void }> = []
  return {
    transport: {
      stream(request: AgentStreamRequest, callbacks: AgentStreamCallbacks): AgentStreamHandle {
        requests.push(request)
        let cancelled = false
        const entry = {
          callbacks,
          cancel: () => {
            cancelled = true
          },
        }
        handles.push(entry)
        return { cancel: () => (cancelled = true) }
      },
    },
    requests,
    emit(i: number, step: AgentTransportStep) {
      const entry = handles[i]
      if (!entry) throw new Error(`no transport handle at index ${i}`)
      applyStep(entry.callbacks, step)
    },
    act(cb) {
      const entry = handles[handles.length - 1]
      const emit = (step: AgentTransportStep) => applyStep(entry.callbacks, step)
      cb(emit, entry.callbacks)
    },
    cancelAll: () => handles.forEach(h => h.cancel()),
  }
}

function applyStep(cb: AgentStreamCallbacks, step: AgentTransportStep): void {
  switch (step.type) {
    case 'delta':
      cb.onDelta(step.text)
      break
    case 'reasoning':
      cb.onReasoning?.(step.text)
      break
    case 'tool-call':
      cb.onToolCall(step.call)
      break
    case 'phase':
      cb.onPhase?.(step.phase)
      break
    case 'done':
      if (step.stopReason) cb.onStopReason?.(step.stopReason)
      cb.onDone()
      break
    case 'error':
      cb.onError(step.error)
      break
  }
}

export function toolDef(
  name: string,
  description = 'A test tool',
  inputSchema: Record<string, unknown> = { type: 'object' }
): AgentToolDef {
  return { name, description, inputSchema }
}

export function toolCall(id: string, name: string, input: Record<string, unknown> = {}): AgentToolCall {
  return { id, name, input }
}

export function phase(kind: AgentPhase['kind']): AgentPhase {
  return { kind }
}

/** A tiny skill whose executor is a plain handler. */
export function makeSkill(
  handler: (
    name: string,
    input: Record<string, unknown>,
    signal?: AbortSignal
  ) => { output: string; mutated?: boolean; isError?: boolean; summary?: string }
) {
  return {
    id: 'test',
    systemPrompt: 'Test system prompt',
    tools: [toolDef('echo'), toolDef('mutate')],
    buildContext: () => 'Context',
    executeTool: ({ name, input }, signal) => {
      const result = handler(name, input, signal)
      return { ...result, summary: result.summary ?? name }
    },
  }
}
