<script lang="ts" setup>
import { computed, defineAsyncComponent, onUnmounted, ref, unref, useAttrs, useSlots, watch } from 'vue'
import type { AnyExtension, JSONContent } from '@tiptap/core'
import { Editor as CoreEditor } from '@tiptap/core'

import type { EditorOptions } from '@tiptap/vue-3'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { DEFAULT_THEME, EDITOR_UPDATE_THROTTLE_WAIT_TIME, THEMES } from '@/constants'
import { differenceBy, getCssUnitWithDefault, hasExtension, isEqual, throttle } from '@/utils/utils'
import { useTiptapStore } from '@/hooks'
import { useEditorPluginUi } from '@/hooks/useEditorPluginUi'
import { useTheme } from '@/hooks/useTheme'
import { useWordDocument } from '@/hooks/useWordDocument'
import BasicBubbleMenu from '@/components/menus/BasicBubbleMenu.vue'
import LinkBubbleMenu from '@/components/menus/LinkBubbleMenu.vue'
import TableBubbleMenu from '@/components/menus/TableBubbleMenu.vue'
import ContentMenu from '@/components/menus/ContentMenu.vue'
import ColumnsBubbleMenu from '@/components/menus/ColumnsBubbleMenu.vue'
import ImageBubbleMenu from '@/components/menus/ImageBubbleMenu.vue'
import AIMenu from '@/components/menus/AIMenu.vue'
import PluginUiSlot from '@/components/plugins/PluginUiSlot.vue'
import PluginSidebarResizeHandle from '@/components/plugins/PluginSidebarResizeHandle.vue'
import Preview from '@/components/overlays/Preview.vue'
import Printer from '@/components/overlays/Printer.vue'
import SpecialCharacter from '@/components/overlays/SpecialCharacter.vue'
import FindAndReplace from '@/components/overlays/FindAndReplace.vue'
import Toc from '@/components/navigation/Toc.vue'
import EditorStatusbar from './EditorStatusbar.vue'
import EditorToolbarRegion from './EditorToolbarRegion.vue'
import WordTitlebar from './WordTitlebar.vue'
import ComposerShell from '@/components/composer/ComposerShell.vue'
import { resolveComposerConfig, useComposer } from '@/hooks/useComposer'
import { useComposerContext } from '@/hooks/useComposerContext'
import { useComposerVoice } from '@/hooks/useComposerVoice'
import { useLocale } from '@/locales'
const SourceCode = defineAsyncComponent(() => import('@/components/overlays/SourceCode.vue'))

// Word-only panels stay out of the initial editor chunk. They are requested
// only after the Word mode opens the corresponding UI.
const WordHeaderFooterEditor = defineAsyncComponent(
  () => import('@/components/document/WordHeaderFooterEditor.vue')
)
const WordCommentsPanel = defineAsyncComponent(() => import('@/components/document/WordCommentsPanel.vue'))
import type { LcComposerErrorDetail, LcEditorEmits, LcEditorProps } from '@/type'
import Toaster from '@/components/ui/toast/Toaster.vue'
import { provideEditorPortalTarget } from '@/hooks/useEditorPortal'
import { WordPage } from '@/extensions/WordPage'
import { Mention } from '@/extensions/Mention'
import {
  copyEditorPluginExtensionMeta,
  createPluginRuntimeExtension,
  getLicenseState,
  resolveEditorPluginRuntime,
  resolveEditorPluginDocumentPolicy,
  resolveLicense,
  type LcResolvedPluginRuntime,
  type LcLicenseState,
} from '@/plugins'

type KeyDownHandler = NonNullable<EditorOptions['editorProps']['handleKeyDown']>
type UpdateHandler = NonNullable<EditorOptions['onUpdate']>

const props = withDefaults(defineProps<LcEditorProps>(), {
  license: undefined,
  autoPlugins: true,
  pluginOptions: () => ({}),
  mode: 'default',
  layout: 'editor',
  composer: () => ({}),
  composerContext: () => [],
  mention: undefined,
  miniExtensions: () => [
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
  ],
  wordPageCount: 2,
  wordComments: () => [],
  modelValue: '',
  output: 'html',
  dark: undefined,
  theme: undefined,
  radius: undefined,
  disabled: false,
  hideToolbar: false,
  hideMenubar: true,
  hideBubble: false,
  removeDefaultWrapper: false,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
  extensions: () => [],
  editorClass: undefined,
  contentClass: undefined,
  toc: () => ({ enable: false, position: 'left', maxLevel: 3, defaultOpen: false }),
})

