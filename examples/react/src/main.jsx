import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
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
import { LangEditor } from '@langeditor/react'
import './style.css'

function App() {
  const editorRef = useRef(null)
  const [value, setValue] = useState('<h1>AI launch brief</h1><p>Draft a product update with AI in context.</p>')
  const extensions = React.useMemo(() => {
    const uploadFiles = files => files.map(file => ({ src: URL.createObjectURL(file), alt: file.name }))
    return [
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
  }, [])

  return (
    <main className="react-example">
      <header>
        <p>Universal element · React adapter</p>
        <h1>React controls. Vue editor. One implementation.</h1>
        <p>Select text in the editor to use the AI menu. The ref still exposes focus and getValue.</p>
      </header>
      <LangEditor
        ref={editorRef}
        value={value}
        extensions={extensions}
        hideToolbar={false}
        hideMenubar={false}
        minHeight="720px"
        maxHeight="900px"
        onChange={({ value: nextValue }) => setValue(nextValue)}
        onAI={event => console.log('[AI]', event.type, event.delta || event.text || '')}
      />
      <button type="button" onClick={() => editorRef.current?.focus()}>
        Focus editor
      </button>
    </main>
  )
}

createRoot(document.querySelector('#root')).render(<App />)
