<script setup lang="ts">
import { computed, ref } from 'vue'
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { WordHeaderFooterConfig } from '@/type'
import WordPageChrome from '@/components/document/WordPageChrome.vue'
import { WORD_PAGE_CLASS } from '../wordPageStyles'

const props = defineProps(nodeViewProps)
const activeSection = ref<'header' | 'footer' | null>(null)

const page = computed(() => Number(props.node.attrs.page) || 1)
const total = computed(() => Number(props.node.attrs.total) || 1)
const config = computed<WordHeaderFooterConfig>(() => ({
  header: props.node.attrs.header ?? undefined,
  footer: props.node.attrs.footer ?? undefined,
}))

function editSection(section: 'header' | 'footer') {
  activeSection.value = section
  // Preserve the current ProseMirror selection. Header/footer settings are
  // edited in the side panel and are not document body nodes.
  props.editor.view.dom.dispatchEvent(
    new CustomEvent('langeditor:word-region-edit', {
      bubbles: true,
      composed: true,
      detail: { section, page: page.value },
    })
  )
}
</script>

<template>
  <NodeViewWrapper
    as="article"
    :class="WORD_PAGE_CLASS"
    :data-page="page"
    :data-total="total"
    data-type="word-page"
    data-word-page-content
  >
    <WordPageChrome
      :active-section="activeSection"
      :config="config"
      :page="page"
      :total="total"
      @edit="editSection"
    />
    <NodeViewContent class="relative z-[2] min-h-0 outline-none" />
  </NodeViewWrapper>
</template>
