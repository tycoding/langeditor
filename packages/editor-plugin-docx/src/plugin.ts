import {
  registerEditorPlugin,
  type LcEditorPluginDefinition,
  type LcPluginContext,
} from '@langeditor/core'
import { ExportWord } from './extensions/ExportWord'
import type { ExportWordOptions } from './extensions/ExportWord'
import { ImportWord } from './extensions/ImportWord'
import type { ImportWordOptions } from './extensions/ImportWord'
import { docxManifest } from './manifest'

export interface DocxPluginOptions {
  importWord?: Partial<ImportWordOptions>
  exportWord?: Partial<ExportWordOptions>
}

function createDocxExtensions(options: DocxPluginOptions = {}) {
  return [
    ImportWord.configure(options.importWord ?? {}),
    ExportWord.configure(options.exportWord ?? {}),
  ]
}

export const unregisterDocxPlugin = registerEditorPlugin({
  ...docxManifest,
  create: ({ options }: LcPluginContext) => ({
    extensions: createDocxExtensions((options.docx ?? {}) as DocxPluginOptions),
  }),
} satisfies LcEditorPluginDefinition)

export { createDocxExtensions }
