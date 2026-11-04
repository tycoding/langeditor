import { Extension } from '@tiptap/core'
import type { GeneralOptions } from '@/type'
import ActionButton from '@/components/actions/ActionButton.vue'

export interface TocOptions extends Partial<GeneralOptions<TocOptions>> {
  defaultOpen?: boolean
  maxLevel?: number
  position?: 'left' | 'right'
  title?: string
  width?: number
}

declare module '@tiptap/core' {
  interface Storage {
    toc: {
      open: boolean
    }
  }

  interface Commands<ReturnType> {
    toc: {
      setTocOpen: (open: boolean) => ReturnType
      toggleToc: () => ReturnType
    }
  }
}

export const Toc = Extension.create<TocOptions>({
  name: 'toc',
  addStorage() {
    return { open: false }
  },
  addOptions() {
    return {
      defaultOpen: false,
      maxLevel: 3,
      position: 'left',
      title: undefined,
      width: 228,
      toolbar: true,
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          tooltip: t('editor.toc.title'),
          action: () => editor.commands.setTocOpen(!editor.storage.toc.open),
          icon: 'ListTree',
          isActive: () => Boolean(editor.storage.toc.open),
        },
      }),
    }
  },
  addCommands() {
    return {
      setTocOpen:
        open =>
        ({ editor, tr, dispatch }) => {
          if (!dispatch || editor.storage.toc.open === open) return true

          editor.storage.toc.open = open
          tr.setMeta('toc:open', open)
          return true
        },
      toggleToc:
        () =>
        ({ editor, commands }) =>
          commands.setTocOpen(!editor.storage.toc.open),
    }
  },
})
