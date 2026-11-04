import { onUnmounted, ref } from 'vue'
import type { Editor as CoreEditor } from '@tiptap/core'
import {
  getEditorPluginSidebarConfig,
  getEditorPluginUi,
  LC_PLUGIN_SIDEBAR_CHANGE_EVENT,
  type LcPluginUiPlacement,
} from '@/plugins'

export function useEditorPluginUi(editor: CoreEditor) {
  const version = ref(0)
  const sidebarWidths = ref<{ left?: number; right?: number }>({})

  function refresh() {
    version.value += 1
  }

  function hasUi(placement: LcPluginUiPlacement) {
    void version.value
    return getEditorPluginUi(editor, placement).length > 0
  }

  function sidebarConfig(placement: 'sidebar-left' | 'sidebar-right') {
    void version.value
    return getEditorPluginSidebarConfig(editor, placement)
  }

  function sidebarWidth(placement: 'sidebar-left' | 'sidebar-right') {
    const side = placement === 'sidebar-left' ? 'left' : 'right'
    return sidebarWidths.value[side] ?? sidebarConfig(placement).width
  }

  function setSidebarWidth(placement: 'sidebar-left' | 'sidebar-right', width: number) {
    const side = placement === 'sidebar-left' ? 'left' : 'right'
    sidebarWidths.value = { ...sidebarWidths.value, [side]: width }
  }

  editor.on('transaction', refresh)
  editor.view.dom.addEventListener(LC_PLUGIN_SIDEBAR_CHANGE_EVENT, refresh)
  onUnmounted(() => {
    if (!editor.isDestroyed) editor.off('transaction', refresh)
    editor.view.dom.removeEventListener(LC_PLUGIN_SIDEBAR_CHANGE_EVENT, refresh)
  })

  return {
    hasUi,
    refresh,
    setSidebarWidth,
    sidebarConfig,
    sidebarWidth,
  }
}
