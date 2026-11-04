<script setup lang="ts">
import type { Editor as CoreEditor } from '@tiptap/core'
import { Maximize, Minimize } from '@lucide/vue'
import { useLocale } from '@/locales'
import { hasExtension } from '@/utils/utils'
import PluginUiSlot from '@/components/plugins/PluginUiSlot.vue'

defineProps<{
  editor: CoreEditor
  miniMode: boolean
  wordMode: boolean
  previewMode: boolean
  currentPage: number
  visiblePages: number
  zoom: number
  showStatusbarLeft: boolean
  showStatusbarRight: boolean
}>()

const emit = defineEmits<{
  'update:zoom': [value: number]
  togglePreview: []
}>()

const { t } = useLocale()

function setZoom(value: number) {
  emit('update:zoom', Math.min(200, Math.max(50, value)))
}

function handleZoomInput(event: Event) {
  setZoom(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div
    v-if="wordMode"
    class="lc-editor-statusbar flex min-h-8 flex-none items-center justify-between gap-4 border-t border-border bg-background px-2.5 py-[3px] text-foreground"
  >
    <div class="flex items-center gap-0">
      <span class="border-r border-border px-2 pl-0.5 text-[10px]">
        {{ t('editor.word.page') }} {{ currentPage }} / {{ visiblePages }}
      </span>
      <span v-if="hasExtension(editor, 'characterCount')" class="border-r border-border px-2 text-[10px]">
        {{ t('editor.word.words') }} {{ editor.storage.characterCount.words() }}
      </span>
      <span v-if="hasExtension(editor, 'characterCount')" class="border-r border-border px-2 text-[10px]">
        {{ t('editor.word.characters') }} {{ editor.storage.characterCount.characters() }}
      </span>
      <PluginUiSlot v-if="showStatusbarLeft" :editor="editor" placement="statusbar-left" />
    </div>
    <div class="flex items-center gap-1">
      <button
        :aria-pressed="!previewMode"
        :class="!previewMode ? '!border-border !bg-accent !text-foreground' : ''"
        class="h-6 rounded border border-transparent bg-transparent px-[7px] text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="previewMode && $emit('togglePreview')"
      >
        {{ t('editor.word.edit') }}
      </button>
      <button
        v-if="hasExtension(editor, 'preview')"
        :aria-pressed="previewMode"
        :class="previewMode ? '!border-border !bg-accent !text-foreground' : ''"
        class="h-6 rounded border border-transparent bg-transparent px-[7px] text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="!previewMode && $emit('togglePreview')"
      >
        {{ t('editor.word.preview') }}
      </button>
      <span class="mx-1 h-[18px] w-px bg-border" aria-hidden="true"></span>
      <button
        :aria-label="t('editor.word.zoomOut')"
        class="inline-flex size-6 items-center justify-center rounded border border-transparent bg-transparent p-0 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="setZoom(zoom - 10)"
      >
        −
      </button>
      <input
        :aria-label="t('editor.word.zoom')"
        :value="zoom"
        class="lc-word-zoom-range mx-[3px] h-[18px] w-[110px] cursor-pointer appearance-none bg-transparent @max-[860px]:w-[76px]"
        max="200"
        min="50"
        step="10"
        type="range"
        @input="handleZoomInput"
      />
      <button
        :aria-label="t('editor.word.zoomIn')"
        class="inline-flex size-6 items-center justify-center rounded border border-transparent bg-transparent p-0 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="setZoom(zoom + 10)"
      >
        +
      </button>
      <span class="min-w-[34px] text-right text-[10px] text-muted-foreground">{{ zoom }}%</span>
      <PluginUiSlot v-if="showStatusbarRight" :editor="editor" placement="statusbar-right" />
      <button
        :aria-label="editor.storage.fullscreen?.active ? t('editor.fullscreen.tooltip.exit') : t('editor.fullscreen.tooltip.fullscreen')"
        :aria-pressed="Boolean(editor.storage.fullscreen?.active)"
        class="inline-flex size-6 items-center justify-center rounded border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        type="button"
        @click="editor.commands.setFullscreen?.()"
      >
        <Minimize v-if="editor.storage.fullscreen?.active" class="size-3.5" aria-hidden="true" />
        <Maximize v-else class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <slot name="footer" />
  </div>
  <div
    v-else-if="
      !miniMode &&
      (hasExtension(editor, 'characterCount') || showStatusbarLeft || showStatusbarRight)
    "
    class="lc-editor-statusbar flex justify-between border-t p-3 items-center"
  >
    <div class="flex flex-col">
      <div class="flex justify-end gap-3 text-sm">
        <span v-if="hasExtension(editor, 'characterCount')">
          {{ editor.storage.characterCount.characters() }}
          {{ t('editor.characters') }}
        </span>
        <PluginUiSlot v-if="showStatusbarLeft" :editor="editor" placement="statusbar-left" />
      </div>
    </div>
    <div class="flex items-center gap-2">
      <PluginUiSlot v-if="showStatusbarRight" :editor="editor" placement="statusbar-right" />
    </div>
    <slot name="footer" />
  </div>
</template>
