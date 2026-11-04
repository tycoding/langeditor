<script lang="ts" setup>
import { cn } from '@/lib/utils'
import {
  MenubarPortal,
  MenubarSubContent,
  type MenubarSubContentEmits,
  type MenubarSubContentProps,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed, type HTMLAttributes } from 'vue'
import { useEditorPortalTarget } from '@/hooks/useEditorPortal'

const props = defineProps<
  MenubarSubContentProps & { class?: HTMLAttributes['class']; portalTo?: string | HTMLElement }
>()

const emits = defineEmits<MenubarSubContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, portalTo: __, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const editorPortalTarget = useEditorPortalTarget()
</script>

<template>
  <MenubarPortal :to="props.portalTo ?? editorPortalTarget">
    <MenubarSubContent
      :class="
        cn(
          'z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class
        )
      "
      v-bind="forwarded"
    >
      <slot />
    </MenubarSubContent>
  </MenubarPortal>
</template>
