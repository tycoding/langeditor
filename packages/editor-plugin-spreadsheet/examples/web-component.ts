import '@langeditor/core/element'
import '@langeditor/core/element.css'
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'
import type { LangEditorElement } from '@langeditor/core/element'

const editor = document.querySelector<LangEditorElement>('lang-editor')
if (editor) {
  editor.mode = 'spreadsheet'
  editor.minHeight = 680
  editor.addEventListener('lc-session-ready', event => {
    const session = (event as CustomEvent).detail.session
    console.info('Spreadsheet session ready', session.id)
  })
}
