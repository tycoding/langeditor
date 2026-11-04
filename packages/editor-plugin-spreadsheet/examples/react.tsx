import { useState } from 'react'
import { LangEditor } from '@langeditor/react'
import type { SpreadsheetWorkbookSnapshot } from '@langeditor/plugin-spreadsheet'
import '@langeditor/core/element.css'
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'

export function SpreadsheetExample() {
  const [workbook, setWorkbook] = useState<SpreadsheetWorkbookSnapshot>()
  return (
    <LangEditor
      mode="spreadsheet"
      minHeight={680}
      value={workbook}
      onChange={({ value }) => setWorkbook(value as SpreadsheetWorkbookSnapshot)}
    />
  )
}
