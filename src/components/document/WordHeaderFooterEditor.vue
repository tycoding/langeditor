<script setup lang="ts">
import { computed } from 'vue'
import DocumentHeaderFooterEditor from './DocumentHeaderFooterEditor.vue'
import type { LcDocumentPageLayout } from '@/plugins'
import type { WordHeaderFooterConfig } from '@/type'

const props = defineProps<{
  open: boolean
  modelValue: WordHeaderFooterConfig
  section: 'header' | 'footer'
}>()

const emit = defineEmits<{
  close: []
  apply: [value: WordHeaderFooterConfig]
  'update:section': [section: 'header' | 'footer']
}>()

const layout = computed<LcDocumentPageLayout>(() => ({
  header: {
    enabled: props.modelValue.header?.enabled ?? false,
    left: props.modelValue.header?.leftContent ?? '',
    center: props.modelValue.header?.content ?? '',
    right: props.modelValue.header?.rightContent ?? '',
    alignment: props.modelValue.header?.alignment,
    firstPage: props.modelValue.header?.showOnFirstPage,
  },
  footer: {
    enabled: props.modelValue.footer?.enabled ?? false,
    left: props.modelValue.footer?.leftContent ?? '',
    center: props.modelValue.footer?.content ?? '',
    right: props.modelValue.footer?.rightContent ?? '',
    alignment: props.modelValue.footer?.alignment,
    firstPage: props.modelValue.footer?.showOnFirstPage,
    showPageNumber: props.modelValue.footer?.showPageNumber,
  },
}))

function apply(value: LcDocumentPageLayout) {
  emit('apply', {
    header: {
      enabled: value.header?.enabled,
      content: value.header?.center,
      leftContent: value.header?.left,
      rightContent: value.header?.right,
      alignment: value.header?.alignment,
      showOnFirstPage: value.header?.firstPage,
    },
    footer: {
      enabled: value.footer?.enabled,
      content: value.footer?.center,
      leftContent: value.footer?.left,
      rightContent: value.footer?.right,
      alignment: value.footer?.alignment,
      showOnFirstPage: value.footer?.firstPage,
      showPageNumber: value.footer?.showPageNumber,
    },
  })
}
</script>

<template>
  <DocumentHeaderFooterEditor
    :model-value="layout"
    :open="open"
    :section="section"
    @apply="apply"
    @close="emit('close')"
    @update:section="emit('update:section', $event)"
  />
</template>
