import { describe, expect, it, vi } from 'vitest'
import { AgentLoop, sanitizeAgentPayload } from '../src/loop'
import type { AgentMessage } from '../src/types'
import { makeSkill, pushableTransport, toolCall, toolDef } from './test-utils'

function waitTick(): Promise<void> {
  // Allow the loop's microtask deferred stream dispatch and event handlers to run.
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('AgentLoop', () => {
  it('single-turn text response', async () => {
    const { transport, requests, act } = pushableTransport()
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: '', summary: 'noop' })),
      events: {},
    })
    loop.run('Hello')
    await waitTick()
    act(emit => {
      emit({ type: 'delta', text: 'Hi ' })
      emit({ type: 'delta', text: 'there' })
      emit({ type: 'done' })
    })
    await waitTick()
    // The loop should have persisted an assistant message.
    expect(loop.messages.some(m => m.role === 'assistant' && m.text === 'Hi there')).toBe(true)
    // The transport was given the user instruction.
    expect(requests[0].messages.some(m => m.role === 'user')).toBe(true)
  })

  it('multi-turn tool call then final text', async () => {
    const { transport, act } = pushableTransport()
    const executed: string[] = []
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(name => {
        executed.push(name)
        return { output: `result:${name}`, summary: name }
      }),
      events: {},
    })
    loop.run('Summarize')
    await waitTick()
    // Turn 1: model requests a tool.
    act(emit => {
      emit({ type: 'tool-call', call: toolCall('c1', 'echo', { value: 'x' }) })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(executed).toEqual(['echo'])
    await waitTick()
    // Turn 2: model returns final text.
    act(emit => {
      emit({ type: 'delta', text: 'Done' })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(loop.messages.some(m => m.role === 'assistant' && m.text === 'Done')).toBe(true)
    expect(loop.messages.some(m => m.role === 'tool' && m.results[0].output === 'result:echo')).toBe(true)
  })

  it('tool error retry loop', async () => {
    const { transport, act } = pushableTransport()
    let calls = 0
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => {
        calls++
        return { output: 'boom', isError: true, summary: 'echo' }
      }),
      events: {},
    })
    loop.run('Run')
    await waitTick()
    act(emit => {
      emit({ type: 'tool-call', call: toolCall('c1', 'echo') })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(calls).toBe(1)
  })

  it('tool input JSON error is fed back and not executed', async () => {
    const { transport, act } = pushableTransport()
    let executed = false
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => {
        executed = true
        return { output: 'x', summary: 'echo' }
      }),
      events: {},
    })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'tool-call', call: { id: 'c1', name: 'echo', input: {}, inputError: 'bad json' } })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(executed).toBe(false)
    const toolMsg = loop.messages.find((m): m is Extract<AgentMessage, { role: 'tool' }> => m.role === 'tool')
    expect(toolMsg?.results[0].isError).toBe(true)
  })

  it('maxTurns triggers a finalizing no-tools turn', async () => {
    const { transport, requests, act } = pushableTransport()
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: 'ok', summary: 'echo' })),
      maxTurns: 1,
      events: {},
    })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'tool-call', call: toolCall('c1', 'echo') })
      emit({ type: 'done' })
    })
    await waitTick()
    const lastRequest = requests[requests.length - 1]
    expect(lastRequest.tools).toEqual([])
  })

  it('cancel stops a running run without starting more tools', async () => {
    const { transport, act } = pushableTransport()
    let executed = 0
    let cancelled = false
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => {
        executed++
        return { output: 'x', mutated: true, summary: 'echo' }
      }),
      events: {
        onDone: result => {
          cancelled = result.cancelled
        },
      },
    })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'tool-call', call: toolCall('c1', 'echo') })
      emit({ type: 'tool-call', call: toolCall('c2', 'mutate') })
      emit({ type: 'done' })
    })
    await waitTick()
    loop.cancel()
    await waitTick()
    // Cancelled after a tool turn: no further turns started.
    expect(executed).toBeGreaterThan(0)
    expect(loop.busy).toBe(false)
    expect(cancelled).toBe(true)
  })

  it('ignores late transport chunks after cancellation', async () => {
    const { transport, emit } = pushableTransport()
    const texts: string[] = []
    const loop = new AgentLoop({
      transport,
      skill: makeSkill(() => ({ output: 'x', summary: 'echo' })),
      events: { onText: text => texts.push(text) },
    })
    loop.run('x')
    await waitTick()
    loop.cancel()
    emit(0, { type: 'delta', text: 'late' })
    emit(0, { type: 'done' })
    await waitTick()
    expect(texts).toEqual([])
    expect(loop.busy).toBe(false)
  })

  it('context compaction folds over-budget history', async () => {
    const { transport, requests } = pushableTransport()
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: 'x', summary: 'echo' })),
      compaction: { maxBytes: 60, keepRecentBytes: 120, disableLlmSummary: true },
      events: {},
    })
    // A long accumulated prefix, then a couple of recent turns that fit in the
    // keep-recent window, so compaction has a foldable prefix before index 0.
    loop.restore([
      { role: 'user', text: 'A'.repeat(200) },
      { role: 'assistant', text: 'B'.repeat(50) },
      { role: 'user', text: 'recent question' },
      { role: 'assistant', text: 'recent answer' },
    ])
    loop.run('new')
    await waitTick()
    const messages = requests[0]?.messages ?? []
    expect(messages.some(m => m.role === 'user' && m.text.startsWith('[Summary of earlier conversation'))).toBe(true)
  })

  it('captures snapshot before the first mutating tool', async () => {
    const { transport, act } = pushableTransport()
    let snapshots = 0
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: 'ok', mutated: true, summary: 'mutate' })),
      captureSnapshot: () => ({ v: ++snapshots }),
      events: {},
    })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'tool-call', call: toolCall('c1', 'mutate') })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(snapshots).toBeGreaterThanOrEqual(1)
  })

  it('verifyResponse forces one corrective turn', async () => {
    const { transport, requests, act } = pushableTransport()
    let verifyCalls = 0
    const skill = {
      id: 'v',
      systemPrompt: 's',
      tools: [toolDef('select_range')],
      executeTool: () => ({ output: 'ok', summary: 'select' }),
      verifyResponse: () => {
        verifyCalls++
        return 'correction'
      },
    }
    const loop = new AgentLoop({ transport: transport, skill, events: {} })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'delta', text: 'I have selected it' })
      emit({ type: 'done' })
    })
    await waitTick()
    expect(requests.length).toBeGreaterThan(1)
    expect(verifyCalls).toBe(1)
  })

  it('a failed run does not leave an unanswered user message in history', async () => {
    const { transport, act } = pushableTransport()
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: 'x', summary: 'echo' })),
      events: {},
    })
    loop.run('fail me')
    await waitTick()
    act(emit => {
      emit({ type: 'error', error: { code: 'network' } })
    })
    await waitTick()
    expect(loop.messages.some(m => m.role === 'user' && m.text.includes('fail me'))).toBe(false)
  })

  it('normalizes a transport code through onError', async () => {
    const { transport, act } = pushableTransport()
    const errors: string[] = []
    const loop = new AgentLoop({
      transport: transport,
      skill: makeSkill(() => ({ output: 'x', summary: 'echo' })),
      events: { onError: e => errors.push(e.code) },
    })
    loop.run('x')
    await waitTick()
    act(emit => {
      emit({ type: 'error', error: { code: 'overloaded', message: 'too many' } })
    })
    await waitTick()
    expect(errors).toContain('overloaded')
  })

  it('retries an idempotent empty stream without duplicating history', async () => {
    vi.useFakeTimers()
    try {
      const { transport, requests, emit } = pushableTransport()
      const loop = new AgentLoop({
        transport,
        skill: makeSkill(() => ({ output: 'x', summary: 'echo' })),
        events: {},
      })
      loop.run('retry me')
      await vi.advanceTimersByTimeAsync(0)
      emit(0, { type: 'error', error: { code: 'network', emptyStream: true } })
      await vi.advanceTimersByTimeAsync(1_000)
      expect(requests).toHaveLength(2)
      expect(requests[1]?.messages.filter(message => message.role === 'user')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('sanitizeAgentPayload', () => {
  it('redacts API keys and credentials', () => {
    const out = sanitizeAgentPayload('key sk-abcdefghijklmnop secret password=abcd')
    expect(out).not.toContain('sk-abcdefghijklmnop')
    expect(out).toContain('[REDACTED_API_KEY]')
  })
})
