# @langeditor/plugin-spreadsheet

Open-source spreadsheet mode for LangEditor. It uses IronCalc for formula
calculation and keeps XLSX/CSV code behind the document surface's dynamic import.

The built-in toolbar supports font family and size, bold/italic/underline,
text and fill colors, alignment, wrapping, merged cells, row/column insertion,
worksheet creation, and clearing cell formatting. These changes are persisted in
the workbook snapshot and included in XLSX export.

Double-click a worksheet tab to rename it. Press Enter or move focus away to
save, and press Escape to cancel. Worksheet renames use the same validated
document-operation path as toolbar, AI, collaboration, and host changes.

## Install

```bash
pnpm add @langeditor/core @langeditor/plugin-spreadsheet
```

```ts
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'
```

## Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { LangEditor } from '@langeditor/core'
import type { SpreadsheetWorkbookSnapshot } from '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'

const workbook = ref<SpreadsheetWorkbookSnapshot>()
const source = ref<File>()
</script>

<template>
  <LangEditor
    v-model="workbook"
    :document-source="source"
    mode="spreadsheet"
    :min-height="680"
  />
</template>
```

The same `mode`, `documentSource`, `lc-session-ready`, and `getSession()` contract
works through `@langeditor/core/element` and the React adapter.

Formatting and merge commands also use the public document-operation path, so AI,
collaboration, and host integrations do not need to mutate grid DOM:

```ts
await session.applyOperations([
  { type: 'spreadsheet.set-style', payload: { font: { bold: true, size: 14 } } },
  { type: 'spreadsheet.rename-sheet', payload: { name: 'Budget 2027' } },
  { type: 'spreadsheet.merge-cells' },
])
```

Programmatic serializers are asynchronous so importing the registration entry
does not eagerly load XLSX or CSV code:

```ts
import { exportSpreadsheet, importSpreadsheet } from '@langeditor/plugin-spreadsheet'

const { value, diagnostics } = await importSpreadsheet(file)
const xlsx = await exportSpreadsheet(value, 'xlsx')
```

## Supported input

- `.xlsx`, `.xlsm` without macro execution, and `.ods` where the serializer can
  read the workbook;
- `.csv`, `.tsv`, and plain delimited text;
- `SpreadsheetWorkbookSnapshot` through `v-model`;
- URL, File, Blob, ArrayBuffer, or Uint8Array through `documentSource`.

See [PRD.md](./PRD.md) for fidelity limits and failure behavior. The package is
MIT and contains no commercial-license dependency.
