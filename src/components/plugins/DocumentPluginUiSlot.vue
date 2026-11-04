<script setup lang="ts">
import { computed } from 'vue'
import type { LcPluginUiPlacement, LcResolvedDocumentPluginRuntime } from '@/plugins'
import { getDocumentPluginUi } from '@/plugins'

const props = defineProps<{
  runtime?: LcResolvedDocumentPluginRuntime
  placement: LcPluginUiPlacement
}>()

const contributions = computed(() => getDocumentPluginUi(props.runtime, props.placement))
</script>

<template>
  <component
    :is="contribution.component"
    v-for="contribution in contributions"
    :key="`${contribution.pluginId}:${contribution.id}`"
    v-bind="contribution.resolvedProps"
    :data-commercial="contribution.commercial ? 'true' : undefined"
    :data-document-plugin-ui="`${contribution.pluginId}:${contribution.id}`"
    :data-plugin-placement="placement"
  />
</template>
