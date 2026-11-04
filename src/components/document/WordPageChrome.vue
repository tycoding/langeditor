<script setup lang="ts">
import { computed } from 'vue'
import DocumentPageChrome from './DocumentPageChrome.vue'
import type { LcDocumentPageLayout } from '@/plugins'
import type { WordHeaderFooterConfig } from '@/type'

const props = defineProps<{
  page: number
  total: number
  config: WordHeaderFooterConfig
  activeSection?: 'header' | 'footer' | null
}>()

const emit = defineEmits<{
  edit: [section: 'header' | 'footer']
}>()

const layout = computed<LcDocumentPageLayout>(() => ({
  header: {
    enabled: props.config.header?.enabled ?? false,
    left: props.config.header?.leftContent || props.config.header?.content,
    right: props.config.header?.rightContent,
    alignment: props.config.header?.alignment,
    firstPage: props.config.header?.showOnFirstPage,
  },
  footer: {
    enabled: props.config.footer?.enabled ?? false,
    left: props.config.footer?.leftContent || props.config.footer?.content,
    right: props.config.footer?.rightContent,
    alignment: props.config.footer?.alignment,
    firstPage: props.config.footer?.showOnFirstPage,
    showPageNumber: props.config.footer?.showPageNumber,
  },
}))
</script>

<template>
  <DocumentPageChrome
    :active-section="activeSection"
    :layout="layout"
    :page="page"
    :total="total"
    @edit="emit('edit', $event)"
  />
</template>