const emit = defineEmits<LcEditorEmits>()

const attrs = useAttrs()
const slots = useSlots()
const { state } = useTiptapStore()
const { t } = useLocale()

const contentRef = ref<HTMLElement | null>(null)
const wordDocumentHostRef = ref<HTMLElement | null>(null)
const editorRootRef = ref<HTMLElement | null>(null)

provideEditorPortalTarget(editorRootRef)

const { theme, borderRadius, isDark } = useTheme()

const pluginLicense = computed<LcLicenseState>(() =>
  props.license ? resolveLicense(props.license) : getLicenseState()
)
const pluginRuntime = computed<LcResolvedPluginRuntime>(() =>
  props.autoPlugins
    ? resolveEditorPluginRuntime(props.pluginOptions, pluginLicense.value)
    : { extensions: [], instances: [], pluginIds: [], license: pluginLicense.value, options: props.pluginOptions }
)
const pluginDocumentPolicy = computed(() => resolveEditorPluginDocumentPolicy(pluginRuntime.value))

const sortExtensions = computed<AnyExtension[]>(() => {
  const extensions = [...state.extensions, ...differenceBy(props.extensions, state.extensions, 'name')]
  const extensionNames = new Set(extensions.map(extension => extension.name))
  if (props.mention?.enabled !== false && props.mention?.sources.length && !extensionNames.has(Mention.name)) {
    extensions.push(
      Mention.configure({
        sources: props.mention.sources,
        onSelect: item => emit('mention-select', item),
        onError: error => emit('error', { error, source: 'mention' }),
      })
    )
    extensionNames.add(Mention.name)
  }
  for (const extension of pluginRuntime.value.extensions) {
    if (extensionNames.has(extension.name)) {
      console.warn(`[LangEditor] Skipping duplicate plugin extension ${extension.name}`)
      continue
    }
    extensionNames.add(extension.name)
    extensions.push(extension)
  }
  if (props.mode === 'word' && !extensions.some(extension => extension.name === WordPage.name)) {
    extensions.push(WordPage)
  }
  const modeExtensions =
    props.mode === 'mini' ? extensions.filter(extension => props.miniExtensions.includes(extension.name)) : extensions

  // A document provider can declare its own history implementation. Keeping
  // local History in that case would create two competing undo stacks.
  const enabledExtensions = pluginDocumentPolicy.value.history === 'plugin'
    ? modeExtensions.filter(extension => extension.name !== 'history')
    : modeExtensions

  // The runtime extension is internal and must remain available in every mode
  // so plugin-provided menus can resolve against the active editor instance.
  enabledExtensions.push(createPluginRuntimeExtension(pluginRuntime.value))

  return enabledExtensions.map((extension, index) => {
    const configured = extension.configure({ sort: index })
    // `configure()` returns a child extension. Preserve host metadata on the
    // child without mutating Tiptap's read-only options getter.
    return copyEditorPluginExtensionMeta(extension, configured)
  })
})

const isMiniMode = computed(() => props.mode === 'mini')
const isWordMode = computed(() => props.mode === 'word')
const isComposerLayout = computed(() => props.layout === 'composer' && !isWordMode.value)
const composerConfig = computed(() => resolveComposerConfig(props.composer))
const composerRevision = ref(0)
let composerController: ReturnType<typeof useComposer> | undefined

const resolvedTheme = computed(() => props.theme ?? theme.value ?? DEFAULT_THEME)
const resolvedRadius = computed(() => props.radius ?? borderRadius.value)
const editorColorStyles = computed<Record<string, string>>(() => {
  const themeOption = THEMES.find(option => option.name === resolvedTheme.value) ?? THEMES[0]
  const colorScheme = isDark.value ? themeOption.cssVars.dark : themeOption.cssVars.light
  const selectionScheme = isDark.value
    ? { selection: '217 91% 60%', 'selection-foreground': '210 40% 98%' }
    : { selection: '214 90% 56%', 'selection-foreground': '222.2 47.4% 11.2%' }
  const styles: Record<string, string> = {
    '--lc-editor-default-radius': `${resolvedRadius.value}rem`,
    '--radius': 'var(--lc-editor-radius, var(--lc-editor-default-radius))',
  }
  for (const [key, value] of Object.entries({ ...colorScheme, ...selectionScheme })) {
    const defaultValue = String(value)
    styles[`--${key}`] = `var(--lc-editor-${key}, ${defaultValue})`
    styles[`--color-${key}`] = `hsl(var(--lc-editor-${key}, ${defaultValue}))`
  }
  return styles
})

