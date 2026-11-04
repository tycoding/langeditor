<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { DOMSerializer } from '@tiptap/pm/model'
import { useFocus } from '@vueuse/core'
import { useLocale } from '@/locales'
import { useHotkeys } from '@/hooks'
import { useToast } from '@/components/ui/toast/use-toast'
import { Icon } from '@/components/icons'
import Menu from '../ui/menu.vue'
import AiCompletion from './components/AiCompletion.vue'
import { useAIConversation } from '@/hooks/useAIConversation'
import { DEFAULT_SHORTCUTS } from '@/extensions/AI/constants'
import type { AIMode } from '@/extensions/AI/AI'
import type { ChartAttributes, ChartDataset } from '@/extensions/Chart'

interface Props {
  editor: Editor
  disabled?: boolean
}

interface ShortcutItem {
  label: string
  prompt: string
  icon?: string
  children?: ShortcutItem[]
}

interface MenuItem {
  label: string
  icon?: string
  children?: MenuItem[]
  [key: string]: any
}

interface CachedPrompt {
  context: string
  prompt: string
  operation: 'document' | 'chart'
}

type DocumentCommandIcon =
  'DocSearch' | 'Pencil' | 'IndentDecrease' | 'Plus' | 'Table' | 'MessageSquarePlus' | 'Processon' | 'ChartColumn'

interface DocumentCommand {
  icon: DocumentCommandIcon
  label: string
  prompt: string
  operation?: 'document' | 'chart'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const prompt = ref('')
const cachedPrompt = ref<CachedPrompt | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const resultContainer = ref<HTMLDivElement | null>(null)
const isShaking = ref(false)
const selectedDocumentCommand = ref<DocumentCommand | null>(null)
const menuRef = ref()
const shouldShow = ref(Boolean(props.editor.storage.AI?.open))
const aiMode = ref<AIMode>(props.editor.storage.AI?.mode ?? 'selection')
const activeSelection = ref<{ from: number; to: number } | null>(null)
const generatedRange = ref<{ from: number; to: number } | null>(null)
const AI_TEXT_COLOR = '#7c3aed'
const AI_HIGHLIGHT_COLOR = '#ede9fe'
let selectionCloseFrame: number | null = null
const selectionMenuPosition = ref({ top: 12, left: 12 })
const { focused } = useFocus(inputRef)
const { t } = useLocale()
const { toast } = useToast()
const { result, status, handleCompletion, resetConversation, stopGeneration } = useAIConversation(props.editor)

function emitAIAction(type: 'accept' | 'reject' | 'insert' | 'regenerate', operation?: 'document' | 'chart') {
  const options = props.editor.extensionManager.extensions.find(extension => extension.name === 'AI')?.options
  options?.onEvent?.({ type, mode: aiMode.value, operation, text: result.value })
}

function getSelectionScrollTarget(): HTMLElement | Window {
  let parent = props.editor.view.dom.parentElement

  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
    parent = parent.parentElement
  }

  return window
}

function getSelectionPositionHost(): HTMLElement | null {
  let parent = props.editor.view.dom.parentElement
  while (parent) {
    const position = window.getComputedStyle(parent).position
    if (position === 'relative' || position === 'absolute' || position === 'fixed') return parent
    parent = parent.parentElement
  }
  return props.editor.view.dom.parentElement
}

function updateSelectionMenuPosition() {
  const selection = activeSelection.value
  const host = getSelectionPositionHost()
  if (!selection || !host || props.editor.isDestroyed) return

  try {
    const from = props.editor.view.coordsAtPos(selection.from)
    const to = props.editor.view.coordsAtPos(selection.to)
    const hostRect = host.getBoundingClientRect()
    const panelWidth = Math.min(450, Math.max(280, host.clientWidth - 16))
    const panelHeight = 156
    const anchorLeft = Math.min(from.left, to.left)
    const anchorRight = Math.max(from.right, to.right)
    const anchorTop = Math.min(from.top, to.top)
    const anchorBottom = Math.max(from.bottom, to.bottom)
    const preferredLeft = anchorLeft - hostRect.left + host.scrollLeft + (anchorRight - anchorLeft) / 2 - panelWidth / 2
    const left = Math.max(8, Math.min(preferredLeft, Math.max(8, host.clientWidth - panelWidth - 8)))
    const belowTop = anchorBottom - hostRect.top + host.scrollTop + 10
    const aboveTop = anchorTop - hostRect.top + host.scrollTop - panelHeight - 10
    const top = anchorBottom + panelHeight + 16 <= window.innerHeight ? belowTop : Math.max(8, aboveTop)
    selectionMenuPosition.value = { top, left }
  } catch {
    // The selection can briefly point at a node being replaced. Keep the last
    // stable position until ProseMirror exposes the new DOM range.
  }
}

