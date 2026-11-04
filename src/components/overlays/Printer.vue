<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { useHotkeys } from '@/hooks'

interface Props {
  editor: Editor
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isPrinting = ref(false)
const srcdoc = ref('')

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 18mm 20mm; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #171717; background: #fff; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
    font-size: 11.5pt;
    line-height: 1.68;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  [data-print-content] {
    width: 100%;
    overflow-wrap: anywhere;
    border: 0;
    outline: 0;
    box-shadow: none;
  }
  [data-print-content] > :first-child { margin-top: 0 !important; }
  [data-print-content] > :last-child { margin-bottom: 0 !important; }
  p { margin: 0 0 0.78em; line-height: 1.68; }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.35em 0 0.5em;
    break-after: avoid-page;
    color: #111;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-weight: 650;
    line-height: 1.25;
  }
  h1 { font-size: 24pt; letter-spacing: -0.025em; }
  h2 { font-size: 18pt; letter-spacing: -0.015em; }
  h3 { font-size: 14.5pt; }
  h4 { font-size: 12.5pt; }
  h5, h6 { font-size: 11.5pt; }
  ul, ol { margin: 0.35em 0 0.9em; padding-left: 1.65em; }
  li { margin: 0.22em 0; padding-left: 0.18em; line-height: 1.58; }
  li > p { margin: 0.15em 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.15em 0 0.15em 1em;
    border-left: 2px solid #c9ccd1;
    color: #4b4d52;
  }
  pre {
    margin: 1em 0;
    padding: 12px 14px;
    border: 1px solid #e2e4e7;
    border-radius: 6px;
    background: #f7f7f8;
    font: 9.5pt/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  :not(pre) > code { padding: 0.08em 0.28em; border-radius: 3px; background: #f1f2f3; }
  table { width: 100%; margin: 1em 0; border-collapse: collapse; break-inside: avoid; }
  th, td { padding: 7px 9px; border: 1px solid #d7d9dc; text-align: left; vertical-align: top; }
  th { background: #f4f5f6; font-weight: 600; }
  img, video, iframe { max-width: 100%; height: auto; break-inside: avoid; }
  hr { margin: 1.4em 0; border: 0; border-top: 1px solid #d7d9dc; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  [data-type="taskList"] { padding-left: 0; list-style: none; }
  [data-type="taskItem"] { display: flex; align-items: flex-start; gap: 0.55em; }
  [data-type="taskItem"] > label { flex: 0 0 auto; padding-top: 0.16em; }
  [data-type="taskItem"] > div { min-width: 0; flex: 1; }
`

function generatePrintHTML(content: string): string {
  const language = document.documentElement.lang || 'zh-CN'
  return `<!doctype html>
    <html lang="${language}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>LangEditor</title>
        <style>${PRINT_STYLES}</style>
      </head>
      <body>
        <main data-print-content>${content}</main>
      </body>
    </html>`
}

function finishPrint() {
  props.editor.storage.printer.active = false
  isPrinting.value = false
  srcdoc.value = ''
  props.editor.view.dispatch(props.editor.state.tr.setMeta('printer:active', false))
}

function printLoadedDocument() {
  const iframeWindow = iframeRef.value?.contentWindow
  if (!iframeWindow) {
    finishPrint()
    return
  }

  try {
    iframeWindow.addEventListener('afterprint', finishPrint, { once: true })
    iframeWindow.focus()
    iframeWindow.print()
  } catch (error) {
    console.error('Failed to print the current editor:', error)
    finishPrint()
  }
}

function requestPrint() {
  if (props.disabled || isPrinting.value) return
  props.editor.commands.blur()
  srcdoc.value = generatePrintHTML(props.editor.getHTML())
  isPrinting.value = true
}

function handleTransaction({ transaction }: { transaction: Transaction }) {
  if (transaction.getMeta('printer:request')) requestPrint()
}

const { bind, unbind } = useHotkeys('ctrl+p,command+p', () => {
  if (!props.disabled) props.editor.commands.printDocument()
})

onMounted(() => {
  props.editor.on('transaction', handleTransaction)
  props.editor.on('focus', bind)
  props.editor.on('blur', unbind)
})

onUnmounted(() => {
  props.editor.off('transaction', handleTransaction)
  props.editor.off('focus', bind)
  props.editor.off('blur', unbind)
})
</script>

<template>
  <iframe
    v-if="isPrinting"
    ref="iframeRef"
    :srcdoc="srcdoc"
    class="absolute h-0 w-0 overflow-hidden border-0"
    title="Print document"
    @load="printLoadedDocument"
  />
</template>