watch(
  () => [props.layout, props.mode] as const,
  ([layout, mode]) => {
    if (layout === 'composer' && mode === 'word') {
      console.warn('[LangEditor] Composer layout is not supported in Word mode; using the editor layout instead.')
    }
  },
  { immediate: true }
)
const editorThemeStyles = computed(() => {
  const styles: Record<string, string> = { ...editorColorStyles.value }
  if (isComposerLayout.value) {
    // Tailwind v4 emits several utility primitives as theme variables. Keep
    // them instance-scoped so the standalone library and Web Component do not
    // depend on a host application's Tailwind root theme.
    Object.assign(styles, {
      '--spacing': '0.25rem',
      '--text-xs': '0.75rem',
      '--text-xs--line-height': '1rem',
      '--text-sm': '0.875rem',
      '--text-sm--line-height': '1.25rem',
      '--font-weight-medium': '500',
      '--font-weight-semibold': '600',
      '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      '--radius-sm': 'calc(var(--radius) - 4px)',
      '--radius-md': 'calc(var(--radius) - 2px)',
      '--radius-lg': 'var(--radius)',
      '--shadow-sm': '0 1px 2px rgb(0 0 0 / 0.05)',
      '--shadow-md': '0 4px 8px -4px rgb(0 0 0 / 0.12)',
      '--default-transition-duration': '150ms',
      '--default-transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--animate-spin': 'spin 1s linear infinite',
      '--animate-pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      '--color-white': '#fff',
    })
  }
  if (isWordMode.value) {
    Object.assign(
      styles,
      isDark.value
        ? {
            '--lc-word-accent': '#2868c7',
            '--lc-word-workspace': '#202226',
            '--lc-word-page': '#111214',
            '--lc-word-corner': '#5f646c',
          }
        : {
            '--lc-word-accent': '#185abd',
            '--lc-word-workspace': '#e7e8ea',
            '--lc-word-page': '#ffffff',
            '--lc-word-corner': '#aeb3ba',
          }
    )
  }
  return styles
})
const {
  addComment: addWordComment,
  applyHeaderFooter: applyWordHeaderFooter,
  attachEditor: attachWordEditor,
  beginComment: beginWordComment,
  cancelComment: cancelWordComment,
  comments: wordCommentsState,
  commentsExtension: wordCommentsExtension,
  currentPage: currentWordPage,
  detachEditor: detachWordEditor,
  headerFooter: wordHeaderFooterState,
  headerFooterOpen: wordHeaderFooterOpen,
  headerFooterSection: wordHeaderFooterSection,
  normalizePages: normalizeWordPageDocument,
  pendingComment: pendingWordComment,
  removeComment: removeWordComment,
  selectComment: selectWordComment,
  setZoom: setWordZoom,
  togglePreview: openWordPreview,
  updateCurrentPage: updateWordPage,
  visiblePages: visibleWordPages,
  zoom: wordZoom,
} = useWordDocument({
  props,
  emit,
  isWordMode,
  contentAuthority: computed(() => pluginDocumentPolicy.value.contentAuthority),
})
const isPreviewMode = ref(false)
const isFullscreen = ref(false)
const spellCheck = ref(false)
const toolbarVariant = computed(() => (isMiniMode.value ? 'compact' : isWordMode.value ? 'word' : 'default'))
const shouldShowMenubar = computed(
  () => !isComposerLayout.value && !isPreviewMode.value && (isWordMode.value ? true : !isMiniMode.value && !props.hideMenubar)
)
const shouldShowToolbar = computed(() => !isComposerLayout.value && !isPreviewMode.value && !props.hideToolbar)
const shouldShowBubbleMenu = computed(
  () => !isComposerLayout.value && !isPreviewMode.value && !isMiniMode.value && !props.hideBubble
)

function toggleEditorTheme() {
  isDark.value = !isDark.value
  emit('update:dark', isDark.value)
}

