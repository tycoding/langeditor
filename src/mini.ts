import LangEditor from '@/components/editor/LangEditorHost.vue'
import './styles/index.css'

/**
 * Lightweight editor entry point.
 *
 * This entry intentionally exposes the editor component only. Optional
 * features such as charts, code editing and DOCX import/export remain in
 * separately installed extensions and are loaded only when explicitly used.
 */
export { LangEditor }
export { LangEditor as MiniLangEditor }
// Keep the recommended Mini extension set on the same lightweight entry so a
// consumer does not need to import the full extension barrel by accident.
export { BaseKit } from './extensions/BaseKit'
export { History } from './extensions/History'
export { Heading } from './extensions/Heading'
export { Bold } from './extensions/Bold'
export { Italic } from './extensions/Italic'
export { Underline } from './extensions/UnderLine'
export { Color } from './extensions/Color'
export { Highlight } from './extensions/Highlight'
export { BulletList } from './extensions/BulletList'
export { OrderedList } from './extensions/OrderedList'
export { TextAlign } from './extensions/TextAlign'
export { Link } from './extensions/Link'
export { SlashCommand } from './extensions/SlashCommand'
export { Mention } from './extensions/Mention'
export type { MentionOptions, LcMentionConfig, LcMentionItem, LcMentionSource } from './extensions/Mention'
export { AI, createOpenAICompletions } from './extensions/AI'
export type { AIOptions, AIModelConfig, AIMessage, AIMode } from './extensions/AI'

export const MINI_EXTENSIONS = [
  'base-kit',
  'history',
  'heading',
  'bold',
  'italic',
  'underline',
  'color',
  'highlight',
  'bulletList',
  'orderedList',
  'textAlign',
  'link',
  'slashCommand',
  'AI',
] as const

export type {
  LcComposerAction,
  LcComposerActionDetail,
  LcComposerConfig,
  LcComposerContextItem,
  LcComposerState,
  LcComposerSubmitDetail,
  LcComposerVoiceState,
  LcEditorEmits,
  LcEditorLayout,
  LcEditorProps,
  TocConfig,
} from './type'
export type { JSONContent } from '@tiptap/core'
export { locale as defaultLocale } from './locales'
export { registerLocaleMessages, useLocale } from './locales'
export {
  getRegisteredEditorPlugins,
  registerEditorPlugin,
  resolveEditorDocumentSurface,
  subscribeEditorPluginRuntime,
} from './plugins'
export type {
  LcDocumentAIContext,
  LcDocumentPageLayout,
  LcDocumentPageRegion,
  LcDocumentOperation,
  LcDocumentSelection,
  LcDocumentSession,
  LcDocumentSource,
  LcDocumentSourceDescriptor,
  LcDocumentSurfaceDefinition,
  LcDocumentValue,
  LcEditorMode,
} from './plugins'

export default LangEditor
