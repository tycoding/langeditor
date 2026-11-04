import { describe, expect, it, vi } from 'vitest'
import { createFetchTransport, type SseChunk } from '../src/fetch-transport'

function sse(chunks: SseChunk[], requestId = 'req-1'): string {
  return chunks.map(c => `data: ${JSON.stringify({ requestId, ...c })}\n`).join('')
}

function makeFetch(mock: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(async (url: string, init: RequestInit) => Promise.resolve(mock(url, init)))
  vi.stubGlobal('fetch', fn)
  return fn
}

function streamResponse(body: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('createFetchTransport', () => {
  it('parses delta / reasoning / tool-call / done frames into callbacks', async () => {
    makeFetch(() =>
      streamResponse(
        sse([
          { type: 'delta', text: 'Hello ' },
          { type: 'delta', text: 'world' },
          { type: 'reasoning', text: 'thinking...' },
          { type: 'tool-call', toolCall: { id: 't1', name: 'echo', input: { a: 1 } } },
          { type: 'done' },
        ])
      )
    )
    const deltas: string[] = []
    const reasoning: string[] = []
    const calls: Array<{ name: string; id: string }> = []
    let done = false
    const handle = createFetchTransport({ url: '/api/x', createRequestId: () => 'req-1' }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: t => deltas.push(t),
        onReasoning: t => reasoning.push(t),
        onToolCall: c => calls.push(c),
        onDone: () => (done = true),
        onError: () => {},
      }
    )
    await new Promise(r => setTimeout(r, 20))
    expect(deltas).toEqual(['Hello ', 'world'])
    expect(reasoning).toEqual(['thinking...'])
    expect(calls).toEqual([{ id: 't1', name: 'echo', input: { a: 1 } }])
    expect(done).toBe(true)
    expect(handle.requestId).toBe('req-1')
  })

  it('filters chunks that do not match the request requestId', async () => {
    // The server echoes a different requestId for one delta.
    makeFetch(() =>
      streamResponse(
        [
          `data: ${JSON.stringify({ requestId: 'req-1', type: 'delta', text: 'mine' })}\n`,
          `data: ${JSON.stringify({ requestId: 'OTHER', type: 'delta', text: 'stale' })}\n`,
          `data: ${JSON.stringify({ requestId: 'req-1', type: 'done' })}\n`,
        ].join('')
      )
    )
    const deltas: string[] = []
    createFetchTransport({ url: '/api/x', createRequestId: () => 'req-1' }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: t => deltas.push(t),
        onDone: () => {},
        onError: () => {},
      }
    )
    await new Promise(r => setTimeout(r, 20))
    expect(deltas).toEqual(['mine'])
  })

  it('normalizes error frames to a stable code', async () => {
    makeFetch(() => streamResponse(sse([{ type: 'error', error: 'rate limited', errorCode: 'overloaded' }], 'req-1')))
    const errors: Array<{ code: string }> = []
    createFetchTransport({ url: '/api/x', createRequestId: () => 'req-1' }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: () => {},
        onDone: () => {},
        onError: e => errors.push(e),
      }
    )
    await new Promise(r => setTimeout(r, 20))
    expect(errors[0]?.code).toBe('overloaded')
  })

  it('maps an HTTP 401 to unauthorized', async () => {
    makeFetch(() => new Response('no token', { status: 401 }))
    const errors: Array<{ code: string }> = []
    createFetchTransport({ url: '/api/x' }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: () => {},
        onDone: () => {},
        onError: e => errors.push(e),
      }
    )
    await new Promise(r => setTimeout(r, 20))
    expect(errors[0]?.code).toBe('unauthorized')
  })

  it('cancel ends the run and fires onDone', async () => {
    let resolveBody: (() => void) | undefined
    makeFetch(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              // never close
            },
          }),
          { status: 200 }
        )
    )
    let done = false
    const handle = createFetchTransport({ url: '/api/x', silenceTimeoutMs: 10000 }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: () => {},
        onDone: () => (done = true),
        onError: () => {},
      }
    )
    await new Promise(r => setTimeout(r, 10))
    handle.cancel()
    expect(done).toBe(true)
    expect(resolveBody).toBeUndefined()
  })

  it('fires onError when the stream ends without a done frame', async () => {
    makeFetch(() => streamResponse(sse([{ type: 'delta', text: 'partial' }])))
    const errors: Array<{ code: string }> = []
    createFetchTransport({ url: '/api/x' }).stream(
      { system: 's', messages: [], tools: [] },
      {
        onDelta: () => {},
        onDone: () => {},
        onError: e => errors.push(e),
      }
    )
    await new Promise(r => setTimeout(r, 20))
    expect(errors[0]?.code).toBe('network')
  })

  it('marks a stream with no bytes as an idempotent empty stream', async () => {
    makeFetch(() => streamResponse(''))
    const errors: Array<{ code: string; emptyStream?: boolean }> = []
    createFetchTransport({ url: '/api/x' }).stream(
      { system: 's', messages: [], tools: [] },
      { onDelta: () => {}, onDone: () => {}, onError: error => errors.push(error) }
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors[0]).toMatchObject({ code: 'network', emptyStream: true })
  })

  it('finishes an absolute request timeout with a stable timeout error', async () => {
    makeFetch(
      () =>
        new Response(
          new ReadableStream({
            start() {
              // Keep the body open until the transport timeout cancels it.
            },
          }),
          { status: 200 }
        )
    )
    const errors: Array<{ code: string }> = []
    createFetchTransport({ url: '/api/x', requestTimeoutMs: 5 }).stream(
      { system: 's', messages: [], tools: [] },
      { onDelta: () => {}, onDone: () => {}, onError: error => errors.push(error) }
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual([{ code: 'timeout', message: 'Streaming request exceeded its time limit' }])
  })

  it('applies the connection timeout while async headers are resolving', async () => {
    const fetchMock = makeFetch(() => streamResponse(sse([{ type: 'done' }])))
    const errors: Array<{ code: string }> = []
    createFetchTransport({
      url: '/api/x',
      connectTimeoutMs: 5,
      headers: () => new Promise(() => undefined),
    }).stream(
      { system: 's', messages: [], tools: [] },
      { onDelta: () => {}, onDone: () => {}, onError: error => errors.push(error) }
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors[0]?.code).toBe('timeout')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the connection timeout armed until the first response byte', async () => {
    makeFetch(
      () =>
        new Response(
          new ReadableStream({
            start() {
              // Headers resolve, but the server never sends the first SSE byte.
            },
          }),
          { status: 200 }
        )
    )
    const errors: Array<{ code: string }> = []
    createFetchTransport({ url: '/api/x', connectTimeoutMs: 5 }).stream(
      { system: 's', messages: [], tools: [] },
      { onDelta: () => {}, onDone: () => {}, onError: error => errors.push(error) }
    )
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors[0]?.code).toBe('timeout')
  })

  it('appends streamExtras and requestId to the request body', async () => {
    const fn = makeFetch((_url, init) => {
      const body = JSON.parse(init.body as string)
      expect(body.requestId).toBeDefined()
      expect(body.requestId).not.toBe('overridden')
      expect(body.system).toBe('s')
      expect(body.documentSessionId).toBe('doc-1')
      expect(body.documentKind).toBe('word')
      return streamResponse(sse([{ type: 'done' }]))
    })
    createFetchTransport({
      url: '/api/x',
      streamExtras: {
        documentSessionId: 'doc-1',
        documentKind: 'word',
        requestId: 'overridden',
        system: 'overridden',
      },
    }).stream({ system: 's', messages: [], tools: [] }, { onDelta: () => {}, onDone: () => {}, onError: () => {} })
    await new Promise(r => setTimeout(r, 20))
    expect(fn).toHaveBeenCalled()
  })
})
