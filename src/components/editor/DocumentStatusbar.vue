<script setup lang="ts">
import ActionButton from '@/components/actions/ActionButton.vue'
import DocumentPluginUiSlot from '@/components/plugins/DocumentPluginUiSlot.vue'
import { useLocale } from '@/locales'
import type { LcResolvedDocumentPluginRuntime } from '@/plugins'

const props = defineProps<{
  runtime?: LcResolvedDocumentPluginRuntime
  fullscreen: boolean
}>()

const emit = defineEmits<{
  toggleFullscreen: []
}>()

const { t } = useLocale()
</script>

<template>
  <div
    class="flex min-h-8 flex-none items-center justify-between gap-4 border-t border-border bg-background px-2.5 py-[3px] text-foreground"
  >
    <div class="flex min-w-0 items-center overflow-hidden">
      <DocumentPluginUiSlot :runtime="runtime" placement="statusbar-left" />
    </div>
    <div class="flex flex-none items-center gap-1">
      <DocumentPluginUiSlot :runtime="runtime" placement="statusbar-right" />
      <ActionButton
        :action="() => emit('toggleFullscreen')"
        :aria-label="fullscreen ? t('editor.fullscreen.tooltip.exit') : t('editor.fullscreen.tooltip.fullscreen')"
        :aria-pressed="fullscreen"
        custom-class="h-6 min-w-6 w-6"
        :icon="fullscreen ? 'Minimize' : 'Maximize'"
        :tooltip="fullscreen ? t('editor.fullscreen.tooltip.exit') : t('editor.fullscreen.tooltip.fullscreen')"
      />
    </div>
  </div>
</template>
