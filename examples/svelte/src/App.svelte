<script>
  import { onMount } from 'svelte'
  import {
    AI,
    BaseKit,
    Blockquote,
    Bold,
    BulletList,
    Chart,
    Clear,
    Code,
    CodeBlock,
    Color,
    Columns,
    FindAndReplace,
    FontFamily,
    FontSize,
    FormatPainter,
    Fullscreen,
    Heading,
    Highlight,
    History,
    HorizontalRule,
    Iframe,
    Image,
    ImageUpload,
    Indent,
    Italic,
    LineHeight,
    Link,
    MoreMark,
    OrderedList,
    Preview,
    Printer,
    SlashCommand,
    SourceCode,
    SpecialCharacter,
    Strike,
    SubAndSuperScript,
    Table,
    TaskList,
    TextAlign,
    Toc,
    Underline,
    Video,
    VideoUpload,
    WordPage,
  } from '@langeditor/core'
  import { ExportWord, ImportWord } from '@langeditor/plugin-docx'
  import '@langeditor/core/element'

  let editor
  let eventLabel = 'Ready for an AI request.'
  const uploadFiles = files => files.map(file => ({ src: URL.createObjectURL(file), alt: file.name }))
  const extensions = [
    BaseKit.configure({ placeholder: { showOnlyCurrent: true }, characterCount: { limit: 50000 } }),
    History,
    Columns,
    FormatPainter,
    Clear,
    Heading.configure({ spacer: true }),
    FontSize,
    FontFamily,
    Bold,
    Italic,
    Underline,
    Strike,
    SubAndSuperScript,
    MoreMark,
    Color.configure({ spacer: true }),
    Highlight,
    BulletList,
    OrderedList,
    TextAlign.configure({ types: ['heading', 'paragraph', 'image'], spacer: true }),
    Indent,
    LineHeight,
    TaskList.configure({ spacer: true, taskItem: { nested: true } }),
    Link,
    Image,
    ImageUpload.configure({ upload: file => Promise.resolve(URL.createObjectURL(file)) }),
    Video,
    VideoUpload.configure({ upload: uploadFiles }),
    Blockquote,
    SlashCommand,
    HorizontalRule,
    CodeBlock,
    Table.configure({ spacer: true }),
    Chart,
    Code,
    ImportWord.configure({ upload: uploadFiles, spacer: true }),
    ExportWord,
    Printer,
    SpecialCharacter,
    Fullscreen.configure({ spacer: true }),
    SourceCode,
    Preview,
    FindAndReplace.configure({ spacer: true }),
    Iframe,
    Toc,
    WordPage,
    AI,
  ]

  onMount(() => {
    editor.value = '<h1>Svelte AI brief</h1><p>Select text or open document Agent from the element API.</p>'
    editor.extensions = extensions
    editor.hideToolbar = false
    editor.hideMenubar = false
    editor.minHeight = '720px'
    editor.maxHeight = '900px'
  })

  function handleAI(event) {
    if (event.detail.type === 'delta') eventLabel = `AI streaming: ${event.detail.text.length} chars`
    if (event.detail.type === 'complete') eventLabel = 'AI response ready for review.'
  }
</script>

<main>
  <p>Universal element · Svelte</p>
  <h1>Keep framework code outside the editor.</h1>
  <lang-editor
    bind:this={editor}
    hide-toolbar="false"
    hide-menubar="false"
    on:lc-ai={handleAI}
  ></lang-editor>
  <p aria-live="polite">{eventLabel}</p>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 48px 24px;
    background: #f4f3ef;
    color: #1f1f1c;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  main {
    display: grid;
    gap: 16px;
    max-width: 980px;
    margin: 0 auto;
  }

  p {
    margin: 0;
    color: #6d6c65;
  }
</style>
