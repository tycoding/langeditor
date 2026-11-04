export const SPREADSHEET_PLUGIN_ID = '@langeditor/plugin-spreadsheet'

export const spreadsheetManifest = {
  id: SPREADSHEET_PLUGIN_ID,
  version: '0.1.0',
  coreRange: '>=1.0.0 <2.0.0',
  requires: [] as string[],
  conflicts: [] as string[],
  provides: ['document:spreadsheet', 'serializer:xlsx', 'serializer:csv'],
  enhances: ['document:page-layout', 'document:ai-context', 'document:operations'],
}
