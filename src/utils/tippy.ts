import type { Instance, Props as TippyProps } from 'tippy.js'

export const LANGEDITOR_TIPPY_THEME = 'langeditor'
export const LANGEDITOR_TIPPY_ATTRIBUTE = 'data-langeditor-editor'
export const LANGEDITOR_ROOT_ATTRIBUTE = 'data-langeditor'

/** Mark an editor-owned popper so host application Tippy styles stay scoped. */
export function markLangEditorTippy(instance: Instance) {
  // Portal content is normally appended to document.body. Carry the editor's
  // public namespace onto the popper so namespaced component utilities still
  // apply instead of falling back to identically named host utilities.
  instance.popper.setAttribute(LANGEDITOR_ROOT_ATTRIBUTE, '')
  instance.popper.setAttribute(LANGEDITOR_TIPPY_ATTRIBUTE, '')
  instance.popper
    .querySelector<HTMLElement>('.tippy-box')
    ?.setAttribute(LANGEDITOR_TIPPY_ATTRIBUTE, '')
}

/**
 * Apply editor-owned defaults without mutating Tippy's global defaults.
 * Callers can still override placement, portal, animation, and other geometry.
 */
export function getLangEditorTippyOptions(options: Partial<TippyProps> = {}): Partial<TippyProps> {
  const { onAfterUpdate, onCreate, onMount, ...rest } = options

  return {
    theme: LANGEDITOR_TIPPY_THEME,
    arrow: false,
    delay: 0,
    ...rest,
    onCreate(instance) {
      markLangEditorTippy(instance)
      onCreate?.(instance)
    },
    onMount(instance) {
      markLangEditorTippy(instance)
      onMount?.(instance)
    },
    onAfterUpdate(instance, partialProps) {
      markLangEditorTippy(instance)
      onAfterUpdate?.(instance, partialProps)
    },
  }
}
