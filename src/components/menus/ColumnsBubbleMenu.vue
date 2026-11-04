<script setup lang="ts">
import { sticky } from 'tippy.js'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { isActive } from '@tiptap/core'
import ActionButton from '@/components/actions/ActionButton.vue'
import { ColumnLayout } from '@/extensions/MultiColumn'
import { getRenderContainer } from '@/utils/getRenderContainer'
import { useLocale } from '@/locales'
import { getLangEditorTippyOptions } from '@/utils/tippy'

interface Props {
  editor: Editor
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const { t } = useLocale()

const shouldShow = ({ editor }) => {
  return isActive(editor.view.state, 'columns')
}
// 获取参考元素的位置
const getReferenceClientRect = () => {
  const renderContainer = getRenderContainer(props.editor, 'columns')
  const rect = renderContainer?.getBoundingClientRect() || new DOMRect(-1000, -1000, 0, 0)

  return rect
}

const onDelete = () => {
  props.editor.chain().focus().deleteNode('columns').run()
}

const tippyOptions = getLangEditorTippyOptions({
  offset: [0, 8],
  getReferenceClientRect,
  plugins: [sticky],
  sticky: 'popper',
})
</script>

<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="columns"
    :shouldShow="shouldShow"
    :updateDelay="0"
    :tippy-options="tippyOptions"
  >
    <div class="p-2 bg-background rounded-lg shadow-sm border">
      <div class="flex gap-1 items-center">
        <ActionButton
          icon="Trash"
          :tooltip="t('editor.remove')"
          :action="onDelete"
          :isActive="() => editor.isActive('columns', { layout: ColumnLayout.SidebarLeft })"
          :tooltip-options="{ sideOffset: 15 }"
        />
      </div>
    </div>
  </BubbleMenu>
</template>
