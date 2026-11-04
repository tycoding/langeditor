<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useHotkeys } from '@/hooks'
import type { Editor, Range } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { useLocale } from '@/locales'
import { getSelectionText } from '@/utils/content'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Icon } from '@/components/icons'
import { useFocus } from '@vueuse/core'

interface Props {
  editor: Editor
  disabled?: boolean
  containerRef: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  containerRef: undefined,
})

const emit = defineEmits(['update:modelValue', 'find', 'replace'])
const inputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(Boolean(props.editor.storage.findAndReplace.open))
const searchTerm = ref<string>('')
const replaceTerm = ref<string>('')
const caseSensitive = ref<boolean>(false)
const { t } = useLocale()

const { focused } = useFocus(inputRef)

const resultLength = computed(() => props.editor?.storage.findAndReplace?.results.length || 0)

const updateSearchReplace = (clearIndex: boolean = false) => {
  if (!props.editor) return

  if (clearIndex) props.editor.commands.resetIndex()

  props.editor.commands.setSearchTerm(searchTerm.value)
  props.editor.commands.setReplaceTerm(replaceTerm.value)
  props.editor.commands.setCaseSensitive(caseSensitive.value)
}
const goToSelection = () => {
  if (!props.editor) return
  const { results, resultIndex } = props.editor.storage.findAndReplace
  const position: number | Range = results[resultIndex]
  if (!position) return
  //@ts-ignore
  props.editor.commands.setTextSelection(position)
  const { node } = props.editor.view.domAtPos(props.editor.state.selection.anchor)
  node instanceof HTMLElement && node.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch(
  () => searchTerm.value.trim(),
  (val, oldVal) => {
    if (!val) clear()
    if (val !== oldVal) updateSearchReplace(true)
  }
)

watch(
  () => replaceTerm.value.trim(),
  (val, oldVal) => (val === oldVal ? null : updateSearchReplace())
)

watch(
  () => caseSensitive.value,
  (val, oldVal) => (val === oldVal ? null : updateSearchReplace(true))
)
watch(isOpen, async val => {
  if (val) {
    await nextTick()
    focused.value = true
    searchTerm.value = getSelectionText(props.editor) || ''
    bindEsc()
  } else {
    clear()
    unbindEsc()
  }
})
const replace = () => {
  props.editor.commands.replace()
  goToSelection()
}

const next = () => {
  props.editor.commands.nextSearchResult()
  goToSelection()
}

const previous = e => {
  e.preventDefault()
  props.editor.commands.previousSearchResult()
  goToSelection()
}

const clear = () => {
  searchTerm.value = replaceTerm.value = ''
  props.editor.commands.resetIndex()
}

const replaceAll = () => props.editor.commands.replaceAll()
function handleChange(e) {
  caseSensitive.value = e
}
onMounted(() => setTimeout(updateSearchReplace))

const { bind, unbind } = useHotkeys('ctrl+f,command+f', () => {
  if (!props.editor.storage.findAndReplace.open) props.editor.commands.toggleFindAndReplace()
})

const { bind: bindEsc, unbind: unbindEsc } = useHotkeys('escape', () => {
  if (props.editor.storage.findAndReplace.open) props.editor.commands.toggleFindAndReplace()
})

function handleTransaction({ transaction }: { transaction: Transaction }) {
  const open = transaction.getMeta('findAndReplace:open')
  if (typeof open === 'boolean') isOpen.value = open
}

props.editor.on('transaction', handleTransaction)

props.editor.on('focus', () => {
  bind()
})
props.editor.on('blur', () => {
  unbind()
})

onBeforeUnmount(() => props.editor.off('transaction', handleTransaction))
</script>

<template>
  <div
    v-if="isOpen"
    class="absolute right-3 top-3 z-40 grid w-[min(326px,calc(100%_-_24px))] gap-2 rounded-lg border border-border bg-background p-3 text-foreground shadow-[0_8px_24px_rgb(15_23_42_/_0.1)] max-[480px]:right-2 max-[480px]:top-2"
    role="dialog"
    :aria-label="t('editor.findAndReplace.find')"
  >
    <header class="flex min-h-[22px] items-center justify-between">
      <div class="flex items-center gap-[7px] text-xs">
        <Icon class="h-3.5 w-3.5 text-muted-foreground" name="DocSearch" />
        <strong>{{ t('editor.findAndReplace.find') }}</strong>
      </div>
      <button
        class="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-transparent text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground"
        type="button"
        @click="editor.commands.toggleFindAndReplace()"
      >
        <Icon class="h-3.5 w-3.5" name="Close" />
      </button>
    </header>

    <div class="grid gap-[5px]">
      <Label class="text-[10px] leading-none text-muted-foreground">{{ t('editor.findAndReplace.find') }}</Label>
      <div class="flex items-center gap-1.5">
        <div class="relative min-w-0 flex-1">
          <Input
            ref="inputRef"
            v-model="searchTerm"
            class="h-[30px] pr-[52px] text-[11px]"
            @keyup.enter="next"
          />
          <span class="pointer-events-none absolute right-2 top-0 inline-flex h-[30px] items-center text-[9px] text-muted-foreground">
            {{
              editor?.storage?.findAndReplace?.results.length
                ? editor?.storage?.findAndReplace?.resultIndex + 1
                : editor?.storage?.findAndReplace?.resultIndex
            }}
            /
            {{ editor?.storage?.findAndReplace?.results.length }}
          </span>
        </div>
        <div class="flex items-center gap-0.5">
          <button
            :aria-label="t('editor.findAndReplace.find')"
            class="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-transparent text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground"
            type="button"
            @click="previous"
          >
            <Icon class="h-3.5 w-3.5" name="ChevronUp" />
          </button>
          <button
            :aria-label="t('editor.findAndReplace.find')"
            class="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-transparent text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground"
            type="button"
            @click="next"
          >
            <Icon class="h-3.5 w-3.5" name="ChevronDown" />
          </button>
        </div>
      </div>
    </div>
    <div class="grid gap-[5px]">
      <Label class="text-[10px] leading-none text-muted-foreground">{{ t('editor.findAndReplace.replace') }}</Label>
      <Input v-model="replaceTerm" class="h-[30px] text-[11px]" />
    </div>

    <label class="flex items-center gap-[7px] text-[10px] text-muted-foreground">
      <Checkbox id="terms" :checked="caseSensitive" @update:checked="handleChange" />
      <span>{{ t('editor.findAndReplace.caseSensitive') }}</span>
    </label>

    <footer class="flex flex-wrap items-center justify-end gap-1.5 pt-0.5 max-[480px]:flex-wrap">
      <Button class="h-7 px-[9px] text-[10px]" :disabled="!resultLength" size="sm" type="button">{{ t('editor.findAndReplace.find') }}</Button>
      <Button class="h-7 px-[9px] text-[10px]" :disabled="!editor.isEditable || !resultLength" size="sm" variant="secondary" @click="replace">{{
        t('editor.findAndReplace.replace')
      }}</Button>
      <Button class="h-7 px-[9px] text-[10px]" :disabled="!editor.isEditable || !resultLength" size="sm" variant="secondary" @click="replaceAll">{{
        t('editor.findAndReplace.replaceAll')
      }}</Button>
    </footer>
  </div>
</template>
