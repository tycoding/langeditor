<script lang="ts" setup>
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icons'
import { useLocale } from '@/locales'

interface Props {
  editor: Editor
}

const props = defineProps<Props>()
const { t } = useLocale()

function exitPreview() {
  props.editor.commands.togglePreview()
}
</script>

<template>
  <div
    :aria-label="t('editor.preview.mode')"
    class="flex min-h-[46px] flex-none items-center justify-between gap-4 border-b border-border bg-muted/55 px-2.5 py-1.5 [[data-editor-mode=word]_&]:bg-background"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-border bg-background text-foreground" aria-hidden="true">
        <Icon class="h-4 w-4" name="Eye" />
      </span>
      <div class="flex min-w-0 flex-col gap-px">
        <strong class="truncate text-xs font-semibold leading-tight text-foreground">{{ t('editor.preview.mode') }}</strong>
        <span class="truncate text-[10px] leading-tight text-muted-foreground">{{ t('editor.preview.readOnly') }}</span>
      </div>
    </div>
    <Button
      class="h-[30px] flex-none border-border bg-background px-2.5 text-[11px] hover:bg-accent"
      size="sm"
      type="button"
      variant="outline"
      @click="exitPreview"
    >
      {{ t('editor.preview.exit') }}
    </Button>
  </div>
</template>
