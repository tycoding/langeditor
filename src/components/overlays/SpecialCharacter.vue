<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { Icon } from '@/components/icons'
import { useLocale } from '@/locales'
import { ScrollArea } from '@/components/ui/scroll-area'
import { allCategories, searchCharacters, type Character } from '@/extensions/SpecialCharacter/characters'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resolveDialogPortalTarget } from '@/utils/dialog'

interface Props {
  editor: Editor
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const { t } = useLocale()
const isOpen = ref(Boolean(props.editor.storage.specialCharacter.open))
const portalTarget = ref<string | null>(resolveDialogPortalTarget(props.editor))
const searchTerm = ref('')
const activeTab = ref('all')

// 当前显示的字符
const currentCharacters = computed(() => {
  const category = allCategories.find(cat => cat.name === activeTab.value)
  if (!category) return []

  if (searchTerm.value) {
    return searchCharacters(category.characters, searchTerm.value)
  }
  return category.characters
})

// 处理字符点击
function handleCharacterClick(char: Character) {
  try {
    props.editor.chain().insertContent(char.char).focus().run()
    setOpen(false)
  } catch (error) {
    console.error('Error inserting character:', error)
  }
}

// 处理搜索
function handleSearch(value: string | number) {
  searchTerm.value = String(value)
}

// 处理标签页切换
function handleTabChange(value: string | number) {
  activeTab.value = String(value)
  searchTerm.value = '' // 切换标签页时清空搜索
}

// 关闭对话框
function handleClose() {
  setOpen(false)
  searchTerm.value = ''
  activeTab.value = 'all'
}

// 监听对话框状态，重置状态
watch(isOpen, isOpen => {
  if (!isOpen) {
    searchTerm.value = ''
    activeTab.value = 'all'
  }
})

function setOpen(open: boolean) {
  if (open !== props.editor.storage.specialCharacter.open) props.editor.commands.toggleSpecialCharacter()
}

function handleTransaction({ transaction }: { transaction: Transaction }) {
  const open = transaction.getMeta('specialCharacter:open')
  if (typeof open === 'boolean') isOpen.value = open
}

props.editor.on('transaction', handleTransaction)
onMounted(() => {
  portalTarget.value = resolveDialogPortalTarget(props.editor)
})
onBeforeUnmount(() => props.editor.off('transaction', handleTransaction))
</script>

<template>
  <Dialog :open="isOpen" @update:open="setOpen">
    <DialogContent
      :portal-target="portalTarget ?? undefined"
      @close-auto-focus="e => e.preventDefault()"
      class="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90dvh]"
    >
      <DialogHeader class="p-6 pb-0">
        <DialogTitle>{{ t('editor.specialCharacter.title') }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('editor.specialCharacter.description') }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col h-full">
        <!-- 搜索框 -->
        <div class="px-6 pb-4">
          <div class="relative">
            <Icon
              name="DocSearch"
              class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"
            />
            <Input
              :placeholder="t('editor.specialCharacter.search.placeholder')"
              class="pl-10"
              :model-value="searchTerm"
              @update:model-value="handleSearch"
            />
          </div>
        </div>

        <!-- 标签页 -->
        <Tabs :model-value="activeTab" @update:model-value="handleTabChange" class="flex-1 flex flex-col">
          <TabsList class="grid mb-4 w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger v-for="category in allCategories" :key="category.name" :value="category.name" class="text-xs">
              {{ t(`editor.specialCharacter.categories.${category.name}`) }}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="category in allCategories"
            :key="category.name"
            :value="category.name"
            class="flex-1 mt-0"
          >
            <ScrollArea class="h-[400px] px-6">
              <TooltipProvider :delay-duration="0">
                <div class="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2">
                  <Tooltip :key="char.code" v-for="char in currentCharacters">
                    <TooltipTrigger>
                      <button
                        @click="handleCharacterClick(char)"
                        class="w-10 h-10 border rounded-md flex items-center justify-center hover:bg-accent hover:border-accent-foreground transition-colors"
                        :title="char.name"
                        :disabled="!editor.isEditable"
                      >
                        <span class="text-lg">{{ char.char }}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent :side-offset="8">{{ char.name }}</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>

              <!-- 无搜索结果 -->
              <div
                v-if="currentCharacters.length === 0"
                class="flex items-center justify-center h-32 text-muted-foreground"
              >
                <div class="text-center">
                  <Icon name="DocSearch" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p class="text-sm">{{ t('editor.slash.empty') }}</p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      <DialogFooter class="p-6 pt-0">
        <Button @click="handleClose">
          {{ t('editor.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* 自定义滚动条样式 */
:deep(.scrollbar) {
  width: 6px;
}

:deep(.scrollbar-track) {
  background: transparent;
}

:deep(.scrollbar-thumb) {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

:deep(.scrollbar-thumb:hover) {
  background: hsl(var(--muted-foreground) / 0.5);
}
</style>
