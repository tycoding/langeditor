import { Extension, useLocale, type GeneralOptions } from '@langeditor/core'
import { useToast } from '@langeditor/core'
import { useFileDialog } from '@vueuse/core'
import { ActionButton } from '@langeditor/core'
import type { DocxImageAsset } from './docx'

export interface WordImageUploadResult {
  src: string
}

export interface ImportWordOptions extends GeneralOptions<ImportWordOptions> {
  /** Uploads imported DOCX images and returns their stable application URLs. */
  upload?: (files: File[]) => Promise<WordImageUploadResult[]>

  /** Maximum DOCX size accepted by the browser parser. */
  limit: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    importWord: {
      toggleImportWord: () => ReturnType
    }
  }
}

function replaceImageSources(content: any, assets: DocxImageAsset[], uploaded: WordImageUploadResult[]) {
  const byDataUrl = new Map(
    assets
      .map((asset, index) => [asset.dataUrl, uploaded[index]?.src])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  )
  const visit = (node: any) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      node.attrs.src = byDataUrl.get(node.attrs.src) || node.attrs.src
    }
    for (const child of node.content ?? []) visit(child)
  }
  visit(content)
}

export const ImportWord = Extension.create<ImportWordOptions>({
  name: 'importWord',

  addOptions() {
    return {
      ...this.parent?.(),
      upload: undefined,
      limit: 1024 * 1024 * 25,
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleImportWord(),
          disabled: !editor.can().setHorizontalRule(),
          icon: 'FileUp',
          tooltip: t('editor.importWord.tooltip'),
        },
      }),
    }
  },

  addCommands() {
    return {
      toggleImportWord:
        () =>
        ({ editor }) => {
          const { toast } = useToast()
          const { t } = useLocale()
          const { open, onChange } = useFileDialog({
            accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            reset: true,
            multiple: false,
          })

          open()
          onChange(async (files: FileList | null) => {
            const file = files?.[0]
            if (!file) return
            if (!file.name.toLowerCase().endsWith('.docx')) {
              toast({ title: t.value('editor.importWord.error'), variant: 'destructive' })
              return
            }
            if (file.size > this.options.limit) {
              toast({ title: t.value('editor.importWord.fileTooLarge'), variant: 'destructive' })
              return
            }

            try {
              const { parseDocx } = await import('./docx')
              const result = await parseDocx(file)
              const upload = this.options.upload
              if (upload && result.images.length) {
                const uploaded = await upload(result.images.map(asset => asset.file))
                replaceImageSources(result.content, result.images, uploaded)
              }
              editor.commands.setContent(result.content, { emitUpdate: true })
              editor.view.dispatch(editor.state.tr.setMeta('word-comments:import', result.comments))
              if (result.warnings.length) console.warn('[LangEditor] DOCX import warnings:', result.warnings)
              toast({ title: t.value('editor.importWord.success') })
            } catch (error) {
              console.error('Failed to import DOCX:', error)
              toast({ title: t.value('editor.importWord.error'), variant: 'destructive' })
            }
          })
          return false
        },
    }
  },
})

/** Lazily loads the DOCX parser for direct consumers. */
export async function parseDocx(...args: Parameters<(typeof import('./docx'))['parseDocx']>) {
  const module = await import('./docx')
  return module.parseDocx(...args)
}
