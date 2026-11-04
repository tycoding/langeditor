<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Editor } from '@tiptap/core'
import { useLocale } from '@/locales'
import type { ButtonViewReturn } from '@/type'
import { Icon } from '@/components/icons'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import ToolbarMenuItem, { type ToolbarMenuItemModel } from './ToolbarMenuItem.vue'

export type WordToolbarGroup = 'history' | 'font' | 'paragraph' | 'insert' | 'document' | 'tools' | 'commercial'

export interface WordToolbarMenu {
  button: ButtonViewReturn
  divider: boolean
  spacer: boolean
  group: WordToolbarGroup
  extensionName: string
  commercial: boolean
}

interface Props {
  editor: Editor
  items: WordToolbarMenu[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const { t } = useLocale()

const wordGroupOrder: WordToolbarGroup[] = ['history', 'font', 'paragraph', 'insert', 'document', 'tools', 'commercial']

const wordGroupSizing: Record<WordToolbarGroup, string> = {
  history: 'basis-[44px] flex-[0_0_44px]',
  font: 'basis-[390px] flex-[0_1_390px] @max-[1500px]:basis-[350px]',
  paragraph: 'basis-[300px] flex-[0_1_300px]',
  insert: 'basis-[128px] flex-[0_0_128px] @max-[900px]:flex-[0_1_128px] @max-[900px]:min-w-[49px]',
  document: 'basis-[92px] flex-[0_0_92px]',
  tools: 'basis-[216px] flex-[0_1_216px] min-w-[120px]',
  commercial: 'basis-auto flex-[0_1_auto] min-w-[49px] max-w-[88px]',
}

const wordGroupSpacing: Record<WordToolbarGroup, string> = {
  history: 'pl-0.5 pr-1.5',
  font: 'px-3 @max-[1500px]:px-[7px] @max-[1250px]:px-[5px]',
  paragraph: 'px-3 @max-[1500px]:px-[7px] @max-[1250px]:px-[5px]',
  insert: 'px-2 @max-[1250px]:px-1.5',
  document: 'px-2 @max-[1250px]:px-1.5',
  tools: 'px-2 @max-[1250px]:px-1.5',
  commercial: 'px-2 @max-[1250px]:px-1.5',
}

const wordGroupItemOrder: Partial<Record<WordToolbarGroup, Record<string, number>>> = {
  history: {
    clear: 0,
    painter: 1,
    history: 2,
  },
  insert: {
    link: 0,
    image: 10,
    imageUpload: 11,
    table: 20,
    video: 21,
    videoUpload: 22,
    chart: 30,
    horizontalRule: 40,
    codeBlock: 50,
  },
  document: {
    importWord: 0,
    exportWord: 1,
    printer: 2,
  },
}

const fontSelectorExtensions = new Set(['heading', 'fontSize', 'fontFamily'])

const wordGroups = computed(() =>
  wordGroupOrder
    .map(group => {
      const rank = wordGroupItemOrder[group]
      const groupItems = props.items
        .filter(item => item.group === group)
        .sort((a, b) => (rank?.[a.extensionName] ?? 99) - (rank?.[b.extensionName] ?? 99))

      return {
        name: group,
        items: groupItems,
        fontSelectors: groupItems.filter(item => fontSelectorExtensions.has(item.extensionName)),
        fontActions: groupItems.filter(item => !fontSelectorExtensions.has(item.extensionName)),
      }
    })
    .filter(group => group.items.length)
)

const wordGroupSignature = computed(() =>
  wordGroups.value.map(group => `${group.name}:${group.items.map(item => item.extensionName).join(',')}`).join('|')
)

const hasHeading = computed(() =>
  props.editor.extensionManager.extensions.some(extension => extension.name === 'heading')
)

const wordStyleMenuItems = computed(() => [
  {
    label: t.value('editor.word.style.normal'),
    icon: 'Paragraph' as const,
    action: () => props.editor.chain().focus().setParagraph().run(),
  },
  {
    label: t.value('editor.word.style.heading1'),
    icon: 'Heading1' as const,
    action: () => props.editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: t.value('editor.word.style.heading2'),
    icon: 'Heading2' as const,
    action: () => props.editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: t.value('editor.word.style.heading3'),
    icon: 'Heading3' as const,
    action: () => props.editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
])

const wordButtonGridClass = 'flex min-h-[68px] flex-wrap content-center items-center gap-x-1.5 gap-y-1'
const commercialWordButtonGridClass = 'flex min-h-[68px] flex-wrap content-start items-start gap-x-1.5 gap-y-1'
const wordGroupLauncherClass =
  'group/launcher absolute bottom-[-10px] right-0.5 z-10 inline-flex h-3 w-4 items-center justify-center rounded-sm bg-transparent text-foreground/80 transition-[background-color,color] hover:bg-accent hover:text-foreground active:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1'
const wordCollapsedGroupLauncherClass =
  'group/launcher absolute inset-0 z-10 inline-flex items-center justify-center rounded-sm bg-transparent text-foreground/80 transition-[background-color,color] hover:bg-accent hover:text-foreground active:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50'
const wordGroupCollapsePriority = [
  'commercial',
  'tools',
  'document',
  'insert',
  'styles',
  'paragraph',
  'font',
  'history',
]
const wordOverflowItems = ref<Record<string, number[]>>({})
const wordCollapsedGroupWidths = ref<Record<string, number>>({})
const wordFullyCollapsedGroups = ref<Record<string, boolean>>({})
const wordToolbarRef = ref<HTMLElement>()
const wordGroupItemRefs = new Map<string, HTMLElement>()
const wordItemWidths = new Map<string, number[]>()
let wordOverflowFrame: number | undefined
let wordResizeObserver: ResizeObserver | undefined
let wordToolbarWidth: number | undefined

function setWordGroupItemRef(name: string, element: unknown) {
  const previous = wordGroupItemRefs.get(name)
  if (previous && previous !== element) wordResizeObserver?.unobserve(previous)
  if (element instanceof HTMLElement) {
    wordGroupItemRefs.set(name, element)
    wordResizeObserver?.observe(element)
  } else {
    wordGroupItemRefs.delete(name)
  }
}

function isWordItemOverflowed(name: string, index: number) {
  return wordOverflowItems.value[name]?.includes(index) ?? false
}

function hasWordOverflow(name: string) {
  return Boolean(wordOverflowItems.value[name]?.length)
}

function isWordGroupFullyCollapsed(name: string) {
  return Boolean(wordFullyCollapsedGroups.value[name])
}

function getWordGroupLauncherClass(name: string) {
  return isWordGroupFullyCollapsed(name) ? wordCollapsedGroupLauncherClass : wordGroupLauncherClass
}

function getWordCollapsedGroupStyle(name: string) {
  const width = wordCollapsedGroupWidths.value[name]
  if (!width) return undefined
  const value = `${width}px`
  return { flexBasis: value, flexGrow: 0, flexShrink: 0, maxWidth: value }
}

function isLastWordGroup(name: WordToolbarGroup) {
  return wordGroups.value[wordGroups.value.length - 1]?.name === name
}

function getMinimumWordContentWidth(widths: number[], count: number, maxRows: number, gap: number) {
  const rowWidth = (start: number, end: number) => {
    const itemCount = end - start
    return widths.slice(start, end).reduce((total, width) => total + width, 0) + Math.max(0, itemCount - 1) * gap
  }

  if (count <= 0) return 0
  if (maxRows === 1 || count === 1) return rowWidth(0, count)

  let minimumWidth = rowWidth(0, count)
  for (let split = 1; split < count; split += 1) {
    minimumWidth = Math.min(minimumWidth, Math.max(rowWidth(0, split), rowWidth(split, count)))
  }
  return minimumWidth
}

function measureWordOverflow() {
  const next: Record<string, number[]> = {}
  const nextWidths: Record<string, number> = {}
  const nextFullyCollapsed: Record<string, boolean> = {}
  const itemCounts: Record<string, number> = {}
  const layouts: Array<{
    name: string
    widths: number[]
    maxRows: number
    gap: number
    chromeWidth: number
    visibleCount: number
  }> = []

  wordGroupItemRefs.forEach((container, name) => {
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-word-item-index]'))
    if (!items.length) return
    itemCounts[name] = items.length

    const cachedWidths = wordItemWidths.get(name) ?? []
    const widths = items.map((item, index) => {
      const measuredWidth = item.getBoundingClientRect().width
      if (measuredWidth > 0) cachedWidths[index] = measuredWidth
      return cachedWidths[index] ?? (name === 'styles' ? 68 : 32)
    })
    wordItemWidths.set(name, cachedWidths)

    const columnGap = Number.parseFloat(getComputedStyle(container).columnGap) || 0
    const availableWidth = container.clientWidth
    const groupWidth = container.parentElement?.getBoundingClientRect().width ?? availableWidth
    const chromeWidth = Math.max(0, groupWidth - availableWidth)

    if (name === 'font') {
      const rowWidths = new Map<number, number>()
      const blockedRows = new Set<number>()
      const overflowed: number[] = []

      items.forEach((item, index) => {
        const row = Number.parseInt(item.dataset.wordRow ?? '0', 10)
        const currentWidth = rowWidths.get(row) ?? 0
        const itemGap = Number.parseFloat(getComputedStyle(item.parentElement ?? container).columnGap) || 0
        const candidateWidth = currentWidth ? currentWidth + itemGap + widths[index] : widths[index]
        const preservePrimarySelector = row === 0 && index === 0 && currentWidth === 0
        if (blockedRows.has(row) || (candidateWidth > availableWidth + 0.5 && !preservePrimarySelector)) {
          blockedRows.add(row)
          overflowed.push(index)
          return
        }
        rowWidths.set(row, candidateWidth)
      })

      if (overflowed.length) next[name] = overflowed
      const visibleContentWidth = Math.max(0, ...rowWidths.values())
      if (overflowed.length === items.length) {
        nextWidths[name] = 28
        nextFullyCollapsed[name] = true
      } else {
        nextWidths[name] = Math.ceil(visibleContentWidth + chromeWidth + 1)
      }
      return
    }

    const maxRows = name === 'styles' ? 1 : 2
    const rowWidths: number[] = [0]
    const overflowed: number[] = []
    let row = 0

    widths.forEach((width, index) => {
      const candidateWidth = rowWidths[row] ? rowWidths[row] + columnGap + width : width
      if (rowWidths[row] && candidateWidth > availableWidth + 0.5) {
        row += 1
        rowWidths[row] = width
      } else {
        rowWidths[row] = candidateWidth
      }

      if (row >= maxRows) overflowed.push(index)
    })

    if (overflowed.length) {
      next[name] = overflowed
    }

    const visibleCount = overflowed[0] ?? widths.length
    const visibleContentWidth = getMinimumWordContentWidth(widths, visibleCount, maxRows, columnGap)
    nextWidths[name] = Math.ceil(visibleContentWidth + chromeWidth + 1)
    layouts.push({ name, widths, maxRows, gap: columnGap, chromeWidth, visibleCount })
  })

  const toolbarRow = wordToolbarRef.value?.firstElementChild
  if (toolbarRow instanceof HTMLElement) {
    const toolbarStyle = getComputedStyle(toolbarRow)
    const availableWidth =
      toolbarRow.clientWidth -
      (Number.parseFloat(toolbarStyle.paddingLeft) || 0) -
      (Number.parseFloat(toolbarStyle.paddingRight) || 0)
    const groupElements = Array.from(toolbarRow.querySelectorAll<HTMLElement>(':scope > [data-group]'))
    let plannedWidth = groupElements.reduce((total, group) => {
      const name = group.dataset.group ?? ''
      return total + (nextWidths[name] ?? group.getBoundingClientRect().width)
    }, 0)
    let remainingWidth = Math.max(0, availableWidth - plannedWidth)

    while (remainingWidth > 0.5) {
      const candidates = layouts
        .filter(layout => layout.visibleCount < layout.widths.length)
        .map(layout => {
          const contentWidth = getMinimumWordContentWidth(
            layout.widths,
            layout.visibleCount + 1,
            layout.maxRows,
            layout.gap
          )
          const width = Math.ceil(contentWidth + layout.chromeWidth + 1)
          return { layout, width, delta: Math.max(0, width - nextWidths[layout.name]) }
        })
        .sort((a, b) => a.delta - b.delta)
      const candidate = candidates[0]
      if (!candidate || candidate.delta > remainingWidth + 0.5) break

      candidate.layout.visibleCount += 1
      nextWidths[candidate.layout.name] = candidate.width
      remainingWidth -= candidate.delta
      if (candidate.layout.visibleCount >= candidate.layout.widths.length) {
        delete next[candidate.layout.name]
      } else {
        next[candidate.layout.name] = candidate.layout.widths
          .map((_, index) => index)
          .slice(candidate.layout.visibleCount)
      }
    }

    plannedWidth = groupElements.reduce((total, group) => {
      const name = group.dataset.group ?? ''
      return total + (nextWidths[name] ?? group.getBoundingClientRect().width)
    }, 0)

    for (const name of wordGroupCollapsePriority) {
      if (plannedWidth <= availableWidth + 0.5) break
      const group = groupElements.find(element => element.dataset.group === name)
      const itemCount = itemCounts[name]
      if (!group || !itemCount) continue

      const currentWidth = nextWidths[name] ?? group.getBoundingClientRect().width
      const collapsedWidth = 28
      if (currentWidth <= collapsedWidth) continue

      next[name] = Array.from({ length: itemCount }, (_, index) => index)
      nextWidths[name] = collapsedWidth
      nextFullyCollapsed[name] = true
      plannedWidth -= currentWidth - collapsedWidth
    }
  }

  if (JSON.stringify(wordOverflowItems.value) !== JSON.stringify(next)) {
    wordOverflowItems.value = next
  }
  if (JSON.stringify(wordCollapsedGroupWidths.value) !== JSON.stringify(nextWidths)) {
    wordCollapsedGroupWidths.value = nextWidths
  }
  if (JSON.stringify(wordFullyCollapsedGroups.value) !== JSON.stringify(nextFullyCollapsed)) {
    wordFullyCollapsedGroups.value = nextFullyCollapsed
  }
}

function scheduleWordOverflowMeasure() {
  if (wordOverflowFrame !== undefined) cancelAnimationFrame(wordOverflowFrame)
  wordOverflowFrame = requestAnimationFrame(() => {
    wordOverflowFrame = undefined
    measureWordOverflow()
  })
}

function getWordGroupItems(group: (typeof wordGroups.value)[number]) {
  return group.name === 'font' ? [...group.fontSelectors, ...group.fontActions] : group.items
}

onMounted(() => {
  void nextTick(() => {
    scheduleWordOverflowMeasure()
    wordResizeObserver = new ResizeObserver(entries => {
      const toolbarEntry = entries.find(entry => entry.target === wordToolbarRef.value)
      if (toolbarEntry) {
        const width = toolbarEntry.contentRect.width
        if (wordToolbarWidth !== undefined && Math.abs(wordToolbarWidth - width) > 0.5) {
          wordOverflowItems.value = {}
          wordCollapsedGroupWidths.value = {}
          wordFullyCollapsedGroups.value = {}
        }
        wordToolbarWidth = width
      }
      scheduleWordOverflowMeasure()
    })
    if (wordToolbarRef.value) wordResizeObserver.observe(wordToolbarRef.value)
    wordGroupItemRefs.forEach(container => wordResizeObserver?.observe(container))
  })
  window.addEventListener('resize', scheduleWordOverflowMeasure)
})

watch(wordGroupSignature, () => {
  wordItemWidths.clear()
  wordOverflowItems.value = {}
  wordCollapsedGroupWidths.value = {}
  wordFullyCollapsedGroups.value = {}
  void nextTick(scheduleWordOverflowMeasure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleWordOverflowMeasure)
  wordResizeObserver?.disconnect()
  if (wordOverflowFrame !== undefined) cancelAnimationFrame(wordOverflowFrame)
})
</script>

<template>
  <div ref="wordToolbarRef" data-word-toolbar class="relative min-w-0 overflow-visible">
    <div
      class="flex min-h-[82px] w-full min-w-0 flex-nowrap items-stretch gap-0 overflow-visible px-2 pb-3 pt-[5px] @max-[1500px]:px-1.5"
    >
      <template v-for="group in wordGroups" :key="group.name">
        <div
          :data-group="group.name"
          :style="getWordCollapsedGroupStyle(group.name)"
          :class="[
            'relative flex min-h-[72px] h-auto min-w-0 max-w-full flex-col justify-between gap-1 py-0.5',
            !isLastWordGroup(group.name) && 'border-r border-border',
            wordGroupSizing[group.name],
            wordGroupSpacing[group.name],
            isLastWordGroup(group.name) && group.name !== 'commercial' && 'grow',
            group.name === 'commercial' ? 'text-[#a86f12]' : '',
          ]"
        >
          <div
            v-if="group.name === 'font'"
            :ref="element => setWordGroupItemRef('font', element)"
            class="flex min-h-[62px] min-w-0 flex-col justify-center gap-1"
          >
            <div
              class="flex h-8 min-w-0 max-w-full flex-nowrap items-center gap-x-2.5 overflow-hidden @max-[1500px]:gap-x-1.5 @max-[1250px]:gap-x-1"
            >
              <div
                v-for="(item, key) in group.fontSelectors"
                :key="key"
                :data-word-item-index="key"
                data-word-row="0"
                :class="isWordItemOverflowed('font', key) && 'hidden'"
                class="flex shrink-0 items-center"
              >
                <component
                  :is="item.button.component"
                  v-bind="item.button.componentProps"
                  :editor="editor"
                  :disabled="disabled || item.button.componentProps?.disabled"
                >
                  <template
                    v-for="(element, slotName, i) in item.button.componentSlots"
                    :key="i"
                    #[`${slotName}`]="values"
                  >
                    <component :is="element" v-bind="values?.props" />
                  </template>
                </component>
              </div>
            </div>
            <div
              class="flex h-8 min-w-0 max-w-full flex-nowrap items-center gap-x-2.5 overflow-hidden @max-[1500px]:gap-x-1.5 @max-[1250px]:gap-x-1"
            >
              <div
                v-for="(item, key) in group.fontActions"
                :key="key"
                :data-word-item-index="group.fontSelectors.length + key"
                data-word-row="1"
                :class="isWordItemOverflowed('font', group.fontSelectors.length + key) && 'hidden'"
                class="flex shrink-0 items-center"
              >
                <component
                  :is="item.button.component"
                  v-bind="item.button.componentProps"
                  :editor="editor"
                  :disabled="disabled || item.button.componentProps?.disabled"
                >
                  <template
                    v-for="(element, slotName, i) in item.button.componentSlots"
                    :key="i"
                    #[`${slotName}`]="values"
                  >
                    <component :is="element" v-bind="values?.props" />
                  </template>
                </component>
              </div>
            </div>
          </div>
          <div
            v-else
            :ref="element => setWordGroupItemRef(group.name, element)"
            :class="group.name === 'commercial' ? commercialWordButtonGridClass : wordButtonGridClass"
          >
            <div
              v-for="(item, key) in group.items"
              :key="key"
              :data-extension="item.extensionName"
              :data-word-item-index="key"
              :class="[
                item.commercial
                  ? 'text-[#a86f12] [&_button]:!text-[#a86f12] [&_svg]:!text-[#a86f12] [&_button[aria-pressed=true]]:!bg-[#a86f12]/15 [&_button[aria-pressed=true]]:!text-[#8a590d] [&_button[aria-pressed=true]_svg]:!text-[#8a590d]'
                  : '',
                isWordItemOverflowed(group.name, key) && 'hidden',
              ]"
              class="flex min-w-0 shrink-0 items-center justify-center"
            >
              <component
                :is="item.button.component"
                v-bind="item.button.componentProps"
                :editor="editor"
                :disabled="disabled || item.button.componentProps?.disabled"
                :mode="item.extensionName === 'AI' ? 'auto' : undefined"
              >
                <template
                  v-for="(element, slotName, i) in item.button.componentSlots"
                  :key="i"
                  #[`${slotName}`]="values"
                >
                  <component :is="element" v-bind="values?.props" />
                </template>
              </component>
            </div>
          </div>
          <Popover v-if="hasWordOverflow(group.name)">
            <PopoverTrigger as-child>
              <button
                type="button"
                :class="getWordGroupLauncherClass(group.name)"
                :aria-describedby="`word-group-launcher-label-${group.name}`"
                :aria-label="t(`editor.word.group.${group.name}`)"
              >
                <Icon name="GroupLauncher" :class="isWordGroupFullyCollapsed(group.name) ? 'size-4' : 'size-3'" />
                <span
                  :id="`word-group-launcher-label-${group.name}`"
                  role="tooltip"
                  class="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 w-max max-w-36 rounded border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/launcher:opacity-100 group-focus-visible/launcher:opacity-100"
                >
                  {{ t(`editor.word.group.${group.name}`) }}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              :side-offset="6"
              class="max-h-[min(420px,70vh)] w-max max-w-[min(360px,calc(100vw-24px))] overflow-y-auto p-2"
            >
              <div class="mb-2 border-b border-border/60 px-1 pb-2 text-xs font-semibold text-foreground">
                {{ t(`editor.word.group.${group.name}`) }}
              </div>
              <div class="flex flex-wrap items-start gap-1">
                <ToolbarMenuItem
                  v-for="(item, key) in getWordGroupItems(group)"
                  :key="key"
                  :editor="editor"
                  :item="item as ToolbarMenuItemModel"
                  :disabled="disabled"
                  :mode="item.extensionName === 'AI' ? 'auto' : undefined"
                  compact
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div
          v-if="group.name === 'paragraph' && hasHeading"
          data-group="styles"
          :style="getWordCollapsedGroupStyle('styles')"
          class="relative flex min-h-[72px] min-w-0 max-w-full flex-[0_1_330px] flex-col justify-center gap-1 border-r border-border px-3 py-0.5 @max-[1500px]:basis-[258px] @max-[1500px]:px-[7px] @max-[1250px]:basis-[230px] @max-[1250px]:px-[5px]"
        >
          <div
            :ref="element => setWordGroupItemRef('styles', element)"
            class="flex min-h-[70px] min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden"
          >
            <button
              data-word-item-index="0"
              :class="[
                editor.isActive('paragraph') ? 'border-primary/45 bg-primary/10' : '',
                isWordItemOverflowed('styles', 0) && 'hidden',
              ]"
              class="flex h-[62px] w-[68px] flex-none flex-col items-start justify-center gap-[3px] rounded-[5px] border border-border bg-background px-2 py-[5px] text-left text-[9px] leading-none text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
              :disabled="disabled"
              type="button"
              @click="editor.chain().focus().setParagraph().run()"
            >
              <span class="max-w-full overflow-hidden truncate whitespace-nowrap font-serif text-sm">AaBb</span>
              <span>{{ t('editor.word.style.normal') }}</span>
            </button>
            <button
              data-word-item-index="1"
              :class="[
                editor.isActive('heading', { level: 1 }) ? 'border-primary/45 bg-primary/10' : '',
                isWordItemOverflowed('styles', 1) && 'hidden',
              ]"
              class="flex h-[62px] w-[68px] flex-none flex-col items-start justify-center gap-[3px] rounded-[5px] border border-border bg-background px-2 py-[5px] text-left text-[9px] leading-none text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
              :disabled="disabled"
              type="button"
              @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
            >
              <span class="max-w-full overflow-hidden truncate whitespace-nowrap font-serif text-[19px] font-bold"
                >Aa</span
              >
              <span>{{ t('editor.word.style.heading1') }}</span>
            </button>
            <button
              data-word-item-index="2"
              :class="[
                editor.isActive('heading', { level: 2 }) ? 'border-primary/45 bg-primary/10' : '',
                isWordItemOverflowed('styles', 2) && 'hidden',
              ]"
              class="flex h-[62px] w-[68px] flex-none flex-col items-start justify-center gap-[3px] rounded-[5px] border border-border bg-background px-2 py-[5px] text-left text-[9px] leading-none text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
              :disabled="disabled"
              type="button"
              @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
            >
              <span class="max-w-full overflow-hidden truncate whitespace-nowrap font-serif text-base font-bold"
                >Aa</span
              >
              <span>{{ t('editor.word.style.heading2') }}</span>
            </button>
            <button
              data-word-item-index="3"
              :class="[
                editor.isActive('heading', { level: 3 }) ? 'border-primary/45 bg-primary/10' : '',
                isWordItemOverflowed('styles', 3) && 'hidden',
              ]"
              class="flex h-[62px] w-[68px] flex-none flex-col items-start justify-center gap-[3px] rounded-[5px] border border-border bg-background px-2 py-[5px] text-left text-[9px] leading-none text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
              :disabled="disabled"
              type="button"
              @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
            >
              <span class="max-w-full overflow-hidden truncate whitespace-nowrap font-serif text-sm font-semibold"
                >Aa</span
              >
              <span>{{ t('editor.word.style.heading3') }}</span>
            </button>
          </div>
          <Popover v-if="hasWordOverflow('styles')">
            <PopoverTrigger as-child>
              <button
                type="button"
                :class="getWordGroupLauncherClass('styles')"
                aria-describedby="word-group-launcher-label-styles"
                :aria-label="t('editor.word.group.styles')"
              >
                <Icon name="GroupLauncher" :class="isWordGroupFullyCollapsed('styles') ? 'size-4' : 'size-3'" />
                <span
                  id="word-group-launcher-label-styles"
                  role="tooltip"
                  class="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 w-max max-w-36 rounded border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/launcher:opacity-100 group-focus-visible/launcher:opacity-100"
                >
                  {{ t('editor.word.group.styles') }}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              :side-offset="6"
              class="w-max max-w-[min(360px,calc(100vw-24px))] p-2"
            >
              <div class="mb-2 border-b border-border/60 px-1 pb-2 text-xs font-semibold text-foreground">
                {{ t('editor.word.group.styles') }}
              </div>
              <div class="flex flex-wrap items-start gap-1">
                <button
                  v-for="style in wordStyleMenuItems"
                  :key="style.label"
                  class="inline-flex w-auto min-w-fit shrink-0 items-center gap-1.5 rounded-md border border-border/50 px-2 py-2 text-left text-xs hover:bg-accent"
                  type="button"
                  @click="style.action()"
                >
                  <Icon :name="style.icon" class="size-3.5 shrink-0 text-muted-foreground" />
                  {{ style.label }}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </template>
    </div>
  </div>
</template>
