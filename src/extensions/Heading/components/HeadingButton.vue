<script lang="ts" setup>
import { computed } from 'vue'
import { MenuCheckboxItem, MenuSeparator, MenuShortcut } from '@/components/ui/menu'

import type { Editor } from '@tiptap/vue-3'
import ActionDropdownButton from '@/components/actions/ActionDropdownButton.vue'
import { getShortcutKey } from '@/utils/plateform'
import type { Item } from '../types'
import HeadingIcon from './HeadingIcon.vue'

interface Props {
  editor: Editor
  disabled?: boolean
  color?: string
  shortcutKeys?: string[]
  maxHeight?: string | number
  tooltip?: string
  items?: Item[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  color: undefined,
  maxHeight: undefined,
  tooltip: '',
  shortcutKeys: undefined,
  items: () => [],
})

const active = computed(() => {
  const find: any = props.items.find((k: any) => k.isActive())
  if (find && !find.default) {
    return {
      ...find,
    }
  }
  const item: Item = {
    title: props.tooltip,
    level: 0,
    isActive: () => false,
  }
  return item
})
</script>

<template>
  <ActionDropdownButton
    :disabled="disabled"
    :tooltip="tooltip"
    :title="active?.title"
    btn_class="min-w-[104px] max-w-[116px] [&_svg]:mr-1.5 [&_.text-sm]:text-[13px]"
    class="w-[232px] rounded-[10px] p-[5px]"
  >
    <template #prefix>
      <HeadingIcon :level="active?.level" />
    </template>
    <template v-for="(item, index) in props.items" :key="index">
      <MenuCheckboxItem
        :model-value="active.title === item.title"
        :class="[
          'grid min-h-9 grid-cols-[20px_minmax(0,1fr)_auto] gap-2 rounded-[7px] px-2 py-[5px] pl-[30px] text-[13px] leading-tight',
          active.title === item.title ? '[&_svg]:text-foreground' : '[&_svg]:text-muted-foreground',
        ]"
        @click="item.action"
      >
        <HeadingIcon :level="item.level" />
        <span class="min-w-0 truncate whitespace-nowrap text-[13px] font-medium">{{ item.title }}</span>
        <MenuShortcut class="pl-1.5 text-[10px] text-muted-foreground">
          {{ item.shortcutKeys?.map(item => getShortcutKey(item)).join(' ') }}
        </MenuShortcut>
      </MenuCheckboxItem>
      <MenuSeparator v-if="item.level === 0" />
    </template>
  </ActionDropdownButton>
</template>
