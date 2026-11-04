import { onUnmounted, ref, shallowRef, watch, type ComputedRef } from 'vue'
import { Extension, type Editor as CoreEditor, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { LcEditorProps, WordComment, WordHeaderFooterConfig } from '@/type'
import { LC_DOCUMENT_SYNC_EVENT } from '@/plugins'
import { hasExtension, isEqual } from '@/utils/utils'

type WordDocumentProps = Pick<
  LcEditorProps,
  'disabled' | 'wordComments' | 'wordHeaderFooter' | 'wordPageCount'
>

interface WordDocumentEmit {
  (event: 'update:wordHeaderFooter', value: WordHeaderFooterConfig): void
  (event: 'update:wordComments', value: WordComment[]): void
}

interface UseWordDocumentOptions {
  props: Readonly<WordDocumentProps>
  emit: WordDocumentEmit
  isWordMode: ComputedRef<boolean>
  contentAuthority: ComputedRef<'host' | 'plugin'>
}

export function useWordDocument({ props, emit, isWordMode, contentAuthority }: UseWordDocumentOptions) {
  const editorRef = shallowRef<CoreEditor | null>(null)
  const requestedPages = ref(Math.max(1, Math.floor(props.wordPageCount ?? 2)))
  const visiblePages = ref(requestedPages.value)
  const zoom = ref(100)
  const currentPage = ref(1)
  const headerFooterOpen = ref(false)
  const headerFooterSection = ref<'header' | 'footer'>('header')
  const headerFooter = ref<WordHeaderFooterConfig>({})
  const comments = ref<WordComment[]>([])
  const pendingComment = ref<{ from: number; to: number; quote: string } | null>(null)

  const commentsExtension = Extension.create({
    name: 'wordComments',
    addProseMirrorPlugins() {
      const key = new PluginKey('wordComments')
      return [
        new Plugin({
          key,
          props: {
            decorations(state) {
              const ranges = [
                ...comments.value,
                ...(pendingComment.value ? [{ ...pendingComment.value, id: 'pending' }] : []),
              ]
              const decorations = ranges.flatMap(comment => {
                const from = Math.max(1, Math.min(comment.from, state.doc.content.size))
                const to = Math.max(from, Math.min(comment.to, state.doc.content.size))
                if (from >= to) return []
                const className =
                  comment.id === 'pending'
                    ? 'rounded-sm border-b-2 border-dashed border-ring/70 bg-ring/18'
                    : 'rounded-sm border-b-2 border-ring/70 bg-ring/10'
                const marker = document.createElement('span')
                marker.className =
                  comment.id === 'pending'
                    ? 'ml-[3px] inline-block h-[5px] w-[5px] rounded-full align-text-top bg-primary'
                    : 'ml-[3px] inline-block h-[5px] w-[5px] rounded-full align-text-top bg-ring'
                marker.setAttribute('aria-hidden', 'true')
                return [
                  Decoration.inline(from, to, { class: className, 'data-comment-id': comment.id }),
                  Decoration.widget(to, () => marker, { side: 1 }),
                ]
              })
              return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty
            },
          },
        }),
      ]
    },
  })

  function getEditor() {
    return editorRef.value
  }

  function cloneHeaderFooter(config: WordHeaderFooterConfig) {
    return {
      header: config.header ? { ...config.header } : null,
      footer: config.footer ? { ...config.footer } : null,
    }
  }

  function pageAttrs(page: number, total: number) {
    const config = cloneHeaderFooter(
      Object.keys(headerFooter.value).length ? headerFooter.value : (props.wordHeaderFooter ?? {})
    )
    return { page, total, ...config }
  }

  function createEmptyPageContent(): JSONContent[] {
    return [{ type: 'paragraph' }]
  }

  function refreshVisiblePages() {
    const editor = getEditor()
    if (!editor || !isWordMode.value) return
    let count = 0
    editor.state.doc.forEach(node => {
      if (node.type.name === 'wordPage') count += 1
    })
    visiblePages.value = count || requestedPages.value
    currentPage.value = Math.min(currentPage.value, visiblePages.value)
  }

  function normalizePages(emitUpdate = false) {
    const editor = getEditor()
    if (!editor || !isWordMode.value || !editor.schema.nodes.wordPage) return
    if (contentAuthority.value === 'plugin') {
      refreshVisiblePages()
      return
    }

    const count = requestedPages.value
    const current = editor.getJSON()
    const topLevel = current.content ?? []
    const existingPages = topLevel.filter(node => node.type === 'wordPage')
    const hasOnlyPages = existingPages.length === topLevel.length && existingPages.length > 0
    let pageContents: JSONContent[][]

    if (hasOnlyPages) {
      pageContents = existingPages.map(page => (page.content?.length ? page.content : createEmptyPageContent()))
    } else {
      const source = topLevel.flatMap(node =>
        node.type === 'wordPage' ? (node.content?.length ? node.content : createEmptyPageContent()) : [node]
      )
      pageContents = Array.from({ length: count }, () => [])
      source.forEach((node, index) => {
        const target = Math.min(count - 1, Math.floor((index * count) / Math.max(1, source.length)))
        pageContents[target].push(node)
      })
      pageContents = pageContents.map(content => (content.length ? content : createEmptyPageContent()))
    }

    if (pageContents.length > count) {
      const overflow = pageContents.splice(count - 1)
      pageContents.push(overflow.flat())
    }
    while (pageContents.length < count) pageContents.push(createEmptyPageContent())

    const normalized: JSONContent = {
      type: 'doc',
      content: pageContents.map((content, index) => ({
        type: 'wordPage',
        attrs: pageAttrs(index + 1, count),
        content,
      })),
    }

    if (!isEqual(current, normalized)) editor.commands.setContent(normalized, { emitUpdate })
  }

  function syncPageAttributes() {
    const editor = getEditor()
    if (!editor || !isWordMode.value || !editor.schema.nodes.wordPage) return
    let transaction = editor.state.tr
    let page = 0
    editor.state.doc.forEach((node, position) => {
      if (node.type.name !== 'wordPage') return
      page += 1
      const attrs = pageAttrs(page, visiblePages.value)
      if (!isEqual(node.attrs, attrs)) transaction = transaction.setNodeMarkup(position, undefined, attrs)
    })
    if (transaction.docChanged) editor.view.dispatch(transaction)
  }

  function refreshCommentDecorations() {
    const editor = getEditor()
    if (!editor || editor.isDestroyed) return
    const storage = editor.storage as Record<string, any>
    storage.wordComments = { comments: comments.value.map(comment => ({ ...comment })) }
    if (!isWordMode.value) return
    editor.view.dispatch(editor.state.tr.setMeta('word-comments:update', true))
  }

  function openHeaderFooter(section: 'header' | 'footer') {
    headerFooterSection.value = section
    headerFooterOpen.value = true
  }

  function applyHeaderFooter(value: WordHeaderFooterConfig) {
    headerFooter.value = value
    syncPageAttributes()
    emit('update:wordHeaderFooter', value)
    headerFooterOpen.value = false
  }

  function beginComment() {
    const editor = getEditor()
    if (!editor || !isWordMode.value || editor.state.selection.empty) return
    const { from, to } = editor.state.selection
    const quote = editor.state.doc.textBetween(from, to, ' ').trim()
    if (!quote) return
    pendingComment.value = { from, to, quote }
    refreshCommentDecorations()
  }

  function addComment(content: string) {
    const pending = pendingComment.value
    if (!pending) return
    const comment: WordComment = {
      id: globalThis.crypto?.randomUUID?.() ?? `comment-${Date.now()}`,
      ...pending,
      content,
      createdAt: new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    }
    comments.value = [...comments.value, comment]
    emit('update:wordComments', comments.value)
    pendingComment.value = null
    refreshCommentDecorations()
  }

  function cancelComment() {
    pendingComment.value = null
    refreshCommentDecorations()
  }

  function removeComment(id: string) {
    comments.value = comments.value.filter(comment => comment.id !== id)
    emit('update:wordComments', comments.value)
    refreshCommentDecorations()
  }

  function selectComment(comment: WordComment) {
    const editor = getEditor()
    if (!editor) return
    const max = editor.state.doc.content.size
    const from = Math.min(Math.max(1, comment.from), max)
    const to = Math.min(Math.max(from, comment.to), max)
    editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run()
  }

  function updateCurrentPage(event: Event) {
    const host = event.currentTarget as HTMLElement
    const pages = Array.from(host.querySelectorAll<HTMLElement>('[data-type="word-page"]'))
    const focusPosition = (host.scrollTop + host.clientHeight * 0.35) / (zoom.value / 100)
    let activePage = 1
    pages.forEach((page, index) => {
      if (page.offsetTop <= focusPosition) activePage = index + 1
    })
    currentPage.value = Math.min(visiblePages.value, activePage)
  }

  function changeZoom(delta: number) {
    zoom.value = Math.min(200, Math.max(50, zoom.value + delta))
  }

  function setZoom(value: number) {
    zoom.value = Math.min(200, Math.max(50, value))
  }

  function togglePreview() {
    const editor = getEditor()
    if (editor && hasExtension(editor, 'preview')) editor.commands.togglePreview()
  }

  function handlePageClick(event: Event) {
    const target = event.target as HTMLElement | null
    let section = target?.closest<HTMLElement>('[data-word-region]')?.dataset.wordRegion
    const clickedPage = target?.closest<HTMLElement>('[data-type="word-page"]')
    if (!section && clickedPage && event instanceof MouseEvent) {
      const bounds = clickedPage.getBoundingClientRect()
      if (event.clientY - bounds.top < 70) section = 'header'
      else if (bounds.bottom - event.clientY < 70) section = 'footer'
    }
    if (section === 'header' || section === 'footer') openHeaderFooter(section)
  }

  function handleRegionEdit(event: Event) {
    const detail = (event as CustomEvent<{ section?: 'header' | 'footer' }>).detail
    if (detail?.section === 'header' || detail?.section === 'footer') openHeaderFooter(detail.section)
  }

  function handleDocumentSync() {
    queueMicrotask(() => {
      const editor = getEditor()
      if (!editor || editor.isDestroyed) return
      refreshVisiblePages()
      syncPageAttributes()
    })
  }

  function handleTransaction({ transaction }: { transaction: Transaction }) {
    const editor = getEditor()
    if (!editor) return
    if (transaction.docChanged && isWordMode.value) handleDocumentSync()

    const importedComments = transaction.getMeta('word-comments:import')
    if (Array.isArray(importedComments)) {
      comments.value = importedComments.map(comment => ({ ...comment }))
      emit('update:wordComments', comments.value)
      refreshCommentDecorations()
    }

    if (transaction.docChanged && comments.value.length) {
      comments.value = comments.value
        .map(comment => ({
          ...comment,
          from: transaction.mapping.map(comment.from, -1),
          to: transaction.mapping.map(comment.to, 1),
        }))
        .filter(comment => comment.from < comment.to)
      emit('update:wordComments', comments.value)
      queueMicrotask(refreshCommentDecorations)
    }
  }

  function attachEditor(editor: CoreEditor) {
    if (editorRef.value === editor) return
    detachEditor()
    editorRef.value = editor
    normalizePages(false)
    refreshVisiblePages()
    refreshCommentDecorations()
    editor.view.dom.addEventListener('click', handlePageClick)
    editor.view.dom.addEventListener('langeditor:word-region-edit', handleRegionEdit)
    editor.view.dom.addEventListener(LC_DOCUMENT_SYNC_EVENT, handleDocumentSync)
    editor.on('transaction', handleTransaction)
  }

  function detachEditor() {
    const editor = getEditor()
    if (!editor) return
    if (!editor.isDestroyed) {
      editor.view.dom.removeEventListener('click', handlePageClick)
      editor.view.dom.removeEventListener('langeditor:word-region-edit', handleRegionEdit)
      editor.view.dom.removeEventListener(LC_DOCUMENT_SYNC_EVENT, handleDocumentSync)
      editor.off('transaction', handleTransaction)
    }
    editorRef.value = null
  }

  watch(
    () => props.wordHeaderFooter,
    value => {
      headerFooter.value = value
        ? {
            header: value.header ? { ...value.header } : undefined,
            footer: value.footer ? { ...value.footer } : undefined,
          }
        : {}
      syncPageAttributes()
    },
    { immediate: true, deep: true }
  )

  watch(
    () => props.wordPageCount,
    value => {
      requestedPages.value = Math.max(1, Math.floor(value ?? 2))
      normalizePages(false)
    }
  )

  watch(
    () => props.wordComments,
    value => {
      comments.value = value?.map(comment => ({ ...comment })) ?? []
      refreshCommentDecorations()
    },
    { immediate: true, deep: true }
  )

  onUnmounted(detachEditor)

  return {
    addComment,
    applyHeaderFooter,
    attachEditor,
    beginComment,
    cancelComment,
    changeZoom,
    comments,
    commentsExtension,
    currentPage,
    detachEditor,
    headerFooter,
    headerFooterOpen,
    headerFooterSection,
    normalizePages,
    pendingComment,
    removeComment,
    selectComment,
    setZoom,
    togglePreview,
    updateCurrentPage,
    visiblePages,
    zoom,
  }
}
