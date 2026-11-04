import { createApp, h, markRaw, reactive, ref, type App, type ComponentPublicInstance } from 'vue'
import type { AnyExtension, Editor as CoreEditor } from '@tiptap/core'
import LangEditor from '@/components/editor/LangEditorHost.vue'
import { BaseKit } from '@/extensions/BaseKit'
import type { LcEditorErrorDetail, LcEditorOnChange, LcEditorProps } from '@/type'
import type { LcDocumentSession, LcDocumentSource } from '@/plugins'
import { isBuiltinEditorMode } from '@/plugins'
import type { AIMode } from '@/extensions/AI/AI'
import type {
  ElementValue,
  LangEditorElement,
  LangEditorElementProps,
  LcChangeDetail,
  LcErrorDetail,
  LcAIEventDetail,
  LcAIAgentEventDetail,
  LcInputDetail,
  LcReadyDetail,
  LcSubmitDetail,
  LcComposerActionEventDetail,
  LcComposerContextChangeDetail,
  LcMentionSelectDetail,
  LcVoiceStateChangeDetail,
  LcVoiceRecordedDetail,
  LcTranscriptionCompleteDetail,
  LcSessionReadyDetail,
} from './types'
import bundledStyles from '@/styles/index.css?inline'

// The element bundle exposes the same extension surface as the main package,
// so a no-bundler page can assemble a full editor without another import.
export * from '@/extensions'
export * from '@/plugins'
export { registerLocaleMessages, useLocale } from '@/locales'

export type {
  ElementValue,
  LangEditorElement,
  LangEditorElementProps,
  LcChangeDetail,
  LcErrorDetail,
  LcAIEventDetail,
  LcAIAgentEventDetail,
  LcInputDetail,
  LcReadyDetail,
  LcSubmitDetail,
  LcComposerActionEventDetail,
  LcComposerContextChangeDetail,
  LcMentionSelectDetail,
  LcVoiceStateChangeDetail,
  LcVoiceRecordedDetail,
  LcTranscriptionCompleteDetail,
  LcSessionReadyDetail,
} from './types'

const ELEMENT_NAME = 'lang-editor'
const STYLE_ATTRIBUTE = 'data-langeditor-style'
const DEFAULT_OUTPUT: NonNullable<LcEditorProps['output']> = 'html'
const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement
const AI_AGENT_EVENT_BRIDGE = Symbol('lc-ai-agent-event-bridge')

type BridgedAgentEventHandler = ((event: LcAIAgentEventDetail) => void) & {
  [AI_AGENT_EVENT_BRIDGE]?: HTMLElement
}

type EditorComponent = ComponentPublicInstance & {
  editor?: CoreEditor
  session?: LcDocumentSession
  focus?: () => void
  getValue?: () => ElementValue | undefined
  setValue?: (value: ElementValue) => void
  submit?: () => void
  stop?: () => void
  startVoice?: () => void
  cancelVoice?: () => void
  confirmVoice?: () => void
}

function dispatch<T>(element: HTMLElement, name: string, detail: T) {
  element.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }))
}

function bridgePluginOptions(
  element: HTMLElement,
  value: Record<string, unknown> | undefined
): Record<string, unknown> {
  const root = value ?? {}
  const workbench = root.aiAgentWorkbench
  if (!workbench || typeof workbench !== 'object' || Array.isArray(workbench)) return root
  const workbenchOptions = workbench as Record<string, unknown>
  const configValue = workbenchOptions.config
  const config =
    configValue && typeof configValue === 'object' && !Array.isArray(configValue)
      ? (configValue as Record<string, unknown>)
      : {}
  const existing = config.onEvent as BridgedAgentEventHandler | undefined
  if (existing?.[AI_AGENT_EVENT_BRIDGE] === element) return root
  const onEvent: BridgedAgentEventHandler = (event: LcAIAgentEventDetail) => {
    try {
      existing?.(event)
    } finally {
      dispatch<LcAIEventDetail>(element, 'lc-ai', event)
      dispatch<LcAIEventDetail>(element, `lc-ai-${event.type}`, event)
    }
  }
  onEvent[AI_AGENT_EVENT_BRIDGE] = element
  return {
    ...root,
    aiAgentWorkbench: {
      ...workbenchOptions,
      config: {
        ...config,
        onEvent,
      },
    },
  }
}