const aiMenuWrapper = computed(() => 'div')
const aiMenuWrapperProps = computed(() =>
  aiMode.value === 'selection'
    ? {
        class: 'pointer-events-auto absolute z-[98] w-[min(450px,calc(100%_-_16px))]',
        style: {
          top: `${selectionMenuPosition.value.top}px`,
          left: `${selectionMenuPosition.value.left}px`,
        },
      }
    : {
        class: 'pointer-events-none absolute inset-0 z-[98]',
      }
)
let selectionScrollTarget: HTMLElement | Window | null = null

onMounted(() => {
  selectionScrollTarget = getSelectionScrollTarget()
  selectionScrollTarget.addEventListener('scroll', updateSelectionMenuPosition, { passive: true })
  window.addEventListener('resize', updateSelectionMenuPosition)
  void nextTick(updateSelectionMenuPosition)
})

const isDocumentComposerExpanded = computed(
  () => aiMode.value === 'document' && status.value === 'init' && (focused.value || Boolean(prompt.value))
)

const showDocumentCommands = computed(
  () =>
    aiMode.value === 'document' &&
    status.value === 'init' &&
    focused.value &&
    !selectedDocumentCommand.value &&
    !prompt.value
)

const documentCommands = computed<DocumentCommand[]>(() => {
  const commands: DocumentCommand[] = [
    {
      icon: 'DocSearch',
      label: t.value('editor.AI.command.proofread'),
      prompt: t.value('editor.AI.prompt.proofread'),
    },
    {
      icon: 'Pencil',
      label: t.value('editor.AI.command.rewrite'),
      prompt: t.value('editor.AI.prompt.rewrite'),
    },
    {
      icon: 'IndentDecrease',
      label: t.value('editor.AI.command.shorten'),
      prompt: t.value('editor.AI.prompt.shorten'),
    },
    {
      icon: 'Plus',
      label: t.value('editor.AI.command.paragraph'),
      prompt: t.value('editor.AI.prompt.paragraph'),
    },
    {
      icon: 'Table',
      label: t.value('editor.AI.command.table'),
      prompt: t.value('editor.AI.prompt.table'),
    },
    {
      icon: 'ChartColumn',
      label: t.value('editor.AI.command.chart'),
      prompt: t.value('editor.AI.prompt.chart'),
      operation: 'chart',
    },
    {
      icon: 'MessageSquarePlus',
      label: t.value('editor.AI.command.explain'),
      prompt: t.value('editor.AI.prompt.explain'),
    },
    {
      icon: 'Processon',
      label: t.value('editor.AI.command.component'),
      prompt: t.value('editor.AI.prompt.component'),
    },
  ]

  return commands.filter(
    command =>
      command.operation !== 'chart' ||
      props.editor.extensionManager.extensions.some(extension => extension.name === 'chart')
  )
})

const getSelectionText = (editor: Editor) => {
  const slice = editor.state.selection.content()
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const fragment = serializer.serializeFragment(slice.content)
  const div = document.createElement('div')
  div.appendChild(fragment)
  return div.innerHTML
}

const getAIContext = () => (aiMode.value === 'document' ? props.editor.getHTML() : getSelectionText(props.editor))

function getAIGeneratedMarks() {
  const marks = []
  const textStyle = props.editor.schema.marks.textStyle
  const underline = props.editor.schema.marks.underline
  const highlight = props.editor.schema.marks.highlight
  if (textStyle) marks.push(textStyle.create({ color: AI_TEXT_COLOR }))
  if (underline) marks.push(underline.create())
  if (highlight) marks.push(highlight.create({ color: AI_HIGHLIGHT_COLOR }))
  return marks
}

function normalizeGeneratedText(text: string) {
  if (!/<\/?[a-z][^>]*>/i.test(text)) return text
  const container = document.createElement('div')
  container.innerHTML = text
  return container.textContent ?? ''
}

