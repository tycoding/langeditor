import { computed, ref } from 'vue'
import type { Editor as CoreEditor } from '@tiptap/core'

export interface TocItem {
  level: number
  text: string
  id: string
  pos: number
  children: TocItem[]
}

export interface UseTocOptions {
  maxLevel?: number
}

/**
 * Hook to extract table of contents from editor content
 * Monitors heading nodes in the editor and provides a structured TOC
 */
export function useToc(editor: CoreEditor | null, options: UseTocOptions = {}) {
  const { maxLevel = 3 } = options
  const items = ref<TocItem[]>([])
  const activeId = ref<string>('')

  const extractHeadings = () => {
    if (!editor) return []
    const headings: TocItem[] = []
    const stack: TocItem[] = []

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level
        if (level <= maxLevel) {
          const id = `heading-${pos}`
          const text = node.textContent || `Heading ${level}`
          const item: TocItem = { level, text, id, pos, children: [] }

          while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
          if (stack.length) stack[stack.length - 1].children.push(item)
          else headings.push(item)
          stack.push(item)
        }
      }
    })

    return headings
  }

  const updateToc = () => {
    items.value = extractHeadings()
  }

  const scrollToHeading = (id: string) => {
    if (!editor) return
    const flatten = (entries: TocItem[]): TocItem[] => entries.flatMap(item => [item, ...flatten(item.children)])
    const item = flatten(items.value).find(entry => entry.id === id)
    const element = item ? editor.view.nodeDOM(item.pos) : null
    if (element instanceof HTMLElement) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sortedItems = computed(() => {
    return items.value
  })

  return {
    items,
    sortedItems,
    activeId,
    extractHeadings,
    updateToc,
    scrollToHeading,
  }
}
