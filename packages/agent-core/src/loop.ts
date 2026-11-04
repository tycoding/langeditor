import type { AgentSkill, ExecutedToolCall } from './skill'
import type {
  AgentErrorCode,
  AgentImage,
  AgentMessage,
  AgentPhase,
  AgentStreamHandle,
  AgentToolCall,
  AgentToolResult,
  AgentTransport,
  AgentTransportError,
  ToolExecution,
} from './types'

/** Extra loop-level failure kinds beyond the transport codes. */
export type AgentLoopFailureKind = 'tool-input-unusable' | 'all-tools-failed' | 'identical-turn' | 'empty-stream'

export interface AgentLoopError {
  /** stable machine code the UI localizes */
  code: AgentErrorCode | AgentLoopFailureKind
  /** raw detail (never user-facing by itself) */
  detail?: string
  /** true when this was an idempotent empty-stream soft failure */
  emptyStream?: boolean
}

export interface ToolExecutedEvent<TSnapshot> {
  call: AgentToolCall
  execution: ToolExecution
  /**
   * Snapshot captured just before this tool ran; present only on the first
   * mutating tool of a run (hook for one-click rollback UIs).
   */
  snapshotBefore?: TSnapshot | undefined
}

export interface AgentRunResult {
  /** final assistant text of the run ('' when cut off) */
  text: string
  cancelled: boolean
  /** true when maxTurns was reached; text is the partial answer from the no-tools finalizing turn */
  turnLimit: boolean
  /** the final turn hit the token limit (stop_reason max_tokens): text is incomplete; set only when true */
  truncated?: boolean
}

export interface AgentLoopEvents<TSnapshot> {
  /** A transport request was created for the current model turn. */
  onRequest?(requestId: string): void
  /** cumulative assistant text of the current turn (call per delta) */
  onText?(text: string): void
  /** cumulative model reasoning of the current turn (call per delta) */
  onReasoning?(reasoning: string): void
  /** lifecycle phase change (requesting / thinking / responding / tool-input / tool-running) */
  onPhase?(phase: AgentPhase): void
  /** a tool is about to execute (UI shows a live "running" indicator; onToolExecuted always follows) */
  onToolStart?(call: AgentToolCall): void
  onToolExecuted?(event: ToolExecutedEvent<TSnapshot>): void
  /** a turn requested tools and they ran; the loop is going back to the model */
  onTurnEnd?(): void
  onDone?(result: AgentRunResult): void
  onError?(error: AgentLoopError): void
}

/** Context compaction config (budget tracked in UTF-8 bytes rather than message count) */
export interface CompactionOptions {
  /** History size that triggers compaction (UTF-8 bytes, default 256KB) */
  maxBytes?: number
  /** Size of recent messages kept after compaction (bytes, default 96KB, cut at a user boundary) */
  keepRecentBytes?: number
  /** Disable LLM summarization and use only the mechanical digest (for tests/offline) */
  disableLlmSummary?: boolean
}

export interface AgentLoopOptions<TSnapshot = unknown> {
  transport: AgentTransport
  skill: AgentSkill
  events?: AgentLoopEvents<TSnapshot>
  /** hard cap on model round-trips per run (default DEFAULT_MAX_TURNS) */
  maxTurns?: number
  /** history cap in messages, trimmed at user-turn boundaries (default 40) */
  maxHistory?: number
  /** Context compaction; false disables it (enabled by default with default thresholds) */
  compaction?: CompactionOptions | false
  /** capture rollback state; invoked right before tools run (see snapshotBefore) */
  captureSnapshot?(): TSnapshot
  /** wrap instruction + skill context into the user message text */
  formatUserMessage?(instruction: string, context: string): string
  /** appended to the system prompt each turn (e.g. reply-language directive following the UI language) */
  systemSuffix?(): string
}

