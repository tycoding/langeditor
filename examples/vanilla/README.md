# Vanilla JS

Build the self-contained browser bundle from the repository root:

```bash
pnpm install
pnpm build:element
```

You can then open [`index.html`](./index.html) directly, including through a `file://` URL. It loads `../../lib/langeditor-element.umd.js`, which bundles the Vue runtime, injects the full editor styles, registers the element, and exposes the complete built-in extension surface used by this example. Running `pnpm build:lib` afterward will preserve this Element bundle.

For an npm/Vite application, use the ESM entry instead. DOCX support is an
optional package and is not included in the standalone core element bundle:

```js
import '@langeditor/core/element'
import { AI, BaseKit } from '@langeditor/core'
import '@langeditor/plugin-docx'
import { ExportWord, ImportWord } from '@langeditor/plugin-docx'
```
