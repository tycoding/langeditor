import { Node } from '@tiptap/core'
import ActionButton from './components/AIButton.vue'
import { createOpenAICompletions } from './openai'
import type { GeneralOptions } from '@/type'
import type { AIConversationEvent } from './conversation'

export interface MenuItem {
  label: string
  prompt?: string
  children?: MenuItem[]
}
export interface SkillDocument {
  name: string
  content: string
  description?: string
}
export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type AIMode = 'selection' | 'document'
export interface AIModelConfig {
  model?: string
  baseURL?: string
  apiKey?: string
  organization?: string
}
export interface AIOptions extends GeneralOptions<AIOptions> {
  completions: (messages: AIMessage[], signal?: AbortSignal, modelConfig?: AIModelConfig) => unknown | Promise<unknown>
  systemPrompt: string
  skills: SkillDocument[]
  modelConfig: AIModelConfig
  showModelConfig: boolean
  onModelConfigChange?: (config: AIModelConfig) => void
  /**
   * AI Shortcuts Menu
   */
  shortcuts: MenuItem[]
  /** Receives framework-neutral AI lifecycle and review events. */
  onEvent?: (event: AIConversationEvent) => void
}

declare module '@tiptap/core' {
  interface Storage {
    AI: {
      open: boolean
      mode: AIMode
    }
  }

  interface Commands<ReturnType> {
    AI: {
      toggleAI: (open?: boolean, mode?: AIMode) => ReturnType
      setAIPrompt: (prompt: string) => ReturnType
    }
  }
}

export const AI = Node.create<AIOptions>({
  name: 'AI',
  group: 'block',
  addStorage() {
    return {
      open: false,
      mode: 'selection',
    }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      toolbar: true,
      completions: createOpenAICompletions(),
      systemPrompt: 'You are a helpful writing assistant. Return only the requested answer.',
      skills: [],
      modelConfig: {},
      showModelConfig: true,
      shortcuts: [],
      onEvent: undefined,
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          icon: 'Sparkles',
          // Selection bubbles must preserve the selected range. The toolbar
          // explicitly overrides this with document mode.
          mode: 'selection',
          tooltip: t('editor.AI.ask'),
        },
      }),
    }
  },
  addCommands() {
    return {
      toggleAI:
        (open, mode) =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            const nextOpen = open ?? !editor.storage.AI.open
            const nextMode =
              mode ?? (nextOpen ? (editor.state.selection.empty ? 'document' : 'selection') : editor.storage.AI.mode)
            editor.storage.AI.open = nextOpen
            editor.storage.AI.mode = nextMode
            tr.setMeta('AI:open', nextOpen)
            tr.setMeta('AI:mode', nextMode)
          }
          return true
        },
      setAIPrompt:
        prompt =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta('AI:prompt', prompt)
          return true
        },
    }
  },
})
