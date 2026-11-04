<script setup>
import { ref } from 'vue'
import {
  BaseKit,
  Bold,
  BulletList,
  History,
  Italic,
  LangEditor,
  Link,
  OrderedList,
} from '@langeditor/core'

const content = ref('<p>粘贴一段带 <strong>粗体</strong>、<em>斜体</em>、链接或列表的 HTML，然后输入 @。</p>')
const context = ref([
  {
    id: 'example-image',
    kind: 'image',
    label: 'reference-sketch.svg',
    mimeType: 'image/svg+xml',
    size: 1240,
    status: 'ready',
    previewUrl:
      'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect width="96" height="96" rx="12" fill="%23e4e4e7"/%3E%3Cpath d="M22 66l18-20 13 12 10-10 13 18" fill="none" stroke="%2371717a" stroke-width="5"/%3E%3C/svg%3E',
  },
  {
    id: 'example-file',
    kind: 'file',
    label: 'product-brief.pdf',
    mimeType: 'application/pdf',
    size: 286_720,
    status: 'processing',
    progress: 64,
  },
])
const lastSubmission = ref('')
const extensions = [BaseKit, History, Bold, Italic, Link, BulletList, OrderedList]
const composer = {
  minHeight: 112,
  maxHeight: 280,
  actions: [{ id: 'tone', label: '语气：专业', icon: 'AI', position: 'start', type: 'button' }],
  addMenu: {
    items: [
      { id: 'knowledge', type: 'reference', label: '引用知识库', icon: 'FileText' },
      { id: 'tools', type: 'action', label: '选择工具', icon: 'Workflow' },
    ],
  },
  voice: {
    visible: true,
    async transcribe(_audio, { signal }) {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(resolve, 900)
        signal.addEventListener('abort', () => {
          window.clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
      return { text: '这是一段由示例 Provider 返回的模拟转录文本。', language: 'zh-CN' }
    },
  },
}
const mention = {
  sources: [
    {
      id: 'people',
      idKey: 'userId',
      labelKey: 'displayName',
      valueKey: 'handle',
      async items(query) {
        const people = [
          { userId: 'u-1', displayName: '林溪', handle: 'linxi', metadata: { team: 'Design' } },
          { userId: 'u-2', displayName: '周野', handle: 'zhouye', metadata: { team: 'Engineering' } },
        ]
        await new Promise(resolve => window.setTimeout(resolve, 180))
        return people.filter(person => person.displayName.includes(query) || person.handle.includes(query))
      },
    },
  ],
}

function onSubmit(detail) {
  lastSubmission.value = JSON.stringify(
    { text: detail.text, context: detail.contextItems.map(item => item.label), mentions: detail.mentions },
    null,
    2
  )
}
</script>

<template>
  <main class="composer-example">
    <header>
      <p>Public Composer example</p>
      <h1>Rich prompt, unified context.</h1>
      <p>Try rich-text paste, file drop, @mention, the custom footer action, and microphone dictation.</p>
    </header>
    <LangEditor
      v-model="content"
      v-model:composer-context="context"
      :composer="composer"
      :extensions="extensions"
      :mention="mention"
      layout="composer"
      @composer-action="detail => console.log('[composer-action]', detail)"
      @submit="onSubmit"
    />
    <pre v-if="lastSubmission">{{ lastSubmission }}</pre>
  </main>
</template>
