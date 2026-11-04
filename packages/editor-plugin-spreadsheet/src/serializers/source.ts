import type { LcDocumentSource, LcDocumentSourceDescriptor } from '@langeditor/core'
import type { SpreadsheetImportDiagnostic, SpreadsheetWorkbookSnapshot } from '../types'
import { importCsv } from './csv'
import { importXlsx } from './xlsx'

function isDescriptor(source: LcDocumentSource): source is LcDocumentSourceDescriptor {
  return Boolean(source && typeof source === 'object' && 'data' in source)
}

function isCsv(name: string, mimeType: string) {
  return /\.(csv|tsv|txt)$/i.test(name) || /(?:csv|tab-separated|text\/plain)/i.test(mimeType)
}

async function resolveSource(source: LcDocumentSource) {
  const descriptor = isDescriptor(source) ? source : { data: source }
  let data = descriptor.data
  let name = descriptor.name ?? (typeof File !== 'undefined' && data instanceof File ? data.name : '')
  let mimeType = descriptor.mimeType ?? (typeof Blob !== 'undefined' && data instanceof Blob ? data.type : '')
  if (data instanceof URL || (typeof data === 'string' && /^https?:\/\//i.test(data))) {
    const url = data instanceof URL ? data : new URL(data)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`)
    name ||= url.pathname.split('/').pop() ?? ''
    mimeType ||= response.headers.get('content-type') ?? ''
    data = await response.arrayBuffer()
  }
  return { data, name, mimeType }
}

export async function importDocumentSource(source: LcDocumentSource): Promise<{
  value: SpreadsheetWorkbookSnapshot
  diagnostics: SpreadsheetImportDiagnostic[]
}> {
  const { data, name, mimeType } = await resolveSource(source)
  if (typeof data === 'string') return importCsv(data, name || 'Workbook', /\.tsv$/i.test(name) ? '\t' : undefined)
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    if (isCsv(name, mimeType)) return importCsv(await data.text(), name || 'Workbook', /\.tsv$/i.test(name) ? '\t' : undefined)
    return importXlsx(await data.arrayBuffer(), name || 'Workbook')
  }
  const binary = data instanceof Uint8Array ? data : data as ArrayBuffer
  if (isCsv(name, mimeType)) {
    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary)
    return importCsv(new TextDecoder().decode(bytes), name || 'Workbook', /\.tsv$/i.test(name) ? '\t' : undefined)
  }
  return importXlsx(binary, name || 'Workbook')
}