function updateGeneratedText(text: string) {
  const selection = activeSelection.value
  if (!selection || !text || props.editor.isDestroyed) return

  const from = generatedRange.value?.from ?? selection.to
  const to = generatedRange.value?.to ?? from
  const generatedNode = props.editor.schema.text(normalizeGeneratedText(text), getAIGeneratedMarks())
  const transaction = props.editor.state.tr.replaceWith(from, to, generatedNode)
  transaction.setSelection(TextSelection.create(transaction.doc, selection.to))
  transaction.setMeta('AI:generated', true)
  props.editor.view.dispatch(transaction)
  generatedRange.value = { from, to: from + normalizeGeneratedText(text).length }
}

function clearGeneratedRange(keepText: boolean) {
  const range = generatedRange.value
  if (!range || range.from >= range.to || props.editor.isDestroyed) return

  const transaction = props.editor.state.tr
  if (keepText) {
    for (const markType of [
      props.editor.schema.marks.textStyle,
      props.editor.schema.marks.underline,
      props.editor.schema.marks.highlight,
    ]) {
      if (markType) transaction.removeMark(range.from, range.to, markType)
    }
  } else {
    transaction.delete(range.from, range.to)
  }
  transaction.setMeta('AI:generated', true)
  props.editor.view.dispatch(transaction)
  generatedRange.value = null
}

const scrollToBottom = async () => {
  await nextTick()
  if (resultContainer.value) resultContainer.value.scrollTop = resultContainer.value.scrollHeight
}

watch(
  () => result.value,
  () => scrollToBottom()
)

function syncVisibility({ transaction }: { transaction: Transaction }) {
  const open = transaction.getMeta('AI:open')
  const mode = transaction.getMeta('AI:mode')
  const requestedPrompt = transaction.getMeta('AI:prompt')
  if (typeof open === 'boolean') {
    shouldShow.value = open
    if (!open) activeSelection.value = null
  }
  if (mode === 'selection' || mode === 'document') aiMode.value = mode

  if (transaction.getMeta('AI:generated')) return

  if (open === true && (mode ?? aiMode.value) === 'selection') {
    const nextSelection = {
      from: transaction.selection.from,
      to: transaction.selection.to,
    }
    const selectionChanged =
      !activeSelection.value ||
      activeSelection.value.from !== nextSelection.from ||
      activeSelection.value.to !== nextSelection.to

    // A new selection starts a fresh request. This prevents a previous
    // accepted/rejected response from being reused by the next AI action.
    if (selectionChanged || status.value !== 'init' || result.value || prompt.value) {
      prompt.value = ''
      cachedPrompt.value = null
      selectedDocumentCommand.value = null
      resetConversation()
    }

    activeSelection.value = nextSelection
    nextTick(() => {
      updateSelectionMenuPosition()
      inputRef.value?.focus()
    })
  }

  if (
    transaction.selectionSet &&
    shouldShow.value &&
    aiMode.value === 'selection' &&
    activeSelection.value &&
    (transaction.selection.from !== activeSelection.value.from || transaction.selection.to !== activeSelection.value.to)
  ) {
    activeSelection.value = null
    // Let the editor finish its current DOM update before closing the state.
    // Deferring this also keeps the selection menu and text selection in sync.
    shouldShow.value = false
    if (selectionCloseFrame === null) {
      selectionCloseFrame = requestAnimationFrame(() => {
        selectionCloseFrame = null
        if (aiMode.value === 'selection') clearGeneratedRange(false)
        if (props.editor.storage.AI?.open && props.editor.storage.AI?.mode === 'selection') {
          props.editor.commands.toggleAI(false)
        }
      })
    }
  }

  if (typeof requestedPrompt === 'string') {
    prompt.value = requestedPrompt
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.setSelectionRange(prompt.value.length, prompt.value.length)
    })
  }
}

props.editor.on('transaction', syncVisibility)
onBeforeUnmount(() => {
  props.editor.off('transaction', syncVisibility)
  if (selectionCloseFrame !== null) cancelAnimationFrame(selectionCloseFrame)
  selectionScrollTarget?.removeEventListener('scroll', updateSelectionMenuPosition)
  window.removeEventListener('resize', updateSelectionMenuPosition)
})

function applyGeneratedDocument(content: string) {
  if (content.trim()) props.editor.commands.setContent(content)
}

function extractJSONObject(content: string) {
  const withoutFence = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  return start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence
}

