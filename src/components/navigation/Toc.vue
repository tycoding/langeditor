<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Editor as CoreEditor } from '@tiptap/core'
import { useLocale } from '@/locales'
import type { TocItem } from '@/hooks/useToc'
import TocTree from './TocTree.vue'

interface Props {
  editor: CoreEditor | null
  maxLevel?: number
  title?: string
  collapsible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxLevel: 3,
  title: undefined,
  collapsible: true,
})

const emit = defineEmits<{ collapse: [] }>()
const { t } = useLocale()
const headings = ref<TocItem[]>([])
const activeId = ref('')
let scrollContainer: HTMLElement | null = null

const flatHeadings = computed(() => {
  const flatten = (items: TocItem[]): TocItem[] => items.flatMap(item => [item, ...flatten(item.children)])
  return flatten(headings.value)
})

const extractHeadings = () => {
  if (!props.editor) return []

  const roots: TocItem[] = []
  const stack: TocItem[] = []

  props.editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading' || node.attrs.level > props.maxLevel) return

    const item: TocItem = {
      id: `heading-${pos}`,
      level: node.attrs.level,
      text: node.textContent || `${t.value('editor.heading.tooltip')} ${node.attrs.level}`,
      pos,
      children: [],
    }

    while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(item)
    else roots.push(item)
    stack.push(item)
  })

  return roots
}

const updateHeadings = () => {
  headings.value = extractHeadings()
  nextTick(updateActiveHeading)
}

const getScrollContainer = () => {
  if (!props.editor) return null
  return props.editor.view.dom.closest<HTMLElement>('[data-word-document-host]') ?? props.editor.view.dom.parentElement
}

const updateActiveHeading = () => {
  if (!props.editor || !flatHeadings.value.length) {
    activeId.value = ''
    return
  }

  const boundary = (scrollContainer?.getBoundingClientRect().top ?? 0) + 72
  let active = flatHeadings.value[0]

  for (const item of flatHeadings.value) {
    const element = props.editor.view.nodeDOM(item.pos)
    if (!(element instanceof HTMLElement)) continue
    if (element.getBoundingClientRect().top <= boundary) active = item
    else break
  }

  activeId.value = active.id
}

const scrollToHeading = (item: TocItem) => {
  if (!props.editor) return
  const element = props.editor.view.nodeDOM(item.pos)
  if (!(element instanceof HTMLElement)) return

  activeId.value = item.id
  if (scrollContainer) {
    const containerTop = scrollContainer.getBoundingClientRect().top
    const targetTop = element.getBoundingClientRect().top - containerTop + scrollContainer.scrollTop - 24
    scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
  } else {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  props.editor.commands.focus(item.pos + 1)
}

onMounted(() => {
  updateHeadings()
  props.editor?.on('update', updateHeadings)
  props.editor?.on('selectionUpdate', updateActiveHeading)
  nextTick(() => {
    scrollContainer = getScrollContainer()
    scrollContainer?.addEventListener('scroll', updateActiveHeading, { passive: true })
    updateActiveHeading()
  })
})

watch(() => props.maxLevel, updateHeadings)

onUnmounted(() => {
  props.editor?.off('update', updateHeadings)
  props.editor?.off('selectionUpdate', updateActiveHeading)
  scrollContainer?.removeEventListener('scroll', updateActiveHeading)
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background text-foreground">
    <header class="flex min-h-[42px] flex-none items-center justify-between gap-2 border-b border-border px-2 py-[7px] pl-3">
      <div class="flex min-w-0 items-center gap-[7px]">
        <strong class="truncate text-xs font-semibold">{{ title || t('editor.toc.title') }}</strong>
        <span class="min-w-5 rounded-full bg-muted px-1.5 py-0.5 text-center text-[9px] text-muted-foreground">{{ flatHeadings.length }}</span>
      </div>
      <button
        v-if="collapsible"
        :aria-label="t('editor.toc.hide')"
        class="h-[26px] w-[26px] rounded-md text-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="emit('collapse')"
      >
        ‹
      </button>
    </header>

    <nav
      v-if="headings.length"
      class="min-h-0 flex-1 overflow-auto px-1.5 pb-3 pt-[7px] [scrollbar-width:thin]"
      :aria-label="title || t('editor.toc.title')"
    >
      <TocTree :active-id="activeId" :items="headings" @select="scrollToHeading" />
    </nav>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 p-5 text-center text-[11px] text-muted-foreground">
      <span class="text-2xl" aria-hidden="true">≡</span>
      <p class="m-0">{{ t('editor.toc.empty') }}</p>
    </div>
  </div>
</template>
