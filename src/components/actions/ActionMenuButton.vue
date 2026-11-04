<script lang="ts" setup>
import { Icon } from '@/components/icons'
import type { ButtonViewReturnComponentProps } from '@/type'
import { getShortcutKeys } from '@/utils/plateform'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { type TooltipContentProps, useForwardExpose } from 'reka-ui'

defineOptions({
  inheritAttrs: false,
})

interface Props {
  icon?: any
  class?: string
  title?: string
  tooltip?: string
  tooltipOptions?: TooltipContentProps
  disabled?: boolean
  shortcutKeys?: string[]
  color?: string
  action?: ButtonViewReturnComponentProps['action']
  isActive?: ButtonViewReturnComponentProps['isActive']
}
const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  title: undefined,
  tooltip: undefined,
  tooltipOptions: undefined,
  disabled: false,
  color: undefined,
  shortcutKeys: undefined,
  action: undefined,
  isActive: undefined,
  class: '',
})

const { forwardRef } = useForwardExpose()
</script>

<template>
  <TooltipProvider>
    <Tooltip :delay-duration="0">
      <TooltipTrigger as-child>
        <Button
          ref="forwardRef"
          v-bind="$attrs"
          :class="cn('h-[32px] px-2 py-0 transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground', isActive?.() && 'bg-accent text-accent-foreground', props.class)"
          variant="ghost"
          :disabled="disabled"
        >
          <div class="flex items-center h-full justify-between font-normal w-full">
            <slot name="prefix"></slot>
            <div class="text-left truncate text-sm flex-grow" v-if="title">{{ title }}</div>
            <Icon class="w-[16px] h-[16px]" :name="icon" v-if="icon" />
            <Icon class="ml-2 text-muted-foreground flex-shrink-0" name="MenuDown" />
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent v-if="tooltip || (shortcutKeys && shortcutKeys.length)" hideWhenDetached v-bind="tooltipOptions">
        <div class="max-w-24 text-center flex flex-col items-center">
          <div>{{ tooltip }}</div>
          <div class="flex" v-if="shortcutKeys && shortcutKeys.length">
            <span>{{ getShortcutKeys(shortcutKeys) }}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
