<script setup lang="ts">
import ActionMenuButton from '@/components/actions/ActionMenuButton.vue'
import type { ButtonViewReturnComponentProps } from '@/type'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

defineOptions({
  inheritAttrs: false,
})

interface Props {
  icon?: any
  title?: string
  tooltip?: string
  disabled?: boolean
  class?: string
  btn_class?: string
  shortcutKeys?: string[]
  action?: ButtonViewReturnComponentProps['action']
  isActive?: ButtonViewReturnComponentProps['isActive']
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  title: undefined,
  tooltip: undefined,
  disabled: false,
  action: undefined,
  isActive: undefined,
  class: '',
  btn_class: '',
  shortcutKeys: undefined,
})
</script>

<template>
  <Popover>
    <PopoverTrigger as-child :disabled="disabled">
      <ActionMenuButton
        v-bind="$attrs"
        :class="btn_class"
        :title="title"
        :icon="icon"
        :tooltip="tooltip"
        :disabled="disabled"
        :is-active="isActive"
        :shortcut-keys="shortcutKeys"
      >
        <template #prefix>
          <slot name="prefix"></slot>
        </template>
      </ActionMenuButton>
    </PopoverTrigger>
    <PopoverContent :class="cn('p-1 min-w-32 w-full', props.class)" align="start" side="bottom">
      <slot />
    </PopoverContent>
  </Popover>
</template>
