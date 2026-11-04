import { Extension } from '@tiptap/core'
import type { GeneralOptions } from '@/type'
import ActionButton from '@/components/actions/ActionButton.vue'
export interface FullscreenOptions extends GeneralOptions<FullscreenOptions> {}

declare module '@tiptap/core' {
  interface Storage {
    fullscreen: {
      active: boolean
    }
  }

  interface Commands<ReturnType> {
    fullscreen: {
      setFullscreen: () => ReturnType
    }
  }
}
export const Fullscreen = Extension.create<FullscreenOptions>({
  name: 'fullscreen',
  addStorage() {
    return { active: false }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, extension, t }) => ({
        component: ActionButton,
        componentProps: {
          tooltip: editor.storage.fullscreen.active
            ? t('editor.fullscreen.tooltip.exit')
            : t('editor.fullscreen.tooltip.fullscreen'),
          action: () => editor?.chain().setFullscreen().focus().run(),
          icon: editor.storage.fullscreen.active ? 'Minimize' : 'Maximize',
          isActive: () => Boolean(editor.storage.fullscreen.active),
        },
      }),
    }
  },
  addCommands() {
    return {
      setFullscreen:
        () =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            const active = !editor.storage.fullscreen.active
            editor.storage.fullscreen.active = active
            tr.setMeta('fullscreen:active', active)
          }
          return true
        },
    }
  },
  addKeyboardShortcuts() {
    return {
      F11: () => this.editor.commands.setFullscreen(),
      'Mod-F11': () => this.editor.commands.setFullscreen(),
    }
  },
})
