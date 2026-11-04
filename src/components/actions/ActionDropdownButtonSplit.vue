<script setup lang="ts">
import ActionDropdownButton from '@/components/actions/ActionDropdownButton.vue'
import type { ButtonViewReturnComponentProps } from '@/type'

interface Props {
  icon?: any
  title?: string
  tooltip?: string
  disabled?: boolean
  class?: string
  shortcutKeys?: string[]
  btn_class?: string
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
  shortcutKeys: undefined,
  class: '',
  btn_class: '',
})
</script>

<template>
  <ActionDropdownButton
    :class="props.class"
    :btn_class="btn_class"
    :disabled="disabled"
    :icon="icon"
    :is-active="isActive"
    :shortcut-keys="shortcutKeys"
    :title="title"
    :tooltip="tooltip"
  >
    <slot />
  </ActionDropdownButton>
</template>