const COMPACT_MAX_BYTES = 256 * 1024
const COMPACT_KEEP_RECENT_BYTES = 96 * 1024
const SUMMARIZE_TOOL_OUTPUT_MAX = 2_000
const SUMMARIZE_TIMEOUT_MS = 30_000
const STALE_TOOL_KEEP_RECENT = 2
const STALE_TOOL_OUTPUT_MAX = 1_000

/** Unified turn budget across chat panels (hosts may still override per loop). */
export const DEFAULT_MAX_TURNS = 100

/** Cap on consecutive tool-input parse failures (a successful parse resets it); abort beyond it. */
const MAX_INPUT_PARSE_RETRIES = 3

/** Degenerate-loop guards: weak models can repeat the exact same turn or keep issuing failing calls. */
const MAX_IDENTICAL_TURNS = 3
const MAX_ALL_ERROR_TURNS = 8

/**
 * Backoff schedule for in-place same-turn retries on empty-stream errors.
 * An empty stream is the cross-layer contract with transports: the server
 * closed the stream without content, tool calls, or framing — a transient
 * soft-failure. The turn produced nothing and history is untouched, so
 * re-sending the identical request is idempotent.
 */
const EMPTY_STREAM_RETRY_DELAYS_MS = [1_000, 3_000]

const TURN_LIMIT_NOTE =
  '[System] The tool-call turn limit for this request has been reached; no more tools may be called this turn. ' +
  'Answer directly from the information already gathered; if the task is unfinished, briefly state what is done and what remains.'

/**
 * Terminal assistant text when tools mutated the artifact and the model
 * returned no prose. Must be non-empty so provider message converters never
 * emit empty assistant content, which breaks multi-turn follow-ups.
 */
export const COMPLETED_VIA_TOOLS_TEXT = '(completed tool actions; no text reply)'

const SUMMARIZE_SYSTEM =
  'You are a conversation compressor. Compress this editing session between the user and the AI assistant into a concise summary so later turns can continue with context. ' +
  "Keep: the user's goals and key instructions, completed changes (which files/pages/elements were modified), important facts and data, and outstanding items. " +
  'For specific figures/statistics, mark their provenance: figures from the user or from tool results keep their source; figures the assistant produced without a source must be marked "(unverified)". ' +
  'Omit: pleasantries, tool-call details, and intermediate trial and error. Use a bullet list of at most 400 words. Write the summary in the same language as the conversation. Output only the summary body, with no preamble.'

const COMPACT_SUMMARY_HEADER = '[Summary of earlier conversation (auto-compacted)]'
const COMPACT_SUMMARY_ACK = 'Understood, continuing from the progress so far.'

/** Approximate UTF-8 byte count (ASCII 1 byte, CJK etc. 3; surrogate pairs count as 6 — slight overestimate is harmless) */
function utf8Size(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3
  }
  return n
}

/** Approximate byte cost of one message (text + tool inputs/outputs + image base64) */
function messageSize(m: AgentMessage): number {
  if (m.role === 'tool') {
    return m.results.reduce((n, r) => n + utf8Size(r.output) + 40, 0)
  }
  let n = utf8Size(m.text)
  if (m.role === 'user' && m.images) {
    n += m.images.reduce((s, img) => s + img.base64.length, 0)
  }
  if (m.role === 'assistant' && m.toolCalls) {
    for (const c of m.toolCalls) {
      try {
        n += utf8Size(JSON.stringify(c.input)) + 40
      } catch {
        n += 40
      }
    }
  }
  return n
}

function historySize(messages: readonly AgentMessage[]): number {
  return messages.reduce((n, m) => n + messageSize(m), 0)
}

/** Mechanical digest when LLM summarization is unavailable. */
function mechanicalDigest(dropped: readonly AgentMessage[]): string {
  const lines: string[] = []
  for (const m of dropped) {
    if (m.role === 'user' && !m.text.startsWith(COMPACT_SUMMARY_HEADER)) {
      lines.push(`- User: ${m.text.slice(0, 200)}`)
    } else if (m.role === 'assistant' && m.text && !m.toolCalls?.length) {
      lines.push(`  Reply: ${m.text.slice(0, 200)}`)
    }
  }
  return lines.join('\n').slice(0, 4_000) || '(earlier conversation omitted)'
}

