<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useLocale } from '@/locales'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { AIModelConfig } from '@/extensions/AI/AI'

const props = defineProps<{
  open: boolean
  config: AIModelConfig
  portalTo?: string | HTMLElement
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [config: AIModelConfig]
}>()

const { t } = useLocale()
const form = reactive<AIModelConfig>({ model: '', baseURL: '', apiKey: '', organization: '' })

watch(
  () => props.config,
  value => Object.assign(form, value),
  { immediate: true, deep: true }
)

const hasApiKey = computed(() => Boolean(form.apiKey))

function close() {
  emit('update:open', false)
}

function save() {
  emit('save', { ...form })
  close()
}
</script>

<template>
  <Popover :open="open" @update:open="emit('update:open', $event)">
    <PopoverAnchor class="pointer-events-none absolute right-3 top-3 h-px w-px" />
    <PopoverContent :portal-to="portalTo" align="end" class="w-[min(340px,calc(100vw-2rem))] p-3">
      <div class="mb-3 grid gap-1">
        <h2 class="text-sm font-semibold">{{ t('editor.modelConfig.title') }}</h2>
        <p class="text-xs text-muted-foreground">{{ t('editor.modelConfig.description') }}</p>
      </div>

      <div class="grid gap-2.5">
        <label class="grid gap-1 text-xs font-medium">
          {{ t('editor.modelConfig.model') }}
          <Input
            v-model="form.model"
            autocomplete="off"
            class="h-8 text-xs"
            :placeholder="t('editor.modelConfig.modelPlaceholder')"
          />
        </label>
        <label class="grid gap-1 text-xs font-medium">
          {{ t('editor.modelConfig.baseURL') }}
          <Input
            v-model="form.baseURL"
            autocomplete="url"
            class="h-8 text-xs"
            :placeholder="t('editor.modelConfig.baseURLPlaceholder')"
            type="url"
          />
        </label>
        <label class="grid gap-1 text-xs font-medium">
          {{ t('editor.modelConfig.apiKey') }}
          <Input
            v-model="form.apiKey"
            autocomplete="off"
            class="h-8 text-xs"
            :placeholder="hasApiKey ? t('editor.modelConfig.apiKeyMasked') : t('editor.modelConfig.apiKeyPlaceholder')"
            type="password"
          />
          <span class="text-xs font-normal text-muted-foreground">{{ t('editor.modelConfig.apiKeyHint') }}</span>
        </label>
        <label class="grid gap-1 text-xs font-medium">
          {{ t('editor.modelConfig.organization') }}
          <Input v-model="form.organization" autocomplete="off" class="h-8 text-xs" />
        </label>
      </div>

      <div class="mt-3 flex justify-end gap-2">
        <Button class="h-8 px-3 text-xs" type="button" variant="outline" @click="close">{{ t('editor.close') }}</Button>
        <Button class="h-8 px-3 text-xs" type="button" @click="save">{{ t('editor.save') }}</Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
