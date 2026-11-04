import { registerEditorPlugin, registerLocaleMessages } from '@langeditor/core'
import SpreadsheetStatus from './components/SpreadsheetStatus.vue'
import SpreadsheetToolbar from './components/SpreadsheetToolbar.vue'
import en from './locales/en'
import zh from './locales/zh'
import { spreadsheetManifest } from './manifest'

registerLocaleMessages('zhHans', zh)
registerLocaleMessages('en', en)

export const unregisterSpreadsheetPlugin = registerEditorPlugin({
  ...spreadsheetManifest,
  surfaces: [
    {
      mode: 'spreadsheet',
      capabilities: [
        'selection:range',
        'operations',
        'ai-context',
        'page-layout',
        'import:xlsx',
        'import:csv',
        'export:xlsx',
        'export:csv',
      ],
      minHeight: 640,
      load: () => import('./components/SpreadsheetSurface.vue'),
    },
  ],
  create: () => ({}),
  createDocument: ({ session }) => {
    if (session.kind !== 'spreadsheet') return {}
    return {
      ui: [
        {
          id: 'spreadsheet-toolbar',
          placement: 'toolbar',
          component: SpreadsheetToolbar,
          props: { session },
          order: 10,
        },
        {
          id: 'spreadsheet-status',
          placement: 'statusbar-left',
          component: SpreadsheetStatus,
          props: { session },
          order: 10,
        },
      ],
    }
  },
})
