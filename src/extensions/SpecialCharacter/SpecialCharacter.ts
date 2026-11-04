import { Extension } from '@tiptap/core'
import ActionButton from '@/components/actions/ActionButton.vue'
import type { GeneralOptions } from '@/type'

declare module '@tiptap/core' {
  interface Storage {
    specialCharacter: {
      open: boolean
    }
  }

  interface Commands<ReturnType> {
    specialCharacter: {
      toggleSpecialCharacter: () => ReturnType
      insertSpecialCharacter: (char: string) => ReturnType
    }
  }
}
export interface SpecialCharacterOptions extends GeneralOptions<SpecialCharacterOptions> {}

export const SpecialCharacter = Extension.create<SpecialCharacterOptions>({
  name: 'specialCharacter',
  addStorage() {
    return { open: false }
  },
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          icon: 'Omega',
          action: () => editor.commands.toggleSpecialCharacter(),
          tooltip: t('editor.specialCharacter.tooltip'),
          isActive: () => Boolean(editor.storage.specialCharacter.open),
        },
      }),
    }
  },
  addCommands() {
    return {
      toggleSpecialCharacter:
        () =>
        ({ editor, tr, dispatch }) => {
          if (dispatch) {
            const open = !editor.storage.specialCharacter.open
            editor.storage.specialCharacter.open = open
            tr.setMeta('specialCharacter:open', open)
          }
          return true
        },
      insertSpecialCharacter:
        (char: string) =>
        ({ editor }) => {
          try {
            // 直接使用insertContent，这是最安全的方法
            editor.commands.insertContent(char)
            return true
          } catch (error) {
            console.error('Error in insertSpecialCharacter command:', error)
            return false
          }
        },
    }
  },
})
