import { Extension } from '@tiptap/core'
import ActionButton from '@/components/actions/ActionButton.vue'
import type { GeneralOptions } from '@/type'

declare module '@tiptap/core' {
  interface Storage {
    sourceCode: {
      open: boolean
    }
  }

  interface Commands<ReturnType> {
    sourceCode: {
      toggleSourceCode: () => ReturnType
      insertSourceCode: (char: string) => ReturnType
    }
  }
}
export interface SourceCodeOptions extends GeneralOptions<SourceCodeOptions> {}

export const SourceCode = Extension.create<SourceCodeOptions>({
  name: 'sourceCode',
  addStorage() {
    return { open: false }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          icon: 'CodeXml',
          action: () => editor.commands.toggleSourceCode(),
          tooltip: t('editor.sourceCode.tooltip'),
          isActive: () => Boolean(editor.storage.sourceCode.open),
        },
      }),
    }
  },
  addCommands() {
    return {
      toggleSourceCode:
        () =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            const open = !editor.storage.sourceCode.open
            editor.storage.sourceCode.open = open
            tr.setMeta('sourceCode:open', open)
          }
          return true
        },
    }
  },
})
