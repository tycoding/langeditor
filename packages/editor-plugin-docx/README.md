# @langeditor/plugin-docx

DOCX import and export for LangEditor. The plugin keeps `docx`,
`prosemirror-docx`, and the DOCX parser out of the core editor bundle. Importing
the package registers the extensions with the editor plugin runtime; the parser
and serializer are still loaded only when the corresponding command is used.

## Install

```bash
pnpm add @langeditor/core @langeditor/plugin-docx
```

```ts
import '@langeditor/plugin-docx'
import { BaseKit, LangEditor } from '@langeditor/core'
```

With the side-effect registration enabled, `LangEditor` adds the Word actions
automatically. To configure image uploads or export image resolution, pass
plugin options through `pluginOptions`:

```vue
<LangEditor
  v-model="content"
  :plugin-options="{
    docx: {
      importWord: { upload: uploadImages },
      exportWord: { resolveImage: resolveImage },
    },
  }"
/>
```

The extensions and serializers are also available for explicit composition:

```ts
import {
  ExportWord,
  ImportWord,
  createDocxDocument,
  parseDocx,
} from '@langeditor/plugin-docx'

const extensions = [
  ImportWord.configure({ spacer: true }),
  ExportWord,
]
```

`ImportWord` preserves supported text, headings, lists, tables, links, images,
and Word comments. Unsupported structures produce diagnostics instead of being
silently dropped. `ExportWord` serializes ordinary editor content and Word page
documents, including comments and registered fallback representations.

The plugin is MIT licensed. It requires `@langeditor/core ^1.1.5` and
does not add any commercial capability or license requirement.