function parseChartCompletion(content: string): Partial<ChartAttributes> {
  const parsed = JSON.parse(extractJSONObject(content)) as Partial<ChartAttributes>
  const labels = Array.isArray(parsed.labels) ? parsed.labels.map(String).slice(0, 12) : []
  const datasets: ChartDataset[] = Array.isArray(parsed.datasets)
    ? parsed.datasets
        .slice(0, 6)
        .filter(dataset => dataset && Array.isArray(dataset.values))
        .map((dataset, index) => ({
          label: String(dataset.label || `Series ${index + 1}`),
          color: dataset.color ? String(dataset.color) : undefined,
          values: labels.map((_, valueIndex) => Number(dataset.values[valueIndex]) || 0),
        }))
    : []

  if (!labels.length || !datasets.length) throw new Error(t.value('editor.AI.chartInvalid'))

  return {
    title: String(parsed.title || t.value('editor.chart.generatedTitle')),
    description: String(parsed.description || ''),
    type: parsed.type === 'line' ? 'line' : 'bar',
    labels,
    datasets,
    note: String(parsed.note || ''),
    height: Math.min(520, Math.max(220, Number(parsed.height) || 300)),
  }
}

function applyGeneratedChart(content: string) {
  props.editor.chain().focus('end').insertChart(parseChartCompletion(content)).run()
}

function restoreOriginalDocument() {
  if (aiMode.value === 'document' && cachedPrompt.value?.context) {
    props.editor.commands.setContent(cachedPrompt.value.context)
  }
}

function resetComposer() {
  prompt.value = ''
  cachedPrompt.value = null
  selectedDocumentCommand.value = null
  resetConversation()
}

function handleClose() {
  inputRef.value?.blur()
  if (aiMode.value === 'selection') clearGeneratedRange(false)
  resetComposer()
  props.editor.commands.toggleAI(false)
}

function handleAccept() {
  if (aiMode.value === 'selection') clearGeneratedRange(true)
  emitAIAction('accept')
  handleClose()
}

function handleInsert() {
  if (aiMode.value === 'selection') {
    clearGeneratedRange(true)
  } else if (result.value.trim()) {
    props.editor.chain().focus('end').insertContent(result.value).run()
  }
  emitAIAction('insert')
  handleClose()
}

function handleReject() {
  if (aiMode.value === 'selection') clearGeneratedRange(false)
  restoreOriginalDocument()
  emitAIAction('reject')
  handleClose()
}

function handleReviewClose() {
  restoreOriginalDocument()
  handleClose()
}

async function completeDocument(context: string, request: string, operation: 'document' | 'chart' = 'document') {
  const completion = await handleCompletion(
    context,
    request,
    aiMode.value === 'selection' ? updateGeneratedText : undefined,
    operation
  )
  if (aiMode.value === 'selection') {
    if (completion.trim()) updateGeneratedText(normalizeGeneratedText(completion))
    else clearGeneratedRange(false)
  }
  if (aiMode.value === 'document') {
    if (operation === 'chart') applyGeneratedChart(completion)
    else applyGeneratedDocument(completion)
  }
  await scrollToBottom()
  return completion
}

async function handleGenerate() {
  const request = prompt.value.trim()
  if (!request) return

  try {
    const context = getAIContext()
    if (!context.trim()) {
      toast({
        title: t.value('editor.AI.error'),
        description: t.value(aiMode.value === 'document' ? 'editor.AI.emptyDocument' : 'editor.AI.noSelection'),
        variant: 'destructive',
      })
      return
    }

    const operation = selectedDocumentCommand.value?.operation ?? 'document'
    generatedRange.value = null
    cachedPrompt.value = { context, prompt: request, operation }
    selectedDocumentCommand.value = null
    prompt.value = ''
    await completeDocument(context, request, operation)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    toast({
      title: t.value('editor.AI.error'),
      description: error instanceof Error ? error.message : t.value('editor.AI.unknownError'),
      variant: 'destructive',
    })
    handleClose()
  }
}

async function handleReGenerate() {
  const cache = cachedPrompt.value
  if (!cache?.context || !cache.prompt) {
    toast({
      title: t.value('editor.AI.error'),
      description: t.value('editor.AI.noCachedPrompt'),
      variant: 'destructive',
    })
    return
  }

  try {
    restoreOriginalDocument()
    resetConversation()
    emitAIAction('regenerate', cache.operation)
    await completeDocument(cache.context, cache.prompt, cache.operation)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    toast({
      title: t.value('editor.AI.error'),
      description: error instanceof Error ? error.message : t.value('editor.AI.regenerateError'),
      variant: 'destructive',
    })
    handleReviewClose()
  }
}

useHotkeys('esc', () => {
  if (status.value === 'completed' && aiMode.value === 'document') {
    handleReviewClose()
    return
  }
  stopGeneration()
  handleClose()
})

