<script setup lang="ts">
import { Editor } from '@tiptap/core'
import type { AIMode } from '@/extensions/AI/AI'
import { Icon } from '@/components/icons'
import { MenuItem } from '@/components/ui/menu'
import { Separator } from '@/components/ui/separator'
import { useLocale } from '@/locales'

const props = defineProps({
  editor: {
    type: Editor,
    required: true,
  },
  completion: {
    type: String,
    required: true,
  },
  mode: {
    type: String as () => AIMode,
    default: 'selection',
  },
  selection: {
    type: Object as () => { from: number; to: number } | null,
    default: null,
  },
})
const { t } = useLocale()
const emits = defineEmits(['generate', 'close', 'accept', 'reject', 'insert'])
function handleReplace() {
  // The parent owns the stable selection snapshot and performs the mutation
  // only after the user explicitly accepts the generated preview.
  emits('accept')
}
function handleInsert() {
  emits('insert')
}
function handleGenerate() {
  emits('generate')
}
function handleClose() {
  emits('close')
}
function handleAccept() {
  emits('accept')
}
function handleReject() {
  emits('reject')
}
</script>

<template>
  <div
    v-if="mode === 'document'"
    class="mx-auto flex min-h-[58px] w-max max-w-full items-center gap-1 rounded-[13px] border border-border bg-background p-[7px] text-foreground shadow-[0_12px_28px_rgb(15_23_42_/_0.13)]"
    role="group"
    :aria-label="t('editor.AI.review')"
  >
    <button
      class="inline-flex h-[42px] items-center justify-center gap-[7px] rounded-[9px] px-[13px] text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      type="button"
      @click="handleReject"
    >
      <Icon name="Close" />
      {{ t('editor.AI.reject') }}
    </button>
    <button
      class="inline-flex h-[42px] items-center justify-center gap-[7px] rounded-[9px] bg-[#6750ff] px-[13px] text-[13px] font-medium text-white hover:bg-[#573ef2]"
      type="button"
      @click="handleAccept"
    >
      <Icon name="Check" />
      {{ t('editor.AI.accept') }}
    </button>
    <span aria-hidden="true" class="mx-[3px] h-[26px] w-px bg-border"></span>
    <button
      :aria-label="t('editor.AI.close')"
      class="inline-flex h-[42px] w-10 items-center justify-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
      type="button"
      @click="handleClose"
    >
      <Icon name="Close" />
    </button>
  </div>
  <div
    v-else
    class="mt-2 max-w-[240px] overflow-hidden rounded-lg border border-violet-600/40 bg-violet-600/[.055] p-1.5 text-violet-900 shadow-[0_8px_20px_rgb(76_29_149_/_0.1)] dark:border-violet-400/45 dark:bg-violet-600/15 dark:text-violet-100 [&_[role='menuitem']]:text-violet-800 dark:[&_[role='menuitem']]:text-violet-200 [&_[role='menuitem']:hover]:bg-violet-600/10 [&_[role='menuitem']:hover]:text-violet-900 dark:[&_[role='menuitem']:hover]:text-violet-100 [&_button]:text-violet-800 dark:[&_button]:text-violet-200 [&_button:hover]:bg-violet-600/10 [&_button:hover]:text-violet-900 dark:[&_button:hover]:text-violet-100 [&_hr]:my-1 [&_hr]:border-violet-600/20"
  >
    <div class="flex flex-col gap-1">
      <MenuItem @click="handleReplace">
        <Icon name="Replace" />
        {{ t('editor.AI.replace') }}
      </MenuItem>
      <MenuItem @click="handleInsert">
        <Icon name="TextQuote" />
        {{ t('editor.AI.insert') }}
      </MenuItem>
      <Separator />
      <MenuItem @click="handleGenerate">
        <Icon name="Redo2" />
        {{ t('editor.AI.regenerate') }}
      </MenuItem>
      <MenuItem @click="handleClose">
        <Icon name="Trash2" />
        {{ t('editor.AI.close') }}
      </MenuItem>
    </div>
  </div>
</template>
