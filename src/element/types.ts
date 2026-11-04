import type { AnyExtension, Editor as CoreEditor } from '@tiptap/core'
import type { AIMode } from '@/extensions/AI/AI'
import type {
  LcComposerActionDetail,
  LcComposerConfig,
  LcComposerContextItem,
  LcComposerSubmitDetail,
  LcComposerTranscriptionResult,
  LcComposerVoiceRecordedDetail,
  LcComposerVoiceState,
  LcEditorProps,
  LcMentionConfig,
  LcMentionItem,
  TocConfig,
  WordComment,
  WordHeaderFooterConfig,
} from '@/type'
import type {
  LcDocumentSession,
  LcDocumentSource,
  LcDocumentSurfaceReadyDetail,
  LcDocumentSyncDetail,
  LcDocumentValue,
  LcLicenseInput,
} from '@/plugins'

export type ElementValue = LcDocumentValue

/**
 * Framework-neutral agent workbench lifecycle events (run-start, phase,
 * text-delta, reasoning-delta, tool-start, tool-executed, turn-end, complete,
 * abort, error, accept, reject, insert, regenerate). These are emitted by the
 * commercial AI Agent Workbench plugin through the `lc-ai` channel.
 */
export type LcAIAgentEventDetail = {
  type:
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
  runId: string
  requestId?: string
  turn: number
  documentSessionId: string
  documentKind: string
  mode: 'word' | 'presentation' | 'spreadsheet' | 'default'
  text?: string
  reasoning?: string
  errorCode?: string
  error?: string
  [key: string]: unknown
}

/** The unified `lc-ai` channel carries only the agent workbench lifecycle. */
export type LcAIEventDetail = LcAIAgentEventDetail

export interface LangEditorElementProps extends Omit<
  LcEditorProps,
  'extensions' | 'modelValue' | 'toc' | 'wordComments' | 'wordHeaderFooter'
> {
  /** Alias for the Vue modelValue prop. */
  value?: ElementValue
  /** Vue-compatible alias for value. */
  modelValue?: ElementValue
  extensions?: AnyExtension[]
  toc?: TocConfig
  wordComments?: WordComment[]
  wordHeaderFooter?: WordHeaderFooterConfig
  license?: LcLicenseInput
  autoPlugins?: boolean
  pluginOptions?: Record<string, unknown>
  /** Binary, URL, or file source passed to a plugin-provided document surface. */
  documentSource?: LcDocumentSource
}

export interface LcReadyDetail {
  element: LangEditorElement
}

export interface LcChangeDetail {
  value: ElementValue
  format: NonNullable<LcEditorProps['output']> | 'document'
}

export interface LcInputDetail extends LcChangeDetail {
  source: 'editor'
}

export interface LcErrorDetail {
  error: {
    name?: string
    message: string
  }
  source:
    | 'mount'
    | 'editor'
    | 'ai'
    | 'composer'
    | 'context'
    | 'mention'
    | 'voice'
    | 'transcription'
    | 'surface'
    | 'document-plugin'
}

export type LcSubmitDetail = LcComposerSubmitDetail
export type LcComposerActionEventDetail = LcComposerActionDetail
export interface LcComposerContextChangeDetail {
  value: LcComposerContextItem[]
}
export type LcMentionSelectDetail = LcMentionItem
export type LcVoiceStateChangeDetail = LcComposerVoiceState
export type LcVoiceRecordedDetail = LcComposerVoiceRecordedDetail
export type LcTranscriptionCompleteDetail = LcComposerTranscriptionResult

export type LcSessionReadyDetail = LcDocumentSurfaceReadyDetail

export type { LcDocumentSyncDetail }

export interface LangEditorElement extends HTMLElement {
  value: ElementValue
  modelValue: ElementValue
  extensions: AnyExtension[]
  license?: LcLicenseInput
  autoPlugins?: boolean
  pluginOptions?: Record<string, unknown>
  documentSource?: LcDocumentSource
  output?: 'html' | 'json' | 'text'
  mode?: LcEditorProps['mode']
  layout?: LcEditorProps['layout']
  composer?: LcComposerConfig
  composerContext?: LcComposerContextItem[]
  mention?: LcMentionConfig
  miniExtensions?: string[]
  toc?: TocConfig
  wordPageCount?: number
  wordHeaderFooter?: WordHeaderFooterConfig
  wordComments?: WordComment[]
  dark?: boolean
  theme?: LcEditorProps['theme']
  radius?: LcEditorProps['radius']
  disabled?: boolean
  hideToolbar?: boolean
  hideMenubar?: boolean
  hideBubble?: boolean
  maxWidth?: string | number
  minHeight?: string | number
  maxHeight?: string | number
  getEditor(): CoreEditor | undefined
  getSession(): LcDocumentSession | undefined
  openAI(mode?: AIMode): void
  closeAI(): void
  submit(): void
  stop(): void
  startVoice(): void
  cancelVoice(): void
  confirmVoice(): void
  getValue(): ElementValue
  setValue(value: ElementValue): void
  focus(): void
  destroy(): void
}

declare global {
  interface HTMLElementTagNameMap {
    'lang-editor': LangEditorElement
  }
}