function handleOverlayClick() {
  if (status.value === 'init' && prompt.value === '') {
    handleClose()
    return
  }
  isShaking.value = true
  setTimeout(() => {
    isShaking.value = false
  }, 820)
}

async function shortcutClick(item: MenuItem) {
  try {
    const context = getAIContext()
    const shortcutItem = item as ShortcutItem
    cachedPrompt.value = { context, prompt: shortcutItem.prompt, operation: 'document' }
    await completeDocument(context, shortcutItem.prompt)
    focused.value = true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    toast({
      title: t.value('editor.AI.error'),
      description: error instanceof Error ? error.message : t.value('editor.AI.shortcutError'),
      variant: 'destructive',
    })
    handleClose()
  }
}

function selectDocumentCommand(command: DocumentCommand) {
  selectedDocumentCommand.value = command
  prompt.value = command.prompt
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.setSelectionRange(prompt.value.length, prompt.value.length)
  })
}

const shortcutMenus = computed<ShortcutItem[]>(() => {
  const configuredShortcuts = props.editor.extensionManager.extensions.find(e => e.name === 'AI')?.options?.shortcuts
  const shortcuts = Array.isArray(configuredShortcuts) ? configuredShortcuts : []
  return [...DEFAULT_SHORTCUTS, ...shortcuts].map(item => ({
    ...item,
    label: t.value(item.label),
    children: item.children?.map(child => ({ ...child, label: t.value(child.label) })),
  }))
})

function handleKey(event: KeyboardEvent) {
  if (status.value === 'init' && shortcutMenus.value.length && !prompt.value && aiMode.value === 'selection') {
    menuRef.value?.handleKeyDown(event)
  }
}

function handlePromptKeydown(event: KeyboardEvent) {
  if (aiMode.value === 'selection' && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) void handleGenerate()
  }
}
</script>

