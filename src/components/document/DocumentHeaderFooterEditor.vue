<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { useLocale } from '@/locales'
import type { LcDocumentPageLayout, LcDocumentPageRegion } from '@/plugins'

const props = defineProps<{
  open: boolean
  modelValue: LcDocumentPageLayout
  section: 'header' | 'footer'
}>()

const emit = defineEmits<{
  close: []
  apply: [value: LcDocumentPageLayout]
  'update:section': [section: 'header' | 'footer']
}>()

type NormalizedRegion = Required<Pick<LcDocumentPageRegion, 'enabled' | 'left' | 'center' | 'right' | 'alignment' | 'firstPage' | 'showPageNumber'>> &
  Pick<LcDocumentPageRegion, 'metadata'>

interface NormalizedLayout extends Omit<LcDocumentPageLayout, 'header' | 'footer'> {
  header: NormalizedRegion
  footer: NormalizedRegion
}

const { t } = useLocale()
const alignments = ['left', 'center', 'right'] as const
const draft = ref<NormalizedLayout>(normalize({}))

function normalizeRegion(value?: LcDocumentPageRegion): NormalizedRegion {
  return {
    enabled: value?.enabled ?? false,
    left: value?.left ?? '',
    center: value?.center ?? '',
    right: value?.right ?? '',
    alignment: value?.alignment ?? 'left',
    firstPage: value?.firstPage ?? true,
    showPageNumber: value?.showPageNumber ?? false,
    metadata: value?.metadata,
  }
}

function normalize(value: LcDocumentPageLayout): NormalizedLayout {
  return {
    ...value,
    header: normalizeRegion(value.header),
    footer: normalizeRegion(value.footer),
  }
}

watch(
  () => [props.open, props.modelValue] as const,
  ([open]) => {
    if (open) draft.value = normalize(props.modelValue)
  },
  { immediate: true, deep: true }
)

const activeSection = computed(() => draft.value[props.section])

function save() {
  emit('apply', {
    ...draft.value,
    header: { ...draft.value.header },
    footer: { ...draft.value.footer },
  })
}
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-none absolute inset-0 z-[80] flex justify-end bg-[linear-gradient(to_left,rgb(15_23_42_/_0.05),transparent_48%)]"
    role="dialog"
    :aria-label="t('editor.document.headerFooter.title')"
  >
    <div class="pointer-events-auto flex h-full w-[min(390px,calc(100%_-_28px))] flex-col border-l border-border bg-background text-foreground shadow-[-12px_0_32px_rgb(15_23_42_/_0.09)]">
      <header class="flex min-h-16 items-center justify-between gap-3 border-b border-border px-[18px] py-2.5 pr-3.5">
        <div class="grid gap-0.5">
          <span class="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{{ t('editor.document.headerFooter.configure') }}</span>
          <strong class="text-sm font-semibold">{{ t('editor.document.headerFooter.title') }}</strong>
        </div>
        <button
          class="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          :aria-label="t('editor.close')"
          type="button"
          @click="emit('close')"
        >
          <Icon name="Close" class="h-4 w-4" />
        </button>
      </header>

      <div class="grid grid-cols-2 gap-1 border-b border-border p-2" role="tablist">
        <button
          v-for="item in ['header', 'footer'] as const"
          :key="item"
          :aria-selected="section === item"
          :class="[
            'h-8 rounded-[5px] text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            section === item && 'bg-accent text-foreground',
          ]"
          role="tab"
          type="button"
          @click="emit('update:section', item)"
        >
          {{ t(`editor.document.headerFooter.${item}`) }}
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] py-4">
        <label class="flex items-center justify-between gap-[18px]">
          <span class="grid gap-[3px]">
            <strong class="text-[11px] font-semibold text-foreground">{{ t('editor.document.headerFooter.enable') }}</strong>
            <small class="text-[9px] leading-[1.45] text-muted-foreground">{{ t('editor.document.headerFooter.enableHint') }}</small>
          </span>
          <input
            v-model="activeSection.enabled"
            class="h-[18px] w-[34px] flex-none cursor-pointer appearance-none rounded-full bg-muted outline-none transition-colors before:my-0.5 before:ml-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:bg-background before:shadow-[0_0_0_1px_hsl(var(--foreground)/.12)] before:transition-transform before:content-[''] checked:bg-primary checked:before:translate-x-4 focus-visible:ring-2 focus-visible:ring-ring"
            type="checkbox"
          />
        </label>

        <div class="grid gap-2.5">
          <label v-for="position in ['left', 'center', 'right'] as const" :key="position" class="grid gap-2">
            <span class="text-[11px] font-semibold text-foreground">{{ t(`editor.document.headerFooter.${position}Content`) }}</span>
            <input
              v-model="activeSection[position]"
              class="min-h-9 w-full rounded-md border border-border bg-muted/35 px-2.5 py-[9px] text-[11px] leading-[1.55] text-foreground outline-2 outline-transparent focus:border-ring/55 focus:outline-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!activeSection.enabled"
              :placeholder="t(`editor.document.headerFooter.${position}Placeholder`)"
              type="text"
            />
          </label>
        </div>

        <div class="grid gap-2">
          <span class="text-[11px] font-semibold text-foreground">{{ t('editor.document.headerFooter.alignment') }}</span>
          <div class="grid grid-cols-3 gap-1" role="group">
            <button
              v-for="alignment in alignments"
              :key="alignment"
              :aria-pressed="activeSection.alignment === alignment"
              :class="[
                'h-8 rounded-[5px] text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                activeSection.alignment === alignment && 'bg-accent text-foreground',
              ]"
              :disabled="!activeSection.enabled"
              type="button"
              @click="activeSection.alignment = alignment"
            >
              {{ t(`editor.document.headerFooter.${alignment}`) }}
            </button>
          </div>
        </div>

        <label class="flex items-center justify-between gap-[18px] text-[11px] text-muted-foreground">
          <span>{{ t('editor.document.headerFooter.firstPage') }}</span>
          <input
            v-model="activeSection.firstPage"
            class="h-[18px] w-[34px] flex-none cursor-pointer appearance-none rounded-full bg-muted outline-none transition-colors before:my-0.5 before:ml-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:bg-background before:shadow-[0_0_0_1px_hsl(var(--foreground)/.12)] before:transition-transform before:content-[''] checked:bg-primary checked:before:translate-x-4 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!activeSection.enabled"
            type="checkbox"
          />
        </label>

        <label v-if="section === 'footer'" class="flex items-center justify-between gap-[18px] text-[11px] text-muted-foreground">
          <span>{{ t('editor.document.headerFooter.pageNumber') }}</span>
          <input
            v-model="draft.footer.showPageNumber"
            class="h-[18px] w-[34px] flex-none cursor-pointer appearance-none rounded-full bg-muted outline-none transition-colors before:my-0.5 before:ml-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:bg-background before:shadow-[0_0_0_1px_hsl(var(--foreground)/.12)] before:transition-transform before:content-[''] checked:bg-primary checked:before:translate-x-4 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!draft.footer.enabled"
            type="checkbox"
          />
        </label>
      </div>

      <footer class="flex min-h-14 items-center justify-end gap-2 border-t border-border px-3.5 py-2.5">
        <button class="h-8 rounded-md bg-accent px-[13px] text-[11px] text-foreground outline-none hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring" type="button" @click="emit('close')">
          {{ t('editor.document.headerFooter.cancel') }}
        </button>
        <button class="h-8 rounded-md bg-primary px-[13px] text-[11px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring" type="button" @click="save">
          {{ t('editor.document.headerFooter.apply') }}
        </button>
      </footer>
    </div>
  </div>
</template>
