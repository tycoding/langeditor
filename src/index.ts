import type { Plugin } from 'vue'
import LangEditor from '@/components/editor/LangEditorHost.vue'
import ActionButton from '@/components/actions/ActionButton.vue'
import ActionDropdownButton from '@/components/actions/ActionDropdownButton.vue'
import ActionMenuButton from '@/components/actions/ActionMenuButton.vue'
import ColorPicker from '@/components/actions/ColorPicker.vue'
import { MenuCheckboxItem, MenuItem, MenuSeparator } from '@/components/ui/menu'
import { Separator } from '@/components/ui/separator'
import locale, { en, registerLocaleMessages, useLocale, zhHans } from './locales'
import './styles/index.css'

const LcEditorPlugin: Plugin = {
  install(app) {
    app.component('lang-editor', LangEditor)
  },
}
export { en, locale, registerLocaleMessages, useLocale, zhHans }
export * from '@/extensions'
export * from '@/plugins'
export { useEditor } from '@tiptap/vue-3'
// Plugin authors must create extensions with the same Tiptap runtime as the
// host editor. Re-export the constructors instead of importing a second copy.
export { Extension, Mark, Node } from '@tiptap/core'
export type * from '@/type'
export { type Editor as EditorInstance, type JSONContent } from '@tiptap/core'
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
  LcMentionConfig,
  LcMentionItem,
  LcMentionSource,
  TocConfig,
} from './type'
export type { Theme } from './constants'
export { useTheme } from './hooks/useTheme'
export { useToc } from './hooks/useToc'
export type { TocItem } from './hooks/useToc'
export { default as ThemeToggle } from './components/theme/ThemeToggle.vue'
export { default as ThemePicker } from './components/theme/ThemePicker.vue'
export { hasExtension } from './utils/utils'
export {
  getLangEditorTippyOptions,
  LANGEDITOR_TIPPY_ATTRIBUTE,
  LANGEDITOR_TIPPY_THEME,
  markLangEditorTippy,
} from './utils/tippy'
export { toast, useToast } from './components/ui/toast'
export {
  ActionButton,
  ActionDropdownButton,
  ActionMenuButton,
  ColorPicker,
  LcEditorPlugin,
  LangEditor,
  MenuCheckboxItem,
  MenuItem,
  MenuSeparator,
  Separator,
}

export default LcEditorPlugin
