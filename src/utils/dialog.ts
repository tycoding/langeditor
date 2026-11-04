import type { Editor } from '@tiptap/core'

let dialogHostSequence = 0

/**
 * Return a selector for the editor that owns a dialog.
 *
 * Keeping the portal inside the editor preserves instance-scoped theme and
 * utility styles while still allowing the dialog to escape the content DOM.
 */
export function resolveDialogPortalTarget(editor: Editor): string | null {
  const host =
    editor.view.dom.closest<HTMLElement>('[data-langeditor]') ??
    (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-langeditor]') : null)
  if (!host) return null

  if (!host.dataset.lcDialogHost) {
    dialogHostSequence += 1
    host.dataset.lcDialogHost = `lc-dialog-host-${dialogHostSequence}`
  }

  return `[data-lc-dialog-host="${host.dataset.lcDialogHost}"]`
}
