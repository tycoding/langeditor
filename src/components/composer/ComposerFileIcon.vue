<script setup lang="ts">
import { computed } from 'vue'
import type { LcComposerContextItem } from '@/type'

const props = defineProps<{ item: LcComposerContextItem }>()

type FileVisual = 'word' | 'sheet' | 'slides' | 'pdf' | 'archive' | 'text' | 'audio' | 'video' | 'file'

const extension = computed(() => props.item.label.split('.').pop()?.toLocaleLowerCase() ?? '')
const visual = computed<FileVisual>(() => {
  const mime = props.item.mimeType?.toLocaleLowerCase() ?? ''
  const ext = extension.value
  if (mime.includes('wordprocessingml') || mime.includes('msword') || ['doc', 'docx', 'odt'].includes(ext)) return 'word'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet'
  if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx', 'odp'].includes(ext)) return 'slides'
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf'
  if (mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio'
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'video'
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml'].includes(ext)) return 'text'
  return 'file'
})

const visualConfig = computed(() => ({
  word: { label: 'DOC', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  sheet: { label: 'XLS', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  slides: { label: 'PPT', class: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  pdf: { label: 'PDF', class: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  archive: { label: 'ZIP', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  text: { label: 'TXT', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  audio: { label: 'AUD', class: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  video: { label: 'VID', class: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' },
  file: { label: 'FILE', class: 'bg-muted text-muted-foreground' },
})[visual.value])
</script>

<template>
  <img
    v-if="item.kind === 'image' && item.previewUrl"
    :alt="item.label"
    :src="item.previewUrl"
    class="h-8 w-8 flex-none rounded object-cover ring-1 ring-border"
  />
  <span
    v-else
    class="flex h-8 w-8 flex-none items-center justify-center rounded-md"
    :class="visualConfig.class"
    aria-hidden="true"
  >
    <svg class="h-7 w-7" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 3.75h10l5 5V27a1.25 1.25 0 0 1-1.25 1.25H8.5A1.25 1.25 0 0 1 7.25 27V5A1.25 1.25 0 0 1 8.5 3.75Z" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.35" />
      <path d="M18.5 3.75v5h5" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
      <path d="M10.5 12.25h9M10.5 15.25h7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity="0.72" />
      <rect x="5" y="19" width="22" height="8" rx="2" fill="currentColor" />
      <text x="16" y="24.7" fill="white" font-size="5.2" font-weight="700" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">{{ visualConfig.label }}</text>
    </svg>
  </span>
</template>
