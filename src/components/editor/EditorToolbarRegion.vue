<script setup lang="ts">
import type { Editor as CoreEditor } from '@tiptap/core'
import Menubars from '@/components/menubar/Menubars.vue'
import PluginUiSlot from '@/components/plugins/PluginUiSlot.vue'
import Toolbar from '@/components/toolbar/Toolbar.vue'

defineProps<{
  editor: CoreEditor
  disabled: boolean
  dark: boolean
  spellCheck: boolean
  toolbarVariant: 'compact' | 'default' | 'word'
  wordMode: boolean
  showMenubar: boolean
  showToolbar: boolean
  showPluginMenubar: boolean
  showPluginToolbar: boolean
}>()

defineEmits<{
  toggleTheme: []
  'update:spellCheck': [value: boolean]
}>()
</script>

<template>
  <div :class="wordMode ? 'flex-none border-b border-border bg-background' : ''" class="lc-editor-toolbar-region">
    <Menubars
      v-if="showMenubar"
      :disabled="disabled"
      :dark="dark"
      :editor="editor"
      :spell-check="spellCheck"
      :variant="wordMode ? 'word' : 'default'"
      @toggle-theme="$emit('toggleTheme')"
      @update:spell-check="$emit('update:spellCheck', $event)"
    />
    <div v-if="showMenubar && showPluginMenubar" class="flex min-w-0 items-center">
      <PluginUiSlot :editor="editor" placement="menubar" />
    </div>
    <Toolbar
      v-if="showToolbar"
      :disabled="disabled"
      :editor="editor"
      :variant="toolbarVariant"
      class="border-b overflow-hidden px-1 py-1"
    />
    <div v-if="showToolbar && showPluginToolbar" class="flex min-w-0 items-center">
      <PluginUiSlot :editor="editor" placement="toolbar" />
    </div>
  </div>
</template>
