import { reactive, watchEffect } from 'vue'

import type { AnyExtension } from '@tiptap/core'
import { createGlobalState } from '@vueuse/core'
import { useContext } from './useContext'

import { DEFAULT_LANG_VALUE } from '@/constants'

/**
 * Interface representing an tiptap editor instance.
 */
interface Instance {
  /**
   * List of extensions
   *
   * @default []
   */
  extensions: AnyExtension[]

  /**
   * Default language setting
   *
   * @default DEFAULT_LANG_VALUE
   */
  defaultLang?: string
}

export const useTiptapStore = createGlobalState(() => {
  const { state: _state } = useContext()

  const state: Instance = reactive({
    extensions: _state.extensions ?? [],
    defaultLang: DEFAULT_LANG_VALUE,
  })

  watchEffect(() => {
    state.extensions = _state.extensions
    state.defaultLang = _state.defaultLang
  })

  return {
    state,
  }
})
