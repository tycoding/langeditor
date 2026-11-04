<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Icon, icons } from '@/components/icons'
import { useLocale } from '@/locales'
import type { MentionMenuItem, MentionMenuProps } from './types'

const props = defineProps<MentionMenuProps>()
const { t } = useLocale()
const selectedIndex = ref(0)
const itemRefs = ref<Array<HTMLButtonElement | null>>([])

const selectableItems = () => props.items.filter(item => !item.disabled && item.status !== 'error')

watch(
  () => props.items,
  async () => {
    selectedIndex.value = 0
    await nextTick()
    itemRefs.value[0]?.scrollIntoView({ block: 'nearest' })
  },
  { deep: true }
)

function isIconName(value?: string): value is keyof typeof icons {
  return Boolean(value && value in icons)
}

function select(item: MentionMenuItem) {
  if (item.disabled || item.status === 'error') return
  props.command(item)
}

function move(delta: number) {
  const available = selectableItems()
  if (!available.length) return
  selectedIndex.value = (selectedIndex.value + delta + available.length) % available.length
  nextTick(() => itemRefs.value[selectedIndex.value]?.scrollIntoView({ block: 'nearest' }))
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (event.key === 'ArrowUp') {
    move(-1)
    return true
  }
  if (event.key === 'ArrowDown') {
    move(1)
    return true
  }
  if (event.key === 'Enter') {
    const item = selectableItems()[selectedIndex.value]
    if (item) select(item)
    return Boolean(item)
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div
    class="max-h-64 min-w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    role="listbox"
    :aria-label="t('editor.composer.mention.label')"
  >
    <button
      v-for="(item, index) in selectableItems()"
      :key="`${item.sourceId}:${item.id}`"
      :ref="element => (itemRefs[index] = element as HTMLButtonElement | null)"
      type="button"
      role="option"
      class="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
      :class="selectedIndex === index && 'bg-accent'"
      :aria-selected="selectedIndex === index"
      @mouseenter="selectedIndex = index"
      @mousedown.prevent="select(item)"
    >
      <Icon v-if="isIconName(item.icon)" :name="item.icon" class="flex-none text-muted-foreground" />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-medium">{{ item.trigger }}{{ item.label }}</span>
        <span v-if="item.description" class="block truncate text-[11px] text-muted-foreground">
          {{ item.description }}
        </span>
      </span>
    </button>
    <p v-if="!selectableItems().length" class="px-2 py-2 text-xs text-muted-foreground">
      {{ items.some(item => item.status === 'error') ? t('editor.composer.mention.error') : t('editor.composer.mention.empty') }}
    </p>
  </div>
</template>
