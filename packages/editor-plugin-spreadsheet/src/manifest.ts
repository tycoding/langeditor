export const SPREADSHEET_PLUGIN_ID = '@langeditor/plugin-spreadsheet'

export const spreadsheetManifest = {
  id: SPREADSHEET_PLUGIN_ID,
  version: '1.1.4',
  coreRange: '^1.1.4',
  requires: [] as string[],
  conflicts: [] as string[],
  provides: ['document:spreadsheet', 'serializer:xlsx', 'serializer:csv'],
  enhances: ['document:page-layout', 'document:ai-context', 'document:operations'],
}
