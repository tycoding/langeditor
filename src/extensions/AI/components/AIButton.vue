<script lang="ts" setup>
import { ref } from 'vue'
import { icons } from '@/components/icons'
import type { Editor } from '@tiptap/vue-3'
import ActionButton from '@/components/actions/ActionButton.vue'
import type { AIMode } from '../AI'

interface Props {
  editor: Editor
  icon?: keyof typeof icons
  tooltip?: string
  disabled?: boolean
  mode?: AIMode | 'auto'
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  tooltip: undefined,
  disabled: false,
  mode: 'auto',
})

const capturedSelection = ref<{ from: number; to: number } | null>(null)

function captureSelection() {
  const { from, to } = props.editor.state.selection
  if (from !== to) {
    capturedSelection.value = { from, to }
  }
}

function handleOpen() {
  const selection = capturedSelection.value
  if (selection && props.editor.state.selection.empty) {
    props.editor.commands.setTextSelection(selection)
  }
  capturedSelection.value = null
  const mode = props.mode === 'auto' ? (props.editor.state.selection.empty ? 'document' : 'selection') : props.mode
  props.editor.commands.toggleAI(true, mode)
}
</script>

<template>
  <span @pointerdown.capture="captureSelection">
    <ActionButton
      :action="handleOpen"
      :disabled="disabled"
      :icon="icon"
      :is-active="() => Boolean(editor.storage.AI?.open)"
      :tooltip="tooltip"
      title="AI"
    />
  </span>
</template>
