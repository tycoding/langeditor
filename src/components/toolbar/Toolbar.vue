<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { Editor } from '@tiptap/core'
import { useLocale } from '@/locales'
import type { ButtonViewReturn } from '@/type'
import { Separator } from '@/components/ui/separator'
import { Icon } from '@/components/icons'
import { getEditorPluginExtensionMeta } from '@/plugins'
import { isFunction } from '@/utils/utils'
import ToolbarMenuItem from './ToolbarMenuItem.vue'
import WordToolbar, { type WordToolbarGroup, type WordToolbarMenu } from './WordToolbar.vue'

type Menu = WordToolbarMenu

interface Props {
  editor: Editor
  disabled?: boolean
  variant?: 'default' | 'compact' | 'word'
}

const { t } = useLocale()
const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  variant: 'default',
})

const wordGroupMap: Record<string, WordToolbarGroup> = {
  history: 'history',
  painter: 'history',
  clear: 'history',
  heading: 'font',
  fontSize: 'font',
  fontFamily: 'font',
  bold: 'font',
  italic: 'font',
  underline: 'font',
  strike: 'font',
  moreMark: 'font',
  color: 'font',
  highlight: 'font',
  bulletList: 'paragraph',
  orderedList: 'paragraph',
  taskList: 'paragraph',
  textAlign: 'paragraph',
  indent: 'paragraph',
  lineHeight: 'paragraph',
  blockquote: 'paragraph',
  link: 'insert',
  image: 'insert',
  imageUpload: 'insert',
  table: 'insert',
  video: 'insert',
  videoUpload: 'insert',
  chart: 'insert',
  horizontalRule: 'insert',
  codeBlock: 'insert',
  importWord: 'document',
  exportWord: 'document',
  printer: 'document',
  toc: 'tools',
}

const getWordGroup = (extensionName: string): WordToolbarGroup => wordGroupMap[extensionName] ?? 'tools'

const items = computed<Menu[]>(() => {
  const extensions = [...props.editor.extensionManager.extensions].sort((a, b) => {
    const aSort = a.options.sort ?? -1
    const bSort = b.options.sort ?? -1
    return aSort - bSort
  })

  const menus: Menu[] = []
  for (const extension of extensions) {
    const { button, divider = false, spacer = false, toolbar = true } = extension.options
    if (!button || !isFunction(button) || !toolbar) continue

    const commercial = Boolean(getEditorPluginExtensionMeta(extension)?.commercial)
    const group: WordToolbarGroup = commercial ? 'commercial' : getWordGroup(extension.name)
    const resolvedButton: ButtonViewReturn = button({
      editor: props.editor,
      extension,
      t: unref(t),
    })

    if (Array.isArray(resolvedButton)) {
      resolvedButton.forEach((buttonItem, index) => {
        menus.push({
          button: buttonItem,
          divider: index === resolvedButton.length - 1 ? divider : false,
          spacer: index === 0 ? spacer : false,
          group,
          extensionName: extension.name,
          commercial,
        })
      })
      continue
    }

    menus.push({
      button: resolvedButton,
      divider,
      spacer,
      group,
      extensionName: extension.name,
      commercial,
    })
  }
  return menus
})

const toolbarRoot = ref<HTMLElement | null>(null)
const isNarrowDefaultToolbar = ref(false)
const defaultToolbarExpanded = ref(false)
let toolbarRootResizeObserver: ResizeObserver | undefined

function updateDefaultToolbarWidth() {
  const wasNarrow = isNarrowDefaultToolbar.value
  const isNarrow = props.variant === 'default' && (toolbarRoot.value?.clientWidth ?? Infinity) < 640

  isNarrowDefaultToolbar.value = isNarrow
  if ((isNarrow && !wasNarrow) || !isNarrow) defaultToolbarExpanded.value = false
}

function setupDefaultToolbarResizeObserver() {
  toolbarRootResizeObserver?.disconnect()
  toolbarRootResizeObserver = undefined
  if (props.variant !== 'default') return

  void nextTick(() => {
    const root = toolbarRoot.value
    if (!root) return

    toolbarRootResizeObserver = new ResizeObserver(updateDefaultToolbarWidth)
    toolbarRootResizeObserver.observe(root)
    updateDefaultToolbarWidth()
  })
}

onMounted(() => {
  setupDefaultToolbarResizeObserver()
})

watch(() => props.variant, setupDefaultToolbarResizeObserver)

onBeforeUnmount(() => {
  toolbarRootResizeObserver?.disconnect()
})
</script>

<template>
  <div
    v-if="items.length"
    ref="toolbarRoot"
    data-editor-toolbar
    :class="[
      variant === 'compact' && 'rounded-t-[0.5rem]',
      isNarrowDefaultToolbar && 'is-narrow',
      defaultToolbarExpanded && 'is-expanded',
    ]"
    class="lc-editor-toolbar group sticky top-0 z-10 h-auto min-w-0 overflow-visible rounded-t-[0.5rem] bg-background [container-type:inline-size]"
  >
    <WordToolbar v-if="variant === 'word'" :editor="editor" :items="items" :disabled="disabled" />
    <div
      v-else
      :class="[
        'flex flex-nowrap items-center gap-x-1 gap-y-1 overflow-x-auto py-0.5 sm:flex-wrap [scrollbar-width:none] transition-[max-height] duration-200',
        variant === 'compact' && 'sm:flex-nowrap',
        variant === 'default' && '@max-[639px]:max-h-[37px] @max-[639px]:flex-wrap @max-[639px]:overflow-hidden @max-[639px]:pr-10',
        variant === 'default' && defaultToolbarExpanded && '@max-[639px]:max-h-[min(320px,48vh)] @max-[639px]:overflow-x-hidden @max-[639px]:overflow-y-auto @max-[639px]:pb-1',
      ]"
    >
      <template v-for="(item, key) in items" :key="key">
        <div class="flex items-center">
          <Separator v-if="item.spacer && variant !== 'compact'" orientation="vertical" class="mx-[10px] h-[16px]" />
        </div>
        <ToolbarMenuItem
          :item="item"
          :editor="editor"
          :disabled="disabled"
          :mode="item.extensionName === 'AI' ? 'auto' : undefined"
        />
        <Separator v-if="item.divider && variant !== 'compact'" orientation="vertical" class="mx-2 h-auto" />
      </template>
    </div>
    <button
      v-if="variant === 'default' && isNarrowDefaultToolbar"
      :aria-expanded="defaultToolbarExpanded"
      :aria-label="t(defaultToolbarExpanded ? 'editor.toolbar.collapse' : 'editor.toolbar.expand')"
      :title="t(defaultToolbarExpanded ? 'editor.toolbar.collapse' : 'editor.toolbar.expand')"
      class="absolute right-1 top-[3px] z-[12] inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-[color,background-color,transform] hover:bg-accent hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-ring/55 focus-visible:outline-offset-[-2px] [&_svg]:h-[15px] [&_svg]:w-[15px]"
      type="button"
      @click="defaultToolbarExpanded = !defaultToolbarExpanded"
    >
      <Icon :name="defaultToolbarExpanded ? 'ChevronUp' : 'ChevronDown'" />
    </button>
  </div>
</template>
