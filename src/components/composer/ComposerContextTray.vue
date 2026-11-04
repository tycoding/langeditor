<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocale } from '@/locales'
import type { LcComposerContextItem } from '@/type'
import ComposerFileIcon from './ComposerFileIcon.vue'

const props = defineProps<{ items: LcComposerContextItem[]; disabled?: boolean }>()
const emit = defineEmits<{
  (event: 'remove', item: LcComposerContextItem): void
  (event: 'retry', item: LcComposerContextItem): void
}>()
const { t } = useLocale()

const visibleItems = computed(() => props.items.slice(0, 3))
const hiddenCount = computed(() => Math.max(0, props.items.length - visibleItems.value.length))
const hiddenItemsLabel = computed(() =>
  t.value('editor.composer.context.more').replace('{count}', String(hiddenCount.value)),
)

const numberFormatter = computed(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }))
function formatSize(size?: number) {
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${numberFormatter.value.format(size / 1024)} KB`
  return `${numberFormatter.value.format(size / 1024 / 1024)} MB`
}
</script>

<template>
  <div
    v-if="items.length"
    class="flex min-w-0 items-center gap-1.5 overflow-hidden px-2.5 pt-2.5"
    data-composer-context
  >
    <article
      v-for="item in visibleItems"
      :key="item.id"
      class="group relative flex min-h-14 w-[160px] max-w-full flex-none items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-left"
      :class="item.status === 'error' && 'border-destructive/40 bg-destructive/5'"
    >
      <ComposerFileIcon :item="item" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-[11px] font-medium leading-4 text-foreground">{{ item.label }}</p>
        <p v-if="item.status === 'error'" class="mt-0.5 line-clamp-2 text-[11px] text-destructive">
          {{ item.error || t('editor.composer.context.error') }}
        </p>
        <p v-else class="truncate text-[10px] leading-4 text-muted-foreground">
          {{ item.description || item.mimeType || t(`editor.composer.context.kind.${item.kind}`) }}
          <template v-if="item.size"> · {{ formatSize(item.size) }}</template>
        </p>
        <div
          v-if="item.status === 'uploading' || item.status === 'processing'"
          class="mt-1 h-0.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          :aria-label="t(`editor.composer.context.status.${item.status}`)"
          :aria-valuenow="item.progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
            :class="item.progress == null && 'w-1/3 animate-pulse motion-reduce:animate-none'"
            :style="item.progress == null ? undefined : { width: `${Math.max(0, Math.min(100, item.progress))}%` }"
          />
        </div>
      </div>
      <TooltipProvider>
        <Tooltip v-if="item.status === 'error'">
          <TooltipTrigger as-child>
            <Button
              class="h-6 w-6 flex-none p-0"
              size="icon"
              variant="ghost"
              :aria-label="t('editor.composer.context.retry')"
              :disabled="disabled"
              @click="emit('retry', item)"
            >
              <Icon name="Refresh" class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('editor.composer.context.retry') }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              class="pointer-events-none absolute right-1 top-1 h-5 w-5 rounded-full border border-border bg-background p-0 text-muted-foreground opacity-0 shadow-sm transition-[background-color,color,opacity] hover:bg-muted hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              size="icon"
              variant="ghost"
              :aria-label="t('editor.composer.context.remove')"
              :disabled="disabled"
              @click="emit('remove', item)"
            >
              <Icon name="Close" class="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('editor.composer.context.remove') }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </article>
    <span
      v-if="hiddenCount"
      class="flex h-8 min-w-8 flex-none items-center justify-center rounded-full border border-border bg-muted px-2 text-[10px] font-semibold text-muted-foreground"
      :aria-label="hiddenItemsLabel"
      :title="hiddenItemsLabel"
    >
      +{{ hiddenCount }}
    </span>
  </div>
</template>