/**
 * Generic ReAct loop: user message -> model turn (text + tool calls) ->
 * execute tools -> feed results back -> repeat until the model answers with
 * plain text. History persists across runs, so follow-up questions work.
 *
 * The loop owns no UI and no document state. It only knows about messages,
 * tools, phases and a transport; anything user-facing comes back as a stable
 * error code that the host localizes.
 */
export class AgentLoop<TSnapshot = unknown> {
  private readonly options: AgentLoopOptions<TSnapshot>
  private history: AgentMessage[] = []
  private handle: AgentStreamHandle | null = null
  private running = false
  private cancelled = false
  private turns = 0
  private finalizing = false
  private mutationSeen = false
  private inputParseFails = 0
  private lastTurnSig = ''
  private identicalTurns = 0
  private allErrorTurns = 0
  private turnStopReason: string | null = null
  private turnText = ''
  private turnReasoning = ''
  private toolCalls: AgentToolCall[] = []
  private executedCalls: ExecutedToolCall[] = []
  private verifyRetryUsed = false
  private runUserMsg: AgentMessage | null = null
  private generation = 0
  private abortController: AbortController | null = null
  private settleCancelledTurn: (() => void) | null = null

  constructor(options: AgentLoopOptions<TSnapshot>) {
    this.options = options
  }

  get busy(): boolean {
    return this.running
  }

  get messages(): readonly AgentMessage[] {
    return this.history
  }

  restore(messages: readonly AgentMessage[]): void {
    if (this.running || this.history.length > 0 || messages.length === 0) return
    // Edits-only runs persist an assistant message with no text; give it a placeholder
    // so the turn stays paired and providers never see an empty assistant content block.
    const normalized = messages
      .filter(m => !(m.role === 'user' && m.text === TURN_LIMIT_NOTE))
      .map(m => (m.role === 'assistant' && !m.text ? { ...m, text: COMPLETED_VIA_TOOLS_TEXT } : m))
    // Unanswered user messages (a failed or interrupted run persisted them without a
    // reply) must not re-enter the model context.
    this.history = normalized.filter(
      (m, i) => m.role !== 'user' || (normalized[i + 1] && normalized[i + 1]!.role !== 'user')
    )
    if (this.history.length === 0) return
    if (this.compactionEnabled()) {
      const { maxBytes, keepRecentBytes } = this.compactBudget()
      if (historySize(this.history) > maxBytes) {
        const cut = this.findCompactCut(keepRecentBytes)
        if (cut > 0) {
          const digest = mechanicalDigest(this.history.slice(0, cut))
          this.history = [
            { role: 'user', text: `${COMPACT_SUMMARY_HEADER}\n${digest}` },
            { role: 'assistant', text: COMPACT_SUMMARY_ACK },
            ...this.history.slice(cut),
          ]
        }
      }
    }
    this.trimHistory()
  }

  /** images: inline attachments for this user turn (vision input; see AgentImage) */
  run(instruction: string, images?: AgentImage[]): void {
    if (this.running || !instruction) return
    this.running = true
    this.cancelled = false
    this.turns = 0
    this.finalizing = false
    this.mutationSeen = false
    this.inputParseFails = 0
    this.lastTurnSig = ''
    this.identicalTurns = 0
    this.allErrorTurns = 0
    this.executedCalls = []
    this.verifyRetryUsed = false
    this.abortController = new AbortController()
    const context = this.options.skill.buildContext?.() ?? ''
    const format =
      this.options.formatUserMessage ?? ((instr: string, ctx: string) => (ctx ? `${instr}\n\n${ctx}` : instr))
    const userMsg: AgentMessage = {
      role: 'user',
      text: format(instruction, context),
      ...(images?.length ? { images } : {}),
    }
    void this.beginRun(userMsg)
  }

