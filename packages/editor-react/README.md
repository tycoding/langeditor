# @langeditor/react

Thin React bindings for the LangEditor Web Component. The editor UI and AI workflow remain implemented once in the main `@langeditor/core` package.

The package ships an ESM runtime (`index.js`) and explicit TypeScript declarations (`index.d.ts`). The declarations expose the full editor prop surface, typed AI lifecycle callbacks, and a typed ref to the underlying `LangEditorElement`.

```tsx
import { useState } from 'react'
import { LangEditor } from '@langeditor/react'
import { AI, BaseKit } from '@langeditor/core'

export function Composer() {
  const [value, setValue] = useState('<p>Draft with AI</p>')

  return (
    <LangEditor
      value={value}
      extensions={[BaseKit, AI]}
      onChange={({ value: nextValue }) => setValue(nextValue as string)}
      onAI={event => console.log(event.type, event.delta || event.text)}
    />
  )
}
```

The ref points to the underlying `LangEditorElement`, so imperative methods such as `focus()`, `getValue()`, `getEditor()`, `openAI()` and `closeAI()` remain available.

For a typed ref:

```tsx
import { useRef } from 'react'
import type { LangEditorElement } from '@langeditor/core/element'
import { LangEditor } from '@langeditor/react'

const editorRef = useRef<LangEditorElement>(null)

<LangEditor
  ref={editorRef}
  onAITextDelta={event => console.log(event.runId, event.text)}
/>
```