function injectStyles() {
  if (typeof document === 'undefined') return
  const styleHost = document.head || document.documentElement
  if (!styleHost || styleHost.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return

  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTRIBUTE, '')
  style.textContent = bundledStyles
  styleHost.appendChild(style)
}

function readBooleanAttribute(element: HTMLElement, name: string) {
  return element.hasAttribute(name) && element.getAttribute(name) !== 'false'
}

function readInitialProps(element: HTMLElement): LangEditorElementProps {
  const mode = element.getAttribute('mode') as LangEditorElementProps['mode'] | null
  const layout = element.getAttribute('layout') as LangEditorElementProps['layout'] | null
  const output = element.getAttribute('output') as LangEditorElementProps['output'] | null

  return {
    modelValue: element.getAttribute('value') || element.getAttribute('model-value') || '',
    license: element.getAttribute('license') || undefined,
    autoPlugins: element.hasAttribute('auto-plugins') ? readBooleanAttribute(element, 'auto-plugins') : true,
    output: output || DEFAULT_OUTPUT,
    mode: mode || 'default',
    layout: layout || 'editor',
    disabled: readBooleanAttribute(element, 'disabled'),
    dark: element.hasAttribute('dark') ? readBooleanAttribute(element, 'dark') : undefined,
    hideToolbar: readBooleanAttribute(element, 'hide-toolbar'),
    hideMenubar: element.hasAttribute('hide-menubar') ? readBooleanAttribute(element, 'hide-menubar') : true,
  }
}

export class LangEditorElementImpl extends ElementBase implements LangEditorElement {
  static observedAttributes = [
    'value',
    'model-value',
    'mode',
    'layout',
    'output',
    'disabled',
    'dark',
    'hide-toolbar',
    'hide-menubar',
    'license',
    'auto-plugins',
  ]

  private app: App<Element> | null = null
  private mountPoint: HTMLDivElement | null = null
  private componentRef = ref<EditorComponent | null>(null)
  private mounted = false
  private mountQueued = false
  private mountTimer: ReturnType<typeof setTimeout> | null = null
  private remountQueued = false
  private extensionInput: AnyExtension[] = [BaseKit]
  private props = reactive<LangEditorElementProps>({
    ...readInitialProps(this),
    // A custom element can be upgraded before the page assigns its complex
    // properties. BaseKit provides the required doc/text schema for that
    // first render; a later `extensions` assignment replaces it and remounts.
    extensions: markRaw([BaseKit]),
  })

  connectedCallback() {
    if (this.mounted || this.mountQueued) return
    this.mountQueued = true
    this.mountTimer = setTimeout(() => {
      this.mountTimer = null
      this.mountQueued = false
      if (this.isConnected) this.mount()
    }, 0)
  }

