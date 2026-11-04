import { onUnmounted, ref, watch, type ComputedRef } from 'vue'
import type { LcComposerContextItem, LcComposerErrorDetail } from '@/type'
import type { LcResolvedComposerConfig } from './useComposer'

function matchesAccept(file: File, accept: string) {
  if (!accept || accept === '*/*') return true
  return accept.split(',').some(rule => {
    const value = rule.trim().toLowerCase()
    if (!value) return false
    if (value.startsWith('.')) return file.name.toLowerCase().endsWith(value)
    if (value.endsWith('/*')) return file.type.toLowerCase().startsWith(value.slice(0, -1))
    return file.type.toLowerCase() === value
  })
}

function fileId(file: File) {
  return `file:${file.name}:${file.size}:${file.lastModified}`
}

export function useComposerContext(options: {
  context: ComputedRef<LcComposerContextItem[]>
  config: ComputedRef<LcResolvedComposerConfig>
  fileTooLargeMessage: (file: File) => string
  fileTypeMessage: (file: File) => string
  maxItemsMessage: () => string
  onUpdate: (items: LcComposerContextItem[]) => void
  onAdd: (items: LcComposerContextItem[]) => void
  onRemove: (item: LcComposerContextItem) => void
  onError: (detail: LcComposerErrorDetail) => void
}) {
  const items = ref<LcComposerContextItem[]>([...options.context.value])
  const ownedUrls = new Map<string, string>()

  watch(
    options.context,
    value => {
      const nextIds = new Set(value.map(item => item.id))
      for (const [id, url] of ownedUrls) {
        if (!nextIds.has(id)) {
          URL.revokeObjectURL(url)
          ownedUrls.delete(id)
        }
      }
      items.value = [...value]
    },
    { deep: true }
  )

  function commit(next: LcComposerContextItem[]) {
    items.value = next
    options.onUpdate([...next])
  }

  function addFiles(files: File[] | FileList) {
    const incoming = Array.from(files)
    if (!incoming.length) return
    const available = Math.max(0, options.config.value.maxContextItems - items.value.length)
    if (incoming.length > available) {
      options.onError({ error: new Error(options.maxItemsMessage()), source: 'context' })
    }

    const existingIds = new Set(items.value.map(item => item.id))
    const added: LcComposerContextItem[] = []
    for (const file of incoming.slice(0, available)) {
      const id = fileId(file)
      if (existingIds.has(id)) continue
      existingIds.add(id)
      const isImage = file.type.startsWith('image/')
      const error =
        file.size > options.config.value.maxFileSize
          ? options.fileTooLargeMessage(file)
          : !matchesAccept(file, options.config.value.accept)
            ? options.fileTypeMessage(file)
            : undefined
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined
      if (previewUrl) ownedUrls.set(id, previewUrl)
      added.push({
        id,
        kind: isImage ? 'image' : 'file',
        label: file.name,
        mimeType: file.type || undefined,
        size: file.size,
        file,
        previewUrl,
        status: error ? 'error' : 'ready',
        error,
      })
    }
    if (!added.length) return
    commit([...items.value, ...added])
    options.onAdd([...added])
  }

  function remove(item: LcComposerContextItem) {
    const url = ownedUrls.get(item.id)
    if (url) {
      URL.revokeObjectURL(url)
      ownedUrls.delete(item.id)
    }
    commit(items.value.filter(candidate => candidate.id !== item.id))
    options.onRemove(item)
  }

  onUnmounted(() => {
    for (const url of ownedUrls.values()) URL.revokeObjectURL(url)
    ownedUrls.clear()
  })

  return { items, addFiles, remove }
}
