<script lang="ts" setup>
import type { TocItem } from '@/hooks/useToc'

defineOptions({ name: 'TocTree' })

withDefaults(
  defineProps<{
    items: TocItem[]
    activeId?: string
    depth?: number
  }>(),
  { activeId: '', depth: 0 }
)

const emit = defineEmits<{ select: [item: TocItem] }>()
</script>

<template>
  <ul class="m-0 list-none p-0" :data-depth="depth">
    <li v-for="item in items" :key="item.id">
      <button
        :class="[
          'flex min-h-[30px] w-full items-center gap-2 rounded-[7px] py-[5px] pr-2 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground',
          activeId === item.id && 'bg-primary/10 text-foreground',
        ]"
        :style="{ paddingLeft: `${10 + depth * 14}px` }"
        :title="item.text"
        type="button"
        @click="emit('select', item)"
      >
        <span
          :class="['h-1 w-1 flex-none rounded-full bg-muted-foreground/45', activeId === item.id && 'bg-primary']"
          aria-hidden="true"
        ></span>
        <span class="truncate">{{ item.text }}</span>
      </button>
      <TocTree
        v-if="item.children.length"
        :active-id="activeId"
        :depth="depth + 1"
        :items="item.children"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>
