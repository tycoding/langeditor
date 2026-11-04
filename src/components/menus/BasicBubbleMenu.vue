<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, unref } from 'vue'
import type { NodeSelection, Transaction } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { Separator } from '@/components/ui/separator'
import type { Editor, Extension } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { BaseKitOptions } from '@/extensions/BaseKit'
import type { BubbleTypeMenu } from './BasicBubble'
import { useLocale } from '@/locales'
import ActionButton from '@/components/actions/ActionButton.vue'
import { getLangEditorTippyOptions } from '@/utils/tippy'

interface Props {
  editor: Editor
  disabled?: boolean
  showComment?: boolean
  wordMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showComment: false,
  wordMode: false,
})
const emit = defineEmits<{
  comment: []
}>()

const { t } = useLocale()
const aiMenuOpen = ref(Boolean(props.editor.storage.AI?.open))

function syncAIVisibility({ transaction }: { transaction: Transaction }) {
  const open = transaction.getMeta('AI:open')
  if (typeof open === 'boolean') aiMenuOpen.value = open
}

props.editor.on('transaction', syncAIVisibility)
onBeforeUnmount(() => props.editor.off('transaction', syncAIVisibility))
const tippyOptions = reactive<Record<string, unknown>>(getLangEditorTippyOptions({
  maxWidth: 'auto',
  zIndex: 20,
  appendTo: 'parent',
  moveTransition: 'transform 0.15s ease-out',
}))

const nodeType = computed(() => {
  const selection = props.editor.state.selection as NodeSelection
  const isLink = props.editor.isActive('link')
  const isVideo = selection.node?.type.name === 'video'
  const isText = selection instanceof TextSelection
  if (isLink) return 'link'
  if (isVideo) return 'video'
  if (isText) return 'text'
  return undefined
})

const nodeMenus = computed(() => {
  const { extensions = [] } = props.editor.extensionManager
  const find = extensions.find(k => k.name === 'base-kit') as Extension<BaseKitOptions>
  if (!find) return {}

  const { button } = find.options?.bubble ?? {}

  if (!button) return {}

  const _button: BubbleTypeMenu = button({
    editor: props.editor,
    extension: find,
    t: unref(t),
  })

  return _button
})

const items = computed(() => {
  if (!nodeType.value) return []
  return unref(nodeMenus)?.[nodeType.value] ?? []
})
const canComment = computed(
  () => props.showComment && nodeType.value === 'text' && !props.editor.state.selection.empty
)
</script>
<template>
  <BubbleMenu
    v-show="(items.length || canComment) && !aiMenuOpen"
    :class="wordMode && 'z-[90]'"
    :editor="editor"
    :tippy-options="tippyOptions"
  >
    <div
      class="border px-3 py-2 transition-all select-none pointer-events-auto shadow-sm rounded-sm bg-background w-auto max-w-[calc(-68px_+_100vw)] overflow-x-auto"
    >
      <div class="flex items-center flex-nowrap whitespace-nowrap h-[26px] justify-start relative gap-0.5">
        <template v-for="(item, key) in items" :key="key">
          <!-- Divider -->
          <Separator v-if="item.type === 'divider'" orientation="vertical" class="mx-1 me-1 h-[16px]" />
          <!-- Buttons -->
          <component
            :is="item.component"
            v-else
            v-bind="item.componentProps"
            :editor="editor"
            :disabled="disabled || item.componentProps?.disabled"
          >
            <template v-for="(element, slotName) in item.componentSlots" :key="slotName" #[`${slotName}`]="values">
              <component :is="element" v-bind="values?.props" />
            </template>
          </component>
        </template>
        <template v-if="canComment">
          <Separator orientation="vertical" class="mx-1 me-1 h-[16px]" />
          <ActionButton
            :action="() => emit('comment')"
            :disabled="disabled"
            :tooltip="t('editor.word.comments.add')"
            icon="MessageSquarePlus"
          />
        </template>
      </div>
    </div>
  </BubbleMenu>
</template>