  private mount() {
    if (this.mounted || typeof document === 'undefined') return

    injectStyles()
    this.mountPoint = document.createElement('div')
    this.mountPoint.className = 'langeditor-element-root'
    this.appendChild(this.mountPoint)

    try {
      this.app = createApp({
        setup: () => () =>
          h(LangEditor, {
            ...this.props,
            ref: this.componentRef,
            'onUpdate:modelValue': (value: ElementValue) => {
              this.props.modelValue = value
              this.reflectValue(value)
              const detail: LcInputDetail = {
                value,
                format: isBuiltinEditorMode(this.props.mode ?? 'default')
                  ? this.props.output || DEFAULT_OUTPUT
                  : 'document',
                source: 'editor',
              }
              dispatch(this, 'lc-input', detail)
            },
            onChange: ({ output }: LcEditorOnChange) => {
              const detail: LcChangeDetail = {
                value: output,
                format: isBuiltinEditorMode(this.props.mode ?? 'default')
                  ? this.props.output || DEFAULT_OUTPUT
                  : 'document',
              }
              dispatch(this, 'lc-change', detail)
            },
            onEnter: () => dispatch(this, 'lc-enter', undefined),
            onSubmit: (detail: LcSubmitDetail) => dispatch(this, 'lc-submit', detail),
            onStop: () => dispatch(this, 'lc-stop', undefined),
            onComposerAction: (detail: LcComposerActionEventDetail) => dispatch(this, 'lc-composer-action', detail),
            'onUpdate:composerContext': (value: LcComposerContextChangeDetail['value']) => {
              this.props.composerContext = value
              dispatch<LcComposerContextChangeDetail>(this, 'lc-composer-context-change', { value })
            },
            onMentionSelect: (detail: LcMentionSelectDetail) => dispatch(this, 'lc-mention-select', detail),
            onVoiceStateChange: (detail: LcVoiceStateChangeDetail) => dispatch(this, 'lc-voice-state-change', detail),
            onVoiceRecorded: (detail: LcVoiceRecordedDetail) => dispatch(this, 'lc-voice-recorded', detail),
            onTranscriptionComplete: (detail: LcTranscriptionCompleteDetail) =>
              dispatch(this, 'lc-transcription-complete', detail),
            onSessionReady: (detail: LcSessionReadyDetail) => dispatch(this, 'lc-session-ready', detail),
            onError: (detail: LcEditorErrorDetail) =>
              dispatch<LcErrorDetail>(this, 'lc-error', {
                error: { name: detail.error.name, message: detail.error.message },
                source: detail.source,
              }),
            'onUpdate:dark': (value: boolean) => dispatch(this, 'lc-dark-change', { value }),
            'onUpdate:wordComments': (value: unknown) => dispatch(this, 'lc-word-comments-change', { value }),
            'onUpdate:wordHeaderFooter': (value: unknown) => dispatch(this, 'lc-word-header-footer-change', { value }),
          }),
      })

      this.app.mount(this.mountPoint)
      this.mounted = true
      queueMicrotask(() => {
        if (this.mounted) dispatch<LcReadyDetail>(this, 'lc-ready', { element: this })
      })
    } catch (error) {
      const value = error as Error
      dispatch<LcErrorDetail>(this, 'lc-error', {
        error: { name: value?.name, message: value?.message || 'Failed to mount editor' },
        source: 'mount',
      })
    }
  }

  disconnectedCallback() {
    this.destroy()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (!this.mounted || _oldValue === newValue) return

    switch (name) {
      case 'value':
      case 'model-value':
        this.setValue(newValue ?? '')
        break
      case 'mode':
        this.props.mode = (newValue as LangEditorElementProps['mode']) || 'default'
        this.queueRemount()
        break
      case 'layout':
        this.props.layout = (newValue as LangEditorElementProps['layout']) || 'editor'
        break
      case 'output':
        this.props.output = (newValue as LangEditorElementProps['output']) || DEFAULT_OUTPUT
        break
      case 'disabled':
        this.props.disabled = readBooleanAttribute(this, name)
        break
      case 'dark':
        this.props.dark = newValue === null ? undefined : readBooleanAttribute(this, name)
        break
      case 'hide-toolbar':
        this.props.hideToolbar = readBooleanAttribute(this, name)
        break
      case 'hide-menubar':
        this.props.hideMenubar = newValue === null ? true : readBooleanAttribute(this, name)
        break
      case 'license':
        this.props.license = newValue || undefined
        this.queueRemount()
        break
      case 'auto-plugins':
        this.props.autoPlugins = newValue === null ? true : readBooleanAttribute(this, name)
        this.queueRemount()
        break
    }
  }

