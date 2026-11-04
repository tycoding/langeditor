import { Extension, type GeneralOptions } from '@langeditor/core'
import { ActionButton } from '@langeditor/core'
import type { ExportDocxOptions } from './docx'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    exportWord: {
      exportToWord: (fileName?: string) => ReturnType
    }
  }
}

export interface ExportWordOptions extends GeneralOptions<ExportWordOptions>, ExportDocxOptions {
  fileName: string
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

export const ExportWord = Extension.create<ExportWordOptions>({
  name: 'exportWord',

  addOptions() {
    return {
      ...this.parent?.(),
      fileName: 'document.docx',
      resolveImage: undefined,
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.exportToWord(),
          icon: 'FileDown',
          tooltip: t('editor.exportWord.tooltip'),
        },
      }),
    }
  },

  addCommands() {
    return {
      exportToWord:
        (fileName?: string) =>
        ({ editor }) => {
          void Promise.all([import('docx'), import('./docx')])
            .then(async ([{ Packer }, { createDocxDocument }]) =>
              Packer.toBlob(await createDocxDocument(editor, this.options))
            )
            .then(blob => {
              if (!blob.size) throw new Error('The Word document is empty')
              downloadBlob(blob, fileName || this.options.fileName)
            })
            .catch(error => console.error('Failed to export Word document:', error))
          return true
        },
    }
  },
})

/**
 * Lazily loads the DOCX serializer for consumers that need direct access.
 * Keeping this wrapper async prevents Word dependencies from entering the
 * editor's initial bundle.
 */
export async function createDocxDocument(...args: Parameters<(typeof import('./docx'))['createDocxDocument']>) {
  const module = await import('./docx')
  return module.createDocxDocument(...args)
}
