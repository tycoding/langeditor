<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LangEditor · JSP / Servlet</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: #f4f3ef;
        color: #1f1f1c;
      }

      body {
        max-width: 980px;
        margin: 0 auto;
        padding: 48px 24px;
      }

      main {
        display: grid;
        gap: 16px;
      }

      p {
        margin: 0;
        color: #6d6c65;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Universal element · JSP / Servlet</p>
      <h1>Use the same AI editor from a server-rendered page.</h1>
      <lang-editor
        id="editor"
        output="html"
        hide-toolbar="false"
        hide-menubar="false"
      ></lang-editor>
    </main>

    <script type="module">
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
      } from "<%= request.getContextPath() %>/assets/langeditor-element.es.js"
      import { ExportWord, ImportWord } from "<%= request.getContextPath() %>/assets/langeditor-plugin-docx.es.js"

      const editor = document.querySelector('#editor')

      editor.value = '<h1>Server-rendered product brief</h1><p>AI requests go through a Servlet proxy.</p>'
      editor.minHeight = '720px'
      editor.maxHeight = '900px'
      const uploadFiles = files => files.map(file => ({ src: URL.createObjectURL(file), alt: file.name }))
      editor.extensions = [
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
      editor.addEventListener('lc-change', event => {
        document.title = `Draft · ${String(event.detail.value).length} chars`
      })

      editor.addEventListener('lc-ai', event => {
        if (event.detail.type === 'complete') console.info('AI response ready for review')
      })
    </script>
  </body>
</html>
