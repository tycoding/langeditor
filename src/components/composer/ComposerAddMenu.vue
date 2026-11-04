<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Icon, icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useLocale } from '@/locales'
import type { LcComposerAddMenuConfig, LcComposerAddMenuItem } from '@/type'

const props = defineProps<{ config: LcComposerAddMenuConfig; accept: string; disabled?: boolean }>()
const emit = defineEmits<{
  (event: 'files', files: FileList): void
  (event: 'action', item: LcComposerAddMenuItem): void
  (event: 'error', error: Error): void
}>()
const { t } = useLocale()
const open = ref(false)
const query = ref('')
const loadedItems = ref<LcComposerAddMenuItem[]>([])
const loading = ref(false)
const loadError = ref(false)
const selectedIndex = ref(0)
const expandedItems = ref(new Set<string>())
const inputRef = ref<HTMLInputElement | null>(null)
let requestId = 0

const uploadItem = computed<LcComposerAddMenuItem>(() => ({
  id: '__upload',
  type: 'upload',
  label: t.value('editor.composer.add.upload'),
  description: t.value('editor.composer.add.uploadDescription'),
  icon: 'FileUp',
  accept: props.accept,
}))

function flatten(items: LcComposerAddMenuItem[], depth = 0): Array<LcComposerAddMenuItem & { depth: number }> {
  return items.flatMap(item => [
    { ...item, depth },
    ...(item.children && expandedItems.value.has(item.id) ? flatten(item.children, depth + 1) : []),
  ])
}

const menuItems = computed(() => flatten([uploadItem.value, ...(props.config.items ?? []), ...loadedItems.value]))
const selectableItems = computed(() => menuItems.value.filter(item => !item.disabled))

watch([query, open], async ([value, isOpen]) => {
  if (!isOpen || !props.config.loadItems) return
  const current = ++requestId
  loading.value = true
  loadError.value = false
  try {
    const result = await props.config.loadItems(value)
    if (current === requestId) loadedItems.value = result
  } catch (error) {
    if (current === requestId) {
      loadedItems.value = []
      loadError.value = true
      emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  } finally {
    if (current === requestId) loading.value = false
  }
})

watch(open, async value => {
  if (!value) {
    query.value = ''
    selectedIndex.value = 0
    expandedItems.value = new Set()
    return
  }
  await nextTick()
})

function isIconName(value?: string): value is keyof typeof icons {
  return Boolean(value && value in icons)
}

function choose(item: LcComposerAddMenuItem) {
  if (item.disabled) return
  if (item.type === 'submenu') {
    const next = new Set(expandedItems.value)
    if (next.has(item.id)) next.delete(item.id)
    else next.add(item.id)
    expandedItems.value = next
    return
  }
  if (item.type === 'upload') inputRef.value?.click()
  else emit('action', item)
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!selectableItems.value.length) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const delta = event.key === 'ArrowDown' ? 1 : -1
    selectedIndex.value = (selectedIndex.value + delta + selectableItems.value.length) % selectableItems.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(selectableItems.value[selectedIndex.value])
  } else if (event.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        class="h-8 w-8 rounded-full p-0"
        size="icon"
        variant="ghost"
        :aria-label="t('editor.composer.add.label')"
        :title="t('editor.composer.add.label')"
        :disabled="disabled"
      >
        <Icon name="Plus" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      side="top"
      :side-offset="8"
      class="w-72 p-1.5"
      @keydown="onKeydown"
    >
      <Input
        v-if="config.loadItems"
        v-model="query"
        class="mb-1 h-8 text-xs"
        :aria-label="t('editor.composer.add.search')"
        :placeholder="t('editor.composer.add.search')"
      />
      <p v-if="loading" class="px-2 py-2 text-xs text-muted-foreground">{{ t('editor.composer.add.loading') }}</p>
      <p v-else-if="loadError" class="px-2 py-2 text-xs text-destructive">{{ t('editor.composer.add.error') }}</p>
      <div v-else class="max-h-64 overflow-y-auto overscroll-contain">
        <button
          v-for="item in menuItems"
          :key="`${item.depth}:${item.id}`"
          type="button"
          class="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          :class="selectableItems[selectedIndex]?.id === item.id && 'bg-accent'"
          :style="{ paddingLeft: `${8 + item.depth * 14}px` }"
          :disabled="item.disabled"
          :aria-expanded="item.type === 'submenu' ? expandedItems.has(item.id) : undefined"
          @mouseenter="selectedIndex = Math.max(0, selectableItems.findIndex(candidate => candidate.id === item.id))"
          @click="choose(item)"
        >
          <Icon v-if="isIconName(item.icon)" :name="item.icon" class="flex-none text-muted-foreground" />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ item.label }}</span>
            <span v-if="item.description" class="block truncate text-[11px] text-muted-foreground">{{ item.description }}</span>
          </span>
          <Icon
            v-if="item.type === 'submenu'"
            name="ChevronRight"
            class="flex-none text-muted-foreground transition-transform motion-reduce:transition-none"
            :class="expandedItems.has(item.id) && 'rotate-90'"
          />
        </button>
      </div>
    </PopoverContent>
  </Popover>
  <input
    ref="inputRef"
    class="sr-only"
    type="file"
    multiple
    :accept="accept"
    :aria-label="t('editor.composer.add.upload')"
    @change="event => {
      const target = event.target as HTMLInputElement
      if (target.files) emit('files', target.files)
      target.value = ''
    }"
  />
</template>