<template>
  <component
    :is="aiMenuWrapper"
    v-if="shouldShow"
    v-bind="aiMenuWrapperProps"
    @click="aiMode === 'document' && handleOverlayClick()"
  >
    <div
      :class="[
        'relative z-[99] w-[min(450px,calc(100%_-_16px))]',
        aiMode === 'selection'
          ? 'relative w-[min(450px,calc(100vw_-_24px))]'
          : 'pointer-events-auto absolute bottom-[18px] left-1/2 w-[min(760px,calc(100%_-_48px))] -translate-x-1/2 max-[640px]:bottom-3 max-[640px]:w-[calc(100%_-_24px)]',
      ]"
      @click.stop
    >
      <div
        :class="[
          'relative w-full',
          isShaking && 'animate-[lc-ai-shake_0.82s_cubic-bezier(0.36,0.07,0.19,0.97)_both]',
        ]"
        @keydown="handleKey"
      >
        <div
          v-if="showDocumentCommands"
          class="absolute bottom-[calc(100%_+_12px)] left-[18px] z-[3] grid w-[min(300px,calc(100%_-_36px))] gap-0.5 rounded-xl border border-border bg-popover p-2 text-foreground shadow-[0_14px_34px_rgb(15_23_42_/_0.13)] max-[640px]:left-0 max-[640px]:w-full"
          @mousedown.prevent
        >
          <strong class="px-[9px] pb-2 pt-1.5 text-[11px] font-semibold tracking-[0.02em] text-muted-foreground">{{ t('editor.AI.command.title') }}</strong>
          <button
            v-for="command in documentCommands"
            :key="command.label"
            class="flex min-h-9 items-center gap-[9px] rounded-[7px] px-[9px] text-left text-[13px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet-600/45 focus-visible:outline-offset-[-2px]"
            type="button"
            @click="selectDocumentCommand(command)"
          >
            <Icon :name="command.icon" />
            <span>{{ command.label }}</span>
          </button>
        </div>

        <form
          v-if="status !== 'completed'"
          :class="[
            'relative flex w-full items-center border bg-background text-foreground transition-[border-color,min-height,box-shadow] duration-200',
            aiMode === 'document'
              ? 'min-h-14 rounded-xl border-violet-600/70 shadow-[0_0_0_2px_rgb(112_91_255_/_0.07)] focus-within:border-violet-600 focus-within:shadow-[0_0_0_3px_rgb(124_58_237_/_0.12)]'
              : 'mt-2 h-11 min-h-11 rounded-lg border-violet-600/55 bg-violet-600/[.045] focus-within:border-violet-600/90 focus-within:shadow-[0_0_0_2px_rgb(124_58_237_/_0.1)]',
            aiMode === 'document' && isDocumentComposerExpanded && 'min-h-[104px] items-start',
            aiMode === 'document' && status === 'generating' && 'min-h-11 items-center',
          ]"
          @submit.prevent="handleGenerate"
        >
          <Icon
            :class="[
              'absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-600',
              aiMode === 'selection' && 'left-3',
              isDocumentComposerExpanded && 'top-[21px] translate-y-0',
            ]"
            name="Sparkles"
          />
          <div v-if="status === 'generating'" class="flex min-h-11 items-center gap-2 px-[50px] pl-[42px] text-[13px] font-medium text-violet-600" aria-live="polite">
            <span class="inline-flex gap-1" aria-hidden="true"><i class="h-[5px] w-[5px] animate-pulse rounded-full bg-current"></i><i class="h-[5px] w-[5px] animate-pulse rounded-full bg-current [animation-delay:120ms]"></i><i class="h-[5px] w-[5px] animate-pulse rounded-full bg-current [animation-delay:240ms]"></i></span>
            {{ t('editor.AI.working') }}
          </div>
          <textarea
            v-else
            ref="inputRef"
            v-model="prompt"
            :aria-label="t(aiMode === 'document' ? 'editor.AI.documentPlaceholder' : 'editor.AI.placeholder')"
            :placeholder="t(aiMode === 'document' ? 'editor.AI.documentPlaceholder' : 'editor.AI.placeholder')"
            :rows="aiMode === 'document' && isDocumentComposerExpanded ? 2 : 1"
            :class="[
              'max-h-28 w-full resize-none overflow-hidden border-0 bg-transparent text-[13px] leading-[1.55] text-inherit outline-0 placeholder:text-muted-foreground [font:inherit]',
              aiMode === 'document'
                ? isDocumentComposerExpanded
                  ? 'h-[102px] min-h-[102px] overflow-y-auto px-12 py-[17px] pb-4 text-sm leading-[22px]'
                  : 'h-[54px] min-h-[54px] px-12 py-4 pb-3.5 text-sm leading-[22px]'
                : 'box-border h-[42px] min-h-[42px] overflow-x-auto overflow-y-hidden whitespace-nowrap px-10 py-0 pr-[46px] leading-[42px] [scrollbar-width:none]',
            ]"
            @keydown.enter.exact="handlePromptKeydown"
            @keydown.ctrl.enter.prevent="handleGenerate"
            @keydown.meta.enter.prevent="handleGenerate"
          ></textarea>
          <button
            v-if="status === 'generating'"
            :aria-label="t('editor.AI.stop')"
            :class="[
              'absolute right-[11px] top-1/2 inline-flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-lg bg-violet-600 text-white transition-[background-color,opacity,transform] hover:bg-violet-700 active:translate-y-[calc(-50%+1px)]',
              aiMode === 'selection' && 'right-1 rounded-full',
              isDocumentComposerExpanded && 'bottom-3 top-auto translate-y-0 active:translate-y-px',
            ]"
            type="button"
            @click="stopGeneration"
          >
            <span class="h-[9px] w-[9px] rounded-sm bg-background" aria-hidden="true"></span>
          </button>
          <button
            v-else
            :aria-label="t('editor.AI.submit')"
            :disabled="!prompt.trim()"
            :class="[
              'absolute right-[11px] top-1/2 inline-flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-lg bg-violet-600 text-white transition-[background-color,opacity,transform] hover:bg-violet-700 active:translate-y-[calc(-50%+1px)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
              aiMode === 'selection' && 'right-1 rounded-full',
              isDocumentComposerExpanded && 'bottom-3 top-auto translate-y-0 active:translate-y-px',
            ]"
            type="submit"
          >
            <Icon name="ArrowUp" />
          </button>
        </form>

        <div
          v-show="aiMode === 'selection' && status === 'init' && shortcutMenus.length && !prompt"
          class="mt-3 max-w-56"
        >
          <Menu ref="menuRef" :items="shortcutMenus" @item-click="shortcutClick" />
        </div>

        <AiCompletion
          v-if="status === 'completed' && prompt === ''"
          :completion="result"
          :editor="editor"
          :mode="aiMode"
          :selection="activeSelection"
          @accept="handleAccept"
          @close="aiMode === 'document' ? handleReviewClose() : handleReject()"
          @generate="handleReGenerate"
          @insert="handleInsert"
          @reject="handleReject"
        />
      </div>
    </div>
  </component>
</template>

<style scoped>
@keyframes lc-ai-shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
</style>