  private async beginRun(userMsg: AgentMessage): Promise<void> {
    const generation = this.generation
    try {
      await this.maybeCompact()
    } catch {
      // Proceed even if compaction fails (over-budget history only costs more).
    }
    if (generation !== this.generation) return // reset during compaction
    if (this.cancelled) {
      this.running = false
      this.options.events?.onDone?.({ text: '', cancelled: true, turnLimit: false })
      return
    }
    // Leftover unanswered user message (a previous run failed before replying):
    // drop it so the model never sees two adjacent user turns as one instruction.
    while (this.history.at(-1)?.role === 'user') this.history.pop()
    this.trimHistory()
    // Reasoning echo only matters inside a run's own tool loop; drop it from
    // finished runs so it stops costing tokens on every later request.
    this.history = this.history.map(m => (m.role === 'assistant' && m.reasoning ? { ...m, reasoning: undefined } : m))
    if (userMsg.role === 'user') {
      userMsg = { ...userMsg, text: sanitizeAgentPayload(userMsg.text) }
    }
    this.runUserMsg = userMsg
    this.history.push(userMsg)
    this.startTurn()
  }

  private rollbackFailedRun(): void {
    const msg = this.runUserMsg
    this.runUserMsg = null
    if (!msg) return
    const i = this.history.lastIndexOf(msg)
    if (i >= 0) this.history.splice(i)
  }

  private compactionEnabled(): boolean {
    return this.options.compaction !== false
  }

  private compactBudget(): { maxBytes: number; keepRecentBytes: number } {
    const opt = this.options.compaction === false ? undefined : this.options.compaction
    return {
      maxBytes: opt?.maxBytes ?? COMPACT_MAX_BYTES,
      keepRecentBytes: opt?.keepRecentBytes ?? COMPACT_KEEP_RECENT_BYTES,
    }
  }