const editorConfig = computed<Partial<EditorOptions>>(() => ({
  content: props.modelValue,
  editorProps: {
    handleKeyDown: throttle<KeyDownHandler>((_, event) => {
      if (isComposerLayout.value && event.key === 'Enter' && !event.shiftKey) {
        if (event.isComposing || event.keyCode === 229 || !composerConfig.value.submitOnEnter) return false
        if (composerController?.submitDisabled.value) return false
        composerController?.submit()
        return true
      }
      if (event.key === 'Enter' && attrs.enter && !event.shiftKey) {
        if (event.isComposing || event.keyCode === 229) return false
        emit('enter')
        return true
      }
      return false
    }, EDITOR_UPDATE_THROTTLE_WAIT_TIME),
    attributes: {
      class: 'LcContentView',
    },
  },
  onUpdate: throttle<UpdateHandler>(({ editor }) => {
    composerRevision.value += 1
    const output = getOutput(editor, props.output)
    emit('update:modelValue', output)
    emit('change', { editor, output })
  }, EDITOR_UPDATE_THROTTLE_WAIT_TIME),
  extensions: [...unref(sortExtensions), ...(isWordMode.value ? [wordCommentsExtension] : [])],
  editable: !props.disabled,
}))

const editor = new Editor(unref(editorConfig))
const composerContextController = useComposerContext({
  context: computed(() => props.composerContext),
  config: composerConfig,
  fileTooLargeMessage: file => t.value('editor.composer.context.fileTooLarge').replace('{name}', file.name),
  fileTypeMessage: file => t.value('editor.composer.context.fileType').replace('{name}', file.name),
  maxItemsMessage: () => t.value('editor.composer.context.maxItems'),
  onUpdate: value => emit('update:composerContext', value),
  onAdd: value => emit('context-add', value),
  onRemove: value => emit('context-remove', value),
  onError: detail => emit('error', detail),
})
const composerVoiceController = useComposerVoice({
  editor,
  config: composerConfig,
  messages: {
    unsupported: () => t.value('editor.composer.voice.unsupported'),
    permissionDenied: () => t.value('editor.composer.voice.permissionDenied'),
    providerMissing: () => t.value('editor.composer.voice.providerMissing'),
    transcriptionFailed: () => t.value('editor.composer.voice.transcriptionFailed'),
  },
  onStateChange: value => emit('voice-state-change', value),
  onRecorded: value => emit('voice-recorded', value),
  onComplete: value => emit('transcription-complete', value),
  onError: value => emit('error', value),
})
const composerVoiceBusy = computed(() => composerVoiceController.busy.value)
composerController = useComposer({
  editor,
  config: composerConfig,
  contextItems: composerContextController.items,
  revision: composerRevision,
  voiceBusy: composerVoiceBusy,
  onSubmit: detail => emit('submit', detail),
  onStop: () => emit('stop'),
  onAction: detail => emit('composer-action', detail),
})

function emitComposerError(error: Error, source: LcComposerErrorDetail['source'] = 'composer') {
  emit('error', { error, source })
}

function retryComposerContext(item: (typeof composerContextController.items.value)[number]) {
  emit('context-add', [item])
}
attachWordEditor(editor)
const {
  hasUi: hasPluginUi,
  setSidebarWidth: setPluginSidebarWidth,
  sidebarConfig: pluginSidebarConfig,
  sidebarWidth: pluginSidebarWidth,
} = useEditorPluginUi(editor)
if (isWordMode.value && editor.storage.preview) {
  // Word documents open in the editable surface by default. Preview remains an
  // explicit user action and must not inherit stale extension storage.
  editor.storage.preview.active = false
  editor.storage.preview.wasEditable = !props.disabled
  editor.setEditable(!props.disabled)
}
isPreviewMode.value = isWordMode.value ? false : Boolean(editor.storage.preview?.active)
isFullscreen.value = Boolean(editor.storage.fullscreen?.active)

const tocExtension = computed(() => editor.extensionManager.extensions.find(extension => extension.name === 'toc'))
const tocEnabled = computed(() => Boolean(tocExtension.value) || props.toc?.enable === true)
const tocOpen = ref(Boolean(props.toc?.defaultOpen || tocExtension.value?.options?.defaultOpen))
const tocMaxLevel = computed(() => props.toc?.maxLevel ?? tocExtension.value?.options?.maxLevel ?? 3)
const tocTitle = computed(() => props.toc?.title ?? tocExtension.value?.options?.title)
const tocWidth = computed(() => tocExtension.value?.options?.width ?? 228)

