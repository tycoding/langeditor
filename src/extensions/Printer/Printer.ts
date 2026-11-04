import ActionButton from '@/components/actions/ActionButton.vue'
import type { GeneralOptions } from '@/type'
import { Extension } from '@tiptap/core'
export interface PrinterOptions extends GeneralOptions<PrinterOptions> {}

declare module '@tiptap/core' {
  interface Storage {
    printer: {
      active: boolean
    }
  }

  interface Commands<ReturnType> {
    printer: {
      printDocument: () => ReturnType
    }
  }
}

export const Printer = Extension.create<PrinterOptions>({
  name: 'printer',
  addStorage() {
    return { active: false }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, extension, t }) => ({
        component: ActionButton,
        componentProps: {
          tooltip: t('editor.printer.tooltip'),
          action: () => editor.commands.printDocument(),
          icon: 'Printer',
          shortcutKeys: ['mod', 'P'],
          isActive: () => Boolean(editor.storage.printer.active),
        },
      }),
    }
  },
  addCommands() {
    return {
      printDocument:
        () =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            editor.storage.printer.active = true
            tr.setMeta('printer:request', true)
          }
          return true
        },
    }
  },
})
