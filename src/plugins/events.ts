import type { Editor as CoreEditor } from '@tiptap/core'

/**
 * Framework-neutral DOM event emitted when a document provider changes its
 * synchronization state. The event bubbles through Vue and Web Component
 * hosts, so adapters can expose the same lifecycle without knowing which
 * plugin owns the document.
 */
export const LC_DOCUMENT_SYNC_EVENT = 'lc-document-sync' as const

export interface LcDocumentSyncDetail {
  /** Stable plugin or provider identifier, for example `collaboration`. */
  source: string
  /** Whether the provider has completed its current synchronization cycle. */
  synced: boolean
}

export function dispatchEditorDocumentSync(editor: CoreEditor, detail: LcDocumentSyncDetail) {
  const target = editor.view?.dom
  if (editor.isDestroyed || !target || typeof CustomEvent === 'undefined') return
  target.dispatchEvent(
    new CustomEvent<LcDocumentSyncDetail>(LC_DOCUMENT_SYNC_EVENT, {
      detail,
      bubbles: true,
      composed: true,
    })
  )
}

declare global {
  interface HTMLElementEventMap {
    [LC_DOCUMENT_SYNC_EVENT]: CustomEvent<LcDocumentSyncDetail>
  }
}