  get value() {
    return this.props.modelValue || ''
  }

  set value(value: ElementValue) {
    this.setValue(value)
  }

  get modelValue() {
    return this.value
  }

  set modelValue(value: ElementValue) {
    this.setValue(value)
  }

  get mode() {
    return this.props.mode
  }

  set mode(value: LangEditorElementProps['mode']) {
    if (!value || value === this.props.mode) return
    this.props.mode = value
    this.queueRemount()
  }

  get layout() {
    return this.props.layout
  }

  set layout(value: LangEditorElementProps['layout']) {
    this.props.layout = value || 'editor'
  }

  get composer() {
    return this.props.composer
  }

  set composer(value: LangEditorElementProps['composer']) {
    this.props.composer = value
  }

  get composerContext() {
    return this.props.composerContext
  }

  set composerContext(value: LangEditorElementProps['composerContext']) {
    this.props.composerContext = value || []
  }

  get mention() {
    return this.props.mention
  }

  set mention(value: LangEditorElementProps['mention']) {
    if (value === this.props.mention) return
    this.props.mention = value
    this.queueRemount()
  }

  get output() {
    return this.props.output
  }

  set output(value: LangEditorElementProps['output']) {
    this.props.output = value
  }

  get miniExtensions() {
    return this.props.miniExtensions
  }

  set miniExtensions(value: LangEditorElementProps['miniExtensions']) {
    const current = this.props.miniExtensions || []
    const next = value || []
    if (current.length === next.length && current.every((extension, index) => extension === next[index])) return
    this.props.miniExtensions = value
    this.queueRemount()
  }

  get toc() {
    return this.props.toc
  }

  set toc(value: LangEditorElementProps['toc']) {
    this.props.toc = value
  }

  get wordPageCount() {
    return this.props.wordPageCount
  }

  set wordPageCount(value: LangEditorElementProps['wordPageCount']) {
    this.props.wordPageCount = value
  }

  get wordHeaderFooter() {
    return this.props.wordHeaderFooter
  }

  set wordHeaderFooter(value: LangEditorElementProps['wordHeaderFooter']) {
    this.props.wordHeaderFooter = value
  }

  get wordComments() {
    return this.props.wordComments
  }

  set wordComments(value: LangEditorElementProps['wordComments']) {
    this.props.wordComments = value
  }

  get dark() {
    return this.props.dark
  }

  set dark(value: LangEditorElementProps['dark']) {
    this.props.dark = value
  }

  get theme() {
    return this.props.theme
  }

  set theme(value: LangEditorElementProps['theme']) {
    this.props.theme = value
  }

  get radius() {
    return this.props.radius
  }

  set radius(value: LangEditorElementProps['radius']) {
    this.props.radius = value
  }

  get disabled() {
    return this.props.disabled
  }

  set disabled(value: LangEditorElementProps['disabled']) {
    this.props.disabled = value
  }

  get hideToolbar() {
    return this.props.hideToolbar
  }

  set hideToolbar(value: LangEditorElementProps['hideToolbar']) {
    this.props.hideToolbar = value
  }

  get hideMenubar() {
    return this.props.hideMenubar
  }

  set hideMenubar(value: LangEditorElementProps['hideMenubar']) {
    this.props.hideMenubar = value
  }

  get hideBubble() {
    return this.props.hideBubble
  }

  set hideBubble(value: LangEditorElementProps['hideBubble']) {
    this.props.hideBubble = value
  }

  get removeDefaultWrapper() {
    return this.props.removeDefaultWrapper
  }

  set removeDefaultWrapper(value: LangEditorElementProps['removeDefaultWrapper']) {
    this.props.removeDefaultWrapper = value
  }

  get editorClass() {
    return this.props.editorClass
  }

  set editorClass(value: LangEditorElementProps['editorClass']) {
    this.props.editorClass = value
  }

  get contentClass() {
    return this.props.contentClass
  }