if (tocExtension.value) editor.storage.toc.open = tocOpen.value

editor.on('transaction', ({ transaction }) => {
  const open = transaction.getMeta('toc:open')
  if (typeof open === 'boolean') tocOpen.value = open

  const previewActive = transaction.getMeta('preview:active')
  if (typeof previewActive === 'boolean') isPreviewMode.value = previewActive

  const fullscreenActive = transaction.getMeta('fullscreen:active')
  if (typeof fullscreenActive === 'boolean') isFullscreen.value = fullscreenActive
})

function closeToc() {
  if (tocExtension.value) editor.commands.setTocOpen(false)
  else tocOpen.value = false
}

watch(
  () => props.dark,
  val => {
    if (val !== undefined) {
      isDark.value = val
    }
  },
  {
    immediate: true,
  }
)

const contentDynamicStyles = computed(() => ({
  ...(isWordMode.value
    ? {
        minHeight: '1123px',
        overflowY: 'visible' as const,
      }
    : isComposerLayout.value
      ? {
          minHeight: getCssUnitWithDefault(composerConfig.value.minHeight),
          maxHeight: getCssUnitWithDefault(composerConfig.value.maxHeight),
          overflowY: 'auto' as const,
          overflowX: 'hidden' as const,
          scrollbarWidth: 'thin',
        }
      : unref(isFullscreen)
      ? { height: '100%', overflowY: 'auto' as const }
      : {
          minHeight: getCssUnitWithDefault(props.minHeight),
          maxHeight: getCssUnitWithDefault(props.maxHeight),
          overflowY: 'auto' as const,
          scrollBehavior: 'smooth',
          scrollbarWidth: 'thin',
        }),
  maxWidth: isWordMode.value ? undefined : getCssUnitWithDefault(props.maxWidth),
  width: !isWordMode.value && props.maxWidth ? '100%' : undefined,
  margin: !isWordMode.value && props.maxWidth ? '8px auto' : undefined,
}))

function getOutput(editor: CoreEditor, output: LcEditorProps['output']): string | JSONContent {
  if (props.removeDefaultWrapper) {
    if (editor.isEmpty) {
      return output === 'json' ? {} : ''
    }
  }

  switch (output) {
    case 'html':
      return editor.getHTML()
    case 'json':
      return editor.getJSON()
    case 'text':
      return editor.getText()
    default:
      console.warn(`Invalid output type: ${output}`)
      return ''
  }
}

watch(
  () => props.modelValue,
  val => {
    // A plugin-owned document is authoritative after initialization. Applying
    // modelValue here could overwrite a freshly synchronized remote document.
    if (pluginDocumentPolicy.value.contentAuthority === 'plugin') return
    if (!editor || isEqual(getOutput(editor, props.output), val)) return
    const { from, to } = editor.state.selection
    editor.commands.setContent(val, { emitUpdate: false })
    normalizeWordPageDocument(false)
    const maxPosition = editor.state.doc.content.size
    editor.commands.setTextSelection({
      from: Math.min(from, maxPosition),
      to: Math.min(to, maxPosition),
    })
  },
  { deep: true }
)

watch(
  () => props.disabled,
  val => {
    if (editor.storage.preview?.active) {
      editor.storage.preview.wasEditable = !val
      editor.setEditable(false)
    } else {
      editor.setEditable(!val)
    }
  }
)

onUnmounted(() => {
  detachWordEditor()
  editor?.destroy()
})

defineExpose({
  editor,
  submit: () => composerController?.submit(),
  stop: () => composerController?.stop(),
  startVoice: () => composerVoiceController.start(),
  cancelVoice: () => composerVoiceController.cancel(),
  confirmVoice: () => composerVoiceController.confirm(),
})
</script>

