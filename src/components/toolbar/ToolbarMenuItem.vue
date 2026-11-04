<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import type { ButtonViewReturn } from '@/type'

export interface ToolbarMenuItemModel {
  button: ButtonViewReturn
  extensionName: string
  commercial: boolean
}

withDefaults(
  defineProps<{
    item: ToolbarMenuItemModel
    editor: Editor
    disabled?: boolean
    mode?: string
    compact?: boolean
  }>(),
  {
    disabled: false,
    mode: undefined,
    compact: false,
  }
)
</script>

<template>
  <div
    :class="[
      'relative inline-flex min-w-0 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground',
      compact ? 'inline-flex w-auto max-w-full shrink-0 items-center' : '',
      item.commercial
        ? 'text-[#a86f12] [&_button]:!text-[#a86f12] [&_svg]:!text-[#a86f12] [&_button[aria-pressed=true]]:!bg-[#a86f12]/15 [&_button[aria-pressed=true]]:!text-[#8a590d] [&_button[aria-pressed=true]_svg]:!text-[#8a590d]'
        : '',
    ]"
  >
    <component
      :is="item.button.component"
      v-bind="item.button.componentProps"
      :editor="editor"
      :disabled="disabled || item.button.componentProps?.disabled"
      :mode="mode"
    >
      <template v-for="(element, slotName, i) in item.button.componentSlots" :key="i" #[`${slotName}`]="values">
        <component :is="element" v-bind="values?.props" />
      </template>
    </component>
  </div>
</template>
