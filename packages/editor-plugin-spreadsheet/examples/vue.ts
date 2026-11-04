import { createApp, ref } from 'vue'
import { LangEditor } from '@langeditor/core'
import type { SpreadsheetWorkbookSnapshot } from '@langeditor/plugin-spreadsheet'
import '@langeditor/core/style.css'
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'

createApp({
  setup() {
    const workbook = ref<SpreadsheetWorkbookSnapshot>()
    return { workbook }
  },
  template: '<LangEditor v-model="workbook" mode="spreadsheet" :min-height="680" />',
  components: { LangEditor },
}).mount('#app')