<template>
  <div
    v-if="editor"
    ref="editorRootRef"
    :class="[
      editorClass,
      `theme-${resolvedTheme}`,
      'lc-editor-root relative rounded-[0.5rem] bg-background text-foreground shadow focus:outline-none',
      !isComposerLayout && !isWordMode && 'border border-border focus-within:outline-none',
      isMiniMode &&
        'shadow-none [&_.tiptap]:min-h-[140px] [&_.tiptap]:px-4 [&_.tiptap]:py-3 sm:[&_.tiptap]:px-5 sm:[&_.tiptap]:py-4',
      isWordMode && 'h-full min-h-0 w-full overflow-hidden rounded-lg shadow-none',
      isComposerLayout &&
        'min-w-0 border border-border shadow-none outline-none transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15',
      isPreviewMode && '[&_.tiptap]:cursor-default',
      {
        dark: isDark,
      },
    ]"
    :data-editor-mode="mode"
    :data-editor-layout="isComposerLayout ? 'composer' : 'editor'"
    :style="{ ...editorThemeStyles, borderRadius: 'var(--lc-editor-radius, var(--lc-editor-default-radius))' }"
    data-langeditor
  >
    <SpecialCharacter v-if="hasExtension(editor, 'specialCharacter')" :editor="editor" />
    <SourceCode v-if="hasExtension(editor, 'sourceCode')" :editor="editor" />
    <Printer v-if="hasExtension(editor, 'printer')" :editor="editor" />
    <div
      :class="[
        isFullscreen && '!fixed !inset-0 !z-[9999] m-0 h-full w-full rounded-[0.5rem] bg-background',
        isWordMode && 'h-full min-h-0',
        isMiniMode && 'rounded-t-[0.5rem]',
      ]"
      class="lc-editor-shell relative flex flex-col overflow-hidden"
      data-editor-shell
    >
      <ComposerShell
        v-if="isComposerLayout"
        :config="composerConfig"
        :context-items="composerContextController.items.value"
        :disabled="disabled"
        :streaming="composerController?.isStreaming.value ?? false"
        :submit-disabled="composerController?.submitDisabled.value ?? true"
        :voice-duration="composerVoiceController.duration.value"
        :voice-error="composerVoiceController.errorMessage.value"
        :voice-level="composerVoiceController.level.value"
        :voice-state="composerVoiceController.state.value"
        @action="composerController?.runAction($event)"
        @error="emitComposerError($event)"
        @files="composerContextController.addFiles($event)"
        @remove-context="composerContextController.remove($event)"
        @retry-context="retryComposerContext($event)"
        @stop="composerController?.stop()"
        @submit="composerController?.submit()"
        @voice="composerVoiceController.start()"
        @voice-cancel="composerVoiceController.cancel()"
        @voice-confirm="composerVoiceController.confirm()"
      >
        <template #editor>
          <editor-content
            ref="contentRef"
            :class="[
              'min-w-0 [&_.tiptap]:min-w-0 [&_.tiptap]:px-3 [&_.tiptap]:py-3 [&_.tiptap]:outline-none',
              contentClass,
            ]"
            :editor="editor"
            :spellcheck="spellCheck"
            :style="contentDynamicStyles"
          />
        </template>
        <template v-if="slots['composer-context']" #context="slotProps">
          <slot name="composer-context" v-bind="slotProps" />
        </template>
        <template v-if="slots['composer-footer-start']" #footer-start="slotProps">
          <slot name="composer-footer-start" v-bind="slotProps" />
        </template>
        <template v-if="slots['composer-footer-center']" #footer-center="slotProps">
          <slot name="composer-footer-center" v-bind="slotProps" />
        </template>
        <template v-if="slots['composer-footer-end']" #footer-end="slotProps">
          <slot name="composer-footer-end" v-bind="slotProps" />
        </template>
        <template v-if="slots['composer-add-menu']" #add-menu>
          <slot name="composer-add-menu" />
        </template>
        <template v-if="slots['composer-voice']" #voice="slotProps">
          <slot name="composer-voice" v-bind="slotProps" />
        </template>
        <template v-if="slots['composer-send']" #send="slotProps">
          <slot
            name="composer-send"
            v-bind="slotProps"
            :stop="composerController?.stop"
            :submit="composerController?.submit"
          />
        </template>
      </ComposerShell>
      <template v-else>
      <WordTitlebar v-if="isWordMode" :has-floating-ui="hasPluginUi('floating')" :zoom="wordZoom" />
      <Preview v-if="isPreviewMode" :editor="editor" />
      <EditorToolbarRegion
        :dark="isDark"
        :disabled="disabled"
        :editor="editor"
        :show-menubar="shouldShowMenubar"
        :show-plugin-menubar="hasPluginUi('menubar')"
        :show-plugin-toolbar="hasPluginUi('toolbar')"
        :show-toolbar="shouldShowToolbar"
        :spell-check="spellCheck"
        :toolbar-variant="toolbarVariant"
        :word-mode="isWordMode"
        @toggle-theme="toggleEditorTheme"
        @update:spell-check="spellCheck = $event"
      />
      <div
        v-if="isWordMode && !isPreviewMode"
        class="grid h-[22px] flex-none grid-cols-9 items-end bg-[var(--lc-word-workspace)] px-[max(12px,calc((100%-794px)/2))] text-center text-[8px] text-muted-foreground [border-bottom:1px_solid_hsl(var(--foreground)/.08)]"
        aria-hidden="true"
      >
        <span v-for="mark in 9" :key="mark" class="border-l border-foreground/15 pb-0.5">{{ mark }}</span>
      </div>

      <!-- Main Content Area with optional TOC -->
      <div
        :class="
          isWordMode
            ? 'relative bg-[var(--lc-word-workspace)]'
            : ''
        "
          class="lc-editor-content-area flex min-h-0 flex-1 flex-row overflow-hidden"
      >
        <aside
          v-if="(tocEnabled && tocOpen) || hasPluginUi('sidebar-left')"
          :class="[
            'lc-editor-sidebar relative min-h-0 flex-none overflow-hidden border-r border-border bg-background transition-[width] duration-200',
            isWordMode &&
              'border-foreground/10 bg-[var(--lc-word-workspace)] [&>div:first-child]:bg-transparent [&>div:first-child>header]:border-foreground/10',
          ]"
          :style="{ width: `${tocEnabled && tocOpen ? tocWidth : pluginSidebarWidth('sidebar-left')}px` }"
        >
          <Toc
            v-if="tocEnabled && tocOpen"
            :editor="editor"
            :max-level="tocMaxLevel"
            :title="tocTitle"
            @collapse="closeToc"
          />
          <div
            v-if="hasPluginUi('sidebar-left')"
            class="flex h-full min-h-0 flex-col [&>[data-langchat-plugin-ui]]:flex [&>[data-langchat-plugin-ui]]:min-h-0 [&>[data-langchat-plugin-ui]]:flex-1 [&>[data-langchat-plugin-ui]]:flex-col [&>[data-langchat-plugin-ui]>_*]:min-h-0 [&>[data-langchat-plugin-ui]>_*]:flex-1"
          >
            <PluginUiSlot :editor="editor" placement="sidebar-left" />
          </div>
        </aside>
        <PluginSidebarResizeHandle
          v-if="hasPluginUi('sidebar-left') && pluginSidebarConfig('sidebar-left').resizable"
          placement="sidebar-left"
          :width="pluginSidebarWidth('sidebar-left')"
          :min-width="pluginSidebarConfig('sidebar-left').minWidth"
          :max-width="pluginSidebarConfig('sidebar-left').maxWidth"
          @resize="setPluginSidebarWidth('sidebar-left', $event)"
        />

        <!-- Editor Content -->
        <div
          ref="wordDocumentHostRef"
          :data-word-document-host="isWordMode ? 'true' : undefined"
          :class="isWordMode ? 'overflow-x-hidden overflow-y-auto' : 'overflow-hidden'"
          class="lc-editor-content-host relative min-h-0 flex-1"
          @scroll="isWordMode && updateWordPage($event)"
        >
          <FindAndReplace
            v-if="hasExtension(editor, 'findAndReplace')"
            :container-ref="wordDocumentHostRef"
            :editor="editor"
          />
          <div
            v-if="isWordMode"
            :style="{ zoom: wordZoom / 100 }"
            class="flex min-h-full w-full min-w-0 flex-1 flex-col items-center px-[max(12px,calc((100%-794px)/2))] pb-12 pt-[34px]"
          >
            <editor-content
              ref="contentRef"
              :class="[
                'lc-editor-content word-content-canvas w-full max-w-[794px] min-h-0 flex-1 overflow-visible [&>.tiptap]:flex [&>.tiptap]:w-full [&>.tiptap]:max-w-[794px] [&>.tiptap]:min-w-0 [&>.tiptap]:min-h-0 [&>.tiptap]:flex-col [&>.tiptap]:gap-[30px] [&>.tiptap]:cursor-text [&>.tiptap]:bg-transparent [&>.tiptap]:p-0 [&>.tiptap]:outline-none',
                contentClass,
              ]"
              :editor="editor"
              :spellcheck="spellCheck"
              :style="contentDynamicStyles"
            />
          </div>
          <editor-content
            v-else
            ref="contentRef"
            :class="['lc-editor-content', contentClass]"
            :editor="editor"
            :spellcheck="spellCheck"
            :style="contentDynamicStyles"
          />
          <template v-if="shouldShowBubbleMenu && !disabled && editor.isEditable">
            <ContentMenu :editor="editor" :word-mode="isWordMode" class="hidden sm:block" />
            <LinkBubbleMenu v-if="hasExtension(editor, 'link')" :editor="editor" />
            <ColumnsBubbleMenu v-if="hasExtension(editor, 'columns')" :editor="editor" />
            <TableBubbleMenu v-if="hasExtension(editor, 'table')" :editor="editor" />
            <ImageBubbleMenu v-if="hasExtension(editor, 'image')" :editor="editor" />
            <BasicBubbleMenu
              :editor="editor"
              :show-comment="isWordMode"
              :word-mode="isWordMode"
              @comment="beginWordComment"
            />
            <div v-if="hasPluginUi('bubble')" class="relative z-20">
              <PluginUiSlot :editor="editor" placement="bubble" />
            </div>
          </template>
          <AIMenu
            v-if="!isWordMode && !isPreviewMode && !disabled && editor.isEditable && hasExtension(editor, 'AI')"
            :editor="editor"
          />
          <WordCommentsPanel
            v-if="isWordMode && (pendingWordComment || wordCommentsState.length)"
            :comments="wordCommentsState"
            :container-ref="wordDocumentHostRef"
            :editor="editor"
            :pending-from="pendingWordComment?.from"
            :pending-quote="pendingWordComment?.quote"
            @add="addWordComment"
            @cancel="cancelWordComment"
            @remove="removeWordComment"
            @select="selectWordComment"
          />
        </div>
        <PluginSidebarResizeHandle
          v-if="hasPluginUi('sidebar-right') && pluginSidebarConfig('sidebar-right').resizable"
          placement="sidebar-right"
          :width="pluginSidebarWidth('sidebar-right')"
          :min-width="pluginSidebarConfig('sidebar-right').minWidth"
          :max-width="pluginSidebarConfig('sidebar-right').maxWidth"
          @resize="setPluginSidebarWidth('sidebar-right', $event)"
        />
        <aside
          v-if="hasPluginUi('sidebar-right')"
          class="lc-editor-sidebar relative flex min-h-0 min-w-0 flex-none flex-col overflow-hidden border-l border-border bg-background [&>[data-langchat-plugin-ui]]:flex [&>[data-langchat-plugin-ui]]:min-h-0 [&>[data-langchat-plugin-ui]]:flex-1 [&>[data-langchat-plugin-ui]]:flex-col [&>[data-langchat-plugin-ui]>_*]:min-h-0 [&>[data-langchat-plugin-ui]>_*]:flex-1"
          data-plugin-sidebar="right"
          :style="{ width: `${pluginSidebarWidth('sidebar-right')}px` }"
        >
          <PluginUiSlot :editor="editor" placement="sidebar-right" />
        </aside>
        <AIMenu
          v-if="isWordMode && !isPreviewMode && !disabled && editor.isEditable && hasExtension(editor, 'AI')"
          :editor="editor"
        />
      </div>

      <div v-if="hasPluginUi('floating')" class="pointer-events-none absolute inset-0 z-30">
        <PluginUiSlot :editor="editor" placement="floating" />
      </div>

      <WordHeaderFooterEditor
        v-if="isWordMode"
        v-model:section="wordHeaderFooterSection"
        :model-value="wordHeaderFooterState"
        :open="wordHeaderFooterOpen"
        @apply="applyWordHeaderFooter"
        @close="wordHeaderFooterOpen = false"
      />

      <EditorStatusbar
        :current-page="currentWordPage"
        :editor="editor"
        :mini-mode="isMiniMode"
        :preview-mode="isPreviewMode"
        :show-statusbar-left="hasPluginUi('statusbar-left')"
        :show-statusbar-right="hasPluginUi('statusbar-right')"
        :visible-pages="visibleWordPages"
        :word-mode="isWordMode"
        :zoom="wordZoom"
        @toggle-preview="openWordPreview"
        @update:zoom="setWordZoom"
      >
        <template #footer><slot :editor="editor" name="footer" /></template>
      </EditorStatusbar>
      </template>
    </div>
    <Toaster />
  </div>
</template>
