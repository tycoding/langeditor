<script setup lang="ts">
import { useLocale } from '@/locales'
import DocumentTitlebar from './DocumentTitlebar.vue'

defineProps<{
  zoom: number
  hasFloatingUi: boolean
}>()

const { t } = useLocale()
</script>

<template>
  <DocumentTitlebar
    :has-floating-ui="hasFloatingUi"
    icon="W"
    :meta="`A4 · ${zoom}%`"
    :status="t('editor.document.saved')"
    :title="t('editor.document.untitled')"
  />
</template>
