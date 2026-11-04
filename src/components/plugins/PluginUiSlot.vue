<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Editor as CoreEditor } from '@tiptap/core'
import {
  getEditorPluginUi,
  LC_PLUGIN_SIDEBAR_CHANGE_EVENT,
  type LcPluginUiPlacement,
  type LcResolvedPluginUiContribution,
} from '@/plugins'

const props = defineProps<{
  editor: CoreEditor
  placement: LcPluginUiPlacement
}>()

const renderVersion = ref(0)
const contributions = computed(() => {
  void renderVersion.value
  return getEditorPluginUi(props.editor, props.placement)
})

function refresh() {
  renderVersion.value += 1
}

onMounted(() => {
  props.editor.on('selectionUpdate', refresh)
  props.editor.on('transaction', refresh)
  props.editor.on('focus', refresh)
  props.editor.on('blur', refresh)
  props.editor.view.dom.addEventListener(LC_PLUGIN_SIDEBAR_CHANGE_EVENT, refresh)
})

onBeforeUnmount(() => {
  props.editor.off('selectionUpdate', refresh)
  props.editor.off('transaction', refresh)
  props.editor.off('focus', refresh)
  props.editor.off('blur', refresh)
  props.editor.view.dom.removeEventListener(LC_PLUGIN_SIDEBAR_CHANGE_EVENT, refresh)
})

function componentProps(item: LcResolvedPluginUiContribution) {
  return { ...item.resolvedProps, editor: props.editor, pluginId: item.pluginId }
}
</script>

<template>
  <div
    v-for="item in contributions"
    :key="`${item.pluginId}:${item.id}`"
    :class="[
      'relative min-w-0',
      placement === 'menubar' || placement === 'toolbar' ? 'flex-none' : '',
      placement === 'floating' ? 'pointer-events-auto' : '',
      item.commercial && placement === 'toolbar'
        ? 'text-[#a86f12] [&_button]:!text-[#a86f12] [&_svg]:!text-[#a86f12] [&_button[aria-pressed=true]]:!bg-[#a86f12]/15 [&_button[aria-pressed=true]]:!text-[#8a590d] [&_button[aria-pressed=true]_svg]:!text-[#8a590d]'
        : '',
    ]"
    data-langchat-plugin-ui="true"
    :data-langchat-plugin-id="item.pluginId"
    :data-langchat-plugin-ui-id="item.id"
  >
    <component :is="item.component" v-bind="componentProps(item)" />
  </div>
</template>
