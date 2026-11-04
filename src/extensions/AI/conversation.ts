import type { AIMessage, AIModelConfig, AIMode, SkillDocument } from './AI'

export type AIEventType =
  'start' | 'delta' | 'complete' | 'error' | 'abort' | 'accept' | 'reject' | 'insert' | 'regenerate'

export interface AIConversationEvent {
  type: AIEventType
  mode?: AIMode
  requestId?: number
  operation?: 'document' | 'chart'
  delta?: string
  text?: string
  error?: {
    name?: string
    message: string
  }
}

export interface AIConversationConfig {
  completions: (messages: AIMessage[], signal?: AbortSignal, modelConfig?: AIModelConfig) => unknown | Promise<unknown>
  systemPrompt?: string
  skills?: SkillDocument[]
  modelConfig?: AIModelConfig
  mode?: AIMode
  operation?: 'document' | 'chart'
}

export type AIConversationStatus = 'init' | 'generating' | 'completed'

function chunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk
  if (!chunk || typeof chunk !== 'object') return ''

  const value = chunk as any
  if (typeof value.output_text === 'string') return value.output_text
  if (typeof value.delta === 'string') return value.delta
  if (typeof value.choices?.[0]?.delta?.content === 'string') return value.choices[0].delta.content
  if (typeof value.choices?.[0]?.message?.content === 'string') return value.choices[0].message.content
  if (typeof value.content === 'string') return value.content
  return ''
}

async function consumeCompletion(value: unknown, onChunk?: (text: string) => void): Promise<string> {
  const resolved = await value
  if (resolved && typeof (resolved as any)[Symbol.asyncIterator] === 'function') {
    let text = ''
    for await (const chunk of resolved as AsyncIterable<unknown>) {
      const next = chunkText(chunk)
      if (!next) continue
      text += next
      onChunk?.(next)
    }
    return text
  }

  const text = chunkText(resolved)
  if (text) onChunk?.(text)
  return text
}

function getSystemMessage(config: AIConversationConfig): AIMessage | null {
  const skillText = (config.skills ?? [])
    .filter(skill => skill?.content)
    .map(skill => `## Skill: ${skill.name}\n${skill.content}`)
    .join('\n\n')
  const content = [config.systemPrompt, skillText ? `Use these skill documents when relevant:\n${skillText}` : '']
    .filter(Boolean)
    .join('\n\n')
  return content ? { role: 'system', content } : null
}

export class AIConversationController {
  result = ''
  status: AIConversationStatus = 'init'
  conversationHistory: AIMessage[] = []

  private abortController: AbortController | null = null
  private requestId = 0
  private listeners = new Set<(event: AIConversationEvent) => void>()

  on(listener: (event: AIConversationEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async run(context: string, prompt: string, config: AIConversationConfig, onChunk?: (text: string) => void) {
    // A new request owns the controller. Abort the previous provider request
    // before replacing its signal so React/Svelte rerenders cannot leave two
    // streams writing into the same editor review surface.
    this.abortController?.abort()
    const currentRequestId = ++this.requestId
    this.status = 'generating'
    this.result = ''
    this.emit({ type: 'start', mode: config.mode, operation: config.operation, requestId: currentRequestId })

    try {
      if (this.conversationHistory.length === 0) {
        const systemMessage = getSystemMessage(config)
        if (systemMessage) this.conversationHistory.push(systemMessage)
        this.conversationHistory.push({
          role: 'user',
          content: `Context:\n${context}\n\nRequest:\n${prompt}`,
        })
      } else {
        this.conversationHistory.push({ role: 'user', content: prompt })
      }

      this.abortController = new AbortController()
      const stream = await config.completions(this.conversationHistory, this.abortController.signal, config.modelConfig)
      if (stream == null) throw new Error('Failed to create stream')

      const assistantResponse = await consumeCompletion(stream, chunk => {
        if (currentRequestId !== this.requestId) return
        this.result += chunk
        onChunk?.(chunk)
        this.emit({
          type: 'delta',
          mode: config.mode,
          operation: config.operation,
          requestId: currentRequestId,
          delta: chunk,
          text: this.result,
        })
      })

      if (currentRequestId !== this.requestId) return this.result

      this.conversationHistory.push({ role: 'assistant', content: assistantResponse })
      this.status = 'completed'
      this.emit({
        type: 'complete',
        mode: config.mode,
        operation: config.operation,
        requestId: currentRequestId,
        text: assistantResponse,
      })
      return assistantResponse
    } catch (error: any) {
      if (currentRequestId !== this.requestId) return this.result

      if (error?.name === 'AbortError') {
        this.status = this.result ? 'completed' : 'init'
        this.emit({
          type: 'abort',
          mode: config.mode,
          operation: config.operation,
          requestId: currentRequestId,
          text: this.result,
        })
      } else {
        this.emit({
          type: 'error',
          mode: config.mode,
          operation: config.operation,
          requestId: currentRequestId,
          text: this.result,
          error: { name: error?.name, message: error?.message || 'Failed to generate AI completion' },
        })
      }
      throw error
    } finally {
      if (currentRequestId === this.requestId) this.abortController = null
    }
  }

  reset() {
    this.requestId += 1
    this.abortController?.abort()
    this.abortController = null
    this.result = ''
    this.status = 'init'
    this.conversationHistory = []
  }

  stop() {
    if (this.abortController) this.abortController.abort()
    else this.requestId += 1
    this.abortController = null
    this.status = this.result ? 'completed' : 'init'
  }

  emit(event: AIConversationEvent) {
    this.listeners.forEach(listener => listener(event))
  }
}
