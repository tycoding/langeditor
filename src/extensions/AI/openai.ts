import type { AIMessage, AIModelConfig } from './AI'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

export interface OpenAIChatCompletionOptions extends AIModelConfig {
  /** Sampling temperature forwarded to the compatible chat completions endpoint. */
  temperature?: number
  /** Additional request headers, useful when the endpoint is an authenticated proxy. */
  headers?: Record<string, string>
  /** Additional protocol-compatible request fields. Core fields cannot be overridden. */
  body?: Record<string, unknown>
  /** Optional fetch implementation for non-browser runtimes or request instrumentation. */
  fetch?: typeof globalThis.fetch
}

export interface OpenAIChatCompletionChoice {
  index?: number
  delta?: {
    role?: string
    content?: string | null
    refusal?: string | null
    [key: string]: unknown
  }
  message?: {
    role?: string
    content?: string | null
    refusal?: string | null
    [key: string]: unknown
  }
  finish_reason?: string | null
  [key: string]: unknown
}

export interface OpenAIChatCompletionEvent {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: OpenAIChatCompletionChoice[]
  error?: OpenAIProtocolErrorBody
  [key: string]: unknown
}

export interface OpenAIProtocolErrorBody {
  message?: string
  type?: string
  code?: string | null
  param?: string | null
  [key: string]: unknown
}

export class OpenAIProtocolError extends Error {
  readonly status?: number
  readonly code?: string | null
  readonly type?: string
  readonly response?: unknown

  constructor(message: string, options: { status?: number; error?: OpenAIProtocolErrorBody; response?: unknown } = {}) {
    super(message)
    this.name = 'OpenAIProtocolError'
    this.status = options.status
    this.code = options.error?.code
    this.type = options.error?.type
    this.response = options.response
  }
}

function resolveChatCompletionsURL(baseURL?: string) {
  const normalizedBaseURL = (baseURL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '')
  return normalizedBaseURL.endsWith('/chat/completions') ? normalizedBaseURL : `${normalizedBaseURL}/chat/completions`
}

function extractProtocolError(payload: unknown): OpenAIProtocolErrorBody | undefined {
  if (!payload || typeof payload !== 'object') return undefined

  const error = (payload as { error?: unknown }).error
  if (!error || typeof error !== 'object') return undefined

  return error as OpenAIProtocolErrorBody
}

async function readErrorResponse(response: Response) {
  const raw = await response.text()
  if (!raw) return undefined

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

/**
 * Reads Server-Sent Events without assuming that network chunks align with lines
 * or event boundaries. Each returned string is the joined value of an SSE event's
 * `data:` fields.
 */
async function* readSSEData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []

  const consumeLine = (line: string): string | undefined => {
    const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line

    if (normalizedLine === '') {
      if (dataLines.length === 0) return undefined
      const data = dataLines.join('\n')
      dataLines = []
      return data
    }

    if (normalizedLine.startsWith(':')) return undefined
    if (!normalizedLine.startsWith('data:')) return undefined

    const value = normalizedLine.slice(5)
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
    return undefined
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      let newlineIndex = buffer.indexOf('\n')

      while (newlineIndex >= 0) {
        const data = consumeLine(buffer.slice(0, newlineIndex))
        buffer = buffer.slice(newlineIndex + 1)
        if (data !== undefined) yield data
        newlineIndex = buffer.indexOf('\n')
      }
    }

    buffer += decoder.decode()
    if (buffer) {
      const data = consumeLine(buffer)
      if (data !== undefined) yield data
    }

    if (dataLines.length > 0) yield dataLines.join('\n')
  } finally {
    reader.releaseLock()
  }
}

/**
 * Calls an OpenAI-compatible Chat Completions endpoint using native `fetch` and
 * yields parsed streaming events. No OpenAI SDK or other protocol dependency is
 * required.
 */
export async function* streamOpenAIChatCompletions(
  messages: AIMessage[],
  options: OpenAIChatCompletionOptions = {},
  signal?: AbortSignal
): AsyncGenerator<OpenAIChatCompletionEvent> {
  if (!options.model) throw new OpenAIProtocolError('A model is required for AI completions.')

  const fetchImplementation = options.fetch || globalThis.fetch
  if (!fetchImplementation) {
    throw new OpenAIProtocolError('This runtime does not provide fetch. Pass a fetch implementation explicitly.')
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }

  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`
  if (options.organization) headers['OpenAI-Organization'] = options.organization
  Object.assign(headers, options.headers)

  const requestBody: Record<string, unknown> = {
    ...options.body,
    model: options.model,
    messages,
    stream: true,
  }

  if (options.temperature !== undefined) requestBody.temperature = options.temperature

  const response = await fetchImplementation(resolveChatCompletionsURL(options.baseURL), {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    const payload = await readErrorResponse(response)
    const protocolError = extractProtocolError(payload)
    throw new OpenAIProtocolError(protocolError?.message || `AI request failed with status ${response.status}.`, {
      status: response.status,
      error: protocolError,
      response: payload,
    })
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as OpenAIChatCompletionEvent
    const protocolError = extractProtocolError(payload)
    if (protocolError) {
      throw new OpenAIProtocolError(protocolError.message || 'The AI endpoint returned an error.', {
        error: protocolError,
        response: payload,
      })
    }
    yield payload
    return
  }

  if (!response.body) throw new OpenAIProtocolError('The AI endpoint returned an empty response body.')

  for await (const data of readSSEData(response.body)) {
    if (data === '[DONE]') return

    let event: OpenAIChatCompletionEvent
    try {
      event = JSON.parse(data) as OpenAIChatCompletionEvent
    } catch (cause) {
      throw new OpenAIProtocolError('The AI endpoint returned an invalid SSE JSON event.', {
        response: { data, cause },
      })
    }

    const protocolError = extractProtocolError(event)
    if (protocolError) {
      throw new OpenAIProtocolError(protocolError.message || 'The AI endpoint returned a streaming error.', {
        error: protocolError,
        response: event,
      })
    }

    yield event
  }
}

function mergeDefinedOptions(
  defaults: OpenAIChatCompletionOptions,
  modelConfig: AIModelConfig = {}
): OpenAIChatCompletionOptions {
  const merged = { ...defaults }

  for (const [key, value] of Object.entries(modelConfig)) {
    if (value !== undefined && value !== '') (merged as Record<string, unknown>)[key] = value
  }

  return merged
}

/** Creates a callback that can be passed directly to `AI.configure({ completions })`. */
export function createOpenAICompletions(defaultOptions: OpenAIChatCompletionOptions = {}) {
  return (messages: AIMessage[], signal?: AbortSignal, modelConfig?: AIModelConfig) =>
    streamOpenAIChatCompletions(messages, mergeDefinedOptions(defaultOptions, modelConfig), signal)
}
