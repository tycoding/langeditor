import type { AnyExtension, Editor as CoreEditor, Extension, JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import { icons } from '@/components/icons'
import type { BorderRadius, Theme } from '@/constants'
import type { LcLicenseInput } from '@/plugins'
import type {
  LcDocumentSession,
  LcDocumentSource,
  LcDocumentSurfaceReadyDetail,
  LcDocumentValue,
  LcEditorMode,
} from '@/plugins/document'

export type { Editor, JSONContent } from '@tiptap/core'

/**
 * Represents the onChange event for LangEditor.
 */
export type LcEditorOnChange = {
  /** Tiptap editor for built-in rich-text modes. */
  editor?: CoreEditor
  /** Framework-neutral session for plugin-provided document modes. */
  session?: LcDocumentSession
  /** Output content, can be a string or JSON content */
  output: LcDocumentValue
}

/**
 * Represents the keys for different extensions.
 */
export type ExtensionNameKeys =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'color'
  | 'highlight'
  | 'heading'
  | 'textAlign'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'indent'
  | 'link'
  | 'image'
  | 'video'
  | 'table'
  | 'chart'
  | 'blockquote'
  | 'horizontalRule'
  | 'code'
  | 'codeBlock'
  | 'clear'
  | 'history'
  | 'fullscreen'

/**
 * Represents the general options for Tiptap extensions.
 */
export interface GeneralOptions<T> {
  /** Enabled divider */
  divider: boolean
  /** Enabled spacer */
  spacer: boolean
  /** Button view function */
  button: ButtonView<T>
  /** Show on Toolbar */
  toolbar?: boolean
}

/**
 * Represents the props for the ButtonView component.
 */
export interface ButtonViewReturnComponentProps {
  /** Method triggered when action is performed */
  action?: (value?: any) => void
  /** Whether it is in the active state */
  isActive?: () => boolean
  /** Button icon */
  icon?: keyof typeof icons
  /** Text displayed on hover */
  tooltip?: string
  [x: string]: any
}

/**
 * Represents the slots for the ButtonView component.
 */
export interface ButtonViewReturnComponentSlots {
  /** Dialog slot */
  dialog: () => any
  [x: string]: () => any
}

/**
 * Represents the return value for the ButtonView component.
 */
export interface ButtonViewReturn {
  /** Component */
  component: unknown
  /** Component props */
  componentProps: ButtonViewReturnComponentProps
  /** Component slots */
  componentSlots?: ButtonViewReturnComponentSlots
}

/**
 * Represents the parameters for the ButtonView function.
 */
export interface ButtonViewParams<T = any> {
  /** Editor object */
  editor: Editor
  /** Extension object */
  extension: Extension<T>
  /** Translation function */
  t: (path: string) => string
}

/**
 * Represents the ButtonView function.
 */
export interface ButtonView<T = any> {
  (options: ButtonViewParams<T>): ButtonViewReturn | ButtonViewReturn[]
}

export interface TocConfig {
  /**
   * Enable Table of Contents
   * @default false
   */
  enable?: boolean

  /**
   * Position of Table of Contents
   * - left: show TOC on the left side
   * - right: show TOC on the right side
   * @default 'left'
   */
  position?: 'left' | 'right'

  /**
   * Maximum heading level to include in TOC
   * @default 3
   */
  maxLevel?: number

  /**
   * Custom title for the TOC panel
   * @default 'Table of Contents'
   */
  title?: string

  /** Initial expanded state. The TOC is collapsed by default. */
  defaultOpen?: boolean
}

export type WordHeaderFooterAlignment = 'left' | 'center' | 'right'

export interface WordHeaderFooterSection {
  /** Whether the region is rendered on every Word page. */
  enabled?: boolean
  /** Plain-text content shared by every page. */
  content?: string
  /** Content aligned to the left side of the page region. */
  leftContent?: string
  /** Content aligned to the right side of the page region. */
  rightContent?: string
  /** Horizontal alignment inside the page margin. */
  alignment?: WordHeaderFooterAlignment
  /** Whether the region should also appear on the first page. */
  showOnFirstPage?: boolean
}

export interface WordFooterSection extends WordHeaderFooterSection {
  /** Append the current page and total page count to the footer. */
  showPageNumber?: boolean
}

export interface WordHeaderFooterConfig {
  header?: WordHeaderFooterSection
  footer?: WordFooterSection
}

export interface WordComment {
  id: string
  /** Optional Word comment author preserved during DOCX round trips. */
  author?: string
  /** Optional author initials used by Word's comments pane. */
  initials?: string
  /** ProseMirror document position where the annotated selection starts. */
  from: number
  /** ProseMirror document position where the annotated selection ends. */
  to: number
  /** Plain-text snapshot of the annotated selection. */
  quote: string
  content: string
  createdAt: string
}

export type LcEditorLayout = 'editor' | 'composer'
export type LcComposerContextKind =
  | 'file'
  | 'image'
  | 'knowledge'
  | 'document'
  | 'url'
  | 'selection'
  | 'tool'
  | 'custom'
export type LcComposerContextStatus = 'ready' | 'uploading' | 'processing' | 'error'

export interface LcComposerContextItem {
  id: string
  kind: LcComposerContextKind
  label: string
  description?: string
  mimeType?: string
  size?: number
  file?: File
  previewUrl?: string
  source?: string
  status?: LcComposerContextStatus
  progress?: number
  error?: string
  metadata?: Record<string, unknown>
}

export type LcComposerSendShape = 'circle' | 'rounded' | 'square'
export type LcComposerControlSize = 'sm' | 'md' | 'lg' | number
export type LcComposerState = 'idle' | 'validating' | 'submitting' | 'streaming' | 'error'

export interface LcComposerSendConfig {
  visible?: boolean
  shape?: LcComposerSendShape
  size?: LcComposerControlSize
  color?: 'primary' | 'foreground' | string
  stopWhenStreaming?: boolean
}

export type LcComposerAddItemType = 'upload' | 'reference' | 'action' | 'submenu'
export interface LcComposerAddMenuItem {
  id: string
  type: LcComposerAddItemType
  label: string
  description?: string
  icon?: string
  disabled?: boolean
  accept?: string
  children?: LcComposerAddMenuItem[]
  metadata?: Record<string, unknown>
}

export interface LcComposerAddMenuConfig {
  visible?: boolean
  items?: LcComposerAddMenuItem[]
  loadItems?: (query: string) => LcComposerAddMenuItem[] | Promise<LcComposerAddMenuItem[]>
}

export type LcComposerVoiceMode = 'dictation'
export type LcComposerVoiceState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'stopping'
  | 'transcribing'
  | 'ready'
  | 'error'

export interface LcComposerTranscriptionResult {
  text: string
  language?: string
  metadata?: Record<string, unknown>
}

export interface LcComposerVoiceConfig {
  visible?: boolean
  mode?: LcComposerVoiceMode
  waveform?: boolean
  language?: string
  maxDuration?: number
  transcribe?: (
    audio: Blob,
    context: { signal: AbortSignal; language?: string }
  ) => Promise<LcComposerTranscriptionResult>
}

export interface LcComposerAction {
  id: string
  label: string
  icon?: string
  position?: 'start' | 'center' | 'end'
  type?: 'button' | 'toggle' | 'select'
  disabled?: boolean
  active?: boolean
  value?: unknown
  metadata?: Record<string, unknown>
}

export interface LcComposerConfig {
  minHeight?: string | number
  maxHeight?: string | number
  submitOnEnter?: boolean
  clearOnSubmit?: boolean
  accept?: string
  maxContextItems?: number
  maxFileSize?: number
  state?: LcComposerState
  send?: LcComposerSendConfig
  voice?: LcComposerVoiceConfig
  addMenu?: LcComposerAddMenuConfig
  actions?: LcComposerAction[]
  metadata?: Record<string, unknown>
}

export interface LcMentionItem {
  id: string
  label: string
  value?: string
  sourceId?: string
  trigger?: string
  icon?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface LcMentionSource<T = Record<string, unknown>> {
  id: string
  trigger?: string
  idKey?: keyof T | string
  labelKey?: keyof T | string
  valueKey?: keyof T | string
  maxItems?: number
  items: T[] | ((query: string) => T[] | Promise<T[]>)
}

export interface LcMentionConfig {
  enabled?: boolean
  sources: LcMentionSource<any>[]
}

export interface LcComposerSubmitDetail {
  html: string
  json: JSONContent
  text: string
  contextItems: LcComposerContextItem[]
  mentions: LcMentionItem[]
  metadata?: Record<string, unknown>
}

export interface LcComposerActionDetail {
  action: LcComposerAction | LcComposerAddMenuItem
  contextItems: LcComposerContextItem[]
}

export interface LcComposerVoiceRecordedDetail {
  audio: Blob
  mimeType: string
  duration: number
}

export interface LcComposerErrorDetail {
  error: Error
  source: 'composer' | 'context' | 'mention' | 'voice' | 'transcription'
}

export interface LcEditorErrorDetail {
  error: Error
  source: LcComposerErrorDetail['source'] | 'surface' | 'document-plugin'
}

export interface LcEditorProps {
  /** License token or verified claims used to enable registered commercial plugins. */
  license?: LcLicenseInput

  /** Automatically enable imported plugins. Set to false to use explicit host wiring. */
  autoPlugins?: boolean

  /** Options passed to every registered plugin factory. */
  pluginOptions?: Record<string, unknown>

  /**
   * Editor presentation and capability mode
   * - default: full editor controlled by the supplied extensions
   * - mini: only essential editing extensions are enabled
   * - word: Office-style document workspace with A4 pages
   * @default 'default'
   */
  mode?: LcEditorMode

  /** Binary, URL, or file input consumed only by plugin-provided document surfaces. */
  documentSource?: LcDocumentSource

  /** Host chrome and interaction layout. Composer reuses the same editor instance. */
  layout?: LcEditorLayout

  /** Composer layout behavior and built-in control configuration. */
  composer?: LcComposerConfig

  /** Unified resources displayed above the Composer input. */
  composerContext?: LcComposerContextItem[]

  /** Optional inline mention sources. */
  mention?: LcMentionConfig

  /**
   * Extension names allowed while using mini mode.
   * The defaults cover document structure, history and essential text formatting.
   */
  miniExtensions?: string[]

  /**
   * Number of A4 sheets displayed in word mode.
   * @default 2
   */
  wordPageCount?: number

  /**
   * Repeated page header and footer configuration for Word mode.
   * Both regions are disabled until explicitly enabled.
   */
  wordHeaderFooter?: WordHeaderFooterConfig

  /** Instance-local comments displayed in the Word mode review rail. */
  wordComments?: WordComment[]

  /**
   * Input value
   * Can be HTML string or JSON content
   */
  modelValue?: LcDocumentValue

  /**
   * Editor output type
   * - html: outputs HTML string
   * - json: outputs JSON object
   * - text: outputs plain text
   * @default 'html'
   */
  output?: 'html' | 'json' | 'text'

  /**
   * Dark mode
   * @default undefined - follows system
   */
  dark?: boolean

  /**
   * Theme color
   * @default 'zinc'
   */
  theme?: Theme

  /**
   * Border Radius
   * @default 0.5
   */
  radius?: BorderRadius

  /**
   * Make editor readonly
   * @default false
   */
  disabled?: boolean

  /**
   * Hide Editor Toolbar
   * @default false
   */
  hideToolbar?: boolean

  /**
   * Hide Editor Menubar
   * @default false
   */
  hideMenubar?: boolean

  /**
   * Hide Editor Bubble Menu
   * @default false
   */
  hideBubble?: boolean

  /**
   * Remove tiptap default wrapper when editor is empty eg. <p></p>
   * @default false
   */
  removeDefaultWrapper?: boolean

  /**
   * Editor content maximum width
   * Can be number (px) or CSS unit string
   */
  maxWidth?: string | number

  /**
   * Editor content minimum height
   * Can be number (px) or CSS unit string
   */
  minHeight?: string | number

  /**
   * Editor content maximum height
   * Can be number (px) or CSS unit string
   */
  maxHeight?: string | number

  /**
   * Tiptap extensions
   * Used to extend editor functionality
   */
  extensions?: AnyExtension[]

  /**
   * Editor container class
   * Accepts string, array or object
   */
  editorClass?: string | string[] | Record<string, any>

  /**
   * Editor content class
   * Accepts string, array or object
   */
  contentClass?: string | string[] | Record<string, any>

  /**
   * Table of Contents configuration
   * Configure how headings are displayed in a TOC panel
   */
  toc?: TocConfig
}

export interface LcEditorEmits {
  (event: 'enter'): void
  (event: 'change', value: LcEditorOnChange): void
  (event: 'update:modelValue', value: string | JSONContent): void
  (event: 'update:wordHeaderFooter', value: WordHeaderFooterConfig): void
  (event: 'update:wordComments', value: WordComment[]): void
  (event: 'update:dark', value: boolean): void
  (event: 'session-ready', value: LcDocumentSurfaceReadyDetail): void
  (event: 'submit', value: LcComposerSubmitDetail): void
  (event: 'stop'): void
  (event: 'composer-action', value: LcComposerActionDetail): void
  (event: 'update:composerContext', value: LcComposerContextItem[]): void
  (event: 'context-add', value: LcComposerContextItem[]): void
  (event: 'context-remove', value: LcComposerContextItem): void
  (event: 'mention-select', value: LcMentionItem): void
  (event: 'voice-state-change', value: LcComposerVoiceState): void
  (event: 'voice-recorded', value: LcComposerVoiceRecordedDetail): void
  (event: 'transcription-complete', value: LcComposerTranscriptionResult): void
  (event: 'error', value: LcEditorErrorDetail): void
}
