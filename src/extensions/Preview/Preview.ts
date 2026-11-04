import { Extension } from '@tiptap/core'
import ActionButton from '@/components/actions/ActionButton.vue'
import type { GeneralOptions } from '@/type'

declare module '@tiptap/core' {
  interface Storage {
    preview: {
      active: boolean
      wasEditable: boolean
    }
  }

  interface Commands<ReturnType> {
    preview: {
      togglePreview: () => ReturnType
    }
  }
}
export interface PreviewOptions extends GeneralOptions<PreviewOptions> {}

export const Preview = Extension.create<PreviewOptions>({
  name: 'preview',
  addStorage() {
    return {
      active: false,
      wasEditable: true,
    }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          icon: 'Eye',
          action: () => editor.commands.togglePreview(),
          tooltip: t('editor.preview.tooltip'),
          isActive: () => Boolean(editor.storage.preview.active),
        },
      }),
    }
  },
  addCommands() {
    return {
      togglePreview:
        () =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            const active = !editor.storage.preview.active

            if (active) editor.storage.preview.wasEditable = editor.isEditable

            editor.storage.preview.active = active
            editor.setEditable(active ? false : editor.storage.preview.wasEditable)
            tr.setMeta('preview:active', active)
          }
          return true
        },
    }
  },
})
