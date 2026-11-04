import type {
  AgentErrorCode,
  AgentPhase,
  AgentStreamCallbacks,
  AgentStreamHandle,
  AgentStreamRequest,
  AgentToolCall,
  AgentTransport,
  AgentTransportError,
} from './types'
import { normalizeErrorCode } from './types'

/**
 * One wire-level SSE chunk produced by the host service (see README service
 * contract). Shapes are framework-neutral and identical to the event protocol
 * the plugin surfaces to `lc-ai`.
 */
export interface SseChunk {
  requestId?: string
  type: 'delta' | 'reasoning' | 'tool-call' | 'phase' | 'done' | 'error' | 'ping'
  text?: string
  toolCall?: AgentToolCall
  phase?: AgentPhase
  error?: string
  errorCode?: AgentErrorCode | string
  /** Marks an idempotent turn that produced no text, reasoning or tool call. */
  emptyStream?: boolean
  /** normalized stop reason on 'done' ('max_tokens' = cut off by the token limit) */
  stopReason?: string
}

export interface FetchTransportOptions {
  /** Endpoint for the streaming agent turn. Defaults to /api/ai/agent/stream. */
  url?: string
  /** Extra headers (e.g. a short-lived bearer token issued by the host service). */
  headers?: () => Record<string, string> | Promise<Record<string, string>>
  /** Abort the turn if no byte arrives for this many ms. */
  silenceTimeoutMs?: number
  /** Abort when the initial response / first byte has not arrived by this many ms. */
  connectTimeoutMs?: number
  /** Optional absolute timeout applied to the whole streamed request (0 = none). */
  requestTimeoutMs?: number
  /** Build the JSON body for a stream request. Override to inject host fields. */
  buildBody?: (request: AgentStreamRequest, extras?: Record<string, unknown>) => Record<string, unknown>
  /** Stable id attached to the request; the server echoes it in every chunk. */
  createRequestId?: () => string
  /** Transport extras appended to the request body (documentSessionId, documentKind, model, provider). */
  streamExtras?: Record<string, unknown>
}

function defaultBuildBody(request: AgentStreamRequest, extras?: Record<string, unknown>) {
  return {
    ...extras,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
  }
}

function defaultRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function parseSseLine(line: string): SseChunk | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const data = trimmed.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const parsed = JSON.parse(data) as SseChunk
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    // Non-JSON keepalive lines are treated as pings.
    return { type: 'ping' }
  }
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text()
  } catch {
    return undefined
  }
}

class HttpFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly body?: string
  ) {
    super(body || `HTTP ${status}`)
    this.name = 'HttpFailure'
  }
}

function httpErrorToTransportError(err: unknown): AgentTransportError {
  if (err instanceof HttpFailure) {
    switch (err.status) {
      case 401:
      case 403:
        return { code: 'unauthorized', message: err.body }
      case 402:
        return { code: 'credits', message: err.body }
      case 429:
      case 502:
      case 503:
      case 529:
        return { code: 'overloaded', message: err.body ?? err.message }
      case 400:
      case 422:
        return { code: 'invalid-request', message: err.body ?? err.message }
      case 408:
      case 504:
        return { code: 'timeout', message: err.body ?? err.message }
      default:
        return { code: 'unknown', message: err.body ?? err.message }
    }
  }
  // fetch() network-level failures (DNS, reset, offline).
  const causeText = err instanceof Error ? err.message : 'network'
  if (/fetch failed|ECONNRESET|ENOTFOUND|ERR_NETWORK|network|failed to fetch|load failed/i.test(causeText)) {
    return { code: 'network', message: causeText }
  }
  if (/rate.?limit|too many requests|overload|resource.{0,12}exhausted|quota exceeded/i.test(causeText)) {
    return { code: 'overloaded', message: causeText }
  }
  if (err && typeof err === 'object' && err instanceof Error && err.name === 'AbortError') {
    return { code: 'timeout', message: causeText }
  }
  return { code: 'unknown', message: causeText }
}

/**
 * Browser-safe AgentTransport over fetch + SSE. Calls a single host endpoint
 * (POST /api/ai/agent/stream by default) that owns model credentials, provider
 * routing and tenant authorization. The browser package never stores an API
 * key. Every error is normalized to an AgentTransportError code so the host
 * can localize copy; no user-facing text lives here.
 */
