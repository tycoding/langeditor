import { computed, type ComputedRef, type Ref } from 'vue'
import type { Editor, JSONContent } from '@tiptap/core'
import type {
  LcComposerAction,
  LcComposerActionDetail,
  LcComposerAddMenuItem,
  LcComposerConfig,
  LcComposerContextItem,
  LcComposerState,
  LcComposerSubmitDetail,
} from '@/type'

export interface LcResolvedComposerConfig extends LcComposerConfig {
  minHeight: string | number
  maxHeight: string | number
  submitOnEnter: boolean
  clearOnSubmit: boolean
  accept: string
  maxContextItems: number
  maxFileSize: number
  state: LcComposerState
  send: Required<NonNullable<LcComposerConfig['send']>>
  voice: NonNullable<LcComposerConfig['voice']> & {
    visible: boolean
    mode: 'dictation'
    waveform: boolean
  }
  addMenu: NonNullable<LcComposerConfig['addMenu']> & { visible: boolean }
  actions: LcComposerAction[]
}

export function resolveComposerConfig(config?: LcComposerConfig): LcResolvedComposerConfig {
  return {
    ...config,
    minHeight: config?.minHeight ?? 96,
    maxHeight: config?.maxHeight ?? 320,
    submitOnEnter: config?.submitOnEnter !== false,
    clearOnSubmit: config?.clearOnSubmit === true,
    accept: config?.accept ?? '*/*',
    maxContextItems: config?.maxContextItems ?? 12,
    maxFileSize: config?.maxFileSize ?? 25 * 1024 * 1024,
    state: config?.state ?? 'idle',
    send: {
      visible: config?.send?.visible !== false,
      shape: config?.send?.shape ?? 'circle',
      size: config?.send?.size ?? 'md',
      color: config?.send?.color ?? 'primary',
      stopWhenStreaming: config?.send?.stopWhenStreaming !== false,
    },
    voice: {
      ...config?.voice,
      visible: config?.voice?.visible !== false,
      mode: 'dictation',
      waveform: config?.voice?.waveform !== false,
    },
    addMenu: {
      ...config?.addMenu,
      visible: config?.addMenu?.visible !== false,
    },
    actions: [...(config?.actions ?? [])],
  }
}

function cloneContextItem(item: LcComposerContextItem): LcComposerContextItem {
  return {
    ...item,
    metadata: item.metadata ? { ...item.metadata } : undefined,
  }
}

function collectMentions(content: JSONContent, mentions: LcComposerSubmitDetail['mentions']) {
  if (content.type === 'mention' && content.attrs) {
    mentions.push({
      id: String(content.attrs.id ?? ''),
      label: String(content.attrs.label ?? ''),
      value: content.attrs.value == null ? undefined : String(content.attrs.value),
      sourceId: String(content.attrs.sourceId ?? ''),
      trigger: String(content.attrs.trigger ?? '@'),
      metadata:
        content.attrs.metadata && typeof content.attrs.metadata === 'object'
          ? { ...(content.attrs.metadata as Record<string, unknown>) }
          : undefined,
    })
  }
  content.content?.forEach(child => collectMentions(child, mentions))
}

export function useComposer(options: {
  editor: Editor
  config: ComputedRef<LcResolvedComposerConfig>
  contextItems: Ref<LcComposerContextItem[]>
  revision: Ref<number>
  voiceBusy: ComputedRef<boolean>
  onSubmit: (detail: LcComposerSubmitDetail) => void
  onStop: () => void
  onAction: (detail: LcComposerActionDetail) => void
}) {
  const isStreaming = computed(
    () => options.config.value.state === 'streaming' && options.config.value.send.stopWhenStreaming
  )
  const hasPendingContext = computed(() =>
    options.contextItems.value.some(item => item.status === 'uploading' || item.status === 'processing')
  )
  const submitDisabled = computed(() => {
    options.revision.value
    if (isStreaming.value) return false
    const state = options.config.value.state
    if (state === 'validating' || state === 'submitting' || options.voiceBusy.value || hasPendingContext.value) return true
    return options.editor.isEmpty && options.contextItems.value.length === 0
  })

  function submit() {
    if (isStreaming.value) {
      stop()
      return
    }
    if (submitDisabled.value) return

    const json = options.editor.getJSON()
    const mentions: LcComposerSubmitDetail['mentions'] = []
    collectMentions(json, mentions)
    options.onSubmit({
      html: options.editor.getHTML(),
      json,
      text: options.editor.getText(),
      contextItems: options.contextItems.value.map(cloneContextItem),
      mentions,
      metadata: options.config.value.metadata ? { ...options.config.value.metadata } : undefined,
    })
    if (options.config.value.clearOnSubmit) options.editor.commands.clearContent(true)
  }

  function stop() {
    options.onStop()
  }

  function runAction(action: LcComposerAction | LcComposerAddMenuItem) {
    if (action.disabled) return
    options.onAction({
      action,
      contextItems: options.contextItems.value.map(cloneContextItem),
    })
  }

  return {
    isStreaming,
    submitDisabled,
    submit,
    stop,
    runAction,
  }
}