  set contentClass(value: LangEditorElementProps['contentClass']) {
    this.props.contentClass = value
  }

  get maxWidth() {
    return this.props.maxWidth
  }

  set maxWidth(value: LangEditorElementProps['maxWidth']) {
    this.props.maxWidth = value
  }

  get minHeight() {
    return this.props.minHeight
  }

  set minHeight(value: LangEditorElementProps['minHeight']) {
    this.props.minHeight = value
  }

  get maxHeight() {
    return this.props.maxHeight
  }

  set maxHeight(value: LangEditorElementProps['maxHeight']) {
    this.props.maxHeight = value
  }

  get extensions() {
    return this.props.extensions || []
  }

  get license() {
    return this.props.license
  }

  set license(value) {
    this.props.license = value
    if (value) this.queueRemount()
  }

  get autoPlugins() {
    return this.props.autoPlugins
  }

  set autoPlugins(value) {
    this.props.autoPlugins = value !== false
    this.queueRemount()
  }

  get pluginOptions() {
    return this.props.pluginOptions
  }

  set pluginOptions(value) {
    this.props.pluginOptions = bridgePluginOptions(this, value)
    this.queueRemount()
  }

  get documentSource() {
    return this.props.documentSource
  }

  set documentSource(value: LcDocumentSource | undefined) {
    this.props.documentSource = value
  }

  set extensions(value: AnyExtension[]) {
    const nextExtensions = Array.isArray(value) ? value : []
    if (
      nextExtensions.length === this.extensionInput.length &&
      nextExtensions.every((extension, index) => extension === this.extensionInput[index])
    ) {
      return
    }

    this.extensionInput = nextExtensions
    // Tiptap extensions are stateful class-like objects. Keeping them raw
    // prevents Vue's deep proxying from changing extension/schema behavior.
    this.props.extensions = markRaw(nextExtensions)
    this.queueRemount()
  }

  getEditor() {
    return this.componentRef.value?.editor
  }

  getSession() {
    return this.componentRef.value?.session
  }

  openAI(mode?: AIMode) {
    this.getEditor()?.commands.toggleAI(true, mode)
  }

  closeAI() {
    this.getEditor()?.commands.toggleAI(false)
  }

  submit() {
    this.componentRef.value?.submit?.()
  }

  stop() {
    this.componentRef.value?.stop?.()
  }

  startVoice() {
    this.componentRef.value?.startVoice?.()
  }

  cancelVoice() {
    this.componentRef.value?.cancelVoice?.()
  }

  confirmVoice() {
    this.componentRef.value?.confirmVoice?.()
  }

  getValue() {
    return this.componentRef.value?.getValue?.() ?? this.value
  }

  setValue(value: ElementValue) {
    this.props.modelValue = value
    this.reflectValue(value)
    this.componentRef.value?.setValue?.(value)
  }

  focus() {
    this.componentRef.value?.focus?.()
  }

  destroy() {
    if (this.mountTimer !== null) {
      clearTimeout(this.mountTimer)
      this.mountTimer = null
    }
    this.mountQueued = false
    this.remountQueued = false
    if (!this.app) return
    this.app.unmount()
    this.app = null
    this.mountPoint?.remove()
    this.mountPoint = null
    this.mounted = false
  }

  private queueRemount() {
    if (!this.mounted || this.remountQueued) return
    this.remountQueued = true
    queueMicrotask(() => {
      this.remountQueued = false
      if (!this.mounted || !this.isConnected) return
      const value = this.getValue()
      this.destroy()
      this.props.modelValue = value
      this.mount()
    })
  }

  private reflectValue(value: ElementValue) {
    if (typeof value !== 'string') return
    if (this.getAttribute('value') !== value) this.setAttribute('value', value)
  }
}

export function registerLangEditorElement(name = ELEMENT_NAME) {
  if (typeof customElements === 'undefined' || customElements.get(name)) return
  customElements.define(name, LangEditorElementImpl)
}

registerLangEditorElement()
