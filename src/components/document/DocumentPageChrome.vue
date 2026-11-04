<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '@/locales'
import type { LcDocumentPageLayout } from '@/plugins'

const props = defineProps<{
  page: number
  total: number
  layout: LcDocumentPageLayout
  activeSection?: 'header' | 'footer' | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  edit: [section: 'header' | 'footer']
}>()

const { t } = useLocale()
const header = computed(() => props.layout.header)
const footer = computed(() => props.layout.footer)
const showHeader = computed(() => Boolean(header.value?.enabled) && (props.page !== 1 || header.value?.firstPage !== false))
const showFooter = computed(() => Boolean(footer.value?.enabled) && (props.page !== 1 || footer.value?.firstPage !== false))
const headerValues = computed(() => [
  showHeader.value ? header.value?.left : '',
  showHeader.value ? header.value?.center : '',
  showHeader.value ? header.value?.right : '',
])
const footerValues = computed(() => [
  showFooter.value ? footer.value?.left : '',
  showFooter.value ? footer.value?.center : '',
  showFooter.value
    ? footer.value?.right || (footer.value?.showPageNumber ? `${props.page} / ${props.total}` : '')
    : '',
])
</script>

<template>
  <span class="pointer-events-none absolute left-3.5 top-3.5 z-[1] h-[18px] w-[18px] border-l border-t border-border" aria-hidden="true"></span>
  <span class="pointer-events-none absolute right-3.5 top-3.5 z-[1] h-[18px] w-[18px] border-r border-t border-border" aria-hidden="true"></span>
  <span class="pointer-events-none absolute bottom-3.5 left-3.5 z-[1] h-[18px] w-[18px] border-b border-l border-border" aria-hidden="true"></span>
  <span class="pointer-events-none absolute bottom-3.5 right-3.5 z-[1] h-[18px] w-[18px] border-b border-r border-border" aria-hidden="true"></span>

  <button
    :aria-label="t('editor.document.headerFooter.editHeader')"
    :aria-pressed="activeSection === 'header'"
    :class="activeSection === 'header' ? '!border-primary/55 !bg-primary/[.055] text-foreground' : ''"
    class="absolute inset-x-0 top-0 z-[3] grid h-[76px] grid-cols-3 items-end gap-5 border-b border-dashed border-transparent bg-transparent px-[clamp(20px,8cqw,88px)] pb-3 text-left text-[10px] leading-[1.45] text-muted-foreground outline-none transition-[border-color,background-color,color] hover:border-foreground/25 hover:bg-muted/35 hover:text-foreground focus-visible:border-primary/45 focus-visible:bg-primary/[.045] focus-visible:text-foreground"
    type="button"
    :disabled="disabled"
    @mousedown.prevent
    @click="emit('edit', 'header')"
  >
    <span v-for="(value, index) in headerValues" :key="index" :class="['min-w-0 truncate text-muted-foreground', index === 1 && 'text-center', index === 2 && 'text-right', !showHeader && 'opacity-[.62]']">
      {{ value || t(`editor.document.headerFooter.headerTemplate.${index}`) }}
    </span>
  </button>

  <button
    :aria-label="t('editor.document.headerFooter.editFooter')"
    :aria-pressed="activeSection === 'footer'"
    :class="activeSection === 'footer' ? '!border-primary/55 !bg-primary/[.055] text-foreground' : ''"
    class="absolute inset-x-0 bottom-0 z-[3] grid h-[76px] grid-cols-3 items-start gap-5 border-t border-dashed border-transparent bg-transparent px-[clamp(20px,8cqw,88px)] pt-3 text-left text-[10px] leading-[1.45] text-muted-foreground outline-none transition-[border-color,background-color,color] hover:border-foreground/25 hover:bg-muted/35 hover:text-foreground focus-visible:border-primary/45 focus-visible:bg-primary/[.045] focus-visible:text-foreground"
    type="button"
    :disabled="disabled"
    @mousedown.prevent
    @click="emit('edit', 'footer')"
  >
    <span v-for="(value, index) in footerValues" :key="index" :class="['min-w-0 truncate text-muted-foreground', index === 1 && 'text-center', index === 2 && 'text-right', !showFooter && 'opacity-[.62]']">
      {{ value || (index === 2 ? t('editor.document.headerFooter.footerPage').replace('{page}', String(page)).replace('{total}', String(total)) : '') }}
    </span>
  </button>
</template>
