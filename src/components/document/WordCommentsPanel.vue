<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Editor } from '@tiptap/core'
import type { WordComment } from '@/type'
import { Icon } from '@/components/icons'
import { useLocale } from '@/locales'

const props = defineProps<{
  editor: Editor
  comments: WordComment[]
  pendingQuote?: string
  pendingFrom?: number
  containerRef: HTMLElement | null
}>()

const emit = defineEmits<{
  add: [content: string]
  cancel: []
  remove: [id: string]
  select: [comment: WordComment]
}>()

const { t } = useLocale()
const content = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const layoutVersion = ref(0)
let resizeObserver: ResizeObserver | null = null

watch(
  () => props.pendingQuote,
  quote => {
    if (!quote) return
    content.value = ''
    void nextTick(() => {
      inputRef.value?.focus()
      updateLayout()
    })
  }
)

function updateLayout() {
  layoutVersion.value += 1
}

function bindHost() {
  const host = props.containerRef
  if (!host) return
  host.addEventListener('scroll', updateLayout, { passive: true })
  window.addEventListener('resize', updateLayout)
  resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateLayout) : null
  resizeObserver?.observe(host)
}

function unbindHost() {
  const host = props.containerRef
  host?.removeEventListener('scroll', updateLayout)
  window.removeEventListener('resize', updateLayout)
  resizeObserver?.disconnect()
  resizeObserver = null
}

onMounted(bindHost)
onBeforeUnmount(unbindHost)

watch(
  () => props.containerRef,
  () => {
    unbindHost()
    bindHost()
  }
)

function getAnchor(from: number) {
  // coordsAtPos is viewport-relative; translate it into the scrolling host's content space.
  const host = props.containerRef
  if (!host) return { top: 16, left: 16 }
  const hostRect = host.getBoundingClientRect()
  const coords = props.editor.view.coordsAtPos(Math.max(1, from))
  const width = 286
  const preferredLeft = coords.right - hostRect.left + host.scrollLeft + 14
  const left = Math.max(12, Math.min(preferredLeft, host.clientWidth - width - 12))
  const top = Math.max(12, coords.top - hostRect.top + host.scrollTop - 4)
  return { top, left }
}

const cardStyles = computed(() => {
  void layoutVersion.value
  const cards = props.comments
    .map(comment => ({ id: comment.id, ...getAnchor(comment.from) }))
    .sort((a, b) => a.top - b.top)
  const occupied: { top: number; bottom: number }[] = []
  const result: Record<string, { top: string; left: string }> = {}
  cards.forEach(card => {
    let top = card.top
    const previous = occupied[occupied.length - 1]
    if (previous && top < previous.bottom + 8) top = previous.bottom + 8
    occupied.push({ top, bottom: top + 150 })
    result[card.id] = { top: `${top}px`, left: `${card.left}px` }
  })
  return result
})

const pendingStyle = computed(() => {
  void layoutVersion.value
  return getAnchor(props.pendingFrom ?? props.editor.state.selection.from)
})

function submit() {
  const value = content.value.trim()
  if (!value) return
  emit('add', value)
  content.value = ''
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-[26] overflow-visible"
    :aria-label="t('editor.word.comments.title')"
  >
    <section
      v-if="pendingQuote"
      class="pointer-events-auto absolute grid w-[286px] max-w-[calc(100%_-_24px)] gap-[9px] rounded-md border border-foreground/10 bg-background p-[11px] text-left text-foreground shadow-[0_8px_22px_rgb(15_23_42_/_0.12)]"
      :style="{ top: `${pendingStyle.top}px`, left: `${pendingStyle.left}px` }"
    >
      <header class="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <strong class="text-[11px] font-semibold text-foreground">{{ t('editor.word.comments.title') }}</strong>
        <span class="truncate">{{ t('editor.word.comments.add') }}</span>
      </header>
      <blockquote class="m-0 truncate border-l-2 border-foreground/20 pl-2 text-[9px] leading-[1.45] text-muted-foreground">
        {{ pendingQuote }}
      </blockquote>
      <textarea
        ref="inputRef"
        v-model="content"
        :placeholder="t('editor.word.comments.placeholder')"
        class="min-h-[72px] w-full resize-y rounded-[5px] border border-border bg-muted/35 px-[9px] py-2 text-[10px] leading-[1.5] text-foreground outline-2 outline-transparent focus:border-ring/50 focus:outline-ring/15"
        rows="3"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      ></textarea>
      <div class="flex items-center justify-end gap-2">
        <button class="h-7 rounded bg-accent px-2.5 text-[9px]" type="button" @click="emit('cancel')">
          {{ t('editor.word.comments.cancel') }}
        </button>
        <button
          :disabled="!content.trim()"
          class="h-7 rounded bg-primary px-2.5 text-[9px] text-primary-foreground disabled:opacity-40"
          type="button"
          @click="submit"
        >
          {{ t('editor.word.comments.save') }}
        </button>
      </div>
    </section>

    <button
      v-for="comment in comments"
      :key="comment.id"
      class="pointer-events-auto absolute grid w-[286px] max-w-[calc(100%_-_24px)] cursor-pointer gap-[9px] rounded-md border border-foreground/10 bg-background p-[11px] text-left text-foreground shadow-[0_8px_22px_rgb(15_23_42_/_0.12)] transition-colors hover:border-foreground/20 hover:bg-background/80"
      :style="cardStyles[comment.id]"
      type="button"
      @click="emit('select', comment)"
    >
      <header class="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <strong class="text-[11px] font-semibold text-foreground">{{ t('editor.word.comments.title') }}</strong>
        <span class="truncate">{{ comment.createdAt }}</span>
      </header>
      <blockquote class="m-0 truncate border-l-2 border-foreground/20 pl-2 text-[9px] leading-[1.45] text-muted-foreground">
        {{ comment.quote }}
      </blockquote>
      <p class="m-0 text-[11px] leading-[1.55]">{{ comment.content }}</p>
      <footer class="flex items-center justify-between gap-2">
        <span class="ml-[-29px] h-px w-[18px] bg-ring/55" aria-hidden="true"></span>
        <span
          :aria-label="t('editor.word.comments.remove')"
          class="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          role="button"
          tabindex="0"
          @click.stop="emit('remove', comment.id)"
          @keydown.enter.stop="emit('remove', comment.id)"
        >
          <Icon class="h-[13px] w-[13px]" name="Trash2" />
        </span>
      </footer>
    </button>
  </div>
</template>