  private findCompactCut(keepRecentBytes: number): number {
    let kept = 0
    let cut = -1
    for (let i = this.history.length - 1; i >= 0; i--) {
      kept += messageSize(this.history[i]!)
      if (kept > keepRecentBytes && cut >= 0) break
      if (this.history[i]!.role === 'user') cut = i
    }
    if (cut < 0) {
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i]!.role === 'user') return i
      }
    }
    return cut
  }

  private async maybeCompact(): Promise<void> {
    if (!this.compactionEnabled()) return
    const { maxBytes, keepRecentBytes } = this.compactBudget()
    if (historySize(this.history) <= maxBytes) return
    const cut = this.findCompactCut(keepRecentBytes)
    if (cut <= 0) return // no foldable prefix
    const dropped = this.history.slice(0, cut)
    const opt = this.options.compaction === false ? undefined : this.options.compaction
    let summary: string | null = null
    if (!opt?.disableLlmSummary) summary = await this.summarizeViaLlm(dropped)
    if (!summary) summary = mechanicalDigest(dropped)
    this.history = [
      { role: 'user', text: `${COMPACT_SUMMARY_HEADER}\n${summary}` },
      { role: 'assistant', text: COMPACT_SUMMARY_ACK },
      ...this.history.slice(cut),
    ]
  }

  private summarizeViaLlm(dropped: readonly AgentMessage[]): Promise<string | null> {
    const slim: AgentMessage[] = dropped.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          results: m.results.map(r => ({
            ...r,
            output: r.output.slice(0, SUMMARIZE_TOOL_OUTPUT_MAX),
          })),
        }
      }
      if (m.role === 'user' && m.images?.length) return { role: 'user' as const, text: m.text }
      return m
    })
    return new Promise(resolve => {
      let text = ''
      let settled = false
      const finish = (v: string | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      }
      const timer = setTimeout(() => finish(null), SUMMARIZE_TIMEOUT_MS)
      try {
        this.handle = this.options.transport.stream(
          {
            system: SUMMARIZE_SYSTEM,
            messages: [...slim, { role: 'user', text: 'Compress the conversation above as instructed.' }],
            tools: [],
          },
          {
            onDelta: t => {
              text += t
            },
            onToolCall: () => {},
            onDone: () => finish(text.trim() || null),
            onError: () => finish(null),
          }
        )
      } catch {
        finish(null)
      }
    })
  }

  private squashStaleToolOutputs(): void {
    if (!this.compactionEnabled()) return
    const { maxBytes } = this.compactBudget()
    if (historySize(this.history) <= maxBytes) return
    let recent = 0
    for (let i = this.history.length - 1; i >= 0; i--) {
      const m = this.history[i]!
      if (m.role !== 'tool') continue
      recent++
      if (recent <= STALE_TOOL_KEEP_RECENT) continue
      m.results = m.results.map(r =>
        r.output.length > STALE_TOOL_OUTPUT_MAX
          ? { ...r, output: `${r.output.slice(0, STALE_TOOL_OUTPUT_MAX)}\n…(output truncated: too long)` }
          : r
      )
    }
  }

  cancel(): void {
    if (!this.running) return
    this.cancelled = true
    this.abortController?.abort()
    this.handle?.cancel()
    // A transport may abort without invoking a terminal callback. Complete the
    // current model turn here as a fallback; the turn-local settled guard makes
    // this safe when cancel() already called onDone synchronously.
    this.settleCancelledTurn?.()
  }

  reset(): void {
    this.generation++
    this.abortController?.abort()
    this.handle?.cancel()
    this.handle = null
    this.settleCancelledTurn = null
    this.running = false
    this.cancelled = false
    this.history = []
    this.runUserMsg = null
  }

  private trimHistory(): void {
    const max = this.options.maxHistory ?? 40
    if (this.history.length <= max) return
    // cut only at a user message so tool_use/tool_result pairs stay intact
    let i = this.history.length - max
    while (i < this.history.length && this.history[i]!.role !== 'user') i++
    if (i >= this.history.length) return // no user boundary in the window: keep history over budget
    const next = this.history.slice(i)
    if (this.runUserMsg && !next.includes(this.runUserMsg)) return
    this.history = next
  }

  private startTurn(retriesUsed = 0): void {
    const generation = this.generation
    this.turnText = ''
    this.turnReasoning = ''
    this.toolCalls = []
    this.turnStopReason = null
    let settled = false
    const finishCurrentTurn = () => {
      if (generation !== this.generation || settled) return
      settled = true
      void this.finishTurn()
    }
    this.settleCancelledTurn = finishCurrentTurn
    this.handle = this.options.transport.stream(
      {
        system: this.options.skill.systemPrompt + (this.options.systemSuffix?.() ?? ''),
        messages: [...this.history],
        tools: this.finalizing ? [] : this.options.skill.tools,
      },
      {
        onDelta: text => {
          if (generation !== this.generation || settled) return
          this.turnText += text
          this.options.events?.onText?.(this.turnText)
        },
        onReasoning: text => {
          if (generation !== this.generation || settled) return
          this.turnReasoning += text
          this.options.events?.onReasoning?.(this.turnReasoning)
          this.emitPhase({ kind: 'thinking' })
        },
        onToolCall: call => {
          if (generation !== this.generation || settled) return
          this.toolCalls.push(call)
        },
        onPhase: phase => {
          if (generation !== this.generation || settled) return
          this.emitPhase(phase)
        },
        onStopReason: reason => {
          if (generation !== this.generation || settled) return
          this.turnStopReason = reason
        },
        onDone: () => {
          finishCurrentTurn()
        },
        onError: error => {
          if (generation !== this.generation || settled) return
          settled = true
          const delay = EMPTY_STREAM_RETRY_DELAYS_MS[retriesUsed]
          // Empty-stream soft failure: turn produced nothing and history is
          // untouched, so re-sending the identical request is idempotent.
          if (
            delay !== undefined &&
            error.emptyStream &&
            !this.cancelled &&
            !this.turnText &&
            this.toolCalls.length === 0
          ) {
            setTimeout(() => {
              if (generation !== this.generation) return
              if (this.cancelled) {
                void this.finishTurn()
                return
              }
              this.startTurn(retriesUsed + 1)
            }, delay)
            return
          }
          this.running = false
          this.rollbackFailedRun()
          this.options.events?.onError?.({
            code: error.code,
            detail: error.message,
            emptyStream: error.emptyStream,
          })
        },
      }
    )
    if (settled) return
    if (this.handle.requestId) this.options.events?.onRequest?.(this.handle.requestId)
    this.emitPhase({ kind: 'requesting' })
  }

  private emitPhase(phase: AgentPhase): void {
    this.options.events?.onPhase?.(phase)
  }

  private async finishTurn(): Promise<void> {
    const { events, skill, captureSnapshot } = this.options
    const toolCalls = this.toolCalls

    // Claimed-action guard: before accepting a final text turn, let the skill
    // check the claims in it against the tools that actually ran this run.
    if (toolCalls.length === 0 && !this.cancelled && !this.finalizing) {
      const correction =
        !this.verifyRetryUsed && this.turnText && skill.verifyResponse
          ? skill.verifyResponse(this.turnText, [...this.executedCalls])
          : null
      if (correction) {
        this.verifyRetryUsed = true
        this.history.push({ role: 'assistant', text: this.turnText })
        this.history.push({ role: 'user', text: correction })
        // No onTurnEnd here: UIs use it to seal the current assistant bubble.
        this.startTurn()
        return
      }
    }

    // final turn: no tools requested, the user stopped the run, or the
    // no-tools finalizing turn after hitting the limit
    if (toolCalls.length === 0 || this.cancelled || this.finalizing) {
      if (this.finalizing) {
        for (let i = this.history.length - 1; i >= 0; i--) {
          const m = this.history[i]!
          if (m.role === 'user' && m.text === TURN_LIMIT_NOTE) {
            this.history.splice(i, 1)
            break
          }
        }
      }
      this.history.push({ role: 'assistant', text: this.turnText || COMPLETED_VIA_TOOLS_TEXT })
      this.running = false
      this.runUserMsg = null
      events?.onDone?.({
        text: this.turnText,
        cancelled: this.cancelled,
        turnLimit: this.finalizing,
        ...(this.turnStopReason === 'max_tokens' && !this.cancelled ? { truncated: true } : {}),
      })
      return
    }

    // Strip turn-local execution hints (inputError/truncated) from stored history.
    this.history.push({
      role: 'assistant',
      text: this.turnText,
      toolCalls: toolCalls.map(({ id, name, input }) => ({ id, name, input })),
      ...(this.turnReasoning ? { reasoning: this.turnReasoning } : {}),
    })
    const generation = this.generation
    const results: AgentToolResult[] = []
    let turnMutated = false
    for (const call of toolCalls) {
      // The user hit stop while an earlier tool was running: skip remaining tools,
      // but fill in paired error results to keep tool_use/tool_result pairs valid.
      if (this.cancelled) {
        results.push({
          id: call.id,
          name: call.name,
          output: '(the user stopped the run; this tool was not executed)',
          isError: true,
        })
        continue
      }
      // Unusable input (truncated by the token limit, or JSON that failed to parse):
      // don't execute; feed a targeted error back so the model retries correctly.
      if (call.truncated || call.inputError) {
        this.inputParseFails++
        const output = call.truncated
          ? 'Tool arguments were cut off by the output length limit; the tool was not executed. Split this operation into several smaller tool calls (less content per call) and try again.'
          : `Tool input JSON failed to parse; the tool was not executed: ${call.inputError}\nFix the arguments (make sure quotes inside strings are escaped) and call again.`
        results.push({ id: call.id, name: call.name, output, isError: true })
        events?.onToolExecuted?.({
          call,
          execution: { output, isError: true, summary: call.name },
        })
        continue
      }
      this.inputParseFails = 0
      events?.onToolStart?.(call)
      this.emitPhase({ kind: 'tool-running', toolName: call.name })
      const snapshot = !this.mutationSeen ? captureSnapshot?.() : undefined
      let execution: ToolExecution
      try {
        execution = await skill.executeTool(call, this.abortController?.signal)
      } catch (e) {
        execution = {
          output: e instanceof Error ? e.message : String(e),
          isError: true,
          summary: call.name,
        }
      }
      if (generation !== this.generation) return // reset while a tool was running
      this.executedCalls.push({ name: call.name, ok: !execution.isError })
      const firstMutation = !!execution.mutated && !this.mutationSeen
      if (execution.mutated) {
        this.mutationSeen = true
        turnMutated = true
      }
      results.push({
        id: call.id,
        name: call.name,
        output: execution.output,
        isError: execution.isError,
      })
      events?.onToolExecuted?.({
        call,
        execution,
        snapshotBefore: firstMutation ? snapshot : undefined,
      })
    }
    this.history.push({ role: 'tool', results })

    // Cancelled while tools were executing: finish immediately.
    if (this.cancelled) {
      this.running = false
      this.runUserMsg = null
      events?.onDone?.({ text: this.turnText, cancelled: true, turnLimit: false })
      return
    }

    // Bad-input retries hit the cap: abort instead of burning more turns.
    if (this.inputParseFails >= MAX_INPUT_PARSE_RETRIES) {
      this.running = false
      this.rollbackFailedRun()
      events?.onError?.({ code: 'tool-input-unusable' })
      return
    }

    this.allErrorTurns = results.every(r => r.isError) ? this.allErrorTurns + 1 : 0
    if (this.allErrorTurns >= MAX_ALL_ERROR_TURNS) {
      this.running = false
      this.rollbackFailedRun()
      events?.onError?.({ code: 'all-tools-failed' })
      return
    }

    // Identical-turn guard: a model re-emitting the same text, tool calls AND
    // tool outputs is looping. Mutating turns are exempt (repeating an identical
    // edit is legitimate progress).
    const turnSig = JSON.stringify([
      this.turnText,
      toolCalls.map(({ name, input }) => [name, input]),
      results.map(r => r.output),
    ])
    if (turnSig === this.lastTurnSig && !turnMutated) {
      if (++this.identicalTurns >= MAX_IDENTICAL_TURNS) {
        this.running = false
        this.rollbackFailedRun()
        events?.onError?.({ code: 'identical-turn' })
        return
      }
    } else {
      this.lastTurnSig = turnSig
      this.identicalTurns = 0
    }

    this.turns++
    if (this.turns >= (this.options.maxTurns ?? DEFAULT_MAX_TURNS)) {
      // Don't throw away gathered context: append one no-tools turn for a partial answer.
      this.finalizing = true
      this.history.push({ role: 'user', text: TURN_LIMIT_NOTE })
    }
    this.squashStaleToolOutputs()
    this.emitPhase({ kind: 'responding' })
    events?.onTurnEnd?.()
    this.startTurn()
  }
}

export function sanitizeAgentPayload(payload: string): string {
  return payload
    .replace(/\b(?:sk-|AIza|ghp_|secret_)[A-Za-z0-9_-]{16,}/g, '[REDACTED_API_KEY]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+):[^\s@/]+@/gi, '$1:[REDACTED_CREDENTIALS]@')
    .replace(/(password|passwd|secret_key|private_key)(\s*[:=]\s*)["'][^"']+["']/gi, '$1$2"[REDACTED_SECURE_TOKEN]"')
}