export function createFetchTransport(options: FetchTransportOptions = {}): AgentTransport {
  const url = options.url ?? '/api/ai/agent/stream'
  const silenceTimeoutMs = options.silenceTimeoutMs ?? 240 * 1000
  const connectTimeoutMs = options.connectTimeoutMs ?? 60 * 1000
  const requestTimeoutMs = options.requestTimeoutMs ?? 0
  const buildBody = options.buildBody ?? defaultBuildBody

  function stream(request: AgentStreamRequest, cb: AgentStreamCallbacks): AgentStreamHandle {
    const controller = new AbortController()
    const requestId = (options.createRequestId ?? defaultRequestId)()
    let settled = false
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    let connectTimer: ReturnType<typeof setTimeout> | undefined
    let requestTimer: ReturnType<typeof setTimeout> | undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let sawPayload = false

    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(silenceTimer)
      clearTimeout(connectTimer)
      clearTimeout(requestTimer)
      void reader?.cancel().catch(() => undefined)
    }

    const fail = (error: AgentTransportError) => {
      if (settled) return
      settle()
      cb.onError(error)
    }

    const armSilence = () => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        controller.abort()
        fail({ code: 'timeout', message: 'Stream timed out waiting for a response' })
      }, silenceTimeoutMs)
    }

    const handleChunk = (chunk: SseChunk) => {
      // requestId filter: drop chunks that belong to a superseded request.
      if (chunk.requestId != null && chunk.requestId !== requestId) return
      switch (chunk.type) {
        case 'ping':
          return
        case 'delta':
          if (chunk.text) sawPayload = true
          cb.onDelta(chunk.text ?? '')
          return
        case 'reasoning':
          if (chunk.text) {
            sawPayload = true
            cb.onReasoning?.(chunk.text)
          }
          return
        case 'tool-call':
          if (chunk.toolCall) {
            sawPayload = true
            cb.onPhase?.({ kind: 'tool-input', toolName: chunk.toolCall.name })
            cb.onToolCall(chunk.toolCall)
          }
          return
        case 'phase':
          if (chunk.phase) cb.onPhase?.(chunk.phase)
          return
        case 'done':
          if (chunk.stopReason) cb.onStopReason?.(chunk.stopReason)
          settle()
          cb.onDone()
          return
        case 'error':
          fail({ code: normalizeErrorCode(chunk.errorCode), message: chunk.error, emptyStream: chunk.emptyStream })
          return
        default:
          return
      }
    }

    const handleLine = (line: string) => {
      const chunk = parseSseLine(line)
      if (chunk) handleChunk(chunk)
    }

    async function start(): Promise<void> {
      connectTimer = setTimeout(() => {
        controller.abort()
        fail({ code: 'timeout', message: 'Streaming endpoint did not respond in time' })
      }, connectTimeoutMs)

      let headers: Record<string, string> = {}
      try {
        headers = (await options.headers?.()) ?? {}
      } catch (err) {
        fail({ code: 'unauthorized', message: err instanceof Error ? err.message : undefined })
        return
      }
      if (settled) return

      const body = buildBody(request, options.streamExtras)
      const fetchPromise = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ...body, requestId }),
        signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new HttpFailure(response.status, await safeText(response))
        if (!response.body) throw new HttpFailure(0, 'Empty response body')
        return response
      })

      let response: Response
      try {
        response = await fetchPromise
      } catch (err) {
        if (settled) return
        if (isAbort(err)) return // connect silence timer or cancel() fired
        fail(httpErrorToTransportError(err))
        return
      }

      if (requestTimeoutMs > 0) {
        requestTimer = setTimeout(() => {
          controller.abort()
          fail({ code: 'timeout', message: 'Streaming request exceeded its time limit' })
        }, requestTimeoutMs)
      }

      reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value?.byteLength) continue
          clearTimeout(connectTimer)
          connectTimer = undefined
          armSilence()
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) >= 0) {
            handleLine(buffer.slice(0, nl))
            buffer = buffer.slice(nl + 1)
          }
        }
        if (buffer.trim()) handleLine(buffer)
        if (!settled) {
          fail({
            code: 'network',
            message: 'Stream ended without a done frame',
            ...(!sawPayload ? { emptyStream: true } : {}),
          })
        }
      } catch (err) {
        if (settled) return
        if (isAbort(err)) return // cancel() or a timeout fired
        fail({ code: 'network', message: err instanceof Error ? err.message : undefined })
      }
    }

    void start()

    return {
      requestId,
      cancel: () => {
        controller.abort()
        settle()
        cb.onDone()
      },
    }
  }

  return { stream }
}
