<script setup lang="ts">
import { ref } from 'vue'
import type {
  LcComposerAction,
  LcComposerAddMenuItem,
  LcComposerContextItem,
  LcComposerVoiceState,
} from '@/type'
import type { LcResolvedComposerConfig } from '@/hooks/useComposer'
import ComposerContextTray from './ComposerContextTray.vue'
import ComposerFooter from './ComposerFooter.vue'

defineProps<{
  config: LcResolvedComposerConfig
  contextItems: LcComposerContextItem[]
  disabled?: boolean
  submitDisabled: boolean
  streaming: boolean
  voiceState: LcComposerVoiceState
  voiceLevel: number
  voiceDuration: number
  voiceError?: string
}>()
const emit = defineEmits<{
  (event: 'files', files: FileList | File[]): void
  (event: 'remove-context', item: LcComposerContextItem): void
  (event: 'retry-context', item: LcComposerContextItem): void
  (event: 'action', action: LcComposerAction | LcComposerAddMenuItem): void
  (event: 'submit'): void
  (event: 'stop'): void
  (event: 'voice'): void
  (event: 'voice-cancel'): void
  (event: 'voice-confirm'): void
  (event: 'error', error: Error): void
}>()
const dragging = ref(false)

function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  emit('files', files)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  emit('files', files)
}
</script>

<template>
  <section
    class="relative flex min-w-0 flex-col overflow-hidden rounded-[7px] bg-background"
    :class="dragging && 'ring-2 ring-inset ring-ring'"
    data-composer-shell
    @dragenter.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @dragover.prevent
    @drop="onDrop"
    @paste.capture="onPaste"
  >
    <slot name="context" :items="contextItems" :remove="(item: LcComposerContextItem) => emit('remove-context', item)">
      <ComposerContextTray
        :disabled="disabled"
        :items="contextItems"
        @remove="emit('remove-context', $event)"
        @retry="emit('retry-context', $event)"
      />
    </slot>
    <div class="min-h-0 min-w-0 flex-1" data-composer-input>
      <slot name="editor" />
    </div>
    <ComposerFooter
      :config="config"
      :disabled="disabled"
      :streaming="streaming"
      :submit-disabled="submitDisabled"
      :voice-duration="voiceDuration"
      :voice-error="voiceError"
      :voice-level="voiceLevel"
      :voice-state="voiceState"
      @action="emit('action', $event)"
      @error="emit('error', $event)"
      @files="emit('files', $event)"
      @stop="emit('stop')"
      @submit="emit('submit')"
      @voice="emit('voice')"
      @voice-cancel="emit('voice-cancel')"
      @voice-confirm="emit('voice-confirm')"
    >
      <template v-if="$slots['footer-start']" #start="slotProps"><slot name="footer-start" v-bind="slotProps" /></template>
      <template v-if="$slots['footer-center']" #center="slotProps"><slot name="footer-center" v-bind="slotProps" /></template>
      <template v-if="$slots['footer-end']" #end="slotProps"><slot name="footer-end" v-bind="slotProps" /></template>
      <template v-if="$slots['add-menu']" #add-menu><slot name="add-menu" /></template>
      <template v-if="$slots.voice" #voice="slotProps"><slot name="voice" v-bind="slotProps" /></template>
      <template v-if="$slots.send" #send="slotProps"><slot name="send" v-bind="slotProps" /></template>
    </ComposerFooter>
  </section>
</template>
