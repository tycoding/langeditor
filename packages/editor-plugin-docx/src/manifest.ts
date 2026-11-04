export const DOCX_PLUGIN_ID = '@langeditor/plugin-docx'

export const docxManifest = {
  id: DOCX_PLUGIN_ID,
  version: '1.0.0',
  coreRange: '>=1.1.0 <2.0.0',
  requires: [] as string[],
  conflicts: [] as string[],
  provides: ['serializer:docx', 'import:docx', 'export:docx'],
  enhances: ['document:word-comments', 'document:word-pages'],
}
