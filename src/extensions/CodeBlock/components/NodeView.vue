<template>
  <node-view-wrapper :id="node.attrs.id" class="my-4" data-code-block-node>
    <div
      ref="containerRef"
      :class="`relative ${isDark ? 'atom-one-dark' : 'vs-code-light'} w-full overflow-hidden rounded-sm outline-1 outline-solid outline-border outline`"
    >
      <div
        v-if="editor.isEditable"
        class="z-10 flex min-h-9 flex-wrap items-center justify-between gap-1 border-b bg-background px-1.5 py-1 text-foreground"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 px-1.5">
          <span
            class="truncate font-mono text-[11px] font-medium text-muted-foreground"
            :aria-label="languageLabel"
            :title="languageLabel"
          >
            {{ languageLabel }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  :aria-label="t('editor.codeblock.copy')"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-40"
                  :disabled="!code"
                  type="button"
                  @click="copyCode"
                >
                  <Icon class="h-4 w-4" name="Copy" />
                </button>
              </TooltipTrigger>
              <TooltipContent :side-offset="8">{{ t('editor.codeblock.copy') }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  :aria-pressed="Boolean(node.attrs.lineNumbers)"
                  :aria-label="t('editor.codeblock.lineNumbers')"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
                  type="button"
                  @click="toggleLineNumbers"
                >
                  <Icon class="h-4 w-4" name="List" />
                </button>
              </TooltipTrigger>
              <TooltipContent :side-offset="8">{{ t('editor.codeblock.lineNumbers') }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

        </div>
      </div>
    </div>
  </node-view-wrapper>
</template>

<script lang="ts" setup>
import 'prism-code-editor/layout.css'
import './theme.css'

import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import type { PrismEditor } from 'prism-code-editor'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocale } from '@/locales'
import { useTheme } from '@/hooks/useTheme'
import { Icon } from '@/components/icons'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps(nodeViewProps)

const { t } = useLocale()

const containerRef = ref(null)

const { isDark } = useTheme()
const code = ref(props.node.attrs.code || props.node.textContent || '')
let codeEditor = ref<PrismEditor | null>(null)

const languages = [
  { value: 'plaintext', label: 'plaintext' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'php', label: 'PHP' },
]

const languageLoaders: Record<string, () => Promise<unknown>> = {
  bash: () => import('prism-code-editor/prism/languages/bash'),
  css: async () => {
    await import('prism-code-editor/prism/languages/css')
    await import('prism-code-editor/prism/languages/css-extras')
  },
  html: () => import('prism-code-editor/prism/languages/markup'),
  java: () => import('prism-code-editor/prism/languages/java'),
  sql: () => import('prism-code-editor/prism/languages/sql'),
  cpp: () => import('prism-code-editor/prism/languages/cpp'),
  go: () => import('prism-code-editor/prism/languages/go'),
  javascript: async () => {
    await import('prism-code-editor/prism/languages/javascript')
    await import('prism-code-editor/prism/languages/js-templates')
  },
  jsx: () => import('prism-code-editor/prism/languages/jsx'),
  python: () => import('prism-code-editor/prism/languages/python'),
  rust: () => import('prism-code-editor/prism/languages/rust'),
  json: () => import('prism-code-editor/prism/languages/json'),
  typescript: () => import('prism-code-editor/prism/languages/typescript'),
  tsx: () => import('prism-code-editor/prism/languages/tsx'),
  yaml: () => import('prism-code-editor/prism/languages/yaml'),
  markdown: () => import('prism-code-editor/prism/languages/markdown'),
  php: () => import('prism-code-editor/prism/languages/php'),
}

const languageLabel = computed(
  () =>
    languages.find(language => language.value === props.node.attrs.language)?.label ||
    props.node.attrs.language ||
    'plaintext'
)

async function loadLanguage(language: string) {
  await languageLoaders[language]?.()
}

const copyCode = () => {
  if (code.value) {
    navigator.clipboard
      .writeText(code.value)
      .then(() => {
        console.log('代码已复制到剪贴板')
      })
      .catch(err => {
        console.error('复制失败:', err)
      })
  }
}

const toggleLineNumbers = () => {
  props.updateAttributes({
    lineNumbers: !props.node.attrs.lineNumbers,
  })
}

const validateAndUpdateLanguage = (attrs: any) => {
  const validatedAttrs = { ...attrs }
  if (validatedAttrs.language && !languages.some(lang => lang.value === validatedAttrs.language)) {
    validatedAttrs.language = 'plaintext'
    props.updateAttributes({
      language: 'plaintext',
    })
  }

  return validatedAttrs
}

onMounted(async () => {
  const attrs = validateAndUpdateLanguage(props.node.attrs)
  await loadLanguage(attrs.language || 'plaintext')
  if (!containerRef.value) return

  // Keep the Tiptap NodeView synchronous while loading the editor runtime only
  // when a code block is actually mounted. This preserves stable ProseMirror
  // DOM ownership and keeps code-editing dependencies out of lightweight entry points.
  const [editorModule, commandsModule, cursorModule, guidesModule, bracketsModule, matchBracketsModule, matchTagsModule] =
    await Promise.all([
      import('prism-code-editor'),
      import('prism-code-editor/commands'),
      import('prism-code-editor/cursor'),
      import('prism-code-editor/guides'),
      import('prism-code-editor/highlight-brackets'),
      import('prism-code-editor/match-brackets'),
      import('prism-code-editor/match-tags'),
    ])

  if (!containerRef.value) return
  const { createEditor } = editorModule
  const { defaultCommands, editHistory } = commandsModule
  const { cursorPosition } = cursorModule
  const { indentGuides } = guidesModule
  const { highlightBracketPairs } = bracketsModule
  const { matchBrackets } = matchBracketsModule
  const { matchTags } = matchTagsModule

  codeEditor.value = createEditor(containerRef.value, {
    readOnly: !props.editor.isEditable,
    language: attrs.language || 'plaintext',
    tabSize: attrs.tabSize ?? 2,
    lineNumbers: attrs.lineNumbers ?? true,
    value: code.value,
    rtl: false,
    onUpdate(value) {
      if (value === code.value) return
      code.value = value
      props.updateAttributes({ code: value })
    },
  })
  codeEditor.value.addExtensions(
    matchBrackets(),
    matchTags(),
    indentGuides(),
    highlightBracketPairs(),
    cursorPosition(),
    defaultCommands(),
    editHistory()
  )

  if (props.node.attrs.shouldFocus) {
    nextTick(() => {
      codeEditor.value?.textarea.focus()
      props.updateAttributes({
        shouldFocus: false,
      })
    })
  }
})
onBeforeUnmount(() => {
  props.editor.off('update', syncEditable)
  codeEditor.value?.remove()
})

function syncEditable() {
  codeEditor.value?.setOptions({ readOnly: !props.editor.isEditable })
}

props.editor.on('update', syncEditable)
watch(
  () => [props.node.attrs.language, props.node.attrs.lineNumbers, props.node.attrs.tabSize],
  async () => {
    const attrs = validateAndUpdateLanguage(props.node.attrs)
    await loadLanguage(attrs.language || 'plaintext')
    codeEditor.value?.setOptions(attrs)
  }
)
</script>

<style>
@reference "../../../styles/index.css";
.prism-code-editor {
  max-height: 560px;
  font-size: 14px;
  textarea {
    @apply caret-primary;
  }
  textarea[aria-readonly='true'] {
    caret-color: transparent;
  }
}
</style>
